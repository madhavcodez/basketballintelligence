import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb, getSchemaDescription } from '@/lib/db';
import { config } from '@/lib/config';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// ─── Schema context for Gemini ──────────────────────────────────────────────
// Computed once at module level so we only hit the DB on first request.
let _schemaCache: string | null = null;
function getDbSchema(): string {
  if (!_schemaCache) {
    _schemaCache = getSchemaDescription();
  }
  return _schemaCache;
}

function buildDbSchema(): string {
  return `SQLite basketball database. Tables:\n${getDbSchema()}\n\nKey notes:\n- Season in player_stats tables is integer like 2024 (representing 2023-24 season)\n- Season in shots table is string like "2023-24"\n- Season in team_stats_advanced is string like "2024-25"\n- Team abbreviations: LAL, BOS, GSW, MIL, etc.\n- Player names are full names like "LeBron James", "Stephen Curry"\n- "3P" and "3PA" and "3PPct" columns must be quoted in SQL\n- SHOT_MADE_FLAG is 0 or 1\n- career_leaders stat values: 'pts', 'trb', 'ast', 'stl', 'blk', etc.\n- For percentile calculations, use PERCENT_RANK() or NTILE() window functions\n- For streaks and records, use window functions like ROW_NUMBER(), LAG(), LEAD()\n- For head-to-head matchups, join player_stats_pergame on Season and compare`;
}

function buildSystemPrompt(): string {
  return `You are a basketball analytics AI assistant. You help users explore NBA data by generating SQLite queries.

${buildDbSchema()}

RULES:
1. Generate ONLY SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Always use parameterized-safe SQL (no user-injected values in the query itself for column/table names).
3. LIMIT results to 25 rows max unless the user asks for more.
4. When comparing players, return data for both in one query or two separate queries.
5. For percentage columns, multiply by 100 for display if they're stored as decimals (0.0-1.0).
6. Always include player/team names in results for context.
7. Use CAST(column as FLOAT) for numeric comparisons and sorting.
8. Quote column names with special characters: "3P", "3PA", "3PPct".
9. For career/all-time queries, use the career_leaders table when possible.
10. For shot zone queries, group by SHOT_ZONE_BASIC and calculate FG% as AVG(SHOT_MADE_FLAG).
11. For percentile queries, use PERCENT_RANK() OVER (ORDER BY ...) window functions.
12. For streak queries, use ROW_NUMBER() or consecutive-group techniques with window functions.
13. For head-to-head comparisons, join on the same Season to compare overlapping years.

INTENT GUIDE (use the most specific intent that matches the query):
- player_stats: Individual player stats, season averages, career averages
- comparison: Side-by-side comparison of two or more players
- leaders: Current season leaders in a stat category
- team_stats: Team-level stats, roster data
- shot_analysis: Shot chart data, shot types, make/miss patterns
- trivia: Fun facts, obscure stats
- general: General basketball questions answerable from the data
- awards: MVP, DPOY, ROY, All-NBA, All-Star, and other award queries
- draft: Draft picks, draft class data, college pipeline analysis
- lineups: Lineup combinations and their effectiveness (proxy via advanced stats)
- tracking: Player tracking data — speed, drives, touches, distance
- team_comparison: Comparing two or more teams on advanced or traditional metrics
- historical: All-time records, highest single-season marks, historical firsts
- streaks_records: Consecutive game streaks, record-breaking runs
- game_logs: Individual game-by-game performances, recent games
- percentiles: Where a player ranks relative to peers (percentile-based)
- career_leaders: All-time career totals leaders
- shot_zones: Shot zone breakdowns and efficiency by zone
- matchups: Head-to-head player or team comparisons across overlapping seasons
- milestones: Players approaching or having reached career milestones

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact format:
{
  "intent": "one of: player_stats, comparison, leaders, team_stats, shot_analysis, trivia, general, awards, draft, lineups, tracking, team_comparison, historical, streaks_records, game_logs, percentiles, career_leaders, shot_zones, matchups, milestones",
  "title": "Short descriptive title for the result",
  "explanation": "1-2 sentence basketball-smart explanation of what this data shows",
  "sql": "The SQL query to execute",
  "chartType": "one of: table, bar, comparison, none",
  "columns": ["column1", "column2"],
  "followUps": ["suggested follow-up question 1", "suggested follow-up question 2"]
}

If the question cannot be answered with the available data, respond:
{
  "intent": "unsupported",
  "title": "Cannot answer",
  "explanation": "Brief explanation of why",
  "sql": null,
  "chartType": "none",
  "columns": [],
  "followUps": ["alternative question 1", "alternative question 2"]
}

IMPORTANT: Respond with ONLY the JSON object, no markdown, no code blocks, no extra text.`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeminiResponse {
  readonly intent: string;
  readonly title: string;
  readonly explanation: string;
  readonly sql: string | null;
  readonly chartType: string;
  readonly columns: readonly string[];
  readonly followUps: readonly string[];
}

interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeSql(sql: string): string | null {
  // Strip to first statement only, reject multi-statement inputs
  const firstStatement = sql.split(';')[0].trim();
  if (!firstStatement) return null;

  // Normalize all whitespace (tabs, newlines, comments) to single spaces for scanning
  const normalized = firstStatement.toUpperCase().replace(/[\s]+/g, ' ').trim();

  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return null;
  }

  // Reject any dangerous keyword using word-boundary regex
  const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|EXEC|EXECUTE)\b/;
  if (FORBIDDEN.test(normalized)) {
    return null;
  }

  return firstStatement;
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body as {
      message: string;
      history?: readonly ChatMessage[];
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > config.gemini.maxMessageLength) {
      return NextResponse.json(
        { error: `Message too long (max ${config.gemini.maxMessageLength} characters)` },
        { status: 400 }
      );
    }

    const genAI = getGeminiClient();
    if (!genAI) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    // Build conversation context
    const conversationHistory = (history ?? []).slice(-6).map((msg: ChatMessage) => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: { role: 'user', parts: [{ text: buildSystemPrompt() }] },
      generationConfig: {
        temperature: config.gemini.temperature,
        maxOutputTokens: config.gemini.maxOutputTokens,
      },
    });

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: 'You are a basketball analytics AI. Follow the system instructions exactly.' }] },
        { role: 'model', parts: [{ text: 'Understood. I will generate SQLite queries for basketball data analysis and respond in the specified JSON format.' }] },
        ...conversationHistory,
      ],
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text().trim();

    // Parse Gemini's JSON response
    let parsed: GeminiResponse;
    try {
      // Strip markdown code blocks if present
      const cleaned = responseText
        .replace(/^```json?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        intent: 'error',
        title: 'AI Response Error',
        explanation: 'The AI generated an invalid response. Please try rephrasing your question.',
        data: null,
        columns: [],
        chartType: 'none',
        followUps: ['Who are the top scorers this season?', 'Compare LeBron James vs Kevin Durant'],
      });
    }

    // If no SQL, return the explanation directly
    if (!parsed.sql || parsed.intent === 'unsupported') {
      return NextResponse.json({
        intent: parsed.intent,
        title: parsed.title,
        explanation: parsed.explanation,
        data: null,
        columns: parsed.columns ?? [],
        chartType: parsed.chartType ?? 'none',
        followUps: parsed.followUps ?? [],
      });
    }

    // Sanitize SQL
    const safeSql = sanitizeSql(parsed.sql);
    if (!safeSql) {
      return NextResponse.json({
        intent: 'error',
        title: 'Safety Check Failed',
        explanation: 'The generated query was blocked for safety. Only read-only queries are allowed.',
        data: null,
        columns: [],
        chartType: 'none',
        followUps: ['Who led the league in scoring last season?', 'Show me the top 10 assists leaders'],
      });
    }

    // Execute the query
    const db = getDb();
    let rows: readonly Record<string, unknown>[];
    try {
      rows = db.prepare(safeSql).all() as Record<string, unknown>[];
    } catch (dbErr) {
      const errMessage = dbErr instanceof Error ? dbErr.message : 'Unknown database error';
      return NextResponse.json({
        intent: 'error',
        title: 'Query Error',
        explanation: process.env.NODE_ENV === 'development'
          ? `Database query failed: ${errMessage}. Try rephrasing your question.`
          : 'The query could not be executed. Try rephrasing your question.',
        data: null,
        columns: [],
        chartType: 'none',
        followUps: ['Who are the top scorers?', 'Show me LeBron James career stats'],
        debug: process.env.NODE_ENV === 'development' ? { sql: safeSql, error: errMessage } : undefined,
      });
    }

    // Extract column names from results
    const columns = rows.length > 0
      ? Object.keys(rows[0])
      : (parsed.columns as string[] ?? []);

    return NextResponse.json({
      intent: parsed.intent,
      title: parsed.title,
      explanation: parsed.explanation,
      data: rows.slice(0, 50),
      columns,
      chartType: parsed.chartType ?? 'table',
      followUps: parsed.followUps ?? [],
      rowCount: rows.length,
    });
  } catch (e) { return handleApiError(e, 'agentic-chat'); }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '@/lib/db';

// ─── Schema context for Gemini ──────────────────────────────────────────────

const DB_SCHEMA = `
SQLite database with these tables:

1. players (Player TEXT, HOF TEXT, Active TEXT, "From" INT, "To" INT, Pos TEXT, Height TEXT, Weight REAL, BirthDate TEXT, College TEXT, player_id INT)
2. player_stats_pergame (Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT, G REAL, GS REAL, MP REAL, FG REAL, FGA REAL, FGPct REAL, "3P" REAL, "3PA" REAL, "3PPct" REAL, "2P" REAL, "2PA" REAL, "2PPct" REAL, eFGPct REAL, FT REAL, FTA REAL, FTPct REAL, ORB REAL, DRB REAL, TRB REAL, AST REAL, STL REAL, BLK REAL, TOV REAL, PF REAL, PTS REAL, Awards TEXT)
3. player_stats_advanced (Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT, G REAL, MP REAL, PER REAL, TSPct REAL, "3PAr" REAL, FTr REAL, ORBPct REAL, DRBPct REAL, TRBPct REAL, ASTPct REAL, STLPct REAL, BLKPct REAL, TOVPct REAL, USGPct REAL, OWS REAL, DWS REAL, WS REAL, WS48 REAL, OBPM REAL, DBPM REAL, BPM REAL, VORP REAL)
4. shots (GAME_ID INT, PLAYER_NAME TEXT, TEAM_NAME TEXT, PERIOD INT, EVENT_TYPE TEXT, ACTION_TYPE TEXT, SHOT_TYPE TEXT, SHOT_ZONE_BASIC TEXT, SHOT_ZONE_AREA TEXT, SHOT_ZONE_RANGE TEXT, SHOT_DISTANCE INT, LOC_X INT, LOC_Y INT, SHOT_MADE_FLAG INT, GAME_DATE TEXT, season TEXT)
5. team_traditional_regular (team_id TEXT, team_name TEXT, gp TEXT, w TEXT, l TEXT, w_pct TEXT, pts TEXT, reb TEXT, ast TEXT, stl TEXT, blk TEXT, fg_pct TEXT, fg3_pct TEXT, ft_pct TEXT, season TEXT)
6. team_stats_advanced (Season TEXT, TEAM_NAME TEXT, GP INT, W INT, L INT, OFF_RATING REAL, DEF_RATING REAL, NET_RATING REAL, PACE REAL, TS_PCT REAL, EFG_PCT REAL, TEAM_ID TEXT)
7. standings (Season TEXT, Conference TEXT, Rank INT, Team TEXT, W INT, L INT, PCT REAL, GB TEXT, PPG REAL, OPP_PPG REAL, DIFF REAL)
8. awards (Player TEXT, award_type TEXT, Season TEXT, Tm TEXT)
9. draft (Year INT, Rk INT, Pk INT, Player TEXT, Tm TEXT, College TEXT)
11. career_leaders (Rank REAL, Player TEXT, HOF TEXT, Active TEXT, Value INT, stat TEXT, league TEXT)
12. tracking (Season TEXT, PLAYER_NAME TEXT, TEAM_ABBREVIATION TEXT, GP INT, various shooting/driving/passing/speed metrics)
13. player_game_logs (SEASON_ID TEXT, PLAYER_NAME TEXT, GAME_DATE TEXT, PTS INT, REB INT, AST INT, STL INT, BLK INT, etc.)

Key notes:
- Season in player_stats tables is integer like 2024 (representing 2023-24 season)
- Season in shots table is string like "2023-24"
- Team abbreviations: LAL, BOS, GSW, MIL, etc.
- Player names are full names like "LeBron James", "Stephen Curry"
- "3P" and "3PA" and "3PPct" columns must be quoted in SQL
- SHOT_MADE_FLAG is 0 or 1
- career_leaders stat values: 'pts', 'trb', 'ast', 'stl', 'blk', etc.
`;

const SYSTEM_PROMPT = `You are a basketball analytics AI assistant. You help users explore NBA data by generating SQLite queries.

${DB_SCHEMA}

RULES:
1. Generate ONLY SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Always use parameterized-safe SQL (no user-injected values in the query itself for column/table names).
3. LIMIT results to 25 rows max unless the user asks for more.
4. When comparing players, return data for both in one query or two separate queries.
5. For percentage columns, multiply by 100 for display if they're stored as decimals (0.0-1.0).
6. Always include player/team names in results for context.
7. Use CAST(column as FLOAT) for numeric comparisons and sorting.
8. Quote column names with special characters: "3P", "3PA", "3PPct".

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact format:
{
  "intent": "one of: player_stats, comparison, leaders, team_stats, shot_analysis, trivia, general",
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
  const upper = sql.toUpperCase().trim();
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM'];
  for (const keyword of forbidden) {
    if (upper.startsWith(keyword) || upper.includes(` ${keyword} `) || upper.includes(`;${keyword}`)) {
      return null;
    }
  }
  // Must start with SELECT or WITH
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return null;
  }
  // Remove trailing semicolons and any subsequent statements
  const cleaned = sql.split(';')[0].trim();
  return cleaned;
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

    if (message.length > 500) {
      return NextResponse.json(
        { error: 'Message too long (max 500 characters)' },
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
      model: 'gemini-2.5-flash',
      systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
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
        explanation: `Database query failed: ${errMessage}. Try rephrasing your question.`,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Agentic API Error]', message);
    return NextResponse.json(
      { error: 'Failed to process request', details: message },
      { status: 500 }
    );
  }
}

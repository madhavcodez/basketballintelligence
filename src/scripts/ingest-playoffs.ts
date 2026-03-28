#!/usr/bin/env npx tsx
/**
 * Playoff Data Ingestion Script
 * Run: npx tsx src/scripts/ingest-playoffs.ts
 *
 * Checks ~/basketball_data/ for playoff CSV files and ingests them
 * into the SQLite database at data/basketball.db.
 *
 * This is a standalone CLI tool that opens the DB in read-write mode.
 * The main app opens the DB as readonly.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Types ───────────────────────────────────────────────────────────────────

interface TableConfig {
  readonly tableName: string;
  readonly filePattern: RegExp;
  readonly createSql: string;
  readonly columns: readonly string[];
  readonly headerMap: ReadonlyMap<string, string>;
  readonly addSeasonFromFilename: boolean;
}

interface IngestionResult {
  readonly tableName: string;
  readonly fileName: string;
  readonly rowsInserted: number;
  readonly rowsSkipped: number;
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line, handling quoted fields that may contain commas.
 * Returns an array of field values.
 */
function parseCsvLine(line: string): readonly string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse a CSV file into an array of rows, each represented as a
 * Map from header name to field value.
 */
function parseCsvFile(filePath: string): {
  readonly headers: readonly string[];
  readonly rows: ReadonlyArray<ReadonlyMap<string, string>>;
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Array<ReadonlyMap<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const row = new Map<string, string>();
    for (let j = 0; j < headers.length; j++) {
      const value = j < fields.length ? fields[j] : '';
      row.set(headers[j], value);
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ── Value conversion ────────────────────────────────────────────────────────

/**
 * Convert a string value to a typed value suitable for SQLite insertion.
 * Empty strings and common null indicators become null.
 * Numeric strings become numbers.
 * Everything else stays as a string.
 */
function toSqliteValue(value: string): string | number | null {
  if (value === '' || value === 'NA' || value === 'N/A' || value === 'nan') {
    return null;
  }

  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== '') {
    return num;
  }

  return value;
}

// ── Season extraction ───────────────────────────────────────────────────────

/**
 * Extract a "YYYY-YY" season string from a filename containing "YYYY_YY".
 * Falls back to a bare 4-digit year if no two-part match is found.
 */
function seasonFromFilename(filename: string): string {
  const twoPartMatch = filename.match(/(\d{4})_(\d{2})/);
  if (twoPartMatch) {
    return `${twoPartMatch[1]}-${twoPartMatch[2]}`;
  }
  const yearMatch = filename.match(/(\d{4})/);
  if (yearMatch) {
    return yearMatch[1];
  }
  return 'unknown';
}

// ── Header mapping ──────────────────────────────────────────────────────────

/**
 * Build header maps for Basketball Reference CSV headers to DB column names.
 * BBRef uses headers like "FG%", "3P%", etc. that must be mapped to
 * the column names used in the database schema.
 */
function buildPerGameHeaderMap(): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['Season', 'Season'],
    ['Player', 'Player'],
    ['Age', 'Age'],
    ['Tm', 'Tm'],
    ['Pos', 'Pos'],
    ['G', 'G'],
    ['GS', 'GS'],
    ['MP', 'MP'],
    ['FG', 'FG'],
    ['FGA', 'FGA'],
    ['FG%', 'FGPct'],
    ['FGPct', 'FGPct'],
    ['3P', '3P'],
    ['3PA', '3PA'],
    ['3P%', '3PPct'],
    ['3PPct', '3PPct'],
    ['2P', '2P'],
    ['2PA', '2PA'],
    ['2P%', '2PPct'],
    ['2PPct', '2PPct'],
    ['eFG%', 'eFGPct'],
    ['eFGPct', 'eFGPct'],
    ['FT', 'FT'],
    ['FTA', 'FTA'],
    ['FT%', 'FTPct'],
    ['FTPct', 'FTPct'],
    ['ORB', 'ORB'],
    ['DRB', 'DRB'],
    ['TRB', 'TRB'],
    ['AST', 'AST'],
    ['STL', 'STL'],
    ['BLK', 'BLK'],
    ['TOV', 'TOV'],
    ['PF', 'PF'],
    ['PTS', 'PTS'],
    ['Awards', 'Awards'],
  ]);
}

function buildAdvancedHeaderMap(): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['Season', 'Season'],
    ['Player', 'Player'],
    ['Age', 'Age'],
    ['Tm', 'Tm'],
    ['Pos', 'Pos'],
    ['G', 'G'],
    ['MP', 'MP'],
    ['PER', 'PER'],
    ['TS%', 'TSPct'],
    ['TSPct', 'TSPct'],
    ['3PAr', '3PAr'],
    ['FTr', 'FTr'],
    ['ORB%', 'ORBPct'],
    ['ORBPct', 'ORBPct'],
    ['DRB%', 'DRBPct'],
    ['DRBPct', 'DRBPct'],
    ['TRB%', 'TRBPct'],
    ['TRBPct', 'TRBPct'],
    ['AST%', 'ASTPct'],
    ['ASTPct', 'ASTPct'],
    ['STL%', 'STLPct'],
    ['STLPct', 'STLPct'],
    ['BLK%', 'BLKPct'],
    ['BLKPct', 'BLKPct'],
    ['TOV%', 'TOVPct'],
    ['TOVPct', 'TOVPct'],
    ['USG%', 'USGPct'],
    ['USGPct', 'USGPct'],
    ['OWS', 'OWS'],
    ['DWS', 'DWS'],
    ['WS', 'WS'],
    ['WS/48', 'WS48'],
    ['WS48', 'WS48'],
    ['OBPM', 'OBPM'],
    ['DBPM', 'DBPM'],
    ['BPM', 'BPM'],
    ['VORP', 'VORP'],
  ]);
}

function buildShotsHeaderMap(): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['GAME_ID', 'GAME_ID'],
    ['PLAYER_NAME', 'PLAYER_NAME'],
    ['TEAM_NAME', 'TEAM_NAME'],
    ['PERIOD', 'PERIOD'],
    ['EVENT_TYPE', 'EVENT_TYPE'],
    ['ACTION_TYPE', 'ACTION_TYPE'],
    ['SHOT_TYPE', 'SHOT_TYPE'],
    ['SHOT_ZONE_BASIC', 'SHOT_ZONE_BASIC'],
    ['SHOT_ZONE_AREA', 'SHOT_ZONE_AREA'],
    ['SHOT_ZONE_RANGE', 'SHOT_ZONE_RANGE'],
    ['SHOT_DISTANCE', 'SHOT_DISTANCE'],
    ['LOC_X', 'LOC_X'],
    ['LOC_Y', 'LOC_Y'],
    ['SHOT_MADE_FLAG', 'SHOT_MADE_FLAG'],
    ['GAME_DATE', 'GAME_DATE'],
    ['season', 'season'],
  ]);
}

// ── Table configurations ────────────────────────────────────────────────────

const TABLE_CONFIGS: readonly TableConfig[] = [
  {
    tableName: 'player_stats_playoffs_pergame',
    filePattern: /^player_playoffs_pergame[_.].*\.csv$/i,
    createSql: `CREATE TABLE IF NOT EXISTS player_stats_playoffs_pergame (
      Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT,
      G REAL, GS REAL, MP REAL, FG REAL, FGA REAL, FGPct REAL,
      "3P" REAL, "3PA" REAL, "3PPct" REAL, "2P" REAL, "2PA" REAL, "2PPct" REAL,
      eFGPct REAL, FT REAL, FTA REAL, FTPct REAL,
      ORB REAL, DRB REAL, TRB REAL, AST REAL, STL REAL, BLK REAL,
      TOV REAL, PF REAL, PTS REAL, Awards TEXT
    )`,
    columns: [
      'Season', 'Player', 'Age', 'Tm', 'Pos',
      'G', 'GS', 'MP', 'FG', 'FGA', 'FGPct',
      '3P', '3PA', '3PPct', '2P', '2PA', '2PPct', 'eFGPct',
      'FT', 'FTA', 'FTPct',
      'ORB', 'DRB', 'TRB', 'AST', 'STL', 'BLK',
      'TOV', 'PF', 'PTS', 'Awards',
    ],
    headerMap: buildPerGameHeaderMap(),
    addSeasonFromFilename: false,
  },
  {
    tableName: 'player_stats_playoffs_advanced',
    filePattern: /^player_playoffs_advanced[_.].*\.csv$/i,
    createSql: `CREATE TABLE IF NOT EXISTS player_stats_playoffs_advanced (
      Season INT, Player TEXT, Age REAL, Tm TEXT, Pos TEXT,
      G REAL, MP REAL, PER REAL, TSPct REAL, "3PAr" REAL, FTr REAL,
      ORBPct REAL, DRBPct REAL, TRBPct REAL, ASTPct REAL, STLPct REAL,
      BLKPct REAL, TOVPct REAL, USGPct REAL,
      OWS REAL, DWS REAL, WS REAL, WS48 REAL,
      OBPM REAL, DBPM REAL, BPM REAL, VORP REAL
    )`,
    columns: [
      'Season', 'Player', 'Age', 'Tm', 'Pos',
      'G', 'MP', 'PER', 'TSPct', '3PAr', 'FTr',
      'ORBPct', 'DRBPct', 'TRBPct', 'ASTPct', 'STLPct',
      'BLKPct', 'TOVPct', 'USGPct',
      'OWS', 'DWS', 'WS', 'WS48',
      'OBPM', 'DBPM', 'BPM', 'VORP',
    ],
    headerMap: buildAdvancedHeaderMap(),
    addSeasonFromFilename: false,
  },
  {
    tableName: 'shots_playoffs',
    filePattern: /^nba_shot_?chart_playoffs[_.].*\.csv$/i,
    createSql: `CREATE TABLE IF NOT EXISTS shots_playoffs (
      GAME_ID INT, PLAYER_NAME TEXT, TEAM_NAME TEXT, PERIOD INT,
      EVENT_TYPE TEXT, ACTION_TYPE TEXT, SHOT_TYPE TEXT,
      SHOT_ZONE_BASIC TEXT, SHOT_ZONE_AREA TEXT, SHOT_ZONE_RANGE TEXT,
      SHOT_DISTANCE INT, LOC_X INT, LOC_Y INT, SHOT_MADE_FLAG INT,
      GAME_DATE TEXT, season TEXT
    )`,
    columns: [
      'GAME_ID', 'PLAYER_NAME', 'TEAM_NAME', 'PERIOD',
      'EVENT_TYPE', 'ACTION_TYPE', 'SHOT_TYPE',
      'SHOT_ZONE_BASIC', 'SHOT_ZONE_AREA', 'SHOT_ZONE_RANGE',
      'SHOT_DISTANCE', 'LOC_X', 'LOC_Y', 'SHOT_MADE_FLAG',
      'GAME_DATE', 'season',
    ],
    headerMap: buildShotsHeaderMap(),
    addSeasonFromFilename: true,
  },
  {
    tableName: 'standings_playoffs',
    filePattern: /^nba_standings_playoffs[_.].*\.csv$/i,
    createSql: `CREATE TABLE IF NOT EXISTS standings_playoffs (
      Season INT, Conference TEXT, Rank INT, Team TEXT,
      W INT, L INT, PCT REAL, GB TEXT,
      PPG REAL, OPP_PPG REAL, DIFF REAL
    )`,
    columns: [
      'Season', 'Conference', 'Rank', 'Team',
      'W', 'L', 'PCT', 'GB',
      'PPG', 'OPP_PPG', 'DIFF',
    ],
    headerMap: new Map<string, string>([
      ['Season', 'Season'],
      ['Conference', 'Conference'],
      ['Rank', 'Rank'],
      ['Team', 'Team'],
      ['W', 'W'],
      ['L', 'L'],
      ['PCT', 'PCT'],
      ['GB', 'GB'],
      ['PPG', 'PPG'],
      ['OPP_PPG', 'OPP_PPG'],
      ['DIFF', 'DIFF'],
    ]),
    addSeasonFromFilename: false,
  },
];

// ── Index definitions ───────────────────────────────────────────────────────

const INDEXES: readonly string[] = [
  'CREATE INDEX IF NOT EXISTS idx_playoffs_pergame_player ON player_stats_playoffs_pergame(Player, Season)',
  'CREATE INDEX IF NOT EXISTS idx_playoffs_advanced_player ON player_stats_playoffs_advanced(Player, Season)',
  'CREATE INDEX IF NOT EXISTS idx_playoffs_shots_player ON shots_playoffs(PLAYER_NAME, season)',
  'CREATE INDEX IF NOT EXISTS idx_playoffs_shots_season_zone ON shots_playoffs(season, SHOT_ZONE_BASIC, SHOT_ZONE_AREA)',
  'CREATE INDEX IF NOT EXISTS idx_playoffs_standings_season ON standings_playoffs(Season)',
];

// ── File discovery ──────────────────────────────────────────────────────────

interface MatchedFile {
  readonly filePath: string;
  readonly fileName: string;
  readonly config: TableConfig;
}

function discoverFiles(sourceDir: string): readonly MatchedFile[] {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  const allFiles = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.csv'));
  const matched: MatchedFile[] = [];

  for (const fileName of allFiles) {
    // Skip duplicate downloads like "file (1).csv"
    if (/\(\d+\)/.test(fileName)) {
      continue;
    }

    for (const config of TABLE_CONFIGS) {
      if (config.filePattern.test(fileName)) {
        matched.push({
          filePath: path.join(sourceDir, fileName),
          fileName,
          config,
        });
        break;
      }
    }
  }

  return matched;
}

// ── Row mapping ─────────────────────────────────────────────────────────────

/**
 * Map a parsed CSV row to an array of values aligned with the table columns.
 * Uses the header map to translate CSV header names to DB column names.
 * Returns null if the row has no usable data (all values empty).
 */
function mapRow(
  csvRow: ReadonlyMap<string, string>,
  config: TableConfig,
  seasonOverride: string | null,
): ReadonlyArray<string | number | null> | null {
  const values: Array<string | number | null> = [];
  let hasData = false;

  for (const dbColumn of config.columns) {
    // For shot chart CSVs, inject the season from the filename
    if (dbColumn === 'season' && config.addSeasonFromFilename && seasonOverride !== null) {
      // Check if the CSV already has a 'season' field
      const csvValue = findCsvValue(csvRow, dbColumn, config.headerMap);
      if (csvValue !== null && csvValue !== '') {
        values.push(csvValue);
        hasData = true;
      } else {
        values.push(seasonOverride);
        hasData = true;
      }
      continue;
    }

    const csvValue = findCsvValue(csvRow, dbColumn, config.headerMap);
    if (csvValue !== null) {
      const converted = toSqliteValue(csvValue);
      values.push(converted);
      if (converted !== null) {
        hasData = true;
      }
    } else {
      values.push(null);
    }
  }

  return hasData ? values : null;
}

/**
 * Find the CSV field value for a given DB column name by checking the header map
 * in reverse (DB column name -> CSV header name).
 */
function findCsvValue(
  csvRow: ReadonlyMap<string, string>,
  dbColumn: string,
  headerMap: ReadonlyMap<string, string>,
): string | null {
  // Direct lookup: the CSV header might match the DB column exactly
  if (csvRow.has(dbColumn)) {
    return csvRow.get(dbColumn) ?? null;
  }

  // Reverse lookup: find CSV headers that map to this DB column
  for (const [csvHeader, mappedColumn] of headerMap) {
    if (mappedColumn === dbColumn && csvRow.has(csvHeader)) {
      return csvRow.get(csvHeader) ?? null;
    }
  }

  return null;
}

// ── Ingestion ───────────────────────────────────────────────────────────────

function ingestFile(
  db: Database.Database,
  matched: MatchedFile,
): IngestionResult {
  const { filePath, fileName, config } = matched;

  // Create the table
  db.exec(config.createSql);

  // Clear existing data for idempotency
  db.exec(`DELETE FROM "${config.tableName}"`);

  // Parse CSV
  const { rows } = parseCsvFile(filePath);

  // Determine season from filename for shot chart files
  const seasonOverride = config.addSeasonFromFilename
    ? seasonFromFilename(fileName)
    : null;

  // Build prepared INSERT statement
  const placeholders = config.columns.map(() => '?').join(', ');
  const quotedColumns = config.columns.map((c) => `"${c}"`).join(', ');
  const insertStmt = db.prepare(
    `INSERT INTO "${config.tableName}" (${quotedColumns}) VALUES (${placeholders})`
  );

  let rowsInserted = 0;
  let rowsSkipped = 0;

  // Use a transaction for performance
  const insertAll = db.transaction(
    (dataRows: ReadonlyArray<ReadonlyMap<string, string>>) => {
      for (const csvRow of dataRows) {
        try {
          const values = mapRow(csvRow, config, seasonOverride);
          if (values === null) {
            rowsSkipped++;
            continue;
          }
          insertStmt.run(...values);
          rowsInserted++;
        } catch {
          rowsSkipped++;
        }
      }
    }
  );

  insertAll(rows);

  return {
    tableName: config.tableName,
    fileName,
    rowsInserted,
    rowsSkipped,
  };
}

function createIndexes(db: Database.Database, createdTables: ReadonlySet<string>): void {
  for (const sql of INDEXES) {
    // Only create indexes for tables that were actually populated
    const tableMatch = sql.match(/ON\s+(\w+)\(/);
    if (tableMatch && !createdTables.has(tableMatch[1])) {
      continue;
    }

    try {
      db.exec(sql);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.info(`  [WARN] Index creation failed: ${message}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const separator = '='.repeat(60);
  console.info(separator);
  console.info('Basketball Intelligence - Playoff Data Ingestion');
  console.info(separator);

  // Resolve paths
  // Check multiple possible data locations
  const candidates = [
    path.join(os.homedir(), 'Downloads', 'basketball_data', 'processed', 'playoffs'),
    path.join(os.homedir(), 'basketball_data'),
    path.join(os.homedir(), 'Downloads', 'sportsdata'),
  ];
  const sourceDir = candidates.find(d => fs.existsSync(d)) ?? candidates[0];
  const projectRoot = path.resolve(__dirname, '..', '..');
  const dbPath = path.join(projectRoot, 'data', 'basketball.db');

  console.info(`Source:  ${sourceDir}`);
  console.info(`Target:  ${dbPath}`);
  console.info('');

  // Validate source directory
  if (!fs.existsSync(sourceDir)) {
    console.info(`[ERROR] Source directory not found: ${sourceDir}`);
    console.info('');
    console.info('Create ~/basketball_data/ and place playoff CSV files there:');
    console.info('  - player_playoffs_pergame_*.csv');
    console.info('  - player_playoffs_advanced_*.csv');
    console.info('  - nba_shot_chart_playoffs_*.csv');
    console.info('  - nba_standings_playoffs_*.csv');
    process.exit(1);
  }

  // Validate database exists
  if (!fs.existsSync(dbPath)) {
    console.info(`[ERROR] Database not found: ${dbPath}`);
    console.info('Run the main ingestion script first to create the database.');
    process.exit(1);
  }

  // Discover matching files
  const matchedFiles = discoverFiles(sourceDir);

  if (matchedFiles.length === 0) {
    console.info('[WARN] No matching playoff CSV files found in source directory.');
    console.info('');
    console.info('Expected file patterns:');
    for (const config of TABLE_CONFIGS) {
      console.info(`  - ${config.filePattern.source} -> ${config.tableName}`);
    }
    process.exit(0);
  }

  console.info(`Found ${matchedFiles.length} playoff CSV file(s):`);
  for (const mf of matchedFiles) {
    console.info(`  - ${mf.fileName} -> ${mf.config.tableName}`);
  }
  console.info('');

  // Open database in read-write mode
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -65536'); // 64MB cache

  try {
    const results: IngestionResult[] = [];
    const createdTables = new Set<string>();
    let totalRows = 0;

    for (const matched of matchedFiles) {
      console.info(`Ingesting ${matched.fileName} ...`);
      const result = ingestFile(db, matched);
      results.push(result);
      createdTables.add(result.tableName);
      totalRows += result.rowsInserted;
      console.info(
        `  -> ${result.tableName}: ${result.rowsInserted} rows inserted` +
        (result.rowsSkipped > 0 ? `, ${result.rowsSkipped} rows skipped` : '')
      );
    }

    // Create indexes
    console.info('');
    console.info('Creating indexes ...');
    createIndexes(db, createdTables);

    // Run ANALYZE for query planner
    db.exec('ANALYZE');

    // Summary
    console.info('');
    console.info(separator);
    console.info(`Done. ${totalRows} total rows inserted across ${createdTables.size} table(s).`);

    for (const result of results) {
      console.info(`  ${result.tableName}: ${result.rowsInserted} rows (${result.fileName})`);
    }
    console.info(separator);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.info(`[FATAL] ${message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();

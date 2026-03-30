import path from 'path';

export const config = {
  db: {
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'basketball.db'),
  },
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    maxMessageLength: 500,
    maxOutputTokens: 1024,
    temperature: 0.3,
  },
  cache: {
    static: 300,
    player: 120,
    search: 60,
    none: 0,
  },
} as const;

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "xp.sqlite");
const db = new Database(dbPath);

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  userId TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  totalXp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  voiceTime INTEGER DEFAULT 0,
  lastDailyXp INTEGER DEFAULT 0,
  lastDailyReset INTEGER DEFAULT 0
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS messages (
  messageId TEXT PRIMARY KEY,
  userId TEXT,
  xp INTEGER
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
)
`).run();

module.exports = db;

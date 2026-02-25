const Database = require("better-sqlite3");

const db = new Database("data.db");

// Таблица истории калькулятора
db.prepare(`
  CREATE TABLE IF NOT EXISTS calc_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    expr TEXT NOT NULL,
    result TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`).run();

module.exports = db;

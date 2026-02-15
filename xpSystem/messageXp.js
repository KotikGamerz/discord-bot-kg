const db = require("./database");

// cooldown в памяти
const cooldowns = new Map();

module.exports = async function messageXp(message) {

  // игнор ботов
  if (message.author.bot) return;

  // проверяем включена ли система XP
  const xpEnabled = db.prepare(
    "SELECT value FROM settings WHERE key = 'xp_enabled'"
  ).get();

  //if (!xpEnabled || xpEnabled.value !== "true") return;

  const userId = message.author.id;

  // ===== КУЛДАУН 60 сек =====
  const now = Date.now();
  const last = cooldowns.get(userId);

  if (last && now - last < 60000) return;

  cooldowns.set(userId, now);

  // ===== СЧИТАЕМ XP =====

  let content = message.content;

  // убираем ссылки
  content = content.replace(/https?:\/\/\S+/g, "");

  // если меньше 3 символов — игнор
  if (content.length < 3) return;

  // XP = длина сообщения, максимум 50
  let xp = Math.min(content.length, 50);

  // LOG (добавили)
  console.log(
    `[XP] ${message.author.tag} | +${xp} XP | "${message.content}"`
  );

  // ===== WEEKEND BOOST =====
  const weekend = db.prepare(
    "SELECT value FROM settings WHERE key = 'weekend_boost'"
  ).get();

  if (weekend?.value === "true") {
    xp *= 2;
  }

  // ===== DAILY LIMIT =====
  const user = db.prepare(
    "SELECT lastDailyXp FROM users WHERE userId=?"
  ).get(userId);

  if (user && user.lastDailyXp >= 6767) return;

  // ===== СОХРАНЯЕМ =====

  db.prepare(`
    INSERT INTO users(userId, xp, totalXp, level, lastDailyXp)
    VALUES(?, ?, ?, 0, ?)
    ON CONFLICT(userId) DO UPDATE SET
      xp = xp + ?,
      totalXp = totalXp + ?,
      lastDailyXp = lastDailyXp + ?
  `).run(userId, xp, xp, xp, xp, xp, xp);

  // для удаления XP при удалении сообщения
  db.prepare(`
    INSERT INTO messages(messageId, userId, xp)
    VALUES(?,?,?)
  `).run(message.id, userId, xp);

};

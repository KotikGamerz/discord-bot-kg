process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

const log = (type, msg) => {
  const time = new Date().toLocaleString();
  console.log(`[${time}] [${type}] ${msg}`);
};

global.logInfo = (msg) => log("INFO", msg);
global.logWarn = (msg) => log("WARN", msg);
global.logError = (msg) => log("ERROR", msg);

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const { MessageFlags } = require('discord.js');

const cron = require('node-cron');
const axios = require('axios');
const { calculate } = require("./utils/calcEngine");

const fs = require('fs');
const path = require('path');

require('dotenv').config();
require("./database");

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const express = require('express');

const sharp = require("sharp");
const https = require("https");
const translate = require('@vitalets/google-translate-api').translate;

const NIGHT_HEADERS = {
  authorization: process.env.NIGHT_API_KEY
};

// =======================================
// 🔧 ЗАГРУЗКА .ENV
// =======================================

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;

// =======================================
// ⚙ ОСНОВНЫЕ КОНСТАНТЫ
// =======================================

const OWNER_ID = "1167514315864162395";
const HNYC2_CONFIG_PATH = "hnyc2_config.json";
const STICK_CONFIG_PATH = "stick_config.json";
const HNYC_CONFIG_PATH = "hnyc_config.json";

let BOT_READY_AT = null;
const STARTUP_DELAY_SECONDS = 60p

// ==========================
// 🎄 ВЕЧЕРНИЕ НОВОГОДНИЕ СОВЕТЫ (заморожено до следующего НГ)
// ==========================

const HNYC_TIPS = [
  "🎄 Самое время включить новогоднюю музыку и немного расслабиться",
  "✨ Вспомни самый приятный момент этого года",
  "❄️ Даже если снега нет, зима уже чувствуется",
  "🕯 Создай уют: свет, тишина и покой",
  "🎁 Пора подумать, кого и чем ты хочешь порадовать",
  "📖 Отличный вечер, чтобы посмотреть любимый фильм",
  "🌟 Иногда достаточно просто остановиться и выдохнуть",
  "🎄 Новый год ближе, чем кажется",
  "🍪 Может, пора чем-нибудь вкусным себя побаловать?",
  "❄️ Маленькие радости — самые важные",
  "✨ Тёплый вечер — хороший повод побыть с близкими",
  "🎶 Включи музыку, которая поднимает настроение",
  "☕ Уют начинается с простых вещей",
  "🕯 Пусть этот вечер будет спокойным",
  "🎄 Уже совсем скоро всё изменится",
  "❄️ Зима — время тишины и мыслей",
  "✨ Пусть этот вечер будет добрым",
  "🎁 Даже ожидание праздника — уже праздник"
];

// ==========================
// ☀️ УТРЕННИЕ НОВОГОДНИЕ СОВЕТЫ (25.12 – 01.01) (заморожено)
// ==========================

const HNYC_MORNING_TIPS = [
  "❄️ Открой окно на минутку, вдохни свежий воздух и выбери одну маленькую цель на сегодня — остальное подтянется само. ✨",
  "☕ Собери уют: плед, тёплый напиток и спокойный темп — декабрь идеально подходит для такого старта. 🎄",
  "✨ Сделай мини-порядок на столе (буквально 30 секунд) — и в голове станет заметно свободнее.",
  "🌤️ Пара лёгких движений или короткая прогулка по комнате — тело проснётся, а настроение подтянется следом.",
  "🍪 Сегодня не нужно спешить: выбери любимый завтрак или перекус и устрой себе маленький утренний праздник. 🎁",
  "💛 Если захочется — напиши кому-нибудь «хорошего дня» или просто подумай о нём тепло. Это действительно работает."
];

// =======================================
// SAFE-SEND
// =======================================

async function safeSend(channel, text) {
  try {
    await channel.send(text);
    return true;
  } catch (error) {
    logError(error);
    return false;
  }
}

// =======================================
// 📁 HNYC — РАБОТА С КОНФИГОМ
// =======================================

function loadHnycConfig() {
  try {
    if (!fs.existsSync(HNYC_CONFIG_PATH)) throw new Error("Config not found");

    const data = fs.readFileSync(HNYC_CONFIG_PATH, "utf-8");
    return JSON.parse(data);

  } catch (error) {
    // дефолтный конфиг, если файла нет или битый
    return {
      enabled: false,              // включён ли countdown
      channel_id: null,            // канал для сообщений
      last_morning_date: null,     // дата последнего счётчика дней
      last_morning_tip_date: null, // дата последнего утреннего совета
      last_evening_date: null,     // дата последнего вечернего совета
      last_tip_index: null,        // индекс последнего совета
      special_31_sent: false,      // отправлено ли событие 31 декабря
      last_action_ts: null         // контроллер действий
    };
  }
}

function saveHnycConfig(cfg) {
  fs.writeFileSync(
    HNYC_CONFIG_PATH,
    JSON.stringify(cfg, null, 4),
    "utf-8"
  );
}

// 📁 HNYC конфиг — гарантируем наличие файла (создастся при первом запуске)
saveHnycConfig(loadHnycConfig());

// =======================================
// 📁 HNYC2 — РАБОТА С КОНФИГОМ (страны)
// =======================================

function loadHnyc2Config() {
  try {
    if (!fs.existsSync(HNYC2_CONFIG_PATH)) throw new Error('Config not found');
    const data = fs.readFileSync(HNYC2_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      enabled: false,
      channel_id: null,
      last_sent_hour: null,
      finished: false
    };
  }
}

function saveHnyc2Config(cfg) {
  fs.writeFileSync(
    HNYC2_CONFIG_PATH,
    JSON.stringify(cfg, null, 4),
    'utf-8'
  );
}

// 📁 HNYC2 конфиг — гарантируем наличие файла
saveHnyc2Config(loadHnyc2Config());

// =======================================
// СОЗДАНИЕ CLIENT (объявляем заранее, создадим ниже)
// =======================================
let client;

// =======================================
// ⏰ HNYC — ВРЕМЯ (GMT+3 / МОСКВА)
// =======================================

const MSK_TIMEZONE = "Europe/Moscow";

function nowMsk() {
  // возвращает объект dayjs с временем Москвы
  return dayjs().tz(MSK_TIMEZONE);
}

// =======================================
// ⏰ HNYC2 — ВРЕМЯ (Europe/Chisinau)
// =======================================

const EET_TIMEZONE = "Europe/Chisinau";
// HNYC2_CONFIG_PATH уже объявлен выше

function nowEet() {
  // текущее время по Кишинёву
  return dayjs().tz(EET_TIMEZONE);
}

// =======================================
// 🎆 HNYC2 — СТРАНЫ И GMT+2
// =======================================

// фиксированная зона GMT+2 (без сезонных скачков)
function nowGmt2() {
  return dayjs().utcOffset(120); // 120 минут = GMT+2
}

// словарь UTC → страны
const HNYC2_BY_UTC_OFFSET = {
  14: "🇰🇮 Кирибати (Острова Лайн, UTC+14)",
  13: "🇳🇿 Новая Зеландия (летнее время, UTC+13), 🇹🇴 Тонга, 🇼🇸 Самоа (часть)",
  12: "🇫🇯 Фиджи, 🇹🇻 Тувалу, 🇲🇭 Маршалловы Острова (UTC+12)",
  11: "🇸🇧 Соломоновы Острова, 🇻🇺 Вануату, 🇳🇨 Новая Каледония (UTC+11)",
  10: "🇦🇺 Австралия (восток), 🇵🇬 Папуа–Новая Гвинея (UTC+10)",
  9:  "🇯🇵 Япония, 🇰🇷 Южная Корея (UTC+9)",
  8:  "🇨🇳 Китай, 🇵🇭 Филиппины, 🇸🇬 Сингапур, 🇲🇾 Малайзия, 🇭🇰 Гонконг (UTC+8)",
  7:  "🇹🇭 Таиланд, 🇻🇳 Вьетнам, 🇰🇭 Камбоджа, 🇱🇦 Лаос (UTC+7)",
  6:  "🇧🇩 Бангладеш, 🇧🇹 Бутан (UTC+6)",
  5:  "🇵🇰 Пакистан (UTC+5) ⚠️ Индия — UTC+5:30",
  4:  "🇦🇪 ОАЭ, 🇴🇲 Оман (UTC+4)",
  3:  "🇷🇺 Россия (Москва), 🇧🇾 Беларусь, 🇹🇷 Турция (UTC+3)",
  2:  "🇲🇩 Молдова, 🇷🇴 Румыния, 🇺🇦 Украина, 🇬🇷 Греция (UTC+2)",
  1:  "🇩🇪 Германия, 🇫🇷 Франция, 🇪🇸 Испания, 🇮🇹 Италия (UTC+1)",
  0:  "🇬🇧 Великобритания, 🇵🇹 Португалия (UTC+0)",
 "-1":  "🇨🇻 Кабо-Верде (UTC-1)",
 "-2":  "🇧🇷 Бразилия (часть, UTC-2)",
 "-3":  "🇧🇷 Бразилия (восток), 🇦🇷 Аргентина, 🇺🇾 Уругвай (UTC-3)",
 "-4":  "🇨🇱 Чили, 🇧🇴 Боливия (UTC-4)",
 "-5":  "🇺🇸 США (восток), 🇨🇦 Канада (UTC-5)",
 "-6":  "🇺🇸 США (центр), 🇨🇦 Канада (UTC-6)",
 "-7":  "🇺🇸 США (гора), 🇨🇦 Канада (UTC-7)",
 "-8":  "🇺🇸 США (тихоокеанское), 🇨🇦 Канада (UTC-8)",
 "-9":  "🇺🇸 Аляска (UTC-9)",
 "-10": "🇵🇫 Французская Полинезия, 🇺🇸 Гавайи (UTC-10)",
 "-11": "🇦🇸 Американское Самоа (UTC-11)"
};

function utcOffsetForSlot(slotGmt2) {
  let off = (2 - slotGmt2.hour()) % 24;
  if (off > 14) off -= 24;
  return off;
}

// ===========================
// 🎄 HNYC — ПОЛНЫЙ НОВОГОДНИЙ ЦИКЛ СЧЕТЧИКА
// ===========================

function startHnycLoop(client) {

  cron.schedule('* * * * *', async () => {

    const cfg = loadHnycConfig();

    // бот ещё не готов
    if (!BOT_READY_AT) return;

    // задержка после запуска
    const secondsSinceReady = (Date.now() - BOT_READY_AT) / 1000;
    if (secondsSinceReady < STARTUP_DELAY_SECONDS) return;

    if (!cfg.enabled) return;
    if (!cfg.channel_id) return;

    const channel = client.channels.cache.get(cfg.channel_id);
    if (!channel) return;

    const now = nowMsk();
    const today = now.format("YYYY-MM-DD");


    // =========================
    // 🌅 СЧЁТЧИК ДНЕЙ ДО НОВОГО ГОДА
    // =========================

    if (cfg.last_morning_date !== today) {

      const target = dayjs.tz(
        `${now.year() + 1}-01-01 00:00`,
        MSK_TIMEZONE
      );

      const daysLeft = target.startOf("day").diff(now.startOf("day"), "day");

      if (daysLeft > 0) {
        await channel.send(
          `🎄Новый год через **${daysLeft} дней**!\n@here`
        );
      }

      cfg.last_morning_date = today;
      saveHnycConfig(cfg);
    }


    // =========================
    // ☀️ УТРЕННИЙ НОВОГОДНИЙ СОВЕТ (25.12 – 01.01)
    // =========================

    const month = now.month() + 1;
    const day = now.date();

    const inMorningPeriod =
      (month === 12 && day >= 25) ||
      (month === 1 && day === 1);

    const afterMorningTime =
      now.hour() > 10 ||
      (now.hour() === 10 && now.minute() >= 30);

    if (inMorningPeriod && afterMorningTime) {

      if (cfg.last_morning_tip_date !== today) {

        const tip = HNYC_MORNING_TIPS[
          Math.floor(Math.random() * HNYC_MORNING_TIPS.length)
        ];

        await channel.send(
          `@here\n☀️ **Доброе утро**\n${tip}`
        );

        cfg.last_morning_tip_date = today;
        saveHnycConfig(cfg);
      }
    }


    // =========================
    // 🌙 ВЕЧЕРНИЙ НОВОГОДНИЙ СОВЕТ — ПОСЛЕ 19:30
    // =========================

    const afterEveningTime =
      now.hour() > 19 ||
      (now.hour() === 19 && now.minute() >= 30);

    if (afterEveningTime) {

      if (cfg.last_evening_date !== today) {

        let idx = Math.floor(Math.random() * HNYC_TIPS.length);
        const lastIdx = cfg.last_tip_index;

        if (lastIdx !== null && HNYC_TIPS.length > 1) {
          while (idx === lastIdx) {
            idx = Math.floor(Math.random() * HNYC_TIPS.length);
          }
        }

        const tip = HNYC_TIPS[idx];

        await channel.send(
          `✨ @here Тёплый совет вечера:\n${tip}`
        );

        cfg.last_evening_date = today;
        cfg.last_tip_index = idx;
        saveHnycConfig(cfg);
      }
    }


    // =========================
    // 🎄 31 ДЕКАБРЯ — ПОСЛЕ 13:00
    // =========================

    const isDec31 = (month === 12 && day === 31);

    const after31Time =
      now.hour() > 13 ||
      (now.hour() === 13 && now.minute() >= 0);

    if (isDec31 && after31Time && !cfg.special_31_sent) {

      await channel.send(
        "🎄 Новый год уже близко! Обязательно помогите родителям накрывать на стол 🍽️\n@here"
      );

      cfg.special_31_sent = true;
      saveHnycConfig(cfg);
    }

  });
}

// =======================================
// 🎆 HNYC2 — ЦИКЛ СТРАН НА НОВЫЙ ГОД
// =======================================

function startHnyc2Loop(client) {

  cron.schedule('* * * * *', async () => {
    const cfg = loadHnyc2Config();

    if (!cfg.enabled || cfg.finished) return;

    const channel = client.channels.cache.get(cfg.channel_id);
    if (!channel) return;

    const now = nowGmt2();

    const year = now.month() === 11 ? now.year() : now.year() - 1;
    const start = dayjs(`${year}-12-31 12:00`).utcOffset(120); // GMT+2
    const end   = dayjs(`${year+1}-01-01 12:00`).utcOffset(120); // GMT+2

    if (now.isBefore(start) || now.isAfter(end.add(5, 'minute'))) return;

    const currentHour = now.hour();
    if (cfg.last_sent_hour === currentHour) return;

    const slot = now.minute(0).second(0);
    const ts = Math.floor(slot.valueOf() / 1000);

    const utcOff = utcOffsetForSlot(slot);
    let countries = HNYC2_BY_UTC_OFFSET[utcOff];
    if (!countries) countries = `часовая зона UTC${utcOff >= 0 ? '+' : ''}${utcOff}`;

    // 🎆 финал
    if (now.isAfter(end)) {
      const msg =
        `🕛🎆 <t:${ts}:t> — @here\n` +
        `**Последними Новый год встретили:** 🇵🇫 Французская Полинезия, 🇺🇸 Гавайи\n\n` +
        `🌍 **Теперь Новый год наступил во всех часовых зонах мира.**\n` +
        `Спасибо, что были вместе 🎄✨`;

      await safeSend(channel, msg);
      cfg.finished = true;
      cfg.enabled = false;
      cfg.last_sent_hour = currentHour;
      saveHnyc2Config(cfg);
      return;
    }

    // обычное сообщение
    const msg =
      `🕛🎄 <t:${ts}:t> — @here\n` +
      `**В этих странах наступил Новый год прямо сейчас:** ${countries}`;

    const ok = await safeSend(channel, msg);
    if (ok) {
      cfg.last_sent_hour = currentHour;
      saveHnyc2Config(cfg);
    }
  });
}

// =======================================
// 🌐 KEEP-ALIVE WEB SERVER (для Render / UptimeRobot)
// =======================================

function keepAlive() {
  const app = express();

  app.get('/', (req, res) => {
    res.send("Bot alive");
  });

  app.listen(3000, () => {
    console.log("Keep-alive сервер запущен на порту 3000");
  });
}

// =======================================
// ❗ RoleDeleteConfirm (кнопки подтверждения удаления ролей)
// =======================================

async function roleDeleteConfirm(interaction, roles) {

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_delete_roles')
      .setLabel('✅ Продолжить')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('cancel_delete_roles')
      .setLabel('❌ Отмена')
      .setStyle(ButtonStyle.Secondary)
  );

  // Отправляем сообщение с кнопками
  await interaction.reply({
    content: `🗑 **Эти роли будут удалены:**\n${roles.map(r => `• ${r.name}`).join("\n")}\n\nВы уверены?`,
    components: [row],
    ephemeral: true
  });

  const message = await interaction.fetchReply();

  const collector = message.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {

    // 🔹 СРАЗУ подтверждаем Discord'у, что кнопка получена
    await i.deferUpdate();

    // 🔒 Проверка владельца
    if (i.user.id !== OWNER_ID) {
      await i.followUp({ content: "❌ Нет доступа.", ephemeral: true });
      return;
    }

    // ✅ Подтверждение удаления
    if (i.customId === 'confirm_delete_roles') {

      let deleted = [];

      for (const role of roles) {
        try {
          await role.delete("Удалено через /croles");
          deleted.push(role.name);
        } catch (e) {}
      }

      await i.editReply({
        content: `🗑 **Удалено ролей:** ${deleted.length}`,
        components: []
      });

      collector.stop();
    }

    // ❌ Отмена
    if (i.customId === 'cancel_delete_roles') {

      await i.editReply({
        content: "❌ Удаление отменено.",
        components: []
      });

      collector.stop();
    }
  });
}

// =======================================
// ❗ KickInactiveConfirm (кнопки подтверждения кика)
// =======================================

async function kickInactiveConfirm(interaction, members) {

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_kick_members')
      .setLabel('🦶 Кикнуть неактивных')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('cancel_kick_members')
      .setLabel('❌ Отмена')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    content:
      `👤 **Потенциально неактивные участники**\n` +
      `Всего: **${members.length}**\n\n` +
      `${members.slice(0, 25).map(m => `• ${m.user.tag}`).join("\n")}\n\n` +
      `⚠️ Вы уверены?`,
    components: [row],
  });

  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {

    // 🔹 подтверждаем кнопку мгновенно
    await i.deferUpdate();

    // 🔒 проверка владельца
    if (i.user.id !== OWNER_ID) {
      await i.followUp({ content: "❌ Нет доступа.", ephemeral: true });
      return;
    }

    // ✅ Кик
    if (i.customId === 'confirm_kick_members') {

      let kicked = 0;

      for (const member of members) {
        try {
          await member.kick("Неактивность");
          kicked++;
        } catch (e) {}
      }

      await i.editReply({
        content: `🦶 **Кикнуто пользователей:** ${kicked}`,
        components: []
      });

      collector.stop();
    }

    // ❌ Отмена
    if (i.customId === 'cancel_kick_members') {

      await i.editReply({
        content: "❌ Действие отменено.",
        components: []
      });

      collector.stop();
    }
  });
}

// =======================================
// ФУНКЦИЯ Night API
// =======================================

async function nightImage(endpoint) {
  try {
    const res = await axios.get(
      `https://api.night-api.com/images/animals/${endpoint}`,
      { headers: NIGHT_HEADERS }
    );

    return res.data?.content?.url || null;

  } catch (err) {
    console.error("Night API error:", err.response?.status || err.message);
    return null;
  }
}

// =======================================
// СОЗДАНИЕ КЛИЕНТА
// =======================================

client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =======================================
// 🧩 РЕГИСТРАЦИЯ SLASH-КОМАНД
// =======================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /ping
  if (commandName === "ping") {
    const ms = Math.round(client.ws.ping);
    return interaction.reply(`${ms}мс`);
  }

  // =========================
  // /guilds
  // =========================

  if (commandName === "guilds") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Нет доступа.", ephemeral: true });

    const lines = client.guilds.cache.map(g =>
      `• ${g.name} — \`${g.id}\` — участников: ${g.memberCount}`
    );

    let text = lines.join("\n") || "Бот не состоит ни в одном сервере.";
    if (text.length > 1900) text = text.slice(0, 1900) + "\n... (обрезано)";

    return interaction.reply({ content: text, ephemeral: true });
  }

  // =========================
  // /caption
  // =========================

  if (commandName === "caption") {

    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");
    const text = interaction.options.getString("text");

    if (!attachment) {
      return interaction.editReply("❌ Изображение не найдено.");
    }

    try {

      const response = await axios.get(attachment.url, {
        responseType: "arraybuffer"
      });

      const img = sharp(response.data);
      const metadata = await img.metadata();

      // 🔥 Автоскейл текста
      const fontSize = Math.max(24, Math.floor(metadata.height * 0.06));
      const captionHeight = Math.floor(fontSize * 2.6);

      // Escape HTML
      const safeText = text
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");

      // SVG с переносом строк
      const svgText = `
        <svg width="${metadata.width}" height="${captionHeight}">
          <style>
            .title {
              fill: black;
              font-size: ${fontSize}px;
              font-family: sans-serif;
              font-weight: bold;
              stroke: white;
              stroke-width: ${Math.max(2, fontSize*0.08)};
              paint-order: stroke;
            }
          </style>

          <foreignObject x="0" y="0" width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml"
                 style="
                   display:flex;
                   align-items:center;
                   justify-content:center;
                   width:100%;
                   height:100%;
                   text-align:center;
                   padding:10px;
                   box-sizing:border-box;
                   word-wrap:break-word;
                   overflow:hidden;
                 ">
              <span class="title">${safeText}</span>
            </div>
          </foreignObject>
        </svg>
      `;

      const finalImage = await sharp({
        create: {
          width: metadata.width,
          height: metadata.height + captionHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
      .composite([
        {
          input: Buffer.from(svgText),
          top: 0,
          left: 0
        },
        {
          input: response.data,
          top: captionHeight,
          left: 0
        }
      ])
      .png()
      .toBuffer();

      await interaction.editReply({
        content: "✅ Готово! Подпись добавлена:",
        files: [{
          attachment: finalImage,
          name: "kg_caption.png"
        }]
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка при обработке изображения.");
    }
  }

  // =========================
  // /calc
  // =========================

  if (commandName === "calc") {

    const expr = interaction.options.getString("пример");

    const res = calculate(expr);

    if (!res.ok) {
      return interaction.reply({
        content: `Пример: ${expr}\n${res.error}`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `Пример: ${expr}\nОтвет: ${res.value}`
    });
  }

  // =========================
  // /warninfo
  // =========================

  if (commandName === "warninfo") {

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");

    const warnsPath = path.join(__dirname, "warns.json");

    let warns = {};
    if (fs.existsSync(warnsPath)) {
      warns = JSON.parse(fs.readFileSync(warnsPath));
    }

    const count = warns[user.id] || 0;

    await interaction.editReply(
      `⚠️ У пользователя **${user.tag}** предупреждений: **${count}**`
    );
  }


  // =========================
  // /devquote
  // =========================

  if (commandName === "devquote") {

    if (!global.lastDevQuotes) global.lastDevQuotes = [];

    const quotes = [
      "Работает? Не трогай.",
      "99 багов в коде... исправил один — стало 127.",
      "Программист — это человек, который гуглит быстрее других.",
      "StackOverflow — мой настоящий тиммейт.",
      "Нет ничего более постоянного, чем временный костыль.",
      "Сначала заставь работать, потом красиво.",
      "Если код компилируется с первого раза — ты что-то сломал.",
      "Я не ленивый, я оптимизирую.",
      "TODO — лучший способ отложить проблему.",
      "Любой код можно оптимизировать… пока он не перестанет работать.",
      "Лучший комментарий — тот, который не нужен.",
      "Сон — это режим энергосбережения программиста.",
      "Это не баг, это фича.",
      "Код без багов — значит его никто не запускал.",
      "Ctrl+C Ctrl+V — двигатель прогресса.",
      "Работаю в IT: чиню то, что сам сломал.",
      "Программа работает идеально… пока её не увидит пользователь.",
      "Один баг исправил — два появилось.",
      "Если долго смотреть на код — он начинает смотреть на тебя.",
      "Рефакторинг — это когда страшно, но надо.",
      "Всё временно, кроме legacy-кода.",
      "Git blame — лучший детектив.",
      "Коммит: 'fixed stuff'. Никто не знает что.",
      "Код — как шутка. Если надо объяснять — плохой код.",
      "Документация? Я же код написал.",
      "Сначала было слово… console.log.",
      "Тесты? Запущу на проде.",
      "Оптимизация начинается после дедлайна.",
      "Костыль сегодня — стандарт завтра.",
      "Прод работает — значит тесты не нужны.",
      "Деплой в пятницу — спорт для смелых.",
      "Бэкап есть? Надеюсь.",
      "Если не знаешь — перезапусти.",
      "Сервер упал? Значит живой был.",
      "npm install — ритуал призыва ошибок.",
      "Python: читаешь как книгу. JS: как детектив.",
      "Java: написал 3 строки — скомпилировал 10 минут.",
      "Вчера работало.",
      "Я ничего не трогал.",
      "Это само сломалось.",
      "Ещё один console.log и точно всё пойму.",
      "Главное — чтобы дедлайн боялся тебя.",
      "Чем старше код — тем он священнее.",
      "Legacy — это код без автора.",
      "TODO позже = никогда.",
      "IDE знает код лучше меня.",
      "Google — старший разработчик.",
      "ChatGPT — младший разработчик.",
      "Код работает — значит можно домой.",
      "Программист: 10 часов думает, 2 минуты пишет код."
    ];

    let quote;

    do {
      quote = quotes[Math.floor(Math.random() * quotes.length)];
    } while (global.lastDevQuotes.includes(quote));

    global.lastDevQuotes.push(quote);
    if (global.lastDevQuotes.length > 20) global.lastDevQuotes.shift();

    await interaction.reply(`💻 ${quote}`);
  }

  // =========================
  // /leave_guild
  // =========================

  if (commandName === "leave_guild") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Нет доступа.", ephemeral: true });

    const gid = interaction.options.getString("guild_id");
    const guild = client.guilds.cache.get(gid);

    if (!guild)
      return interaction.reply({ content: "❌ Бот не найден на сервере.", ephemeral: true });

    await interaction.reply({
      content: `⚠️ Бот выходит с сервера **${guild.name}**`,
      ephemeral: true
    });

    return guild.leave();
  }      

  // =========================
  // /proembed
  // =========================

  if (commandName === "proembed") {

    // 👉 ВСТАВЬ СЮДА СВОЙ DISCORD ID
    const OWNER_ID = "1167514315864162395";

    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "❌ Эта команда только для владельца бота.",
        ephemeral: true
      });
    }

    const { EmbedBuilder } = require("discord.js");

    const title = interaction.options.getString("title");
    const text = interaction.options.getString("text");
    const color = interaction.options.getString("color");
    const image = interaction.options.getString("image");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(text)
      .setColor(color || "#2b2d31");

    if (image && image.startsWith("http")) {
      embed.setImage(image);
    }

    await interaction.reply({ embeds: [embed] });
  }

  // =========================
  // /translate
  // =========================

  if (commandName === "translate") {

    // 🔒 Пытаемся defer ТОЛЬКО если можно
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    } catch {
      // interaction уже мёртв — дальше НИЧЕГО не делаем
      return;
    }

    try {
      const text = interaction.options.getString("text");
      const to = interaction.options.getString("to");

      const result = await translate(text, { to });

      await interaction.editReply({
        content:
          `🌍 **Перевод**\n` +
          `➡️ **Язык:** ${to}\n\n` +
          `**Результат:**\n${result.text}`
      });

    } catch (error) {
      console.error(error);

      // 🔒 Отвечаем ТОЛЬКО если interaction жив
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Ошибка перевода.");
      }
    }
  }

  // =========================
  // /shortlink
  // =========================

  if (commandName === "shortlink") {

    await interaction.deferReply();

    const url = interaction.options.getString("url");

    if (!url.startsWith("http")) {
      return interaction.editReply("❌ Укажи корректную ссылку (http/https).");
    }

    try {
      const res = await axios.get(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
      );

      await interaction.editReply(
        `🔗 **Короткая ссылка:**\n${res.data}`
      );

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка сокращения ссылки.");
    }
  }

  // ===== /mute =====
  if (interaction.commandName === "mute") {

    await interaction.deferReply(); // теперь публичный ответ

    try {
      const member = interaction.options.getMember("user");
      const time = interaction.options.getString("time");
      const reason = interaction.options.getString("reason") || "Без причины";
  
      if (!member)
        return interaction.editReply("❌ Пользователь не найден.");

      if (!member.moderatable)
        return interaction.editReply("❌ Я не могу замутить этого пользователя.");

      // Парсер времени
      const match = time.match(/^(\d+)([smhd])$/i);
      if (!match)
        return interaction.editReply(
          "❌ Формат времени: `10s`, `10m`, `1h`, `1d`"
        );

      const num = Number(match[1]);
      const unit = match[2].toLowerCase();

      const duration = {
        s: num * 1000,
        m: num * 60_000,
        h: num * 3_600_000,
        d: num * 86_400_000,
      }[unit];

      await member.timeout(duration, reason);

      await interaction.editReply(
        `🔇 **${member.user.tag}** замьючен на **${time}**\nПричина: ${reason}`
      );

    } catch (err) {
      console.error("Mute error:", err);
      await interaction.editReply("❌ Ошибка мута.");
    }
  }

  // =========================
  // /qr
  // =========================

  if (commandName === "qr") {

    await interaction.deferReply();

    const text = interaction.options.getString("text");

    try {
      const QRCode = require("qrcode");

      const buffer = await QRCode.toBuffer(text, {
        width: 512,
        margin: 2
      });

      await interaction.editReply({
        content: "📱 Вот твой QR-код:",
        files: [
          {
            attachment: buffer,
            name: "kotikg_qr.png"
          }
        ]
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка создания QR-кода.");
    }
  }

  // =====================
  // /choose
  // =====================

  if (commandName === "choose") {
    const options = [
      interaction.options.getString("option1"),
      interaction.options.getString("option2"),
      interaction.options.getString("option3"),
      interaction.options.getString("option4"),
      interaction.options.getString("option5")
    ].filter(Boolean);

    const choice = options[Math.floor(Math.random() * options.length)];

    return interaction.reply(`🎲 Я выбираю: **${choice}**`);
  }


  // =====================
  // /8ball
  // =====================

  if (commandName === "8ball") {
    const answers = [
      "Да.",
      "Нет.",
      "Скорее да.",
      "Скорее нет.",
      "Определённо.",
      "Спроси позже.",
      "Шансы хорошие.",
      "Не рассчитывай.",
      "Возможно.",
      "100% да."
    ];

    const question = interaction.options.getString("question");
    const answer = answers[Math.floor(Math.random() * answers.length)];

    return interaction.reply(`🎱 **Вопрос:** ${question}\n**Ответ:** ${answer}`);
  }

  // =========================
  // /togif
  // =========================

  if (commandName === "togif") {

    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");

    if (!attachment || !attachment.contentType?.startsWith("image/")) {
      return interaction.editReply("❌ Это не изображение.");
    }

    const imageUrl = attachment.url;

    try {
      const buffer = await new Promise((resolve, reject) => {
        https.get(imageUrl, res => {
          const data = [];
          res.on("data", chunk => data.push(chunk));
          res.on("end", () => resolve(Buffer.concat(data)));
        }).on("error", reject);
      });

      const gifBuffer = await sharp(buffer)
        .gif()
        .toBuffer();

      await interaction.editReply({
        content: "✅ Готово! Вот твоя GIF:",
        files: [
          {
            attachment: gifBuffer,
            name: "kg_convert.gif"
          }
        ]
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка при конвертации.");
    }
  }

  // =========================
  // /say
  // =========================

  if (commandName === "say") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Нет доступа.", ephemeral: true });

    const msg = interaction.options.getString("message");
    await interaction.reply({ content: "✅ Отправлено", ephemeral: true });
    return interaction.channel.send(msg);
  }


  // =========================
  // /embed
  // =========================

  if (commandName === "embed") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Нет доступа.", ephemeral: true });

    const title = interaction.options.getString("title");
    const text = interaction.options.getString("text");
    const colorRaw = interaction.options.getString("embedcolor");

    let color = 0x5865F2;
    if (colorRaw) {
      try { color = parseInt(colorRaw.replace("#",""), 16); } catch {}
    }

    await interaction.reply({ content: "✅ Отправлено", ephemeral: true });

    return interaction.channel.send({
      embeds: [{ title, description: text, color }]
    });
  }
  
  // =========================
  // /compress
  // =========================

  if (commandName === "compress") {

    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");

    if (!attachment) {
      return interaction.editReply("❌ Изображение не найдено.");
    }

    try {
      // скачиваем изображение
      const response = await axios.get(attachment.url, {
        responseType: "arraybuffer"
      });

      const inputBuffer = response.data;

      // определяем формат по имени файла
      const fileName = attachment.name.toLowerCase();

      let outputBuffer;
      let outputName;

      if (fileName.endsWith(".png")) {
        // PNG — максимальное сжатие без потери размеров
        outputBuffer = await sharp(inputBuffer)
          .png({ compressionLevel: 9 })
          .toBuffer();
        outputName = "compressed.png";

      } else {
        // JPG / JPEG / другие → сохраняем как JPEG с качеством 70
        outputBuffer = await sharp(inputBuffer)
          .jpeg({ quality: 70 })
          .toBuffer();
        outputName = "compressed.jpg";
      }

      await interaction.editReply({
        content: "✅ Изображение сжато без изменения разрешения:",
        files: [{
          attachment: outputBuffer,
          name: outputName
        }]
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка при сжатии изображения.");
    }
  }

  // =========================
  // /kick
  // =========================

  if (commandName === "kick") {

    const target = interaction.options.getUser("user");
    const cause = interaction.options.getString("cause");

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: "❌ Пользователь не найден на сервере.", ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: "❌ Я не могу кикнуть этого пользователя (роль выше моей).", ephemeral: true });
    }

    await member.kick(cause);

    await interaction.reply({
      content: `👢 Пользователь **${target.tag}** кикнут!\n📌 Причина: **${cause}**`
    });
  }

  // =========================
  // /ban
  // =========================

  if (commandName === "ban") {

    const target = interaction.options.getUser("user");
    const cause = interaction.options.getString("cause");

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: "❌ Пользователь не найден на сервере.", ephemeral: true });
    }

    if (!member.bannable) {
      return interaction.reply({ content: "❌ Я не могу забанить этого пользователя (роль выше моей).", ephemeral: true });
    }

    await member.ban({ reason: cause });

    await interaction.reply({
      content: `🔨 Пользователь **${target.tag}** забанен!\n📌 Причина: **${cause}**`
    });
  }

  // =========================
  // /warn
  // =========================

  if (commandName === "warn") {

    const target = interaction.options.getUser("user");
    const message = interaction.options.getString("message");

    // Загружаем файл предупреждений
    let warnings = {};
    try {
      warnings = JSON.parse(fs.readFileSync("./warnings.json", "utf8"));
    } catch {
      warnings = {};
    }

    // Увеличиваем счётчик
    if (!warnings[target.id]) warnings[target.id] = 0;
    warnings[target.id] += 1;

    // Сохраняем обратно
    fs.writeFileSync("./warnings.json", JSON.stringify(warnings, null, 2));

    const warnCount = warnings[target.id];

    await interaction.reply({
      content:
        `⚠️ Предупреждение №**${warnCount}** для пользователя **${target.tag}**!\n` +
        `💬 Сообщение от администрации: **${message}**`
    });
  }

  // =========================
  // /unwarn
  // =========================

  if (commandName === "unwarn") {

    const target = interaction.options.getUser("user");

    // Загружаем файл предупреждений
    let warnings = {};
    try {
      warnings = JSON.parse(fs.readFileSync("./warnings.json", "utf8"));
    } catch {
      warnings = {};
    }

    // Если предупреждений нет
    if (!warnings[target.id] || warnings[target.id] === 0) {
      return interaction.reply({
        content: `ℹ️ У пользователя **${target.tag}** нет предупреждений.`,
        ephemeral: true
      });
    }

    // Сбрасываем счётчик
    warnings[target.id] = 0;

    // Сохраняем файл
    fs.writeFileSync("./warnings.json", JSON.stringify(warnings, null, 2));

    await interaction.reply({
      content: `✅ Предупреждения пользователя **${target.tag}** сброшены до нуля.`
    });
  }

  // =========================
  // /combined
  // =========================

  if (commandName === "combined") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Нет доступа.", ephemeral: true });

    const realtext = interaction.options.getString("realtext");
    const title = interaction.options.getString("title");
    const embedText = interaction.options.getString("embed");
    const embedcolor = interaction.options.getString("embedcolor");

    let color;
    try { color = parseInt(embedcolor.replace("#",""), 16); }
    catch { return interaction.reply({ content:"❌ Ошибка цвета.", ephemeral:true}); }

    await interaction.reply({ content:"✅ Отправлено", ephemeral:true });

    return interaction.channel.send({
      content: realtext,
      embeds: [{ title, description: embedText, color }]
    });
  }


  // =========================
  // /userinfo UPDATED
  // =========================

  if (commandName === "userinfo") {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);

    // Получаем баннер если есть
    let bannerURL = null;
    try {
      const fetchedUser = await user.fetch();
      bannerURL = fetchedUser.bannerURL({ size: 1024, dynamic: true });
    } catch {}

    const avatarURL = user.displayAvatarURL({ size: 1024, dynamic: true });

    const embed = {
      title: `👤 ${user.username}`,
      color: 0x00ffcc,
      thumbnail: { url: avatarURL },

      fields: [
        {
          name: "Username",
          value: `\`${user.username}\``,
          inline: true
        },
        {
          name: "Display name",
          value: `\`${user.globalName || "нет"}\``,
          inline: true
        },
        {
          name: "Server nick",
          value: `\`${member?.nickname || "нет"}\``,
          inline: true
        },
        {
          name: "ID",
          value: `\`${user.id}\``,
          inline: true
        },
        {
          name: "Аккаунт создан",
          value: `<t:${Math.floor(user.createdTimestamp/1000)}:F>`,
          inline: true
        },
        {
          name: "На сервере с",
          value: member?.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp/1000)}:F>`
            : "ЛС / неизвестно",
          inline: true
        },
        {
          name: "Бот?",
          value: user.bot ? "🤖 Да" : "👤 Нет",
          inline: true
        },
        {
          name: "Аватар HD",
          value: `[Открыть](${avatarURL})`,
          inline: true
        }
      ]
    };

    // Роли (если есть сервер)
    if (member) {
      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .map(r => `<@&${r.id}>`)
        .join(", ");

      embed.fields.push({
        name: `Роли (${member.roles.cache.size - 1})`,
        value: roles || "нет"
      });
    }

    // Баннер
    if (bannerURL) {
      embed.image = { url: bannerURL };
    }

    return interaction.reply({ embeds: [embed] });
  }



  // =========================
  // /coinflip
  // =========================

  if (commandName === "coinflip") {
    return interaction.reply(Math.random() < 0.5 ? "Орёл" : "Решка");
  }


  // =========================
  // /roll
  // =========================

  if (commandName === "roll") {
    const n = Math.floor(Math.random()*100)+1;
    return interaction.reply(String(n));
  }


  // =========================
  // /meme
  // =========================

  if (commandName === "meme") {
    const r = await axios.get("https://meme-api.com/gimme");
    const d = r.data;
    return interaction.reply({
      embeds: [{ title: d.title, image:{url:d.url} }]
    });
  }

 // ==== /cat =====
  if (interaction.commandName === "cat") {
  const img = await nightImage("cat");

  if (!img) {
    return interaction.reply({
      content: "❌ Night API не ответил.",
      ephemeral: true
    });
  }

  return interaction.reply(img);
  }

 // ==== /dog ====
  if (interaction.commandName === "dog") {
  const img = await nightImage("dog");

  if (!img) {
    return interaction.reply({
      content: "❌ Night API не ответил.",
      ephemeral: true
    });
  }

  return interaction.reply(img);
  }

 // ==== /fox ====
  if (interaction.commandName === "fox") {
  const img = await nightImage("fox");

  if (!img) {
    return interaction.reply({
      content: "❌ Night API не ответил.",
      ephemeral: true
    });
  }

  return interaction.reply(img);
  }
 // ==== /hamster ====
  if (interaction.commandName === "hamster") {
  const img = await nightImage("hamster");

  if (!img) {
    return interaction.reply({
      content: "❌ Night API не ответил.",
      ephemeral: true
    });
  }

  return interaction.reply(img);
  }

  // =========================
  // HNYC управление
  // =========================

  if (commandName === "hnyc_start") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const cfg = loadHnycConfig();
    cfg.enabled = true;
    cfg.channel_id = interaction.channel.id;
    cfg.last_morning_date = null;
    cfg.last_evening_date = null;
    saveHnycConfig(cfg);

    return interaction.reply({ content:"✅ Countdown включён.", ephemeral:true });
  }

  if (commandName === "hnyc_stop") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const cfg = loadHnycConfig();
    cfg.enabled = false;
    saveHnycConfig(cfg);

    return interaction.reply({ content:"🛑 Countdown выключен.", ephemeral:true });
  }


  if (commandName === "hnyc2_start") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const cfg = loadHnyc2Config();
    cfg.enabled = true;
    cfg.finished = false;
    cfg.channel_id = interaction.channel.id;
    cfg.last_sent_hour = null;
    saveHnyc2Config(cfg);

    return interaction.reply({ content:"🎆 HNYC2 запущен.", ephemeral:true });
  }

  if (commandName === "hnyc2_stop") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const cfg = loadHnyc2Config();
    cfg.enabled = false;
    saveHnyc2Config(cfg);

    return interaction.reply({ content:"🛑 HNYC2 остановлен.", ephemeral:true });
  }


  // =========================
  // /croles → подтверждение
  // =========================

  if (commandName === "croles") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const roles = [];
    for (let i=1;i<=25;i++){
      const r = interaction.options.getRole("role"+i);
      if (r) roles.push(r);
    }

    if (!roles.length)
      return interaction.reply({ content:"❌ Роли не выбраны.", ephemeral:true });

    return roleDeleteConfirm(interaction, roles);
  }


  // =========================
  // /channels_purge
  // =========================

  if (commandName === "channels_purge") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    const amount = interaction.options.getInteger("amount");
    const channel = interaction.options.getChannel("channel") || interaction.channel;

    if (amount < 1 || amount > 1000)
      return interaction.reply({ content:"❌ Количество 1–1000.", ephemeral:true });

    const msgs = await channel.bulkDelete(amount, true);
    return interaction.reply({ content:`🧹 Удалено сообщений: ${msgs.size}`, ephemeral:true });
  }


  // =========================
  // /inactive_check
  // =========================

  if (commandName === "inactive_check") {
    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content:"❌ Нет доступа.", ephemeral:true });

    await interaction.deferReply({ ephemeral:true });

    const period = interaction.options.getString("period");

    const daysMap = {
      "1 неделя":7,
      "1 месяц":30,
      "3 месяца":90,
      "6 месяцев":180
    };

    const cutoff = Date.now() - daysMap[period]*86400000;

    const inactive = [];

    for (const m of interaction.guild.members.cache.values()) {
      if (m.user.bot) continue;
      if (!m.joinedAt) continue;
      if (m.joinedAt.getTime() < cutoff) inactive.push(m);
    }

    if (!inactive.length) {
      await interaction.editReply({ content: "✅ Неактивных нет." });
      return;
    }

    return kickInactiveConfirm(interaction, inactive);
  }


});

// =======================================
// 🔔 СОБЫТИЕ clientReady (аналог on_ready)
// =======================================

client.once(Events.ClientReady, async () => {

  BOT_READY_AT = Date.now();

  console.log(`✅ Бот онлайн как ${client.user.tag}`);
  console.log(`⏳ Ждём ${STARTUP_DELAY_SECONDS} секунд перед запуском фоновых задач...`);

  // задержка старта (аналог await asyncio.sleep)
  await new Promise(resolve => setTimeout(resolve, STARTUP_DELAY_SECONDS * 1000));


  // =========================
  // 🎄 COUNTDOWN (HNYC)
  // =========================

  const cfg = loadHnycConfig();

  if (cfg.enabled && !cfg.finished) {
    console.log("🎄 HNYC (countdown) запущен");
    startHnycLoop(client);
  } else {
    console.log("🧊 HNYC (countdown) заморожен");
  }


  // =========================
  // 🌍 СТРАНЫ (HNYC2)
  // =========================

  const cfg2 = loadHnyc2Config();

  if (cfg2.enabled && !cfg2.finished) {
    console.log("🌍 HNYC2 (страны) запущен");
    startHnyc2Loop(client);
  } else {
    console.log("🧊 HNYC2 (страны) заморожен");
  }


  console.log("🚀 Проверка фоновых задач завершена");

  // keep-alive сервер
  keepAlive();
});


client.login(TOKEN);

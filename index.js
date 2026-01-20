const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const { MessageFlags } = require('discord.js');

const cron = require('node-cron');
const axios = require('axios');

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const express = require('express');

const sharp = require("sharp");
const https = require("https");

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
const STARTUP_DELAY_SECONDS = 60


// =======================================
// /stick — память последнего закреплённого сообщения
// =======================================
global.last_sticky_message_id = null;
global.last_sticky_channel_id = null;


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
    console.log(`⚠️ HNYC2 send failed: ${error}`);
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
      // скачиваем картинку
      const response = await axios.get(attachment.url, {
        responseType: "arraybuffer"
      });

      const img = sharp(response.data);
      const metadata = await img.metadata();

      const captionHeight = 140;

      // создаём итоговое изображение
      const finalImage = await sharp({
        create: {
          width: metadata.width,
          height: metadata.height + captionHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 } // белый фон
        }
      })
      .composite([
        // текст сверху
        {
          input: Buffer.from(
            `<svg width="${metadata.width}" height="${captionHeight}">
               <style>
                 text { fill: black; font-size: 48px; font-family: sans-serif; }
               </style>
               <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
                 ${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
               </text>
             </svg>`
          ),
          top: 0,
          left: 0
        },
        // оригинальная картинка снизу
        { input: response.data, top: captionHeight, left: 0 }
      ])
      .png()
      .toBuffer();

      await interaction.editReply({
        content: "✅ Готово! Подпись добавлена:",
        files: [{
          attachment: finalImage,
          name: "caption.png"
        }]
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply("❌ Ошибка при обработке изображения.");
    }
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
  // /userinfo
  // =========================

  if (commandName === "userinfo") {
    const user = interaction.options.getUser("user") || interaction.user;

    const embed = {
      title: "Информация",
      thumbnail: { url: user.displayAvatarURL() },
      fields: [
        { name: "Имя", value: user.username },
        { name: "ID", value: String(user.id) }
      ],
      color: 0x00ffcc
    };

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


  // =========================
  // /cat
  // =========================

  if (commandName === "cat") {
    const r = await axios.get("https://api.thecatapi.com/v1/images/search");
    return interaction.reply(r.data[0].url);
  }

  if (commandName === "dog") {
    const r = await axios.get("https://dog.ceo/api/breeds/image/random");
    return interaction.reply(r.data.message);
  }

  if (commandName === "fox") {
    const r = await axios.get("https://randomfox.ca/floof/");
    return interaction.reply(r.data.image);
  }

  if (commandName === "hamster") {
    const r = await axios.get(
      "https://api.night-api.com/images/animals/hamster",
      { headers: { authorization: "wjeHiPP0rd-wXiN99rkH5iGKPqJBweF-2SoiKnAcZ8" } }
    );
    const img = r.data?.content?.url;
    return interaction.reply(img || "❌ Ошибка API.");
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

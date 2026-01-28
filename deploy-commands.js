const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // ID приложения бота

const commands = [

  // /ping
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверка задержки'),

  // /guilds
  new SlashCommandBuilder()
    .setName('guilds')
    .setDescription('Список серверов, где есть бот'),

  // /leave_guild
  new SlashCommandBuilder()
    .setName('leave_guild')
    .setDescription('Заставить бота выйти с сервера')
    .addStringOption(o =>
      o.setName('guild_id')
       .setDescription('ID сервера')
       .setRequired(true)
    ),

  // /say
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Отправить сообщение от имени бота')
    .addStringOption(o =>
      o.setName('message')
       .setDescription('Текст сообщения')
       .setRequired(true)
    ),

  // /kick
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Кикнуть пользователя')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Кого кикнуть')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('cause')
        .setDescription('Причина')
        .setRequired(true)
    )
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  

  // /ban
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Забанить пользователя')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Кого забанить')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('cause')
        .setDescription('Причина')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // /warn
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение пользователю')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Кому выдать предупреждение')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Сообщение от администрации')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // /unwarn
  new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Сбросить предупреждения пользователю')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Кому сбросить предупреждения')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // /compress
  new SlashCommandBuilder()
    .setName('compress')
    .setDescription('Сжать изображение без изменения размера в пикслеях')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Изображение для сжатия')
        .setRequired(true)
    ),

  // /togif
  new SlashCommandBuilder()
    .setName('togif')
    .setDescription('Конвертировать изображение в формат .gif')
    .addAttachmentOption(option => 
      option.setName('image')
        .setDescription('Изображение для конвертации')
        .setRequired(true)
    ),
  
  // /embed
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Отправить embed-сообщение')
    .addStringOption(o =>
      o.setName('title')
       .setDescription('Заголовок')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('text')
       .setDescription('Текст embed')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('embedcolor')
       .setDescription('HEX цвет, например #ff0000')
       .setRequired(false)
    ),

  // /combined
  new SlashCommandBuilder()
    .setName('combined')
    .setDescription('Текст + embed вместе')
    .addStringOption(o =>
      o.setName('realtext')
       .setDescription('Обычный текст')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('title')
       .setDescription('Заголовок embed')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('embed')
       .setDescription('Текст embed')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('embedcolor')
       .setDescription('HEX цвет')
       .setRequired(true)
    ),

  // /userinfo
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Информация о пользователе')
    .addUserOption(o =>
      o.setName('user')
       .setDescription('Пользователь')
       .setRequired(false)
    ),

  // /coinflip
  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Подбросить монетку'),

  // /roll
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Случайное число 1–100'),

  // /meme
  new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Случайный мем'),

  // /cat
  new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Случайный котик'),

  // /dog
  new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Случайная собачка'),

  // /fox
  new SlashCommandBuilder()
    .setName('fox')
    .setDescription('Случайная лиса'),

  // /hamster
  new SlashCommandBuilder()
    .setName('hamster')
    .setDescription('Случайный хомяк'),

  // HNYC
  new SlashCommandBuilder()
    .setName('hnyc_start')
    .setDescription('Включить новогодний countdown'),

  new SlashCommandBuilder()
    .setName('hnyc_stop')
    .setDescription('Выключить новогодний countdown'),

  new SlashCommandBuilder()
    .setName('hnyc2_start')
    .setDescription('Запуск странного новогоднего процесса'),

  new SlashCommandBuilder()
    .setName('hnyc2_stop')
    .setDescription('Остановить странный новогодний процесс'),

  // /channels_purge
  new SlashCommandBuilder()
    .setName('channels_purge')
    .setDescription('Удалить сообщения в канале')
    .addIntegerOption(o =>
      o.setName('amount')
       .setDescription('Количество сообщений')
       .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('channel')
       .setDescription('Канал (необязательно)')
       .setRequired(false)
    ),

  // /inactive_check
  new SlashCommandBuilder()
    .setName('inactive_check')
    .setDescription('Найти неактивных участников')
    .addStringOption(o =>
      o.setName('period')
       .setDescription('Период')
       .setRequired(true)
       .addChoices(
         { name: "1 неделя", value: "1 неделя" },
         { name: "1 месяц", value: "1 месяц" },
         { name: "3 месяца", value: "3 месяца" },
         { name: "6 месяцев", value: "6 месяцев" }
       )
    ),

  // /croles
  new SlashCommandBuilder()
    .setName('croles')
    .setDescription('Массово удалить роли')
    // 25 ролей — все с description
    .addRoleOption(o=>o.setName('role1').setDescription('Роль 1').setRequired(false))
    .addRoleOption(o=>o.setName('role2').setDescription('Роль 2').setRequired(false))
    .addRoleOption(o=>o.setName('role3').setDescription('Роль 3').setRequired(false))
    .addRoleOption(o=>o.setName('role4').setDescription('Роль 4').setRequired(false))
    .addRoleOption(o=>o.setName('role5').setDescription('Роль 5').setRequired(false))
    .addRoleOption(o=>o.setName('role6').setDescription('Роль 6').setRequired(false))
    .addRoleOption(o=>o.setName('role7').setDescription('Роль 7').setRequired(false))
    .addRoleOption(o=>o.setName('role8').setDescription('Роль 8').setRequired(false))
    .addRoleOption(o=>o.setName('role9').setDescription('Роль 9').setRequired(false))
    .addRoleOption(o=>o.setName('role10').setDescription('Роль 10').setRequired(false))
    .addRoleOption(o=>o.setName('role11').setDescription('Роль 11').setRequired(false))
    .addRoleOption(o=>o.setName('role12').setDescription('Роль 12').setRequired(false))
    .addRoleOption(o=>o.setName('role13').setDescription('Роль 13').setRequired(false))
    .addRoleOption(o=>o.setName('role14').setDescription('Роль 14').setRequired(false))
    .addRoleOption(o=>o.setName('role15').setDescription('Роль 15').setRequired(false))
    .addRoleOption(o=>o.setName('role16').setDescription('Роль 16').setRequired(false))
    .addRoleOption(o=>o.setName('role17').setDescription('Роль 17').setRequired(false))
    .addRoleOption(o=>o.setName('role18').setDescription('Роль 18').setRequired(false))
    .addRoleOption(o=>o.setName('role19').setDescription('Роль 19').setRequired(false))
    .addRoleOption(o=>o.setName('role20').setDescription('Роль 20').setRequired(false))
    .addRoleOption(o=>o.setName('role21').setDescription('Роль 21').setRequired(false))
    .addRoleOption(o=>o.setName('role22').setDescription('Роль 22').setRequired(false))
    .addRoleOption(o=>o.setName('role23').setDescription('Роль 23').setRequired(false))
    .addRoleOption(o=>o.setName('role24').setDescription('Роль 24').setRequired(false))
    .addRoleOption(o=>o.setName('role25').setDescription('Роль 25').setRequired(false))
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("⏳ Регистрирую slash-команды...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log("✅ Slash-команды зарегистрированы!");
  } catch (error) {
    console.error("❌ Ошибка регистрации:", error);
  }
})();









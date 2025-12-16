import disnake
from disnake.ext import commands, tasks
from disnake.ui import View, Button
import random
import aiohttp
import os
from pathlib import Path
from dotenv import load_dotenv
import datetime
from datetime import timedelta, timezone
import json
from flask import Flask
from threading import Thread

# =======================================
# 🔧 ЗАГРУЗКА .ENV
# =======================================
load_dotenv(dotenv_path=Path('.') / '.env')
TOKEN = os.getenv("DISCORD_TOKEN")

# =======================================
# ⚙ ОСНОВНЫЕ КОНСТАНТЫ
# =======================================
OWNER_ID = 1167514315864162395  
CONFIG_PATH = "stock_config.json"
STICK_CONFIG_PATH = "stick_config.json"
HNYC_CONFIG_PATH = "hnyc_config.json"

STOCK_ENABLED = False
STOCK_CHANNEL_ID = None

# ключевая фраза по которой ловим сток-бота
STOCK_TRIGGER_TEXT = "Grow A Garden Stock"


# ==========================
# 🎄 НОВОГОДНИЕ СОВЕТЫ
# ==========================

HNYC_TIPS = [
    "🎄 Самое время включить новогоднюю музыку и немного расслабиться",
    "☕ Сделай себе тёплый чай и просто отдохни",
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
    "🌟 Хороший момент, чтобы сказать кому-то спасибо",
    "❄️ Зима — время тишины и мыслей",
    "✨ Пусть этот вечер будет добрым",
    "🎁 Даже ожидание праздника — уже праздник"
]


# =======================================
# 📁 HNYC — РАБОТА С КОНФИГОМ
# =======================================

def load_hnyc_config():
    try:
        with open(HNYC_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        # дефолтный конфиг, если файла нет
        return {
            "enabled": False,              # включён ли countdown
            "channel_id": None,            # канал для сообщений
            "last_morning_date": None,     # дата последнего утреннего сообщения
            "last_evening_date": None,     # дата последнего вечернего совета
            "last_tip_index": None,        # индекс последнего совета
            "special_31_sent": False       # отправлено ли событие 31 декабря
        }


def save_hnyc_config(cfg: dict):
    with open(HNYC_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)


# =======================================
# ⏰ HNYC — ВРЕМЯ (GMT+3 / МОСКВА)
# =======================================

MSK = timezone(timedelta(hours=3))  # GMT+3

def now_msk():
    """Текущее время по Москве (timezone-aware)"""
    return datetime.datetime.now(MSK)


# =======================================
# 📁 РАБОТА С КОНФИГОМ для stock
# =======================================

def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)

# =======================================
# 📁 РАБОТА С КОНФИГОМ для STICK
# =======================================

def load_stick_config():
    try:
        with open(STICK_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return None

def save_stick_config(cfg: dict):
    with open(STICK_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)

# =======================================
# 🔁 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: отправка sticky-рекламки
# =======================================

async def send_sticky_in_channel(channel: disnake.TextChannel, cfg: dict):
    old_id = cfg.get("message_id")

    # Удаляем старое закреп-сообщение
    if old_id:
        try:
            msg = await channel.fetch_message(old_id)
            await msg.delete()
        except:
            pass  # нет доступа или сообщение удалено

    # Цвет эмбеда
    try:
        ecolor = int(cfg.get("embed_color", "#5865F2").replace("#", ""), 16)
    except:
        ecolor = 0x5865F2

    embed = disnake.Embed(
        title=cfg.get("embed_title", "Магазин"),
        description=cfg.get("embed_text", ""),
        color=ecolor
    )

    # Отправляем новое сообщение
    new_msg = await channel.send(
        content=cfg.get("text", ""),
        embed=embed
    )

    cfg["message_id"] = new_msg.id
    cfg["channel_id"] = channel.id
    save_stick_config(cfg)

    return new_msg


# =======================================
# 🔁 HNYC — ФОНОВЫЙ ПРОЦЕСС
# =======================================

@tasks.loop(seconds=30)
async def hnyc_loop():
    cfg = load_hnyc_config()

    if not cfg.get("enabled"):
        return

    channel_id = cfg.get("channel_id")
    if not channel_id:
        return

    channel = bot.get_channel(channel_id)
    if not channel:
        return

    now = now_msk()
    today = now.date()

    # =========================
    # 🌅 УТРО — 00:00
    # =========================
    if now.hour == 0 and now.minute == 0:
        if cfg.get("last_morning_date") != str(today):

            target = datetime.datetime(now.year + 1, 1, 1, tzinfo=MSK)
            days_left = (target.date() - today).days

            if days_left > 0:
                await channel.send(
                    f"🎄Новый год через **{days_left} дней**!\n@here"
                )

            cfg["last_morning_date"] = str(today)
            save_hnyc_config(cfg)

    # =========================
    # 🌙 ВЕЧЕР — 19:30
    # =========================
    if now.hour == 19 and now.minute == 30:
        if cfg.get("last_evening_date") != str(today):

            last_idx = cfg.get("last_tip_index")
            idx = random.randrange(len(HNYC_TIPS))

            if last_idx is not None and len(HNYC_TIPS) > 1:
                while idx == last_idx:
                    idx = random.randrange(len(HNYC_TIPS))

            tip = HNYC_TIPS[idx]

            await channel.send(
                f"✨ @here Тёплый совет вечера:\n{tip}"
            )

            cfg["last_evening_date"] = str(today)
            cfg["last_tip_index"] = idx
            save_hnyc_config(cfg)

    # =========================
    # 🎄 31 ДЕКАБРЯ — 13:00
    # =========================
    if (
        today.month == 12
        and today.day == 31
        and now.hour == 13
        and now.minute == 0
        and not cfg.get("special_31_sent")
    ):
        await channel.send(
            "🎄 Новый год уже близко! Обязательно помогите родителям накрывать на стол 🍽️\n@here"
        )

        cfg["special_31_sent"] = True
        save_hnyc_config(cfg)


# =======================================
# 🌐 ДЕРЖИМ БОТА ЖИВЫМ (RENDER KEEP-ALIVE)
# =======================================

app = Flask('')

@app.route('/')
def home():
    return "Bot alive"

def run_web():
    app.run(host="0.0.0.0", port=3000)

def keep_alive():
    Thread(target=run_web).start()

# =======================================
# 🤖 СОЗДАНИЕ БОТА
# =======================================

intents = disnake.Intents.default()
intents.members = True

bot = commands.InteractionBot(intents=intents)

# =======================================
# 🔔 СОБЫТИЕ on_ready
# =======================================

@bot.event
async def on_ready():
    print(f"✅ Бот онлайн как {bot.user}")

    if not hnyc_loop.is_running():
        hnyc_loop.start()

# =======================================
# 📨 ЛОВИМ СООБЩЕНИЕ СТОКА → переносим рекламку вниз
# =======================================

@bot.event
async def on_message(message: disnake.Message):

    # игнорируем самого бота
    if message.author.id == bot.user.id:
        return

    cfg = load_stick_config()
    if not cfg:
        return  # sticky не настроен

    if message.channel.id != cfg.get("channel_id"):
        return  # чужой канал

    # проверяем — это сток?
    if STOCK_TRIGGER_TEXT not in message.content:
        return

    # переносим рекламку вниз
    await send_sticky_in_channel(message.channel, cfg)

# =======================================
# 📡 STOCK API (пока не используем, но оставляем)
# =======================================

async def fetch_stock():
    url = "https://gag-stock-api.onrender.com/stock"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url) as r:
                if r.status != 200:
                    return None
                return await r.json()
    except:
        return None

def create_stock_embed(seeds, gear, eggs):
    t = int(datetime.datetime.utcnow().timestamp())
    e = disnake.Embed(
        title=f"🌱 Сток Grow A Garden — <t:{t}:t>",
        color=disnake.Color.green()
    )

    e.add_field(name="🌱 Семена", value="\n".join(seeds) if seeds else "Пусто")
    e.add_field(name="🛠 Инструменты", value="\n".join(gear) if gear else "Пусто")
    e.add_field(name="🥚 Яйца", value="\n".join(eggs) if eggs else "Пусто")

    return e

# =======================================
# ❗КЛАССЫ
# =======================================

class RoleDeleteConfirm(disnake.ui.View):
    def __init__(self, roles: list[disnake.Role]):
        super().__init__(timeout=60)
        self.roles = roles

    @disnake.ui.button(label="✅ Продолжить", style=disnake.ButtonStyle.danger)
    async def confirm(self, button: disnake.ui.Button, inter: disnake.MessageInteraction):
        if inter.author.id != OWNER_ID:
            await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
            return

        deleted = []
        for role in self.roles:
            try:
                await role.delete(reason="Удалено через /croles")
                deleted.append(role.name)
            except Exception:
                pass

        await inter.response.edit_message(
            content=f"🗑 **Удалено ролей:** {len(deleted)}",
            view=None
        )

    @disnake.ui.button(label="❌ Отмена", style=disnake.ButtonStyle.secondary)
    async def cancel(self, button: disnake.ui.Button, inter: disnake.MessageInteraction):
        await inter.response.edit_message(
            content="❌ Удаление отменено.",
            view=None
        )

class KickInactiveConfirm(disnake.ui.View):
    def __init__(self, members: list[disnake.Member]):
        super().__init__(timeout=60)
        self.members = members

    @disnake.ui.button(label="🦶 Кикнуть неактивных", style=disnake.ButtonStyle.danger)
    async def kick(self, button: disnake.ui.Button, inter: disnake.MessageInteraction):
        if inter.author.id != OWNER_ID:
            await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
            return

        kicked = 0

        for member in self.members:
            try:
                await member.kick(reason="Неактивность")
                kicked += 1
            except:
                pass  # нет прав / роль выше / ошибка

        await inter.response.edit_message(
            content=f"🦶 **Кикнуто пользователей:** {kicked}",
            view=None
        )

    @disnake.ui.button(label="❌ Отмена", style=disnake.ButtonStyle.secondary)
    async def cancel(self, button: disnake.ui.Button, inter: disnake.MessageInteraction):
        await inter.response.edit_message(
            content="❌ Действие отменено.",
            view=None
        )


# =======================================
# 🧩 КОМАНДА /ping
# =======================================

@bot.slash_command(description="Проверка задержки")
async def ping(inter):
    await inter.response.send_message(f"{int(bot.latency * 1000)}мс")

# =======================================
# 🧩 КОМАНДА /stick
# =======================================

last_sticky_message_id = None  # хранит ID последнего закреплённого сообщения
last_sticky_channel_id = None  # в каком канале делался /stick


@bot.slash_command(
    name="stick",
    description="Закрепить сообщение-баннер (удаляет старое и оставляет новое)"
)
async def stick(
    inter: disnake.ApplicationCommandInteraction,
    title: str,
    text: str
):
    global last_sticky_message_id, last_sticky_channel_id

    # Только владелец
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец может использовать /stick.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)

    channel = inter.channel

    # Удаляем старое sticky, если оно было в этом же канале
    if last_sticky_message_id and last_sticky_channel_id == channel.id:
        try:
            old_msg = await channel.fetch_message(last_sticky_message_id)
            await old_msg.delete()
        except:
            pass  # старое сообщение не найдено — игнорируем

    # Создаём новый embed
    embed = disnake.Embed(
        title=title,
        description=text,
        color=disnake.Color.green()
    )

    # Отправляем новый sticky
    new_msg = await channel.send(embed=embed)

    # Сохраняем ID
    last_sticky_message_id = new_msg.id
    last_sticky_channel_id = channel.id

    await inter.followup.send("✅ Sticky обновлён!", ephemeral=True)


# =======================================
# 🧩 ВСЕ ПРОШЛЫЕ КОМАНДЫ
# =======================================

@bot.slash_command(name="stock", description="Показать реальный сток Grow A Garden")
async def stock(inter):
    await inter.response.defer()
    data = await fetch_stock()
    if not data:
        await inter.followup.send("❌ Не удалось получить сток.", ephemeral=True)
        return

    e = create_stock_embed(data["seeds"], data["gear"], data["eggs"])
    await inter.followup.send(embed=e)

@bot.slash_command(
    name="say",
    description="Отправить сообщение от имени бота (только владелец)"
)
async def say(
    inter: disnake.ApplicationCommandInteraction,
    message: str
):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    await inter.response.send_message("✅ Отправлено", ephemeral=True)
    await inter.channel.send(message)

@bot.slash_command(
    name="embed",
    description="Отправить эмбед (только владелец)"
)
async def embed_cmd(
    inter: disnake.ApplicationCommandInteraction,
    title: str,
    text: str,
    embedcolor: str = None
):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    await inter.response.send_message("✅ Отправлено", ephemeral=True)

    # Цвет
    if embedcolor:
        try:
            color = disnake.Color(int(embedcolor.lstrip("#"), 16))
        except ValueError:
            color = disnake.Color.blurple()
    else:
        color = disnake.Color.blurple()

    emb = disnake.Embed(
        title=title,
        description=text,
        color=color
    )

    await inter.channel.send(embed=emb)

@bot.slash_command(
    name="combined",
    description="Отправить текст + эмбед без привязки к команде (только владелец)"
)
async def combined(
    inter: disnake.ApplicationCommandInteraction,
    realtext: str,
    title: str,
    embed: str,
    embedcolor: str
):
    # 🔒 Проверка владельца
    if inter.author.id != OWNER_ID:
        await inter.response.send_message(
            "❌ У тебя нет доступа к этой команде.",
            ephemeral=True
        )
        return

    # ✅ СРАЗУ отвечаем на команду невидимо
    await inter.response.send_message(
        "✅ Отправлено",
        ephemeral=True
    )

    # 🎨 HEX → color
    try:
        color_value = int(embedcolor.lstrip("#"), 16)
        color = disnake.Color(color_value)
    except ValueError:
        # если ошибка — просто не отправляем эмбед
        return

    emb = disnake.Embed(
        title=title,
        description=embed,
        color=color
    )

    # 📤 ОТПРАВЛЯЕМ СООБЩЕНИЕ УЖЕ ОТДЕЛЬНО ОТ КОМАНДЫ
    await inter.channel.send(
        content=realtext,
        embed=emb
    )

@bot.slash_command(description="Информация о пользователе")
async def userinfo(inter, user: disnake.User = None):
    m = user or inter.author
    e = disnake.Embed(title="Информация", color=0x00ffcc)
    e.set_thumbnail(url=m.display_avatar.url)
    e.add_field(name="Имя", value=m.name)
    e.add_field(name="ID", value=m.id)
    await inter.response.send_message(embed=e)

@bot.slash_command(description="Подбросить монетку")
async def coinflip(inter):
    await inter.response.send_message(random.choice(["Орёл", "Решка"]))

@bot.slash_command(description="Случайное число 1–100")
async def roll(inter):
    await inter.response.send_message(f"{random.randint(1, 100)}")

@bot.slash_command(description="Отправить случайный мем")
async def meme(inter):
    async with aiohttp.ClientSession() as s:
        async with s.get("https://meme-api.com/gimme") as r:
            d = await r.json()
            e = disnake.Embed(title=d["title"])
            e.set_image(url=d["url"])
            await inter.response.send_message(embed=e)

@bot.slash_command(description="Отправить случайного котика")
async def cat(inter):
    async with aiohttp.ClientSession() as s:
        async with s.get("https://api.thecatapi.com/v1/images/search") as r:
            d = await r.json()
            await inter.response.send_message(d[0]["url"])

@bot.slash_command(description="Отправить случайную собачку")
async def dog(inter):
    async with aiohttp.ClientSession() as s:
        async with s.get("https://dog.ceo/api/breeds/image/random") as r:
            d = await r.json()
            await inter.response.send_message(d["message"])

@bot.slash_command(description="Отправить случайного хомячка")
async def hamster(inter):
    async with aiohttp.ClientSession() as s:
        async with s.get(
            "https://api.night-api.com/images/animals/hamster",
            headers={"authorization": "wjeHiPP0rd-wXiN99rkH5iGKPqJBweF-2SoiKnAcZ8"}
        ) as r:
            d = await r.json()
            img = d.get("content", {}).get("url")
            await inter.response.send_message(img or "❌ Ошибка API.")

@bot.slash_command(description="Отправить случайную лису")
async def fox(inter):
    async with aiohttp.ClientSession() as s:
        async with s.get("https://randomfox.ca/floof/") as r:
            d = await r.json()
            await inter.response.send_message(d["image"])


@bot.slash_command(
    name="hnyc_start",
    description="Включить новогодний countdown (только владелец)"
)
async def hnyc_start(inter: disnake.ApplicationCommandInteraction):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    cfg = load_hnyc_config()
    cfg["enabled"] = True
    cfg["channel_id"] = inter.channel.id

    # сбрасываем дневные флаги, если включаем заново
    cfg["last_morning_date"] = None
    cfg["last_evening_date"] = None

    save_hnyc_config(cfg)

    await inter.response.send_message(
        "✅ Countdown включён в этом канале.",
        ephemeral=True
    )


@bot.slash_command(
    name="hnyc_stop",
    description="Выключить новогодний countdown (только владелец)"
)
async def hnyc_stop(inter: disnake.ApplicationCommandInteraction):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    cfg = load_hnyc_config()
    cfg["enabled"] = False
    save_hnyc_config(cfg)

    await inter.response.send_message(
        "🛑 Countdown выключен.",
        ephemeral=True
    )


@bot.slash_command(
    name="croles",
    description="Массово удалить роли (до 25, только владелец)"
)
async def croles(
    inter: disnake.ApplicationCommandInteraction,

    role1: disnake.Role = None,
    role2: disnake.Role = None,
    role3: disnake.Role = None,
    role4: disnake.Role = None,
    role5: disnake.Role = None,
    role6: disnake.Role = None,
    role7: disnake.Role = None,
    role8: disnake.Role = None,
    role9: disnake.Role = None,
    role10: disnake.Role = None,

    role11: disnake.Role = None,
    role12: disnake.Role = None,
    role13: disnake.Role = None,
    role14: disnake.Role = None,
    role15: disnake.Role = None,
    role16: disnake.Role = None,
    role17: disnake.Role = None,
    role18: disnake.Role = None,
    role19: disnake.Role = None,
    role20: disnake.Role = None,

    role21: disnake.Role = None,
    role22: disnake.Role = None,
    role23: disnake.Role = None,
    role24: disnake.Role = None,
    role25: disnake.Role = None,
):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    roles = [
        r for r in [
            role1, role2, role3, role4, role5,
            role6, role7, role8, role9, role10,
            role11, role12, role13, role14, role15,
            role16, role17, role18, role19, role20,
            role21, role22, role23, role24, role25
        ] if r
    ]

    if not roles:
        await inter.response.send_message("❌ Роли не выбраны.", ephemeral=True)
        return

    preview = "\n".join(f"• {r.name}" for r in roles)
    view = RoleDeleteConfirm(roles)

    await inter.response.send_message(
        content=f"🗑 **Эти роли будут удалены:**\n{preview}\n\nВы уверены?",
        view=view,
        ephemeral=True
    )

@bot.slash_command(
    name="channels_purge",
    description="Удалить сообщения в канале (до 14 дней)"
)
async def channels_purge(
    inter: disnake.ApplicationCommandInteraction,
    amount: int,
    channel: disnake.TextChannel = None
):
    if inter.author.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    if amount < 1 or amount > 1000:
        await inter.response.send_message("❌ Количество должно быть от 1 до 1000.", ephemeral=True)
        return

    target_channel = channel or inter.channel

    deleted = await target_channel.purge(limit=amount)

    await inter.response.send_message(
        f"🧹 Удалено сообщений: {len(deleted)}",
        ephemeral=True
    )


@bot.slash_command(
    name="inactive_check",
    description="Найти потенциально неактивных участников"
)
async def inactive_check(
    inter: disnake.ApplicationCommandInteraction,
    period: str = commands.Param(
        choices=[
            "1 неделя",
            "1 месяц",
            "3 месяца",
            "6 месяцев"
        ]
    )
):
    # 🔒 Проверка доступа
    if inter.author.id != OWNER_ID:
        await inter.response.send_message(
            "❌ Нет доступа.",
            ephemeral=True
        )
        return

    # ⏳ Говорим Discord'у: «я думаю»
    await inter.response.defer(ephemeral=True)

    # 🕒 Текущее время (timezone-aware!)
    now = datetime.now(timezone.utc)

    delta_map = {
        "1 неделя": timedelta(days=7),
        "1 месяц": timedelta(days=30),
        "3 месяца": timedelta(days=90),
        "6 месяцев": timedelta(days=180)
    }

    cutoff = now - delta_map[period]

    inactive = []

    for member in inter.guild.members:
        if member.bot:
            continue

        if not member.joined_at:
            continue

        joined_at = member.joined_at

        # 🔁 если joined_at без timezone — приводим к UTC
        if joined_at.tzinfo is None:
            joined_at = joined_at.replace(tzinfo=timezone.utc)

        if joined_at < cutoff:
            inactive.append((member, joined_at))

    # ❌ Никого не нашли
    if not inactive:
        await inter.followup.send(
            "✅ Неактивных участников не найдено.",
            ephemeral=True
        )
        return

    # 👀 Превью (первые 25)
    preview = "\n".join(
        f"• {m.mention} (с {ja.date()})"
        for m, ja in inactive[:25]
    )

    members_only = [m for m, _ in inactive]

    view = KickInactiveConfirm(members_only)

    # 📤 ВАЖНО: этот await ВНУТРИ функции
    await inter.followup.send(
        f"👤 **Потенциально неактивные ({period})**\n"
        f"Всего: **{len(inactive)}**\n\n"
        f"{preview}\n\n"
        f"⚠️ Будут кикнуты ТОЛЬКО выбранные",
        view=view,
        ephemeral=True
    )
    

# ===============================
# ▶ ЗАПУСК
# ===============================

keep_alive()
bot.run(TOKEN)













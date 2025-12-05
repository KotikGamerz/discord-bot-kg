import disnake
from disnake.ext import commands, tasks
from disnake.ui import View, Button
import random
import aiohttp
import os
from pathlib import Path
from dotenv import load_dotenv
import datetime
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

STOCK_ENABLED = False
STOCK_CHANNEL_ID = None

# ключевая фраза по которой ловим сток-бота
STOCK_TRIGGER_TEXT = "Grow A Garden Stock"

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
    await bot.sync_commands()
    print(f"✅ Бот онлайн как {bot.user}")

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
# 🧩 КОМАНДА /ping
# =======================================

@bot.slash_command(description="Проверка задержки")
async def ping(inter):
    await inter.response.send_message(f"{int(bot.latency * 1000)}мс")

# =======================================
# 🧩 КОМАНДА /stick
# =======================================

@bot.slash_command(
    name="stick",
    description="Создать / обновить рекламное сообщение в канале (только владелец)"
)
async def stick(
    inter: disnake.ApplicationCommandInteraction,
    message: str,
    embed_name: str,
    embed: str,
    color: str = "#5865F2"
):
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)

    cfg = {
        "text": message,
        "embed_title": embed_name,
        "embed_text": embed,
        "embed_color": color,
        "channel_id": inter.channel.id
    }

    await send_sticky_in_channel(inter.channel, cfg)

    await inter.followup.send("✅ Рекламка закреплена и будет автоматически переноситься вниз!", ephemeral=True)

# =======================================
# 🧩 ВСЕ ТВОИ ПРОШЛЫЕ КОМАНДЫ
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


# ===============================
# ▶ ЗАПУСК
# ===============================

keep_alive()
bot.run(TOKEN)

















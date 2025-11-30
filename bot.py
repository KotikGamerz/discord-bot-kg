import disnake
from disnake.ext import commands
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

# ===============================
# ЗАГРУЗКА .ENV
# ===============================

load_dotenv(dotenv_path=Path('.') / '.env')
TOKEN = os.getenv("DISCORD_TOKEN")

# ===============================
# ОСНОВНЫЕ КОНСТАНТЫ
# ===============================

OWNER_ID = 1167514315864162395  # твой ID
CONFIG_PATH = "stock_config.json"

# ===============================
# РАБОТА С КОНФИГОМ
# ===============================

def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)

# ===============================
# API ДЛЯ STOСK
# ===============================

async def fetch_stock():
    url = "https://ТВОЯ-ССЫЛКА.onrender.com/stock"  # ← ВСТАВЬ свою ссылку

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    print("❌ API вернул ошибку:", resp.status)
                    return None
                return await resp.json()
    except Exception as e:
        print("❌ Ошибка получения стока:", e)
        return None

# ===============================
# СБОРКА EMBED ДЛЯ СТОКА
# ===============================

def create_stock_embed(seeds, gear, eggs):
    timestamp = int(datetime.datetime.utcnow().timestamp())

    embed = disnake.Embed(
        title=f"🌱 Сток Grow A Garden — <t:{timestamp}:t>",
        color=disnake.Color.green()
    )

    embed.add_field(
        name="🌱 Семена",
        value="\n".join(seeds) if seeds else "Пусто",
        inline=True
    )
    embed.add_field(
        name="🛠 Инструменты",
        value="\n".join(gear) if gear else "Пусто",
        inline=True
    )
    embed.add_field(
        name="🥚 Яйца",
        value="\n".join(eggs) if eggs else "Сток не изменился",
        inline=True
    )

    return embed

# ===============================
# FLASK SERVER (KEEP ALIVE)
# ===============================

app = Flask('')

@app.route('/')
def home():
    return "Bot is alive!"

def run_web():
    app.run(host='0.0.0.0', port=3000)

def keep_alive():
    t = Thread(target=run_web)
    t.start()

# ===============================
# СОЗДАНИЕ БОТА
# ===============================

intents = disnake.Intents.default()
intents.members = True

bot = commands.InteractionBot(intents=intents)

# ===============================
# СОБЫТИЕ on_ready
# ===============================

@bot.event
async def on_ready():
    await bot.sync_commands()
    print(f"✅ Бот в сети как {bot.user}")
    print("✅ Slash-команды синхронизированы")

# ===============================
# КОМАНДЫ
# ===============================

@bot.slash_command(description="Проверка задержки")
async def ping(inter):
    latency = int(bot.latency * 1000)
    await inter.response.send_message(f"Бот онлайн и ответил с задержкой в {latency}мс")

@bot.slash_command(name="stock", description="Показать реальный сток Grow A Garden")
async def stock(inter: disnake.ApplicationCommandInteraction):
    await inter.response.defer()

    data = await fetch_stock()
    if not data:
        await inter.followup.send("❌ Не удалось получить данные стока.", ephemeral=True)
        return

    seeds = data.get("seeds", [])
    gear = data.get("gear", [])
    eggs = data.get("eggs", [])

    embed = create_stock_embed(seeds, gear, eggs)
    await inter.followup.send(embed=embed)

@bot.slash_command(description="Информация о пользователе")
async def userinfo(inter, user: disnake.User = None):
    member = user or inter.author
    embed = disnake.Embed(
        title="Информация",
        color=0x00ffcc
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.add_field(name="Имя", value=member.name)
    embed.add_field(name="ID", value=member.id)
    await inter.response.send_message(embed=embed)

@bot.slash_command(description="Показать список команд")
async def help(inter):
    msg = (
        "**Доступные команды:**\n"
        "/ping — задержка\n"
        "/userinfo — информация о пользователе\n"
        "/coinflip — монетка\n"
        "/roll — число 1–100\n"
        "/meme — мем\n"
        "/cat — котик\n"
        "/dog — собачка\n"
        "/hamster — хомячок\n"
        "/fox — лиса\n"
        "/penguin — пингвин\n"
        "/say — сказать от лица бота\n"
        "/embed — создать embed\n"
    )
    await inter.response.send_message(msg, ephemeral=True)

@bot.slash_command(description="Подбросить монетку")
async def coinflip(inter):
    await inter.response.send_message(random.choice(["Орёл 🦅", "Решка 💰"]))

@bot.slash_command(description="Случайное число 1–100")
async def roll(inter):
    await inter.response.send_message(f"🎯 {random.randint(1, 100)}")

@bot.slash_command(description="Случайный мем")
async def meme(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://meme-api.com/gimme") as resp:
            data = await resp.json()
            embed = disnake.Embed(title=data["title"])
            embed.set_image(url=data["url"])
            await inter.response.send_message(embed=embed)

@bot.slash_command(description="Прислать случайного котика 😺")
async def cat(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.thecatapi.com/v1/images/search") as resp:
            data = await resp.json()
            await inter.response.send_message(data[0]["url"])

@bot.slash_command(name="dog", description="Прислать случайную собачку 🐶")
async def dog(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://dog.ceo/api/breeds/image/random") as resp:
            data = await resp.json()
            await inter.response.send_message(data.get("message"))

@bot.slash_command(name="hamster", description="Картинка хомячка 🐹")
async def hamster(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.night-api.com/images/animals/hamster",
            headers={"authorization": "wjeHiPP0rd-wXiN99rkH5iGKPqJBweF-2SoiKnAcZ8"}
        ) as resp:
            data = await resp.json()
            img = data.get("content", {}).get("url")
            await inter.response.send_message(img or "❌ Не удалось получить хомячка.")

@bot.slash_command(name="fox", description="Картинка лисы 🦊")
async def fox(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://randomfox.ca/floof/") as resp:
            data = await resp.json()
            await inter.response.send_message(data.get("image"))

@bot.slash_command(name="penguin", description="Картинка пингвина 🐧")
async def penguin(inter):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://source.unsplash.com/random/800x600/?penguin") as resp:
            await inter.response.send_message(str(resp.url))

# ===============================
# SAY
# ===============================

@bot.slash_command(name="say", description="Отправить сообщение от бота (только владелец)")
async def say(inter, message: str):
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)
    await inter.channel.send(message)
    await inter.followup.send("✅ Сообщение отправлено!", ephemeral=True)

# ===============================
# EMBED
# ===============================

@bot.slash_command(name="embed", description="Создать embed (только владелец)")
async def embed_command(inter, title: str, text: str, color: str = "#5865F2"):
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)

    try:
        embed_color = int(color.replace("#", ""), 16)
    except:
        embed_color = 0x5865F2

    embed = disnake.Embed(title=title, description=text, color=embed_color)
    await inter.channel.send(embed=embed)
    await inter.followup.send(f"✅ Embed отправлен!", ephemeral=True)

# ===============================
# COMBINED
# ===============================

@bot.slash_command(name="combined", description="Текст + embed (только владелец)")
async def combined(inter, realtext: str, title: str, embed: str, embedcolor: str = "#5865F2"):
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)

    try:
        embed_color = int(embedcolor.replace("#", ""), 16)
    except:
        embed_color = 0x5865F2

    em = disnake.Embed(title=title, description=embed, color=embed_color)
    await inter.channel.send(content=realtext, embed=em)

# ===============================
# МЕНЮ УДАЛЕНИЯ РОЛЕЙ
# ===============================

class RoleDeleteConfirm(View):
    def __init__(self, roles_to_delete):
        super().__init__(timeout=60)
        self.roles_to_delete = roles_to_delete

    @disnake.ui.button(label="✅ Продолжить", style=disnake.ButtonStyle.danger)
    async def confirm(self, button: Button, inter: disnake.MessageInteraction):
        if inter.user.id != OWNER_ID:
            await inter.response.send_message("❌ Это не твоя кнопка.", ephemeral=True)
            return

        await inter.response.defer(ephemeral=True)

        deleted = 0
        skipped = 0

        for role in self.roles_to_delete:
            try:
                await role.delete()
                deleted += 1
            except:
                skipped += 1

        await inter.followup.send(
            content=f"✅ Готово!\nУдалено: {deleted}\nПропущено: {skipped}",
            ephemeral=True
        )

    @disnake.ui.button(label="❌ Отмена", style=disnake.ButtonStyle.secondary)
    async def cancel(self, button: Button, inter: disnake.MessageInteraction):
        if inter.user.id != OWNER_ID:
            await inter.response.send_message("❌ Это не твоя кнопка.", ephemeral=True)
            return

        await inter.response.defer(ephemeral=True)
        await inter.followup.send("❌ Удаление отменено.", ephemeral=True)

@bot.slash_command(
    name="croles",
    description="Удаление выбранных ролей с подтверждением"
)
async def croles(
    inter: disnake.ApplicationCommandInteraction,
    role1:  disnake.Role = commands.Param(default=None),
    role2:  disnake.Role = commands.Param(default=None),
    role3:  disnake.Role = commands.Param(default=None),
    role4:  disnake.Role = commands.Param(default=None),
    role5:  disnake.Role = commands.Param(default=None),
    role6:  disnake.Role = commands.Param(default=None),
    role7:  disnake.Role = commands.Param(default=None),
    role8:  disnake.Role = commands.Param(default=None),
    role9:  disnake.Role = commands.Param(default=None),
    role10: disnake.Role = commands.Param(default=None),
    role11: disnake.Role = commands.Param(default=None),
    role12: disnake.Role = commands.Param(default=None),
    role13: disnake.Role = commands.Param(default=None),
    role14: disnake.Role = commands.Param(default=None),
    role15: disnake.Role = commands.Param(default=None),
    role16: disnake.Role = commands.Param(default=None),
    role17: disnake.Role = commands.Param(default=None),
    role18: disnake.Role = commands.Param(default=None),
    role19: disnake.Role = commands.Param(default=None),
    role20: disnake.Role = commands.Param(default=None),
    role21: disnake.Role = commands.Param(default=None),
    role22: disnake.Role = commands.Param(default=None),
    role23: disnake.Role = commands.Param(default=None),
    role24: disnake.Role = commands.Param(default=None),
    role25: disnake.Role = commands.Param(default=None),
):
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Нет доступа.", ephemeral=True)
        return

    await inter.response.defer(ephemeral=True)

    input_roles = [
        role1, role2, role3, role4, role5,
        role6, role7, role8, role9, role10,
        role11, role12, role13, role14, role15,
        role16, role17, role18, role19, role20,
        role21, role22, role23, role24, role25,
    ]

    roles_to_delete = [
        r for r in input_roles
        if isinstance(r, disnake.Role)
    ]

    if not roles_to_delete:
        await inter.followup.send("❌ Ты не выбрал ни одной роли.", ephemeral=True)
        return

    preview = "\n".join(f"• {r.name}" for r in roles_to_delete)
    view = RoleDeleteConfirm(roles_to_delete)

    await inter.followup.send(
        content=f"🗑 **Эти роли будут удалены:**\n{preview}\n\nВы уверены?",
        view=view,
        ephemeral=True
    )


# ===============================
# ЗАПУСК
# ===============================

keep_alive()
bot.run(TOKEN)














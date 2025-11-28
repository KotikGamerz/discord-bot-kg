import disnake
from disnake.ext import commands
import random
import aiohttp
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path('.') / '.env')
from flask import Flask
from threading import Thread
import datetime

def create_stock_embed(seeds, gear, eggs):
    timestamp = int(datetime.datetime.utcnow().timestamp())  # ✅ с отступом

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


app = Flask('')

@app.route('/')
def home():
    return "Bot is alive!"

def run_web():
    app.run(host='0.0.0.0', port=3000)

def keep_alive():
    t = Thread(target=run_web)
    t.start()

OWNER_ID = 1167514315864162395  

intents = disnake.Intents.default()
intents.members = True

bot = commands.InteractionBot(intents=intents)


@bot.event
async def on_ready():
    await bot.sync_commands()
    print(f"✅ Бот в сети как {bot.user}")
    print("✅ Slash-команды синхронизированы")



@bot.slash_command(description="Проверка задержки")
async def ping(inter):
    latency = int(bot.latency * 1000)
    await inter.response.send_message(f"Бот онлайн и ответил с задержкой в {latency}мс")


@bot.slash_command(name="stock", description="Показать сток Grow A Garden (тестовый)")
async def stock(inter: disnake.ApplicationCommandInteraction):
    test_seeds = [
        "🍉 Watermelon x5",
        "🌼 Daffodil x7",
        "🍅 Tomato x1",
        "🫐 Blueberry x2",
    ]

    test_gear = [
        "💧 Basic Sprinkler x3",
        "🔧 Wrench x1"
    ]

    test_eggs = [
        "🥚 Uncommon Egg x1",
        "🥚 Rare Egg x1"
    ]

    embed = create_stock_embed(test_seeds, test_gear, test_eggs)
    await inter.response.send_message(embed=embed)


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
        "/userinfo — информацмя о пользователе\n"
        "/coinflip — брось монетку\n"
        "/roll — рандомное число 1–100\n"
        "/meme — случайный мем\n"
        "/cat — случайный котик 🐱\n"
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


@bot.slash_command(
    name="dog",
    description="Прислать случайную собачку 🐶"
)
async def dog(inter: disnake.ApplicationCommandInteraction):
    # Делаем запрос к API собачек
    async with aiohttp.ClientSession() as session:
        async with session.get("https://dog.ceo/api/breeds/image/random") as resp:
            if resp.status != 200:
                await inter.response.send_message(
                    "❌ Не удалось получить собачку, попробуй ещё раз позже.",
                    ephemeral=True
                )
                return

            data = await resp.json()
            image_url = data.get("message")

            if not image_url:
                await inter.response.send_message(
                    "❌ API вернуло что-то странное без собачки. Попробуй позже.",
                    ephemeral=True
                )
                return

            # Отправляем картинку собаки
            await inter.response.send_message(image_url)


@bot.slash_command(
    name="hamster",
    description="Показывает случайную картинку хомячка 🐹"
)
async def hamster(inter: disnake.ApplicationCommandInteraction):
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.night-api.com/images/animals/hamster",
            headers={"authorization": "wjeHiPP0rd-wXiN99rkH5iGKPqJBweF-2SoiKnAcZ8"}
        ) as resp:
            if resp.status != 200:
                await inter.response.send_message(
                    "❌ Не удалось получить хомячка, попробуй позже.",
                    ephemeral=True
                )
                return

            data = await resp.json()
            image_url = data.get("content", {}).get("url") 

            if not image_url:
                await inter.response.send_message(
                    "⚠️ Ответ API пустой. Попробуй ещё раз позже.",
                    ephemeral=True
                )
                return

            await inter.response.send_message(image_url)


@bot.slash_command(
    name="fox",
    description="Показывает случайную картинку лисы 🦊"
)
async def fox(inter: disnake.ApplicationCommandInteraction):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://randomfox.ca/floof/") as resp:
            if resp.status != 200:
                await inter.response.send_message(
                    "❌ Не удалось получить лису, попробуй позже.",
                    ephemeral=True
                )
                return
            data = await resp.json()
            image_url = data.get("image")

            if not image_url:
                await inter.response.send_message(
                    "⚠️ Ответ API пустой, попробуй ещё раз.",
                    ephemeral=True
                )
                return

            await inter.response.send_message(image_url)


@bot.slash_command(
    name="penguin",
    description="Показывает случайную картинку пингвина 🐧"
)
async def penguin(inter: disnake.ApplicationCommandInteraction):
    async with aiohttp.ClientSession() as session:
        async with session.get("https://source.unsplash.com/random/800x600/?penguin") as resp:
            image_url = str(resp.url)
            await inter.response.send_message(image_url)






@bot.slash_command(
    name="say",
    description="Отправить сообщение в канал от лица бота (только владелец)"
)
async def say(inter: disnake.ApplicationCommandInteraction, message: str):
    # доступ только владельцу
    if inter.user.id != OWNER_ID:
        await inter.response.send_message("❌ Только владелец может использовать эту команду.", ephemeral=True)
        return

    # мгновенно подтверждаем, чтобы не словить 'Unknown interaction'
    await inter.response.defer(ephemeral=True)

    # публичное сообщение в текущий канал
    await inter.channel.send(message)

    # скрытое уведомление только тебе
    await inter.followup.send("✅ Сообщение отправлено!", ephemeral=True)


@bot.slash_command(
    name="embed",
    description="Создать embed-сообщение (только для владельца)"
)
async def embed_command(
    inter: disnake.ApplicationCommandInteraction,
    title: str,
    text: str,
    color: str = "#5865F2"  # фиолетовый по умолчанию
):
    # проверка на владельца
    if inter.user.id != OWNER_ID:
        await inter.response.send_message(
            "❌ Только владелец бота может использовать эту команду.",
            ephemeral=True
        )
        return

    # подтверждаем команду
    await inter.response.defer(ephemeral=True)

    # пробуем преобразовать строку цвета (например, "#00ff00") в число
    try:
        embed_color = int(color.replace("#", ""), 16)
    except ValueError:
        embed_color = 0x5865F2  # fallback если цвет неверный

    # создаём embed
    embed = disnake.Embed(
        title=title,
        description=text,
        color=embed_color
    )

    # отправляем embed в канал
    await inter.channel.send(embed=embed)

     # уведомление только тебе
    await inter.followup.send(f"✅ Embed отправлен! Цвет: {color}", ephemeral=True)


@bot.slash_command(
    name="combined",
    description="Отправляет сообщение с текстом и embed (только для владельца)"
)
async def combined(
    inter: disnake.ApplicationCommandInteraction,
    realtext: str,
    title: str,
    embed: str,
    embedcolor: str = "#5865F2"  # фиолетовый по умолчанию
):
    # Проверяем, что команду вызывает владелец
    if inter.user.id != OWNER_ID:
        await inter.response.send_message(
            "❌ Только владелец бота может использовать эту команду.",
            ephemeral=True
        )
        return

    # Подтверждаем команду
    await inter.response.defer(ephemeral=True)

    # Преобразуем цвет (например, "#00ff00" -> зелёный)
    try:
        embed_color = int(embedcolor.replace("#", ""), 16)
    except ValueError:
        embed_color = 0x5865F2  # стандартный цвет Discord

    # Создаём embed
    em = disnake.Embed(
        title=title,
        description=embed,
        color=embed_color
    )

    # Отправляем одно сообщение: текст + embed
    await inter.channel.send(content=realtext, embed=em)



OWNER_ID = 1167514315864162395 

from disnake.ui import View, Button
from disnake.ext import commands
import disnake


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
            content=f"✅ Готово!\nУдалено ролей: {deleted}\nПропущено: {skipped}",
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

    roles_to_delete = []
    for r in input_roles:
        if r and r not in roles_to_delete:
            roles_to_delete.append(r)

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

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

keep_alive()

bot.run(TOKEN)










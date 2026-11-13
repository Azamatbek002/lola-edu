"""Lola Edu reklama boti.

Bot kanallarga admin qilib qo'shiladi. Administrator botga xabar yuboradi,
tasdiqlagach bot o'sha xabarni barcha kanallarga bir vaqtda nusxalaydi.
"""

import asyncio
import html
import itertools
import logging
import os
from dataclasses import dataclass

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ChatType, ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    CallbackQuery,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from dotenv import load_dotenv

from db import DB

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_IDS = {int(x) for x in os.environ["ADMIN_IDS"].replace(" ", "").split(",") if x}
# Railway'da disk (Volume) ulansa, kanallar ro'yxati o'sha diskda saqlanadi va qayta ishga tushganda yo'qolmaydi.
DATA_DIR = os.getenv("RAILWAY_VOLUME_MOUNT_PATH") or os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.getenv("DB_PATH", os.path.join(DATA_DIR, "bot.db"))
# Telegram bir botga sekundiga ~30 ta xabar ruxsat beradi, biroz zaxira qoldiramiz.
MESSAGES_PER_SECOND = float(os.getenv("MESSAGES_PER_SECOND", "25"))
ALBUM_WAIT_SECONDS = 1.5

log = logging.getLogger("lola-bot")
db = DB(DB_PATH)
router = Router()


@dataclass
class Post:
    token: int
    from_chat_id: int
    message_ids: list[int]


# Har bir admin uchun tasdiq kutayotgan xabar.
pending_posts: dict[int, Post] = {}
# Albom (bir nechta rasm/video) qismlari bittadan keladi, ularni yig'ib olamiz.
album_parts: dict[str, list[Message]] = {}
tokens = itertools.count(1)


def is_admin(user_id: int | None) -> bool:
    return user_id in ADMIN_IDS


def channel_name(row) -> str:
    title = html.escape(row["title"] or str(row["chat_id"]))
    return f"{title} (@{row['username']})" if row["username"] else title


async def notify_admins(bot: Bot, text: str) -> None:
    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(admin_id, text)
        except TelegramAPIError:
            # Admin hali botga /start bosmagan bo'lishi mumkin.
            pass


async def send_long(message: Message, lines: list[str]) -> None:
    chunk = ""
    for line in lines:
        if len(chunk) + len(line) + 1 > 4000:
            await message.answer(chunk)
            chunk = ""
        chunk += line + "\n"
    if chunk:
        await message.answer(chunk)


# ---------------------------------------------------------------------------
# Bot kanalga qo'shilganda / olib tashlanganda
# ---------------------------------------------------------------------------


@router.my_chat_member(F.chat.type == ChatType.CHANNEL)
async def on_bot_status_changed(event: ChatMemberUpdated, bot: Bot) -> None:
    chat = event.chat
    member = event.new_chat_member
    title = html.escape(chat.title or str(chat.id))

    if member.status == ChatMemberStatus.ADMINISTRATOR:
        if getattr(member, "can_post_messages", False):
            db.upsert_channel(chat.id, chat.title, chat.username)
            await notify_admins(
                bot, f"✅ Yangi kanal qo'shildi: <b>{title}</b>\nJami kanallar: {db.count_active()}"
            )
        else:
            db.deactivate_channel(chat.id)
            await notify_admins(
                bot,
                f"⚠️ <b>{title}</b> kanalida botga «Xabar joylash» huquqi berilmagan. "
                "Huquqni yoqing, shunda kanal ro'yxatga qo'shiladi.",
            )
    elif member.status in (ChatMemberStatus.LEFT, ChatMemberStatus.KICKED, ChatMemberStatus.MEMBER):
        if db.deactivate_channel(chat.id):
            await notify_admins(
                bot,
                f"➖ Bot <b>{title}</b> kanalidan olib tashlandi.\n"
                f"Jami kanallar: {db.count_active()}",
            )


# ---------------------------------------------------------------------------
# Admin buyruqlari
# ---------------------------------------------------------------------------

HELP_TEXT = (
    "👋 <b>Lola Edu reklama boti</b>\n\n"
    "Menga istalgan xabar yuboring (matn, rasm, video, albom, fayl...). "
    "Tasdiqlaganingizdan so'ng uni barcha kanallarga bir vaqtda joylayman.\n\n"
    "<b>Buyruqlar:</b>\n"
    "/kanallar — ulangan kanallar ro'yxati\n"
    "/tekshir — bot hamon admin ekanini tekshirish\n"
    "/qosh @kanal — kanalni qo'lda qo'shish\n"
    "/olib_tashla -100123... — kanalni ro'yxatdan chiqarish\n"
    "/ochir — oxirgi reklamani barcha kanallardan o'chirish\n\n"
    "Kanal qo'shish uchun: botni kanalga admin qiling va "
    "«Xabar joylash» huquqini bering — bot o'zi ro'yxatga oladi."
)

admin_only = F.from_user.id.in_(ADMIN_IDS)
private = F.chat.type == ChatType.PRIVATE


@router.message(CommandStart(), private, admin_only)
@router.message(Command("help", "yordam"), private, admin_only)
async def cmd_start(message: Message) -> None:
    await message.answer(HELP_TEXT + f"\n\nHozir ulangan kanallar: <b>{db.count_active()}</b>")


@router.message(Command("kanallar"), private, admin_only)
async def cmd_channels(message: Message) -> None:
    channels = db.active_channels()
    if not channels:
        await message.answer("Hali birorta kanal ulanmagan. Botni kanalga admin qilib qo'shing.")
        return
    lines = [f"📋 <b>Kanallar: {len(channels)} ta</b>", ""]
    lines += [f"{i}. {channel_name(ch)} — <code>{ch['chat_id']}</code>" for i, ch in enumerate(channels, 1)]
    await send_long(message, lines)


@router.message(Command("qosh"), private, admin_only)
async def cmd_add(message: Message, command: CommandObject, bot: Bot) -> None:
    if not command.args:
        await message.answer("Foydalanish: <code>/qosh @kanal_username</code> yoki <code>/qosh -100123456789</code>")
        return
    ref = command.args.strip()
    try:
        chat = await bot.get_chat(int(ref) if ref.lstrip("-").isdigit() else ref)
        me = await bot.get_chat_member(chat.id, bot.id)
    except TelegramAPIError as e:
        await message.answer(f"❌ Kanal topilmadi yoki bot unda yo'q: {html.escape(str(e))}")
        return
    if chat.type != ChatType.CHANNEL:
        await message.answer("❌ Bu kanal emas.")
        return
    if me.status != ChatMemberStatus.ADMINISTRATOR or not getattr(me, "can_post_messages", False):
        await message.answer("❌ Bot bu kanalda admin emas yoki «Xabar joylash» huquqi yo'q.")
        return
    db.upsert_channel(chat.id, chat.title, chat.username)
    await message.answer(f"✅ <b>{html.escape(chat.title or ref)}</b> qo'shildi. Jami: {db.count_active()}")


@router.message(Command("olib_tashla"), private, admin_only)
async def cmd_remove(message: Message, command: CommandObject) -> None:
    ref = (command.args or "").strip()
    if not ref.lstrip("-").isdigit():
        await message.answer("Foydalanish: <code>/olib_tashla -100123456789</code> (ID ni /kanallar dan oling)")
        return
    if db.deactivate_channel(int(ref)):
        await message.answer(f"✅ Kanal ro'yxatdan chiqarildi. Jami: {db.count_active()}")
    else:
        await message.answer("Bunday faol kanal topilmadi.")


@router.message(Command("tekshir"), private, admin_only)
async def cmd_check(message: Message, bot: Bot) -> None:
    channels = db.active_channels()
    status = await message.answer(f"⏳ {len(channels)} ta kanal tekshirilmoqda...")
    removed = []
    for ch in channels:
        try:
            me = await bot.get_chat_member(ch["chat_id"], bot.id)
            ok = me.status == ChatMemberStatus.ADMINISTRATOR and getattr(me, "can_post_messages", False)
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after + 1)
            continue
        except TelegramAPIError:
            ok = False
        if not ok:
            db.deactivate_channel(ch["chat_id"])
            removed.append(channel_name(ch))
        await asyncio.sleep(0.05)
    text = f"✅ Tekshiruv tugadi. Faol kanallar: <b>{db.count_active()}</b>"
    if removed:
        text += "\n\nQuyidagilarda bot admin emas, ro'yxatdan chiqarildi:\n" + "\n".join(f"• {r}" for r in removed)
    await status.edit_text(text[:4000])


@router.message(Command("ochir"), private, admin_only)
async def cmd_delete_last(message: Message) -> None:
    last = db.last_broadcast_with_messages()
    if not last:
        await message.answer("O'chiriladigan reklama yo'q.")
        return
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🗑 Ha, o'chirish", callback_data=f"del:{last['id']}")],
            [InlineKeyboardButton(text="Bekor qilish", callback_data="del:cancel")],
        ]
    )
    await message.answer(
        f"Oxirgi reklama (#{last['id']}, {last['ok']} ta kanalga yuborilgan) barcha kanallardan o'chirilsinmi?",
        reply_markup=kb,
    )


@router.callback_query(F.data.startswith("del:"), admin_only)
async def on_delete_confirm(call: CallbackQuery, bot: Bot) -> None:
    value = call.data.split(":", 1)[1]
    if value == "cancel":
        await call.message.edit_text("Bekor qilindi.")
        return
    broadcast_id = int(value)
    sent = db.sent_messages(broadcast_id)
    await call.message.edit_text(f"⏳ {len(sent)} ta kanaldan o'chirilmoqda...")
    deleted = failed = 0
    for chat_id, message_ids in sent.items():
        try:
            await bot.delete_messages(chat_id, message_ids)
            deleted += 1
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after + 1)
            try:
                await bot.delete_messages(chat_id, message_ids)
                deleted += 1
            except TelegramAPIError:
                failed += 1
        except TelegramAPIError:
            failed += 1
        await asyncio.sleep(1 / MESSAGES_PER_SECOND)
    db.forget_sent(broadcast_id)
    text = f"🗑 {deleted} ta kanaldan o'chirildi."
    if failed:
        text += f"\n❌ {failed} ta kanalda o'chirib bo'lmadi (48 soatdan eski bo'lishi mumkin)."
    await call.message.edit_text(text)


# ---------------------------------------------------------------------------
# Reklama yuborish
# ---------------------------------------------------------------------------


async def offer_post(message: Message, message_ids: list[int]) -> None:
    count = db.count_active()
    if count == 0:
        await message.answer("Hali birorta kanal ulanmagan. Avval botni kanallarga admin qiling.")
        return
    post = Post(token=next(tokens), from_chat_id=message.chat.id, message_ids=sorted(message_ids))
    pending_posts[message.from_user.id] = post
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"✅ {count} ta kanalga yuborish", callback_data=f"send:{post.token}")],
            [InlineKeyboardButton(text="❌ Bekor qilish", callback_data=f"cancel:{post.token}")],
        ]
    )
    await message.reply("Shu xabar barcha kanallarga yuborilsinmi?", reply_markup=kb)


async def copy_with_retry(bot: Bot, chat_id: int, post: Post) -> list[int]:
    for _ in range(3):
        try:
            result = await bot.copy_messages(chat_id, post.from_chat_id, post.message_ids)
            return [m.message_id for m in result]
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after + 1)
    raise RuntimeError("Telegram cheklovi (flood limit)")


async def broadcast(bot: Bot, admin_id: int, post: Post) -> tuple[int, list[str]]:
    channels = db.active_channels()
    broadcast_id = db.create_broadcast(admin_id)
    # Har bir kanalga yuborishni biroz siljitib boshlaymiz — Telegram limitidan oshmaslik uchun.
    step = len(post.message_ids) / MESSAGES_PER_SECOND

    async def send_to(index: int, ch) -> str | None:
        await asyncio.sleep(index * step)
        try:
            ids = await copy_with_retry(bot, ch["chat_id"], post)
            db.add_sent(broadcast_id, ch["chat_id"], ids)
            return None
        except TelegramForbiddenError:
            db.deactivate_channel(ch["chat_id"])
            return f"{channel_name(ch)} — bot kanaldan chiqarilgan"
        except Exception as e:  # noqa: BLE001 — bitta kanal xatosi qolganlarini to'xtatmasin
            log.warning("Kanalga yuborilmadi %s: %s", ch["chat_id"], e)
            return f"{channel_name(ch)} — {html.escape(str(e))}"

    results = await asyncio.gather(*(send_to(i, ch) for i, ch in enumerate(channels)))
    errors = [r for r in results if r]
    ok = len(channels) - len(errors)
    db.finish_broadcast(broadcast_id, ok, len(errors))
    return ok, errors


@router.callback_query(F.data.startswith(("send:", "cancel:")), admin_only)
async def on_post_confirm(call: CallbackQuery, bot: Bot) -> None:
    action, token = call.data.split(":", 1)
    post = pending_posts.get(call.from_user.id)
    if not post or post.token != int(token):
        await call.answer("Bu so'rov eskirgan. Xabarni qaytadan yuboring.", show_alert=True)
        await call.message.edit_reply_markup(reply_markup=None)
        return
    del pending_posts[call.from_user.id]

    if action == "cancel":
        await call.message.edit_text("❌ Bekor qilindi.")
        return

    await call.answer()
    await call.message.edit_text(f"⏳ {db.count_active()} ta kanalga yuborilmoqda...")
    ok, errors = await broadcast(bot, call.from_user.id, post)
    text = f"✅ Yuborildi: <b>{ok}</b> ta kanalga"
    if errors:
        text += f"\n❌ Xato: <b>{len(errors)}</b> ta\n\n" + "\n".join(f"• {e}" for e in errors)
    await call.message.edit_text(text[:4000])


@router.message(private, admin_only, F.media_group_id)
async def on_album_part(message: Message) -> None:
    key = message.media_group_id
    if key in album_parts:
        album_parts[key].append(message)
        return
    album_parts[key] = [message]
    await asyncio.sleep(ALBUM_WAIT_SECONDS)
    parts = album_parts.pop(key)
    await offer_post(parts[0], [m.message_id for m in parts])


@router.message(private, admin_only)
async def on_post(message: Message) -> None:
    await offer_post(message, [message.message_id])


@router.message(private)
async def on_stranger(message: Message) -> None:
    await message.answer(
        "Bu bot faqat Lola Edu administratorlari uchun.\n"
        f"Sizning ID: <code>{message.from_user.id}</code>"
    )


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)
    log.info("Bot ishga tushdi. Faol kanallar: %s", db.count_active())
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())

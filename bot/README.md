# Lola Edu reklama boti

Bot bir nechta (masalan, 100 ta) kanalga admin qilib qo'shiladi. Siz botga xabar yuborasiz,
«Yuborish» tugmasini bosasiz — bot o'sha xabarni barcha kanallarga bir vaqtda joylaydi.

- Matn, rasm, video, albom, fayl, ovozli xabar, tugmali post — hammasi qo'llab-quvvatlanadi.
- Post kanallarda «Forwarded from» belgisisiz, xuddi kanalning o'z posti kabi chiqadi.
- Botni kanalga admin qilsangiz, u kanalni o'zi ro'yxatga oladi (qo'lda ID kiritish shart emas).
- Har yuborishdan keyin hisobot: nechta kanalga ketdi, qaysilarida xato bo'ldi.
- `/ochir` — oxirgi reklamani barcha kanallardan bir bosishda o'chirish (48 soat ichida).

## 1. Botni yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) ga `/newbot` yozing, nom bering va **token**ni oling.
2. O'z Telegram ID ingizni bilib oling ([@userinfobot](https://t.me/userinfobot) orqali).

## 2. Ishga tushirish

Bot doim ishlab turishi kerak, shuning uchun uni serverga (VPS) qo'yish tavsiya etiladi.
Python 3.10 yoki yangisi kerak.

```bash
cd bot
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env      # keyin .env ichiga BOT_TOKEN va ADMIN_IDS ni yozing
.venv/bin/python main.py
```

Serverda doimiy ishlashi uchun systemd xizmati (`/etc/systemd/system/lola-bot.service`):

```ini
[Unit]
Description=Lola Edu reklama boti
After=network-online.target

[Service]
WorkingDirectory=/opt/lola-edu/bot
ExecStart=/opt/lola-edu/bot/.venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now lola-bot
sudo journalctl -u lola-bot -f   # loglarni ko'rish
```

## 3. Kanallarga qo'shish

Har bir kanalda: **Kanal sozlamalari → Administratorlar → Admin qo'shish → botni tanlang**.
Kamida **«Xabar joylash»** huquqi yoqilgan bo'lsin («Xabarlarni o'chirish» ham bo'lsa, `/ochir` ishlaydi).

Bot har bir yangi kanalni o'zi ro'yxatga oladi va sizga «✅ Yangi kanal qo'shildi» deb yozadi.
Agar bot kanalga u ishga tushmasdan oldin qo'shilgan bo'lsa, `/qosh @kanal_username` bilan qo'shing.

## 4. Har kungi ish

1. Botga reklama postini yuboring (yoki boshqa joydan forward qiling).
2. «✅ 100 ta kanalga yuborish» tugmasini bosing.
3. Bot hisobot yuboradi.

## Buyruqlar

| Buyruq | Vazifasi |
| --- | --- |
| `/kanallar` | Ulangan kanallar ro'yxati |
| `/tekshir` | Bot hamon admin ekanini tekshiradi, admin bo'lmaganlarini ro'yxatdan chiqaradi |
| `/qosh @kanal` | Kanalni qo'lda qo'shish |
| `/olib_tashla -100…` | Kanalni ro'yxatdan chiqarish |
| `/ochir` | Oxirgi reklamani barcha kanallardan o'chirish |

## Eslatmalar

- Telegram bitta botga sekundiga ~30 ta xabar ruxsat beradi. Bot shunga moslab yuboradi:
  100 ta kanalga oddiy post taxminan 4 soniyada, 5 ta rasmli albom ~20 soniyada tarqaladi.
- Kanallar ro'yxati `data/bot.db` faylida saqlanadi — serverni ko'chirsangiz shu faylni ham olib o'ting.
- `.env` faylidagi tokenni hech kimga bermang va git'ga yuklamang.

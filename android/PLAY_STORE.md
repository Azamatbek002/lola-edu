# Lola Edu — Google Play'ga chiqarish

Android ilova — **Trusted Web Activity**: `lola-edu.vercel.app` ni brauzer satrisiz, to'liq ekranda ochadi.
Ma'lumotlar Supabase serverida (haqiqiy baza); saytdagi har bir yangilanish ilovaga darhol keladi.
Play Market'ga qayta yuklash faqat nom, ikonka, versiya yoki Android talablari o'zgarganda kerak.

| | |
|---|---|
| Paket nomi | `uz.lolaedu.app` (o'zgartirib bo'lmaydi) |
| Minimal Android | 7.0 (API 24) |
| Target | Android 16 (API 36) |
| Fayllar | `app-release.aab` — Play Market'ga; `app-release.apk` — telefonga to'g'ridan-to'g'ri o'rnatib sinash uchun |
| Material | `store/` — ikonka 512, banner 1024×500, 6 ta skrinshot 1080×1920 |

---

## 1. Play Console hisobi (egasi qiladi)

1. <https://play.google.com/console> → **Shaxsiy (Personal)** hisob, bir martalik $25, pasport va telefon tasdiqlash (1–3 kun).
2. **Muhim:** 2023-yildan keyin ochilgan shaxsiy hisoblar ilovani hammaga chiqarishdan oldin
   **yopiq test** o'tkazishi shart: kamida **12 tester**, **14 kun** uzluksiz.
   Testerlar: o'qituvchilar, qabulxona, o'quvchilar yoki ota-onalar (Gmail kerak).
   (Tashkilot hisobi — D-U-N-S raqami bilan — bu talabdan ozod, lekin ochilishi uzoqroq.)

## 2. Ilova yaratish

**Create app** → nomi `Lola Edu — Türk Dili Markazi`, til: O'zbek, App, Free.

## 3. Do'kon sahifasi (Main store listing)

**Nomi (30):** `Lola Edu — Türk Dili Markazi`

**Qisqa tavsif (80):**
- uz: `Turk tili markazi: dars jadvali, davomat, to'lovlar va baholar bitta ilovada`
- ru: `Центр турецкого: расписание, посещаемость, оплаты и оценки в одном приложении`

**To'liq tavsif (uz):**

```
Lola Edu — Toshkentdagi Lola Edu Türk Dili Markazining rasmiy ilovasi. O'quvchilar, ota-onalar, o'qituvchilar va markaz xodimlari uchun.

O'quvchi va ota-ona uchun:
• Dars jadvali va keyingi dars
• Davomat, baholar va uy vazifalari
• To'lovlar tarixi, keyingi to'lov sanasi va qarzdorlik
• Telegram orqali eslatmalar

O'qituvchi uchun:
• Bir bosishda davomat belgilash
• Baho va uy vazifasi qo'yish
• O'z guruhlari va dars jadvali

Markaz rahbariyati uchun:
• O'quvchilar, guruhlar va xonalar
• Oylik to'lovlar: har bir guruh alohida, har o'quvchining to'lov sanasi
• Qarzdorlar va avtomatik eslatmalar
• Lidlar (CRM), marketing va hisobotlar
• Xarajatlar va o'qituvchilar ish haqi

Ilova o'zbek, rus va turk tillarida ishlaydi. Kirish markaz bergan login va parol bilan amalga oshiriladi.
```

**To'liq tavsif (ru):**

```
Lola Edu — официальное приложение центра турецкого языка Lola Edu Türk Dili Markazi (Ташкент). Для учеников, родителей, преподавателей и сотрудников центра.

Ученикам и родителям:
• Расписание и ближайший урок
• Посещаемость, оценки и домашние задания
• История оплат, дата следующего платежа и задолженность
• Напоминания в Telegram

Преподавателям:
• Отметка посещаемости в одно касание
• Оценки и домашние задания
• Свои группы и расписание

Руководству центра:
• Ученики, группы и кабинеты
• Ежемесячные оплаты по каждой группе, срок оплаты у каждого ученика
• Должники и автоматические напоминания
• Лиды (CRM), маркетинг и отчёты
• Расходы и зарплата преподавателей

Приложение работает на узбекском, русском и турецком. Вход — по логину и паролю, выданным центром.
```

**Grafika:** `store/play-icon-512.png`, `store/feature-graphic-1024x500.png`, telefon skrinshotlari `store/01…06-*.png`.
Kategoriya: **Education** (Ta'lim). Kontakt: markaz telefoni va email.

## 4. App content (ilova haqida)

| Bo'lim | Javob |
|---|---|
| Privacy policy | `https://lola-edu.vercel.app/privacy.html` |
| App access | *All or some functionality is restricted* → login: `demo@lolaedu.uz`, parol: `LolaDemo2026`. Izoh: "Demo account opens the app with sample data (no real users). Tap Kirish (Sign in)." |
| Ads | No |
| Content rating | Kategoriya: Education/Reference. Zo'ravonlik, jinsiy, so'kinish, qimor, giyohvand — hammasi **No**. Foydalanuvchilar o'zaro kontent almashmaydi, joylashuv ulashilmaydi, raqamli xarid yo'q → natija: 3+ / Everyone |
| Target audience | 16–17 va 18+ (ilova markaz uchun boshqaruv vositasi; bolalarga mo'ljallangan emas) |
| News / Government / Financial features / Health | No |
| Data safety | quyida |

### Data safety

- **Ma'lumot yig'iladimi?** Ha. **Uchinchi shaxslarga beriladimi (sharing)?** Yo'q (Supabase/Vercel — xizmat ko'rsatuvchilar, "sharing" hisoblanmaydi).
- **Shifrlanganmi (in transit)?** Ha. **O'chirishni so'rash mumkinmi?** Ha — `https://lola-edu.vercel.app/privacy.html` (6-bo'lim).
- Yig'iladigan turlar (hammasi *App functionality* va *Account management* uchun, ixtiyoriy emas):
  - Personal info → **Name**, **Phone number**, **Email address** (xodim loginlari), **Other info** (davomat, baholar)
  - Financial info → **Other financial info** (to'lovlar va qarzdorlik)
- Joylashuv, kontaktlar, rasm/video, audio, qurilma identifikatorlari — **yig'ilmaydi**.

## 5. Yuklash (Testing → Closed testing)

1. Track yarating → **Create new release** → `app-release.aab` ni yuklang.
2. **Play App Signing**: *Use Google-generated key* (tavsiya). Biz yuklagan kalit — faqat *upload key*.
3. Testerlar ro'yxati (kamida 12 Gmail) → opt-in havolasini ularga yuboring → 14 kun kuting.
4. **Setup → App integrity → App signing key certificate** dagi **SHA-256** ni olib,
   `public/.well-known/assetlinks.json` ga qo'shing (aks holda ilova tepasida manzil satri ko'rinadi).
5. 14 kundan keyin **Apply for production** → tekshiruv (bir necha kun) → chiqariladi.

## 6. Qayta qurish (yangi versiya)

```bash
cd android
export ANDROID_HOME=/opt/android-sdk          # Android SDK (platform 36, build-tools 36.1.0)
export LOLA_KEYSTORE=/xavfsiz/joy/lola-edu-upload.jks LOLA_KEYSTORE_PASSWORD='...'
./gradlew bundleRelease assembleRelease -PversionCode=2 -PversionName=1.0.1
# natija: app/build/outputs/bundle/release/app-release.aab, app/build/outputs/apk/release/app-release.apk
```

Upload kaliti (`lola-edu-upload.jks`) va paroli **repozitoriyda saqlanmaydi** — egasida.
Upload kaliti SHA-256: `08:F9:79:A2:01:17:70:DB:85:22:6E:DF:E1:8D:87:D6:22:AB:EC:C0:36:3D:E3:AF:CD:A8:FA:E5:64:F8:7A:12`.
Kalit yo'qolsa, Play Console orqali yangi upload kalitini so'rash mumkin (Play App Signing yoqilgan bo'lsa).

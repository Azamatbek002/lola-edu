# Lola Edu — loyiha qoidalari

Lola Edu Türk Dili Markazi (Toshkent) uchun boshqaruv tizimi: rahbar, xodimlar, o'qituvchilar,
o'quvchilar va ota-onalar. Egasi bilan muloqot — **o'zbek tilida**.

## Tuzilma
- `src/` — React 18 + TypeScript + Vite (PWA). Tillar: uz/ru/tr (`src/lib/i18n/dict.ts`).
- `src/lib/db` — demo (localStorage) yoki Supabase; production build doim Supabase'ga ulanadi (`src/lib/config.ts`).
- `supabase/migrations/` — SQL migratsiyalar (RLS, funksiyalar, pg_cron). `supabase/functions/` — Edge Functions (Deno).
- `android/` — Play Market ilovasi (Trusted Web Activity, `uz.lolaedu.app`). Qo'llanma: `android/PLAY_STORE.md`.
- `bot/` — eski reklama boti (Python). **Tegilmaydi.**

## Infratuzilma
- Supabase loyihasi: `lola-edu-app` (ref `vowncclaomnzxbadedkm`, Frankfurt).
- Sayt: Vercel, `main` → https://lola-edu.vercel.app (avtomatik deploy).
- Telegram bot: @LoleEdu_bot (`telegram-bot` funksiyasi).
- pg_cron: `lola-send-messages` (har daqiqa), `lola-daily-jobs` (09:00), `lola-backup` (02:00 va 14:00, Toshkent).

## Qat'iy qoidalar
1. **Har bir yangilanishdan oldin zaxira olinadi.** Production bazaga migratsiya qo'llash yoki
   Edge Function joylashdan oldin:
   ```sql
   select private.call_function('backup', '{"reason":"yangilanish"}'::jsonb);
   ```
   So'ng `net._http_response` da javob 200 ekanini tekshiring. Zaxira `backups` omborida
   (oxirgi 60 ta ≈ 30 kun) va rahbarning Telegram'ida saqlanadi.
2. PR faqat egasi **«merge qil»** deganda birlashtiriladi.
3. Maxfiy kalitlar (bot tokeni, Payme/Click, Eskiz, service_role, `BACKUP_ZIP_PASSWORD`, imzo kaliti)
   chatga so'ralmaydi va repozitoriyga yozilmaydi — faqat Supabase Secrets yoki xavfsiz forma orqali.
   Repozitoriy **ochiq (public)**: shaxsiy ma'lumot, email, parol qo'shilmaydi.
4. Migratsiyalar ma'lumotni o'chirmaydi; o'zgarishlar qo'shimcha (additive) bo'ladi. Pul hisob-kitobi
   `src/lib/finance.ts` va SQL'da bir xil (testlar: `src/lib/logic.test.ts`).
5. Har bir o'zgarishdan keyin: `npx tsc -p tsconfig.json`, `npx vitest run`, `npm run build`;
   UI o'zgarsa — brauzerda (Playwright) tekshirish.

# Ishga tushirish qo'llanmasi

Bu qo'llanma ilovani **demo rejimdan** haqiqiy ishga (Supabase + hosting + Payme/Click + Telegram + SMS) o'tkazish bosqichlarini tushuntiradi.

> ⚠️ **Muhim xavfsizlik ogohlantirishi.** Eski versiyada (`LolaEdu.jsx`) Supabase kaliti va foydalanuvchi parollari (`1234`) to'g'ridan-to'g'ri kodda yozilgan edi. Repo ommaviy (public). Agar eski Supabase loyihasida RLS yoqilmagan bo'lsa, istalgan odam u yerdagi ma'lumotlarni o'qishi va o'zgartirishi mumkin. Tavsiya: **yangi Supabase loyihasi oching** va eski loyihada `anon` kalitni yangilang (Settings → API → Rotate) yoki loyihani o'chiring.

---

## 1. Supabase loyihasi

1. [supabase.com](https://supabase.com) → **New project** (region: Frankfurt yoki eng yaqin).
2. Supabase CLI o'rnating: `npm i -g supabase`.
3. Loyihani ulang va sxemani yuklang:
   ```bash
   supabase login
   supabase link --project-ref <PROJECT_REF>
   supabase db push            # supabase/migrations/*.sql
   ```
4. Boshlang'ich ma'lumotlar: Dashboard → **SQL Editor** → `supabase/seed.sql` faylini ishga tushiring (kurslar, shablonlar, sozlamalar).

### Birinchi rahbar (owner) hisobi

Dashboard → **Authentication → Users → Add user** (email + parol, "Auto confirm" yoqilgan). So'ng SQL Editor'da:

```sql
insert into profiles (id, full_name, email, phone, role)
select id, 'Rahbar ismi', email, '+998901234567', 'owner'
from auth.users where email = 'rahbar@lolaedu.uz';
```

Qolgan barcha xodimlar, o'quvchi va ota-ona hisoblari ilovaning o'zidan yaratiladi (**Xodimlar** sahifasi va **O'quvchi kartasi → Portalga kirish**).

## 2. Frontend sozlamalari

`.env.example` dan nusxa oling → `.env`:

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_PAYME_MERCHANT_ID=<payme kassa id>
VITE_CLICK_SERVICE_ID=<click service id>
VITE_CLICK_MERCHANT_ID=<click merchant id>
VITE_TELEGRAM_BOT_USERNAME=LolaEduBot
```

`VITE_SUPABASE_URL` bo'sh bo'lsa ilova **demo rejimda** ishlaydi (ma'lumotlar brauzerda).

## 3. Hosting (Vercel — bepul)

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub'dan `lola-edu` reposini tanlang.
2. Framework: **Vite**. Build: `npm run build`, Output: `dist`.
3. **Environment Variables** ga 2-bo'limdagi qiymatlarni kiriting.
4. Deploy. O'z domeningizni ulang: Settings → Domains (masalan `app.lolaedu.uz`).

`vercel.json` va `public/_redirects` (Netlify) SPA marshrutlari uchun tayyor.

## 4. Edge Functions va maxfiy kalitlar

```bash
supabase secrets set \
  PAYME_KEY=<payme kassa kaliti> \
  CLICK_SECRET_KEY=<click secret> CLICK_SERVICE_ID=<id> \
  TELEGRAM_BOT_TOKEN=<BotFather tokeni> TELEGRAM_WEBHOOK_SECRET=<tasodifiy uzun satr> \
  ESKIZ_EMAIL=<eskiz login> ESKIZ_PASSWORD=<eskiz parol> ESKIZ_FROM=4546 \
  CRON_SECRET=<tasodifiy uzun satr>

supabase functions deploy payme click telegram-bot send-messages daily-jobs admin-users
```

| Funksiya | Vazifasi |
|---|---|
| `payme` | Payme Merchant API (CheckPerform, Create, Perform, Cancel, Check, GetStatement) |
| `click` | Click Prepare/Complete, imzo tekshiruvi (MD5) |
| `telegram-bot` | Telefon orqali bog'lash, /balans, /jadval, /davomat |
| `send-messages` | Navbatdagi SMS (Eskiz) va Telegram xabarlarini yuborish |
| `daily-jobs` | Oylik hisob (1-kuni), qarz eslatmalari, tug'ilgan kun, sinov darsi eslatmasi |
| `admin-users` | Xodim/o'quvchi/ota-ona uchun login yaratish (faqat rahbar va admin) |

## 5. Avtomatik ishlar (pg_cron)

Dashboard → **Database → Extensions**: `pg_cron` va `pg_net` ni yoqing. So'ng SQL Editor:

```sql
-- Har daqiqada xabarlar navbatini yuborish
select cron.schedule('send-messages', '* * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-messages',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
  )
$$);

-- Har kuni 09:00 (Toshkent = 04:00 UTC)
select cron.schedule('daily-jobs', '0 4 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-jobs',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
  )
$$);
```

## 6. Payme

1. [business.payme.uz](https://business.payme.uz) da kassa oching.
2. Kassa sozlamalari → **Endpoint URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/payme`
3. Hisob maydoni (account): **`student_id`**.
4. Test kassa kaliti bilan [test.paycom.uz](https://test.paycom.uz) sandbox'ida barcha testlarni o'tkazing, so'ng prod kalitini `PAYME_KEY` ga qo'ying.

## 7. Click

1. [merchant.click.uz](https://merchant.click.uz) da xizmat oching.
2. **Prepare URL** va **Complete URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/click`
3. `merchant_trans_id` sifatida o'quvchi ID si yuboriladi (ilova buni avtomatik qiladi).

## 8. Telegram bot

1. [@BotFather](https://t.me/BotFather) → `/newbot` → tokenni oling.
2. Webhook:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-bot&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
3. O'quvchi/ota-ona botga kirib **telefon raqamini yuboradi** — tizim uni avtomatik bog'laydi. Xodimlar esa ilovadagi **Profil** sahifasidagi tugma orqali ulanadi.

## 9. SMS (Eskiz.uz)

[eskiz.uz](https://eskiz.uz) da ro'yxatdan o'ting, shablonlarni tasdiqlating (Eskiz SMS matnlarini oldindan moderatsiya qiladi — ilovadagi **Shablonlar** bilan bir xil matnlarni yuboring).

## 10. Tekshiruv ro'yxati

- [ ] Rahbar hisobi bilan kirish ishlaydi
- [ ] Filial, xonalar, kurslar, o'qituvchilar kiritildi
- [ ] Guruh yaratildi, o'quvchi qo'shildi, davomat belgilandi
- [ ] To'lov qabul qilindi, chek chiqdi
- [ ] Payme/Click test to'lovi balansga tushdi
- [ ] Telegram bot raqam orqali bog'landi, SMS keldi
- [ ] `/apply` ochiq formasidan lid tushdi

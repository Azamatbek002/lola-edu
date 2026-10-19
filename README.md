# Lola Edu — Türk Dili Markazi boshqaruv tizimi

O'quv markazining barcha jarayonlarini bitta ilovada boshqarish: rahbar, administrator, filial menejeri, resepshn, sotuv menejeri, marketolog, buxgalter, o'qituvchi, o'quvchi va ota-ona uchun alohida kabinetlar.

**Platforma:** Web + PWA (kompyuter va telefonda ishlaydi, telefonga ilova sifatida o'rnatiladi) · **Tillar:** o'zbek, rus, turk · **To'lovlar:** Payme, Click, naqd/karta

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| **Bosh sahifa** | Rolga mos: tushum, qarzdorlik, lidlar konversiyasi, davomat, bugungi darslar, ketish xavfi ostidagi o'quvchilar, bugun qo'ng'iroq qilinadigan lidlar |
| **O'quvchilar** | Karta, guruhga yozish, chegirma, muzlatish, chiqarish (sababi bilan), balans, to'lovlar, davomat, baholar, tarix, portalga kirish berish |
| **Guruhlar** | Kurs, o'qituvchi, xona, kunlar, vaqt; xona/o'qituvchi to'qnashuvini avtomatik aniqlash; jurnal (oylik davomat jadvali) |
| **Dars jadvali** | Haftalik kalendar, o'qituvchi/xona bo'yicha filtr, tadbirlar |
| **Davomat** | Bir bosishda belgilash, dars mavzusi va uyga vazifa, kelmaganlarning ota-onasiga avtomatik SMS/Telegram |
| **Baholar, uyga vazifalar, sertifikatlar** | Guruhga ommaviy baho, vazifa topshirish va tekshirish, chop etiladigan sertifikat |
| **Lidlar (CRM)** | Kanban (sudrab o'tkazish), sotuv voronkasi, manbalar statistikasi, qo'ng'iroq tarixi, keyingi bog'lanish sanasi, o'quvchiga aylantirish, ochiq ariza formasi (`/apply`, UTM bilan) |
| **Marketing** | Kampaniyalar, byudjet, CPL, CAC, ROI; promokodlar; tavsiyalar (referral) |
| **Moliya** | To'lov qabul qilish + chek, oylik hisoblash (proporsional, chegirma bilan), qarzdorlar va eslatmalar, xarajatlar, o'qituvchi maoshi (belgilangan / foiz / darsbay / aralash), foyda-zarar hisobotlari, kitob do'koni |
| **Aloqa** | SMS va Telegram ommaviy xabarlar (guruh, qarzdorlar, ota-onalar, lidlar), shablonlar, avtomatik xabarlar |
| **Boshqaruv** | Xodimlar va rollar, filiallar va xonalar, sozlamalar, harakatlar tarixi (audit) |
| **O'quvchi / ota-ona portali** | Jadval, davomat, baholar, uyga vazifa topshirish, balans va Payme/Click orqali onlayn to'lov, fikr-mulohaza |

## Tez boshlash (demo)

```bash
npm install
npm run dev
```

Brauzerda `http://localhost:5173` — kirish sahifasida istalgan rolni tanlab kiring. Demo rejimda ma'lumotlar brauzerda saqlanadi.

Haqiqiy ishga tushirish: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Texnologiyalar

- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, Recharts, PWA
- **Backend:** Supabase (PostgreSQL + Row Level Security, Auth, Edge Functions)
- **Integratsiyalar:** Payme Merchant API, Click SHOP API, Telegram Bot API, Eskiz.uz SMS

## Loyiha tuzilishi

```
src/
  lib/            ma'lumotlar modeli, moliya/jadval/analitika mantiqi, ruxsatlar, tarjimalar, DB adapter
  components/     UI komponentlar (jadval, modal, forma...)
  crud/           umumiy CRUD sahifa va forma
  layout/         menyu va sahifa qobig'i
  modules/        bo'limlar: students, groups, leads, finance, portal, ...
supabase/
  migrations/     sxema, RLS xavfsizlik qoidalari, SQL funksiyalar
  functions/      payme, click, telegram-bot, send-messages, daily-jobs, admin-users
docs/DEPLOY.md    ishga tushirish qo'llanmasi
```

## Buyruqlar

| Buyruq | |
|---|---|
| `npm run dev` | ishlab chiqish serveri |
| `npm run build` | production build (`dist/`) |
| `npm test` | moliya, jadval va analitika testlari |
| `npm run typecheck` | TypeScript tekshiruvi |

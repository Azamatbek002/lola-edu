// Production Supabase loyihasi (lola-edu-app, Frankfurt).
// Publishable kalit ommaviy — brauzer uchun mo'ljallangan; ma'lumotlar RLS xavfsizlik qoidalari bilan himoyalangan.
// Maxfiy service_role kalit bu yerda YO'Q va bo'lmasligi kerak.
// Bu qiymatlar Vercel muhit o'zgaruvchilaridan ustun turadi: eski loyiha manzili tasodifan qolib ketsa ham, ilova to'g'ri bazaga ulanadi.
export const SUPABASE_URL = 'https://vowncclaomnzxbadedkm.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_LvyLFrLZvGB-7oa7c6yCUw_e9Z6iv5y'

// O'quvchi va ota-onalar uchun Telegram bot (ochiq ma'lumot; token esa faqat Supabase secrets'da)
export const TELEGRAM_BOT_USERNAME = 'LoleEdu_bot'

// Eskiz SMS ulanganda true qilinadi (kalitlar Supabase secrets'da: ESKIZ_EMAIL / ESKIZ_PASSWORD)
export const SMS_ENABLED = false

// Google Play tekshiruvchilari uchun demo kirish: haqiqiy bazaga ulanmaydi,
// faqat qurilmadagi soxta ma'lumotlar bilan ishlaydi (maxfiy emas)
export const DEMO_LOGIN = 'demo@lolaedu.uz'
export const DEMO_PASSWORD = 'LolaDemo2026'

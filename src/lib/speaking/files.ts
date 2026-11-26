// Gapirish imtihoni fayllari: savol materiallari (speaking-media) va o'quvchi ovozlari (speaking-answers).
// Ikkala ombor ham yopiq: fayllar faqat vaqtinchalik havola orqali ochiladi. Demo rejimda — brauzer xotirasida.
import { supabase } from '../db'
import { uid } from '../format'
import { idb } from './idb'

const MEDIA = 'speaking-media'
const ANSWERS = 'speaking-answers'

export function extFor(mime: string): string {
  const m = mime.split(';')[0].trim()
  const map: Record<string, string> = {
    'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'audio/aac': 'aac',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/quicktime': 'mov',
  }
  return map[m] ?? 'bin'
}
export const baseMime = (mime: string) => mime.split(';')[0].trim()
/** To'g'ridan-to'g'ri havola (demo rasmlari va h.k.) — ombordan so'ralmaydi */
export const isDirect = (p: string) => /^(data:|blob:|https?:|\/)/.test(p)

/** Savol materiallarini oldindan yuklab olish (internet uzilsa ham imtihon davom etishi uchun) → { yo'l: blob URL } */
export async function preloadMedia(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const all = [...new Set(paths.filter(Boolean))]
  for (const p of all.filter(isDirect)) out[p] = p
  const uniq = all.filter((p) => !isDirect(p))
  if (!uniq.length) return out
  if (supabase) {
    const { data, error } = await supabase.storage.from(MEDIA).createSignedUrls(uniq, 3600)
    if (error) throw error
    await Promise.all(
      (data ?? []).map(async (d) => {
        if (!d.signedUrl || !d.path) return
        try {
          const r = await fetch(d.signedUrl)
          out[d.path] = URL.createObjectURL(await r.blob())
        } catch {
          out[d.path] = d.signedUrl
        }
      }),
    )
    return out
  }
  for (const p of uniq) {
    const f = await idb.file(p).catch(() => undefined)
    if (f) out[p] = URL.createObjectURL(f.blob)
  }
  return out
}

/** Xodim uchun: bir nechta material havolasi (yuklab olmasdan) */
export async function signedMediaUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const all = [...new Set(paths.filter(Boolean))]
  for (const p of all.filter(isDirect)) out[p] = p
  const rest = all.filter((p) => !isDirect(p))
  if (!rest.length) return out
  if (supabase) {
    const { data } = await supabase.storage.from(MEDIA).createSignedUrls(rest, 3600)
    for (const d of data ?? []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl
    return out
  }
  for (const p of rest) {
    const f = await idb.file(p).catch(() => undefined)
    if (f) out[p] = URL.createObjectURL(f.blob)
  }
  return out
}

/** Xodim uchun: material havolasi (ko'rish/tahrirlash) */
export async function mediaUrl(path: string): Promise<string | null> {
  if (isDirect(path)) return path
  if (supabase) {
    const { data } = await supabase.storage.from(MEDIA).createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }
  const f = await idb.file(path).catch(() => undefined)
  return f ? URL.createObjectURL(f.blob) : null
}

/** Ustoz: variantga rasm/ovoz/video yuklash → ombordagi yo'l */
export async function uploadMedia(variantId: string, file: File): Promise<string> {
  const type = file.type || 'application/octet-stream'
  const path = `${variantId}/${uid()}.${extFor(type)}`
  if (supabase) {
    const { error } = await supabase.storage.from(MEDIA).upload(path, file, { contentType: type, upsert: false })
    if (error) throw error
  } else {
    await idb.putFile({ path, blob: file, type })
  }
  return path
}

export async function removeMedia(paths: string[]) {
  paths = paths.filter((p) => p && !isDirect(p))
  if (!paths.length) return
  if (supabase) await supabase.storage.from(MEDIA).remove(paths)
  else for (const p of paths) await idb.deleteFile(p).catch(() => undefined)
}

/** O'quvchi javobini yopiq omborga yuklash. Takroriy urinishda fayl allaqachon bo'lsa — muvaffaqiyat. */
export async function uploadAnswer(attemptId: string, itemId: string, blob: Blob, mime: string): Promise<string> {
  const path = `${attemptId}/${itemId}.${extFor(mime)}`
  if (supabase) {
    const { error } = await supabase.storage.from(ANSWERS).upload(path, blob, { contentType: baseMime(mime), upsert: false })
    if (error && !/exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) throw error
  } else {
    await idb.putFile({ path, blob, type: baseMime(mime) })
  }
  return path
}

/** Baholovchi: javobni eshitish havolasi (1 soat) */
export async function answerUrl(path: string): Promise<string | null> {
  if (supabase) {
    const { data } = await supabase.storage.from(ANSWERS).createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }
  const f = await idb.file(path).catch(() => undefined)
  return f ? URL.createObjectURL(f.blob) : null
}

/** Rahbar/administrator: urinishni qayta topshirishga ochganda eski ovozlarni o'chirish */
export async function removeAnswers(paths: string[]) {
  if (!paths.length) return
  if (supabase) await supabase.storage.from(ANSWERS).remove(paths)
  else for (const p of paths) await idb.deleteFile(p).catch(() => undefined)
}

/** Variant nusxasi uchun: materialni yangi variant papkasiga ko'chirish (o'quvchiga ruxsat papka bo'yicha beriladi) */
export async function copyMedia(path: string, toVariantId: string): Promise<string> {
  if (isDirect(path)) return path
  const name = path.split('/').pop() || uid()
  const to = `${toVariantId}/${name}`
  if (supabase) {
    const { error } = await supabase.storage.from(MEDIA).copy(path, to)
    if (error && !/exists|duplicate/i.test(error.message)) throw error
  } else {
    const f = await idb.file(path).catch(() => undefined)
    if (f) await idb.putFile({ ...f, path: to })
  }
  return to
}

// Variant yaratish (namunaviy video vaqtlari bilan) va nusxa olish
import { db } from '@/lib/db'
import { queryClient } from '@/lib/queryClient'
import type { SpeakingItem, SpeakingPart, SpeakingVariant } from '@/lib/types'
import { copyMedia } from '@/lib/speaking/files'

/** Namunaviy video bo'yicha tuzilma: 1.1 — 3 savol, 1.2 — 3 savol (rasm), 2 — rasm + 3 savol, 3 — munozara jadvali */
export const TEMPLATE: { part: SpeakingPart; prep: number; answer: number }[] = [
  { part: '1.1', prep: 5, answer: 30 },
  { part: '1.1', prep: 5, answer: 30 },
  { part: '1.1', prep: 5, answer: 30 },
  { part: '1.2', prep: 10, answer: 45 },
  { part: '1.2', prep: 5, answer: 30 },
  { part: '1.2', prep: 5, answer: 30 },
  { part: '2', prep: 60, answer: 120 },
  { part: '3', prep: 60, answer: 120 },
]

const refresh = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['speaking_variants'] }),
    queryClient.invalidateQueries({ queryKey: ['speaking_items'] }),
  ])

export async function createVariantFromTemplate(title: string, userId: string, sort: number): Promise<string> {
  const v = await db.insert('speaking_variants', { title, status: 'draft', sort, created_by: userId })
  try {
    await db.insertMany(
      'speaking_items',
      TEMPLATE.map((x, i) => ({ variant_id: v.id, part: x.part, position: i + 1, prompt: '', bullets: [], pros: [], cons: [], images: [], prep_seconds: x.prep, answer_seconds: x.answer })),
    )
  } catch (e) {
    await db.remove('speaking_variants', v.id).catch(() => undefined)
    throw e
  }
  await refresh()
  return v.id
}

/** Nusxa: savollar va materiallar (rasm/ovoz/video) yangi variant papkasiga ko'chiriladi */
export async function copyVariant(src: SpeakingVariant, title: string, userId: string, sort: number): Promise<string> {
  const items = (await db.list('speaking_items')).filter((i) => i.variant_id === src.id)
  const v = await db.insert('speaking_variants', { title, level: src.level ?? null, status: 'draft', sort, created_by: userId })
  try {
    const rows: Partial<SpeakingItem>[] = []
    for (const it of items) {
      const images: string[] = []
      for (const p of it.images ?? []) images.push(await copyMedia(p, v.id))
      rows.push({
        variant_id: v.id,
        part: it.part,
        position: it.position,
        prompt: it.prompt ?? '',
        bullets: it.bullets ?? [],
        pros: it.pros ?? [],
        cons: it.cons ?? [],
        images,
        media_path: it.media_path ? await copyMedia(it.media_path, v.id) : null,
        media_kind: it.media_kind ?? null,
        prep_seconds: it.prep_seconds,
        answer_seconds: it.answer_seconds,
      })
    }
    await db.insertMany('speaking_items', rows)
  } catch (e) {
    await db.remove('speaking_variants', v.id).catch(() => undefined)
    throw e
  }
  await refresh()
  return v.id
}

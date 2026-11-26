// Demo rejim uchun gapirish imtihoni namunalari (savollar shu ilova uchun yozilgan, rasmlar — oddiy chizmalar).
// Haqiqiy imtihon materiallari faqat bazada saqlanadi, repozitoriyga qo'shilmaydi.
import type { SpeakingItem, SpeakingVariant, Setting } from '../types'

const pic = (emoji: string, a: string, b: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="200" y="190" font-size="130" text-anchor="middle">${emoji}</text></svg>`,
  )

type Item = Omit<SpeakingItem, 'id' | 'variant_id' | 'position'>
const q = (part: SpeakingItem['part'], prompt: string, prep: number, answer: number, extra: Partial<Item> = {}): Item => ({
  part,
  prompt,
  bullets: [],
  pros: [],
  cons: [],
  images: [],
  prep_seconds: prep,
  answer_seconds: answer,
  ...extra,
})

export function speakingSeed(): { speaking_variants: SpeakingVariant[]; speaking_items: SpeakingItem[]; setting: Setting } {
  const ts = new Date().toISOString()
  const variants: SpeakingVariant[] = [
    { id: 'sv-demo-1', title: 'Namuna 1', status: 'published', sort: 1, level: 'B1–C1', created_at: ts },
    { id: 'sv-demo-2', title: 'Qisqa sinov (demo)', status: 'published', sort: 2, level: null, created_at: ts },
  ]
  const one: Item[] = [
    q('1.1', 'Kendinizi kısaca tanıtır mısınız?', 5, 30),
    q('1.1', 'Boş zamanlarınızda neler yapmaktan hoşlanırsınız?', 5, 30),
    q('1.1', 'En sevdiğiniz mevsim hangisi ve neden?', 5, 30),
    q('1.2', 'Fotoğraflarda neler görüyorsunuz?', 10, 45, { images: [pic('🏙️', '#9cc3e6', '#5b7fa8'), pic('🏡', '#bfe3b4', '#6fa86a')] }),
    q('1.2', 'Şehirde mi yoksa köyde mi yaşamayı tercih edersiniz? Neden?', 5, 30, { images: [pic('🏙️', '#9cc3e6', '#5b7fa8'), pic('🏡', '#bfe3b4', '#6fa86a')] }),
    q('1.2', 'Sizce gelecekte şehirler nasıl değişecek?', 5, 30, { images: [pic('🏙️', '#9cc3e6', '#5b7fa8'), pic('🏡', '#bfe3b4', '#6fa86a')] }),
    q('2', '', 60, 120, {
      bullets: ['Okumaktan en çok keyif aldığınız bir kitabı anlatın.', 'Bu kitap size ne kazandırdı?', 'Sizce gençler bugün yeterince kitap okuyor mu?'],
      images: [pic('📚', '#f3d9a4', '#d39b4c')],
    }),
    q('3', 'Öğrenciler okulda tek tip kıyafet giymelidir.', 60, 120, {
      pros: ['Öğrenciler arasında eşitlik sağlar', 'Sabahları zaman kazandırır', 'Okula aidiyet duygusunu güçlendirir'],
      cons: ['Kişisel tarzı kısıtlar', 'Aileler için ek bir masraftır', 'Her mevsimde rahat olmayabilir'],
    }),
  ]
  const two: Item[] = [
    q('1.1', 'Bugün hava nasıl?', 3, 6),
    q('1.1', 'Sabah kahvaltıda ne yediniz?', 3, 6),
    q('2', '', 4, 8, { bullets: ['Fotoğrafta ne görüyorsunuz?', 'Siz de spor yapıyor musunuz?'], images: [pic('⚽', '#c7e6c1', '#3f8f5a')] }),
    q('3', 'Herkesin bir evcil hayvanı olmalıdır.', 4, 8, {
      pros: ['Yalnızlığı azaltır', 'Sorumluluk öğretir'],
      cons: ['Bakımı zaman alır', 'Masraflıdır'],
    }),
  ]
  const items: SpeakingItem[] = [
    ...one.map((x, i) => ({ ...x, id: `si-d1-${i + 1}`, variant_id: 'sv-demo-1', position: i + 1, created_at: ts })),
    ...two.map((x, i) => ({ ...x, id: `si-d2-${i + 1}`, variant_id: 'sv-demo-2', position: i + 1, created_at: ts })),
  ]
  const setting: Setting = {
    id: 'st-speaking',
    key: 'speaking',
    value: {
      criteria: [
        { id: 'fluency', name: 'Ravonlik va izchillik', max: 10 },
        { id: 'grammar', name: 'Grammatika', max: 10 },
        { id: 'vocab', name: "Lug'at boyligi", max: 10 },
        { id: 'pron', name: 'Talaffuz', max: 10 },
      ],
      levels: [
        { name: 'B1', min: 18 },
        { name: 'B2', min: 26 },
        { name: 'C1', min: 34 },
      ],
      retention_days_after_grading: 5,
      intro_seconds: 15,
      intros: {
        '1.1': 'Birinci bölümde size kendiniz ve ilgi alanlarınız hakkında kısa sorular sorulacaktır. Zil sesini duyduktan sonra konuşmaya başlayınız.',
        '1.2': 'Bu bölümde iki resim gösterilecek ve onlarla ilgili sorular sorulacaktır. Zil sesini duyduktan sonra konuşmaya başlayınız.',
        '2': 'Bu bölümde bir resim ve sorular gösterilecektir. Önce hazırlanmanız için süre verilecek, ardından sorulara cevap vereceksiniz.',
        '3': 'Bu bölümde bir konu ve konunun lehinde ve aleyhinde maddeler gösterilecektir. Her iki taraftan da maddeler seçerek dengeli bir konuşma yapınız.',
      },
    },
  }
  return { speaking_variants: variants, speaking_items: items, setting }
}

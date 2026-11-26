import { describe, expect, it } from 'vitest'
import { opusSamples, parseWebmOpus, webmToOgg } from '../../../supabase/functions/_shared/webm2ogg'

// Chromium MediaRecorder (har soniyada bo'lak) yozgan 3 soniyalik haqiqiy fayl
const fsModule = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (p: URL) => Uint8Array }
const webm = new Uint8Array(readFileSync(new URL('./__fixtures__/beep.webm', import.meta.url)))

function oggPages(b: Uint8Array) {
  const pages: { type: number; granule: number; seq: number; segs: number }[] = []
  let p = 0
  while (p < b.length) {
    expect(String.fromCharCode(...b.subarray(p, p + 4))).toBe('OggS')
    const v = new DataView(b.buffer, b.byteOffset + p)
    const segs = b[p + 26]
    let body = 0
    for (let i = 0; i < segs; i++) body += b[p + 27 + i]
    pages.push({ type: b[p + 5], granule: v.getUint32(6, true), seq: v.getUint32(18, true), segs })
    p += 27 + segs + body
  }
  expect(p).toBe(b.length)
  return pages
}

describe("Telegram uchun ovoz: WebM → OGG", () => {
  it("WebM'dan Opus paketlari ajratiladi", () => {
    const r = parseWebmOpus(webm)
    expect(r.packets.length).toBeGreaterThan(40) // ~3 s (Chrome 20–60 ms kadrlar)
    expect(r.head && new TextDecoder().decode(r.head.subarray(0, 8))).toBe('OpusHead')
  })
  it("OGG sahifalari to'g'ri: boshlanish/tugash belgisi, tartib, vaqt o'sib boradi", () => {
    const { ogg, seconds } = webmToOgg(webm)
    const pages = oggPages(ogg)
    expect(pages[0].type).toBe(0x02)
    expect(pages[pages.length - 1].type).toBe(0x04)
    pages.forEach((pg, i) => expect(pg.seq).toBe(i))
    for (let i = 3; i < pages.length; i++) expect(pages[i].granule).toBeGreaterThan(pages[i - 1].granule)
    expect(seconds).toBeGreaterThan(2.5)
    expect(seconds).toBeLessThan(3.6)
  })
  it('Opus TOC: 20 ms kadr = 960 namuna', () => {
    expect(opusSamples(new Uint8Array([0x78 | 0]))).toBe(960) // CELT 20 ms, 1 kadr
    expect(opusSamples(new Uint8Array([(15 << 3) | 1]))).toBe(1920) // hybrid 20 ms, 2 kadr
  })
  it("Opus bo'lmagan fayl rad etiladi", () => {
    expect(() => webmToOgg(new Uint8Array([1, 2, 3, 4]))).toThrow()
  })
})

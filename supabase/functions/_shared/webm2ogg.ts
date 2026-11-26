// Brauzer yozgan WebM/Opus ovozni Telegram ovozli xabari uchun OGG/Opus ga o'tkazish (qayta kodlamasdan, faqat "qobig'ini" almashtiradi).
// Chrome/Android MediaRecorder WebM beradi, Telegram sendVoice esa OGG/Opus, MP3 yoki M4A qabul qiladi.
// Sof TypeScript: Deno (Edge Function) va brauzer/Node testlarida bir xil ishlaydi.

const ID = {
  EBML: 0x1a45dfa3,
  Segment: 0x18538067,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  Audio: 0xe1,
  Channels: 0x9f,
  Cluster: 0x1f43b675,
  BlockGroup: 0xa0,
  Block: 0xa1,
  SimpleBlock: 0xa3,
}
/** Ichiga kirib o'qiladigan elementlar (qolganlari o'tkazib yuboriladi) */
const MASTER = new Set([ID.Segment, ID.Tracks, ID.TrackEntry, ID.Audio, ID.Cluster, ID.BlockGroup])

function readVint(b: Uint8Array, p: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } | null {
  const first = b[p]
  if (first === undefined || first === 0) return null
  let len = 1
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++
  if (len > 8 || p + len > b.length) return null
  let value = keepMarker ? first : first & (0xff >> len)
  let allOnes = (first & (0xff >> len)) === 0xff >> len
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[p + i]
    if (b[p + i] !== 0xff) allOnes = false
  }
  return { value, len, unknown: !keepMarker && allOnes }
}

export interface WebmOpus {
  head: Uint8Array | null
  channels: number
  packets: Uint8Array[]
}

/** WebM ichidan Opus paketlarini ajratib olish (bitta audio yo'lak) */
export function parseWebmOpus(b: Uint8Array): WebmOpus {
  let p = 0
  let head: Uint8Array | null = null
  let channels = 1
  let codec = ''
  const packets: Uint8Array[] = []
  while (p < b.length) {
    const id = readVint(b, p, true)
    if (!id) break
    const size = readVint(b, p + id.len, false)
    if (!size) break
    const start = p + id.len + size.len
    if (MASTER.has(id.value)) {
      p = start // ichiga kiramiz (o'lchami noma'lum bo'lsa ham)
      continue
    }
    if (size.unknown) break
    const end = Math.min(b.length, start + size.value)
    const data = b.subarray(start, end)
    if (id.value === ID.CodecID) codec = new TextDecoder().decode(data)
    else if (id.value === ID.CodecPrivate) head = data.slice()
    else if (id.value === ID.Channels) channels = data.reduce((n, x) => n * 256 + x, 0) || 1
    else if (id.value === ID.SimpleBlock || id.value === ID.Block) {
      const tn = readVint(data, 0, false)
      if (tn && data.length > tn.len + 3) {
        const flags = data[tn.len + 2]
        const lacing = (flags >> 1) & 3
        if (lacing === 0) packets.push(data.slice(tn.len + 3))
      }
    }
    p = end
  }
  if (codec && codec !== 'A_OPUS') throw new Error('not_opus')
  if (!packets.length) throw new Error('no_audio')
  return { head, channels, packets }
}

/** Opus paketidagi namunalar soni (48 kHz) — TOC baytidan */
export function opusSamples(pkt: Uint8Array): number {
  if (!pkt.length) return 0
  const toc = pkt[0]
  const c = toc >> 3
  const frameMs = c < 12 ? [10, 20, 40, 60][c & 3] : c < 16 ? [10, 20][c & 1] : [2.5, 5, 10, 20][c & 3]
  const code = toc & 3
  const frames = code === 0 ? 1 : code === 3 ? (pkt[1] ?? 0) & 0x3f : 2
  return Math.round(frames * frameMs * 48)
}

let CRC: Uint32Array | null = null
function crc32(data: Uint8Array): number {
  if (!CRC) {
    CRC = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let r = i << 24
      for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1
      CRC[i] = r >>> 0
    }
  }
  let crc = 0
  for (let i = 0; i < data.length; i++) crc = ((crc << 8) ^ CRC[((crc >>> 24) & 0xff) ^ data[i]]) >>> 0
  return crc >>> 0
}

function page(packets: Uint8Array[], granule: number, serial: number, seq: number, type: number): Uint8Array {
  const lacing: number[] = []
  for (const pk of packets) {
    let n = pk.length
    while (n >= 255) {
      lacing.push(255)
      n -= 255
    }
    lacing.push(n)
  }
  const body = packets.reduce((s, x) => s + x.length, 0)
  const out = new Uint8Array(27 + lacing.length + body)
  const v = new DataView(out.buffer)
  out.set([0x4f, 0x67, 0x67, 0x53], 0) // "OggS"
  out[4] = 0
  out[5] = type
  v.setUint32(6, granule % 0x100000000, true)
  v.setUint32(10, Math.floor(granule / 0x100000000), true)
  v.setUint32(14, serial, true)
  v.setUint32(18, seq, true)
  out[26] = lacing.length
  out.set(lacing, 27)
  let o = 27 + lacing.length
  for (const pk of packets) {
    out.set(pk, o)
    o += pk.length
  }
  v.setUint32(22, crc32(out), true)
  return out
}

function opusHead(channels: number): Uint8Array {
  const h = new Uint8Array(19)
  const v = new DataView(h.buffer)
  h.set(new TextEncoder().encode('OpusHead'), 0)
  h[8] = 1
  h[9] = channels
  v.setUint16(10, 312, true) // pre-skip
  v.setUint32(12, 48000, true)
  v.setInt16(16, 0, true)
  h[18] = 0
  return h
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode('Lola Edu')
  const t = new Uint8Array(8 + 4 + vendor.length + 4)
  const v = new DataView(t.buffer)
  t.set(new TextEncoder().encode('OpusTags'), 0)
  v.setUint32(8, vendor.length, true)
  t.set(vendor, 12)
  v.setUint32(12 + vendor.length, 0, true)
  return t
}

/** WebM/Opus → OGG/Opus. Natija: Telegram sendVoice uchun tayyor fayl baytlari va davomiylik (soniya). */
export function webmToOgg(webm: Uint8Array, serial = 0x4c6f6c61): { ogg: Uint8Array; seconds: number } {
  const { head, channels, packets } = parseWebmOpus(webm)
  const isHead = head && head.length >= 19 && new TextDecoder().decode(head.subarray(0, 8)) === 'OpusHead'
  const pages: Uint8Array[] = [page([isHead ? head! : opusHead(channels)], 0, serial, 0, 0x02), page([opusTags()], 0, serial, 1, 0)]
  let seq = 2
  let granule = 0
  let batch: Uint8Array[] = []
  let segs = 0
  const flush = (last: boolean) => {
    if (!batch.length) return
    pages.push(page(batch, granule, serial, seq++, last ? 0x04 : 0))
    batch = []
    segs = 0
  }
  packets.forEach((pk, i) => {
    const need = Math.floor(pk.length / 255) + 1
    if (segs + need > 255 || batch.length >= 50) flush(false)
    batch.push(pk)
    segs += need
    granule += opusSamples(pk)
    if (i === packets.length - 1) flush(true)
  })
  const total = pages.reduce((s, x) => s + x.length, 0)
  const ogg = new Uint8Array(total)
  let o = 0
  for (const pg of pages) {
    ogg.set(pg, o)
    o += pg.length
  }
  return { ogg, seconds: granule / 48000 }
}

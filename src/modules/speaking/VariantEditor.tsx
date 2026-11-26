// Variant muharriri: ustoz kodsiz yangi variant qo'shadi va tahrirlaydi (matn, rasm, ovoz/video, vaqtlar).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Eye, FilmStrip, ImageIcon, Plus, SpeakerHigh, Trash2, X } from '@/components/icons'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHead, Select, Textarea, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth'
import { useMutate, useRows } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { fillTemplate } from '@/lib/format'
import { canEdit } from '@/lib/permissions'
import { useToast } from '@/components/Toast'
import type { SpeakingItem, SpeakingPart, SpeakingVariant } from '@/lib/types'
import { PART_ORDER, sortItems, totalMinutes } from '@/lib/speaking/timeline'
import { removeMedia, signedMediaUrls, uploadMedia } from '@/lib/speaking/files'
import { useSpeakingSettings } from '@/lib/speaking/api'
import { TEMPLATE } from './variantOps'
import { partTitle, Question } from './Exam'

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
const MAX_IMAGE = 8 * 1024 * 1024
const MAX_MEDIA = 50 * 1024 * 1024

export default function VariantEditor() {
  const { id = '' } = useParams()
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const settings = useSpeakingSettings()
  const variant = useRows('speaking_variants').find((v) => v.id === id)
  const allItems = useRows('speaking_items')
  const items = useMemo(() => sortItems(allItems.filter((i) => i.variant_id === id)), [allItems, id])
  const attempts = useRows('speaking_attempts').filter((a) => a.variant_id === id).length
  const answeredItems = new Set(useRows('speaking_answers').map((a) => a.item_id))
  const mv = useMutate('speaking_variants')
  const mi = useMutate('speaking_items')
  const editable = canEdit(me.role, 'speaking')

  const [vd, setVd] = useState<Partial<SpeakingVariant>>({})
  const [drafts, setDrafts] = useState<Record<string, Partial<SpeakingItem>>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(false)

  const paths = items.flatMap((i) => [...(i.images ?? []), i.media_path ?? '']).filter(Boolean)
  const pathKey = paths.join('|')
  useEffect(() => {
    let off = false
    signedMediaUrls(paths)
      .then((u) => !off && setUrls(u))
      .catch(() => undefined)
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey])

  if (!variant)
    return (
      <Card>
        <Empty text={t('sp.notFound')} />
      </Card>
    )

  const v = { ...variant, ...vd }
  const merged = items.map((i) => ({ ...i, ...drafts[i.id] }) as SpeakingItem)
  const dirty = Object.keys(vd).length > 0 || Object.keys(drafts).length > 0
  const setItem = (itemId: string, patch: Partial<SpeakingItem>) => setDrafts((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }))

  const save = async () => {
    setBusy('save')
    try {
      if (Object.keys(vd).length) await mv.update(id, { ...vd, title: (vd.title ?? variant.title).trim() || variant.title, updated_at: new Date().toISOString() })
      for (const [itemId, patch] of Object.entries(drafts)) await mi.update(itemId, patch)
      setVd({})
      setDrafts({})
      toast.success(t('common.saved'))
    } finally {
      setBusy('')
    }
  }

  const publish = async (status: SpeakingVariant['status']) => {
    if (status === 'published') {
      const empty = merged.filter((i) => !(i.prompt ?? '').trim() && !i.bullets.length && !i.pros.length)
      if (empty.length && !(await confirm(fillTemplate(t('sp.emptyQuestions'), { n: empty.length })))) return
    }
    if (dirty) await save()
    await mv.update(id, { status })
    toast.success(t('common.saved'))
  }

  const addItem = async (part: SpeakingPart) => {
    const tpl = TEMPLATE.find((x) => x.part === part)!
    const pos = Math.max(0, ...items.map((i) => i.position)) + 1
    await mi.create({ variant_id: id, part, position: pos, prompt: '', bullets: [], pros: [], cons: [], images: [], prep_seconds: tpl.prep, answer_seconds: tpl.answer })
  }

  const move = async (it: SpeakingItem, dir: -1 | 1) => {
    const same = items.filter((i) => i.part === it.part)
    const j = same.findIndex((i) => i.id === it.id) + dir
    const other = same[j]
    if (!other) return
    await mi.update(it.id, { position: other.position })
    await mi.update(other.id, { position: it.position })
  }

  const removeItem = async (it: SpeakingItem) => {
    if (!(await confirm(t('common.confirmDelete')))) return
    await mi.remove(it.id)
    await removeMedia([...(it.images ?? []), it.media_path ?? ''])
  }

  const addImages = async (it: SpeakingItem, files: FileList | null) => {
    if (!files?.length) return
    setBusy('img-' + it.id)
    try {
      const added: string[] = []
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue
        if (f.size > MAX_IMAGE) {
          toast.error(fillTemplate(t('sp.fileTooBig'), { mb: 8 }))
          continue
        }
        added.push(await uploadMedia(id, f))
      }
      if (added.length) await mi.update(it.id, { images: [...(it.images ?? []), ...added] })
    } catch (e) {
      toast.error((e as Error).message || t('common.error'))
    } finally {
      setBusy('')
    }
  }
  const removeImage = async (it: SpeakingItem, p: string) => {
    await mi.update(it.id, { images: (it.images ?? []).filter((x) => x !== p) })
    await removeMedia([p])
  }
  const setMedia = async (it: SpeakingItem, f: File | undefined) => {
    if (!f) return
    const kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : null
    if (!kind) return
    if (f.size > MAX_MEDIA) {
      toast.error(fillTemplate(t('sp.fileTooBig'), { mb: 50 }))
      return
    }
    setBusy('media-' + it.id)
    try {
      const path = await uploadMedia(id, f)
      const old = it.media_path
      await mi.update(it.id, { media_path: path, media_kind: kind })
      if (old) await removeMedia([old])
    } catch (e) {
      toast.error((e as Error).message || t('common.error'))
    } finally {
      setBusy('')
    }
  }
  const clearMedia = async (it: SpeakingItem) => {
    const old = it.media_path
    await mi.update(it.id, { media_path: null, media_kind: null })
    if (old) await removeMedia([old])
  }

  const tone = { draft: 'gray', published: 'green', archived: 'yellow' } as const
  return (
    <>
      <PageHead
        title={v.title}
        subtitle={`${items.length} ${t('sp.questionsLower')} · ~${totalMinutes(merged, settings.intro_seconds)} ${t('sp.minutes')}`}
        actions={
          <>
            <Badge tone={tone[v.status]}>{t('sp.vs.' + v.status)}</Badge>
            <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => nav('/speaking')}>
              {t('common.back')}
            </Button>
            <Button icon={<Eye size={16} />} onClick={() => setPreview(true)}>
              {t('sp.preview')}
            </Button>
            {editable && (
              <Button variant="primary" disabled={!dirty || !!busy} onClick={save}>
                {t('common.save')}
              </Button>
            )}
          </>
        }
      />
      {attempts > 0 && <div className="sp-alert mb">{fillTemplate(t('sp.lockedNote'), { n: attempts })}</div>}

      <Card pad className="mb">
        <div className="form-grid">
          <Field label={t('common.name')}>
            <Input value={v.title} disabled={!editable} onChange={(e) => setVd({ ...vd, title: e.target.value })} />
          </Field>
          <Field label={t('sp.level')} hint={t('sp.levelOptional')}>
            <Input value={v.level ?? ''} disabled={!editable} placeholder="B1–C1" onChange={(e) => setVd({ ...vd, level: e.target.value || null })} />
          </Field>
          <Field label={t('sp.order')}>
            <Input type="number" value={v.sort} disabled={!editable} onChange={(e) => setVd({ ...vd, sort: Number(e.target.value) || 0 })} />
          </Field>
          <Field label={t('common.status')}>
            <Select
              value={v.status}
              disabled={!editable}
              onChange={(e) => publish(e.target.value as SpeakingVariant['status'])}
              options={(['draft', 'published', 'archived'] as const).map((s) => ({ value: s, label: t('sp.vs.' + s) }))}
            />
          </Field>
        </div>
        <p className="small muted mt">{t('sp.statusHint')}</p>
      </Card>

      {PART_ORDER.map((part) => {
        const list = merged.filter((i) => i.part === part)
        return (
          <section key={part} className="sp-part">
            <div className="sp-part-head">
              <h3>{partTitle(part)}</h3>
              <span className="small muted">{t('sp.partHint.' + part.replace('.', '_'))}</span>
              {editable && (
                <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => addItem(part)}>
                  {t('sp.addQuestion')}
                </Button>
              )}
            </div>
            {!list.length && <p className="small muted">{t('sp.noQuestionsPart')}</p>}
            {list.map((it, idx) => {
              const locked = answeredItems.has(it.id)
              return (
                <div key={it.id} className="card sp-edit">
                  <div className="sp-edit-head">
                    <span className="sp-num">{merged.indexOf(it) + 1}</span>
                    <div className="grow" />
                    {editable && (
                      <>
                        <Button size="sm" variant="ghost" icon={<ArrowUp size={15} />} disabled={idx === 0} onClick={() => move(it, -1)} aria-label="up" />
                        <Button size="sm" variant="ghost" icon={<ArrowDown size={15} />} disabled={idx === list.length - 1} onClick={() => move(it, 1)} aria-label="down" />
                        <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} disabled={locked} title={locked ? t('sp.hasAnswers') : undefined} onClick={() => removeItem(it)} aria-label={t('common.delete')} />
                      </>
                    )}
                  </div>
                  <div className="form-grid">
                    <Field full label={part === '3' ? t('sp.topic') : part === '2' ? t('sp.heading') : t('sp.question')}>
                      <Textarea rows={part === '3' ? 2 : 2} value={it.prompt ?? ''} disabled={!editable} onChange={(e) => setItem(it.id, { prompt: e.target.value })} />
                    </Field>
                    {part === '2' && (
                      <Field full label={t('sp.bullets')} hint={t('sp.onePerLine')}>
                        <Textarea rows={3} defaultValue={it.bullets.join('\n')} disabled={!editable} onChange={(e) => setItem(it.id, { bullets: lines(e.target.value) })} />
                      </Field>
                    )}
                    {part === '3' && (
                      <>
                        <Field label="Lehine (+)" hint={t('sp.onePerLine')}>
                          <Textarea rows={4} defaultValue={it.pros.join('\n')} disabled={!editable} onChange={(e) => setItem(it.id, { pros: lines(e.target.value) })} />
                        </Field>
                        <Field label="Aleyhine (−)" hint={t('sp.onePerLine')}>
                          <Textarea rows={4} defaultValue={it.cons.join('\n')} disabled={!editable} onChange={(e) => setItem(it.id, { cons: lines(e.target.value) })} />
                        </Field>
                      </>
                    )}
                    <Field label={t('sp.prepSec')}>
                      <Input type="number" min={0} max={600} value={it.prep_seconds} disabled={!editable} onChange={(e) => setItem(it.id, { prep_seconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
                    </Field>
                    <Field label={t('sp.answerSec')}>
                      <Input type="number" min={5} max={600} value={it.answer_seconds} disabled={!editable} onChange={(e) => setItem(it.id, { answer_seconds: Math.max(5, Math.min(600, Number(e.target.value) || 5)) })} />
                    </Field>
                  </div>

                  <div className="sp-media">
                    {(it.images ?? []).map((p) => (
                      <div key={p} className="sp-thumb">
                        {urls[p] ? <img src={urls[p]} alt="" /> : <span className="skel" />}
                        {editable && (
                          <button className="sp-thumb-x" onClick={() => removeImage(it, p)} aria-label={t('common.delete')}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    {editable && (
                      <label className={'sp-upload' + (busy === 'img-' + it.id ? ' busy' : '')}>
                        <ImageIcon size={18} />
                        <span>{t('sp.addImage')}</span>
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => (addImages(it, e.target.files), (e.target.value = ''))} />
                      </label>
                    )}
                    {it.media_path ? (
                      <div className="sp-mediafile">
                        {it.media_kind === 'video' ? <FilmStrip size={17} /> : <SpeakerHigh size={17} />}
                        {urls[it.media_path] && (it.media_kind === 'video' ? <video src={urls[it.media_path]} controls preload="metadata" /> : <audio src={urls[it.media_path]} controls preload="metadata" />)}
                        {editable && (
                          <button className="sp-thumb-x static" onClick={() => clearMedia(it)} aria-label={t('common.delete')}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      editable && (
                        <label className={'sp-upload' + (busy === 'media-' + it.id ? ' busy' : '')} title={t('sp.mediaHint')}>
                          <FilmStrip size={18} />
                          <span>{t('sp.addMedia')}</span>
                          <input type="file" accept="audio/*,video/*" hidden onChange={(e) => (setMedia(it, e.target.files?.[0]), (e.target.value = ''))} />
                        </label>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      {preview && (
        <Modal title={`${t('sp.preview')} — ${v.title}`} onClose={() => setPreview(false)} wide>
          <div className="sp-preview">
            {merged.map((it, i) => (
              <div key={it.id} className="ex-card">
                <div className="ex-card-head">
                  <b>
                    {partTitle(it.part)}
                    {it.part === '1.1' || it.part === '1.2' ? ` · ${i + 1}. soru` : ''}
                  </b>
                  <span className="small muted">
                    {it.prep_seconds}s + {it.answer_seconds}s{it.media_path ? ` · ${it.media_kind}` : ''}
                  </span>
                </div>
                <Question item={it} urls={urls} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

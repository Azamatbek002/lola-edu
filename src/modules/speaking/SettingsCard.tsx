// Sozlamalar → Gapirish imtihoni: baholash mezonlari, darajalar, yo'riqnomalar va ovozlarni saqlash muddati
import { useState } from 'react'
import { Microphone, Plus, Trash2 } from '@/components/icons'
import { Button, Card, Field, Input, Textarea } from '@/components/ui'
import { useMutate, useRows } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { uid } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { parseSpeakingSettings, type SpeakingSettings } from '@/lib/speaking/grading'
import { PART_ORDER } from '@/lib/speaking/timeline'
import { partTitle } from './Exam'

export function SpeakingSettingsCard() {
  const t = useT()
  const toast = useToast()
  const row = useRows('settings').find((s) => s.key === 'speaking')
  const m = useMutate('settings')
  const [v, setV] = useState<SpeakingSettings | null>(null)
  const val = v ?? parseSpeakingSettings(row?.value)
  const set = (patch: Partial<SpeakingSettings>) => setV({ ...val, ...patch })

  const save = async () => {
    const clean = parseSpeakingSettings({ ...(row?.value as object), ...val })
    const value = { ...(row?.value as object), ...clean }
    if (row) await m.update(row.id, { value })
    else await m.create({ key: 'speaking', value })
    setV(null)
    toast.success(t('common.saved'))
  }

  return (
    <Card
      title={
        <h3 className="row" id="speaking">
          <Microphone size={18} /> {t('nav.speaking')}
        </h3>
      }
      actions={
        <Button size="sm" variant="primary" onClick={save} disabled={!v}>
          {t('common.save')}
        </Button>
      }
      pad
    >
      <h4 className="sp-set-h">{t('sp.criteria')}</h4>
      <p className="small muted mb">{t('sp.criteriaHint')}</p>
      <div className="col" style={{ gap: 8 }}>
        {val.criteria.map((c, i) => (
          <div key={c.id} className="sp-set-row">
            <Input
              value={c.name}
              placeholder={t('sp.criterionName')}
              onChange={(e) => set({ criteria: val.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
            />
            <Input
              type="number"
              min={1}
              value={c.max}
              aria-label={t('sp.maxScore')}
              onChange={(e) => set({ criteria: val.criteria.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) || 1 } : x)) })}
            />
            <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} aria-label={t('common.delete')} onClick={() => set({ criteria: val.criteria.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => set({ criteria: [...val.criteria, { id: 'c-' + uid().slice(0, 8), name: '', max: 10 }] })}>
            {t('sp.addCriterion')}
          </Button>
        </div>
      </div>

      <div className="divider" />
      <h4 className="sp-set-h">{t('sp.levels')}</h4>
      <p className="small muted mb">{t('sp.levelsHint')}</p>
      <div className="col" style={{ gap: 8 }}>
        {val.levels.map((l, i) => (
          <div key={i} className="sp-set-row">
            <Input value={l.name} placeholder="B1" onChange={(e) => set({ levels: val.levels.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <Input type="number" min={0} value={l.min} aria-label={t('sp.minScore')} onChange={(e) => set({ levels: val.levels.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) || 0 } : x)) })} />
            <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} aria-label={t('common.delete')} onClick={() => set({ levels: val.levels.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <div>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => set({ levels: [...val.levels, { name: '', min: 0 }] })}>
            {t('sp.addLevel')}
          </Button>
        </div>
      </div>

      <div className="divider" />
      <div className="form-grid">
        <Field label={t('sp.introSeconds')} hint={t('sp.introSecondsHint')}>
          <Input type="number" min={0} max={120} value={val.intro_seconds} onChange={(e) => set({ intro_seconds: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('sp.retention')} hint={t('sp.retentionHint')}>
          <Input type="number" min={1} max={60} value={val.retention_days_after_grading} onChange={(e) => set({ retention_days_after_grading: Number(e.target.value) || 5 })} />
        </Field>
      </div>
      <details className="mt">
        <summary className="small bold">{t('sp.intros')}</summary>
        <div className="col mt" style={{ gap: 10 }}>
          {PART_ORDER.map((p) => (
            <Field key={p} label={partTitle(p)}>
              <Textarea rows={3} value={val.intros[p] ?? ''} onChange={(e) => set({ intros: { ...val.intros, [p]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </details>
    </Card>
  )
}

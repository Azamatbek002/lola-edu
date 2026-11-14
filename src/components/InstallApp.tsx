import { useState } from 'react'
import { Download, Share, SquarePlus } from 'lucide-react'
import { Button, Modal } from './ui'
import { useT } from '@/lib/i18n'
import { promptInstall, useInstallMode } from '@/lib/pwa'

/** "Ilovani o'rnatish" tugmasi. O'rnatib bo'lmasa yoki allaqachon o'rnatilgan bo'lsa ko'rinmaydi. */
export function InstallApp({ compact, block }: { compact?: boolean; block?: boolean }) {
  const t = useT()
  const mode = useInstallMode()
  const [ios, setIos] = useState(false)
  if (!mode) return null

  const onClick = () => (mode === 'ios' ? setIos(true) : promptInstall())
  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        block={block}
        icon={<Download size={compact ? 18 : 16} />}
        onClick={onClick}
        aria-label={t('pwa.install')}
        title={t('pwa.install')}
      >
        {compact ? undefined : t('pwa.install')}
      </Button>
      {ios && (
        <Modal title={t('pwa.install')} onClose={() => setIos(false)} footer={<Button variant="primary" onClick={() => setIos(false)}>{t('common.close')}</Button>}>
          <div className="row mb">
            <img src="/icons/apple-touch-icon.png" alt="" style={{ width: 56, height: 56, borderRadius: 14, boxShadow: 'var(--shadow)' }} />
            <p className="muted">{t('pwa.iosIntro')}</p>
          </div>
          <ol className="col" style={{ gap: 12, paddingLeft: 20 }}>
            <li>
              {t('pwa.iosStep1')} <Share size={16} style={{ verticalAlign: 'text-bottom', color: '#0a84ff' }} />
            </li>
            <li>
              {t('pwa.iosStep2')} <SquarePlus size={16} style={{ verticalAlign: 'text-bottom' }} />
            </li>
            <li>{t('pwa.iosStep3')}</li>
          </ol>
        </Modal>
      )}
    </>
  )
}

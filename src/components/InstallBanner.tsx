import { useState } from 'react'
import { X, Smartphone } from 'lucide-react'

const DISMISSED_KEY = 'far135_install_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
}

function getOS(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export default function InstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1' || isStandalone()
  )

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const os = getOS()

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
      <Smartphone size={18} className="shrink-0 mt-0.5 text-blue-500" />
      <p className="flex-1 leading-snug">
        {os === 'ios' && <>
          <strong>Add to Home Screen:</strong> Tap the <strong>Share</strong> button in Safari, then select <strong>Add to Home Screen</strong> for the best experience.
        </>}
        {os === 'android' && <>
          <strong>Add to Home Screen:</strong> Tap the <strong>menu (⋮)</strong> in Chrome, then select <strong>Add to Home Screen</strong> or <strong>Install app</strong> for the best experience.
        </>}
        {os === 'desktop' && <>
          <strong>Designed for mobile.</strong> Open <strong>{window.location.host + window.location.pathname}</strong> in Safari (iPhone) or Chrome (Android) and add it to your home screen for the best experience.
        </>}
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}

import { useRegisterSW } from 'virtual:pwa-register/react'
import ChangelogModal from '@/components/ChangelogModal'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 shadow-lg text-white text-sm font-medium">
      <span>Update available</span>
      <ChangelogModal>
        <button className="text-blue-100 underline underline-offset-2 text-sm hover:text-white transition-colors">
          What's new?
        </button>
      </ChangelogModal>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-white text-blue-700 font-semibold px-3 py-1 hover:bg-blue-50 transition-colors"
      >
        Refresh
      </button>
    </div>
  )
}

import ChangelogModal from '@/components/ChangelogModal'

interface Props {
  needRefresh: boolean
  onRefresh: () => void
}

// Shown when a new version has downloaded and is waiting. The service-worker
// watcher (useRegisterSW) runs once, in App, and passes its state down.
export default function UpdateBanner({ needRefresh, onRefresh }: Props) {
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
        onClick={onRefresh}
        className="rounded-lg bg-white text-blue-700 font-semibold px-3 py-1 hover:bg-blue-50 transition-colors"
      >
        Refresh
      </button>
    </div>
  )
}

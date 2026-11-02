import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

// A sideways-scrolling area that shows when there's more off screen: a fade at
// the edge with more content, and a "Swipe for more" tag until you reach the end.
export default function ScrollX({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMore({
      left:  el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [])

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto">{children}</div>
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent transition-opacity ${more.left ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity ${more.right ? 'opacity-100' : 'opacity-0'}`} />
      {more.right && (
        <button
          type="button"
          onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8, behavior: 'smooth' })}
          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-slate-900/80 dark:bg-slate-100/90 text-white dark:text-slate-900 text-[0.68rem] font-semibold pl-2.5 pr-1.5 py-1 shadow"
        >
          Swipe for more <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}

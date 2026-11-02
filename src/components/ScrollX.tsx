import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

// A sideways-scrolling area that shows when there's more off screen: a fade at
// the edge with more content, and a › arrow on the right fade until you reach the end.
// The arrow sits below the column headers, centered, and stays mid-screen on a long table.
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
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-10 pt-11 pb-2 flex flex-col items-end justify-center bg-gradient-to-l from-card via-card/70 to-transparent transition-opacity ${more.right ? 'opacity-100' : 'opacity-0'}`}>
        <button
          type="button"
          tabIndex={more.right ? 0 : -1}
          aria-label="Scroll right for more columns"
          onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8, behavior: 'smooth' })}
          className={`sticky top-[45vh] bottom-[45vh] p-1 text-slate-500 dark:text-slate-300 ${more.right ? 'pointer-events-auto' : ''}`}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

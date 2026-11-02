import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// A sideways-scrolling area that shows when there's more off screen: a fade at
// each edge with more content, with a ‹ or › arrow on it. The arrows sit below the
// column headers and hold at the middle of the screen while the table is in view.
//
// Tapping › moves a full screen: the column cut off at the right edge becomes the
// first column (edges from the first table row). ‹ goes back a screen to a whole column.
// Both stop exactly at either end, so the last column ends
// flush with the edge rather than relying on the browser to clamp a smooth scroll.
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

  function step(dir: 1 | -1) {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const cur = el.scrollLeft
    const want = cur + dir * el.clientWidth
    // Left edges of the columns, in scroll coordinates.
    const box = el.getBoundingClientRect()
    const edges = [...(el.querySelector('tr')?.children ?? [])]
      .map(c => c.getBoundingClientRect().left - box.left + cur)
    let target = want
    if (dir > 0) {
      // The column cut off at the right edge becomes the first column.
      const fits = edges.filter(x => x > cur + 4 && x <= want + 1)   // +1: a column ending right at the edge was fully shown
      if (fits.length) target = Math.max(...fits)
    } else {
      // Back a full screen, starting on a whole column.
      const fits = edges.filter(x => x < cur - 4 && x >= want - 1)
      if (fits.length) target = Math.min(...fits)
    }
    el.scrollTo({ left: Math.round(Math.min(max, Math.max(0, target))), behavior: 'smooth' })
  }

  const fade = 'pointer-events-none absolute inset-y-0 w-10 pt-11 pb-2 flex flex-col justify-center via-card/70 to-transparent transition-opacity'
  const arrow = 'sticky p-1 text-slate-500 dark:text-slate-300'
  // One resting spot: the middle of the screen area below the pinned top bar
  // (--header-h, set by Header). Same value for top and bottom, so the arrow holds
  // there instead of shifting between two spots. ARROW_HALF = half the 30 px button.
  const ARROW_HALF = 15
  const pin = {
    top:    `calc((100vh + var(--header-h, 0px)) / 2 - ${ARROW_HALF}px)`,
    bottom: `calc((100vh - var(--header-h, 0px)) / 2 - ${ARROW_HALF}px)`,
  }

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto">{children}</div>
      <div className={`${fade} left-0 items-start bg-gradient-to-r from-card ${more.left ? 'opacity-100' : 'opacity-0'}`}>
        <button
          type="button"
          tabIndex={more.left ? 0 : -1}
          aria-label="Scroll left for more columns"
          onClick={() => step(-1)}
          style={pin}
          className={`${arrow} ${more.left ? 'pointer-events-auto' : ''}`}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
      </div>
      <div className={`${fade} right-0 items-end bg-gradient-to-l from-card ${more.right ? 'opacity-100' : 'opacity-0'}`}>
        <button
          type="button"
          tabIndex={more.right ? 0 : -1}
          aria-label="Scroll right for more columns"
          onClick={() => step(1)}
          style={pin}
          className={`${arrow} ${more.right ? 'pointer-events-auto' : ''}`}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

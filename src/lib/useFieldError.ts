import { useEffect, useRef, useState } from 'react'

export interface FieldErr { msg: string; field?: string }

/**
 * A form's current error and the field it's about. `fail(msg, field)` sets it and
 * scrolls that field (marked with data-field, inside `rootRef`) into view; the form shows the message
 * under the field, or at the bottom when there's no single field to point at.
 * It clears itself whenever any of `deps` (the form's values) change.
 */
export function useFieldError(deps: unknown[]) {
  const [error, setError] = useState<FieldErr | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)   // the form; field lookups stay inside it

  useEffect(() => {
    if (!error?.field) return
    rootRef.current?.querySelector(`[data-field="${error.field}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [error])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setError(null), deps)

  return {
    rootRef,
    error,
    fail: (msg: string, field?: string) => setError({ msg, field }),
    clear: () => setError(null),
    /** The message, if the current error is about `field`. */
    at: (field: string) => (error?.field === field ? error.msg : undefined),
    /** The message, if the current error isn't about any one field. */
    general: error && !error.field ? error.msg : undefined,
  }
}

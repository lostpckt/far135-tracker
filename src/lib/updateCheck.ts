// Manual "Check for update": asks the server for a new version, then reads the
// outcome from the service-worker registration instead of guessing from a timer.

export type UpdateCheckResult =
  | { kind: 'downloading'; worker: ServiceWorker }  // new version found, still installing
  | { kind: 'waiting' }                              // new version already downloaded
  | { kind: 'upToDate' }
  | { kind: 'failed' }                               // offline, or no service worker

export async function checkForAppUpdate(
  sw: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
): Promise<UpdateCheckResult> {
  try {
    const reg = await sw?.getRegistration()
    if (!reg) return { kind: 'failed' }
    await reg.update()   // rejects when the new script can't be fetched (e.g. offline)
    if (reg.installing) return { kind: 'downloading', worker: reg.installing }
    if (reg.waiting) return { kind: 'waiting' }
    return { kind: 'upToDate' }
  } catch {
    return { kind: 'failed' }
  }
}

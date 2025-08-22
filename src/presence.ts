
import type { User } from 'firebase/auth'
import type { Database } from 'firebase/database'

export type PresenceAPIs = {
  db: Database
  ref: any
  onValue: any
  onDisconnect: any
  set: any
  serverTimestamp: any
  update: any
}

export async function ensureRTDB(): Promise<PresenceAPIs | null> {
  try {
    const apis = await import('firebase/database')
    const { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp, update } = apis as any
    const db = getDatabase()
    return { db, ref, onValue, onDisconnect, set, serverTimestamp, update }
  } catch {
    return null
  }
}

export async function wirePresence(currentUser: User | null) {
  const apis = await ensureRTDB()
  if (!apis || !currentUser) return
  const { db, ref, onDisconnect, set, serverTimestamp } = apis
  const uid = currentUser.uid
  const statusRef = ref(db, `status/${uid}`)
  await onDisconnect(statusRef).set({ state: 'offline', last_changed: serverTimestamp() })
  await set(statusRef, { state: 'online', last_changed: serverTimestamp() })
}

export async function setTyping(convId: string, currentUser: User | null, typing: boolean) {
  const apis = await ensureRTDB()
  if (!apis || !currentUser) return
  const { db, ref, set } = apis
  const uid = currentUser.uid
  const tRef = ref(db, `typing/${convId}/${uid}`)
  await set(tRef, typing ? 1 : 0)
}

export async function subscribeTyping(convId: string, currentUser: User | null, cb: (map: Record<string, number>) => void) {
  const apis = await ensureRTDB()
  if (!apis) return () => {}
  const { db, ref, onValue } = apis
  const tRef = ref(db, `typing/${convId}`)
  const off = onValue(tRef, (snap: any) => {
    const val = snap.val() || {}
    if (currentUser) delete val[currentUser.uid]
    cb(val)
  })
  return () => off()
}

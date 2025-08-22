
import type { Firestore } from 'firebase/firestore'

export type Session = {
  roomId: string
  pc: RTCPeerConnection
  local?: MediaStream
  remote?: MediaStream
  kind: 'voice' | 'video'
  hangup: () => Promise<void>
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
}

export async function createRoom(db: Firestore, kind: 'voice'|'video'): Promise<Session> {
  const apis = await import('firebase/firestore')
  const { collection, addDoc, doc, onSnapshot, setDoc, updateDoc } = apis as any

  const pc = new RTCPeerConnection(RTC_CONFIG)
  const local = await getLocalStream(kind)
  if (local) {
    for (const track of local.getTracks()) pc.addTrack(track, local)
  }
  const remote = new MediaStream()
  pc.addEventListener('track', (evt) => {
    const [stream] = evt.streams
    if (!stream) return
    for (const track of stream.getTracks()) remote.addTrack(track)
  })

  const roomRef = await addDoc(collection(db, 'rooms'), { created: Date.now(), kind })
  const callerCandidates = collection(roomRef, 'callerCandidates')
  const calleeCandidates = collection(roomRef, 'calleeCandidates')

  pc.addEventListener('icecandidate', async (event) => {
    if (event.candidate) {
      await addDoc(callerCandidates, event.candidate.toJSON())
    }
  })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp }, kind, created: Date.now() }, { merge: true })

  const unsub = onSnapshot(roomRef, async (snap: any) => {
    const data = snap.data()
    if (!pc.currentRemoteDescription && data?.answer) {
      const answer = new RTCSessionDescription(data.answer)
      await pc.setRemoteDescription(answer)
    }
  })

  onSnapshot(calleeCandidates, (snap: any) => {
    snap.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
  })

  async function hangup() {
    try { unsub() } catch {}
    try { await updateDoc(roomRef, { ended: Date.now() }) } catch {}
    local?.getTracks().forEach(t => t.stop())
    pc.getSenders().forEach(s => { try { s.track?.stop() } catch {} })
    pc.close()
  }

  return { roomId: roomRef.id, pc, local, remote, kind, hangup }
}

export async function joinRoom(db: Firestore, roomId: string, kind: 'voice'|'video'): Promise<Session> {
  const apis = await import('firebase/firestore')
  const { collection, addDoc, doc, getDoc, onSnapshot, setDoc } = apis as any

  const pc = new RTCPeerConnection(RTC_CONFIG)
  const local = await getLocalStream(kind)
  if (local) {
    for (const track of local.getTracks()) pc.addTrack(track, local)
  }
  const remote = new MediaStream()
  pc.addEventListener('track', (evt) => {
    const [stream] = evt.streams
    if (!stream) return
    for (const track of stream.getTracks()) remote.addTrack(track)
  })

  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Room not found')
  const data = roomSnap.data()
  const offer = data.offer
  await pc.setRemoteDescription(new RTCSessionDescription(offer))

  const calleeCandidates = collection(roomRef, 'calleeCandidates')
  const callerCandidates = collection(roomRef, 'callerCandidates')

  pc.addEventListener('icecandidate', async (event) => {
    if (event.candidate) {
      await addDoc(calleeCandidates, event.candidate.toJSON())
    }
  })

  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true })

  onSnapshot(callerCandidates, (snap: any) => {
    snap.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
  })

  async function hangup() {
    local?.getTracks().forEach(t => t.stop())
    pc.getSenders().forEach(s => { try { s.track?.stop() } catch {} })
    pc.close()
  }

  return { roomId, pc, local, remote, kind, hangup }
}

async function getLocalStream(kind: 'voice'|'video'): Promise<MediaStream | undefined> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return undefined
  try {
    const constraints: MediaStreamConstraints = kind === 'video'
      ? { audio: true, video: { width: 1280, height: 720 } }
      : { audio: true, video: false }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream
  } catch {
    return undefined
  }
}

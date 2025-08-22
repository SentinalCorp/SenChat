
# SenChat (Release Advanced)

**What’s included**

- **Release mode** (PREVIEW_MODE defaults to false): Firestore is required; app blocks if unavailable.
- **Messaging** persisted in Firestore (server timestamps).
- **Direct Messages** (creates `dm` conversations).
- **Presence & Typing** via Realtime Database (optional; auto-wires if RTDB available).
- **WebRTC Calls** with **Firestore signaling** (`rooms` collection + ICE candidate subcollections). Includes create/join flows and device toggles.

## Run

```bash
npm i
# Release-like run (Firestore required)
VITE_PREVIEW_MODE=false npm run dev
```

## Calls

- Click **Voice** or **Video** in a channel/DM → creates a room and shows the **Room ID** in the floating bar.
- On a second client, go to the **Calls** tab → enter the **Room ID** and Join.
- Uses public STUN. For production, add a TURN server in `webrtc.ts`.

## Presence / Typing

- Requires Firebase **Realtime Database** enabled. If RTDB isn't available, presence/typing silently disable.

## GitHub

1. Create (or use) `SenChat` repo.
2. Unzip these files into the repo folder, then:
```bash
git add .
git commit -m "feat: release with presence, typing, and WebRTC signaling"
git push
```

Replace the UI stubs in `src/components/ui/*` with your shadcn/ui components to match your design system.

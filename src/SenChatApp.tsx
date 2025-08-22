
import React, { useMemo, useState, useContext, createContext, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Cog, Users, Smartphone, Phone, Video, Mic, MicOff, Camera, CameraOff, PhoneOff, Shield } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Switch } from "./components/ui/switch";

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, initializeAuth, browserLocalPersistence, indexedDBLocalPersistence,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signOut, type User
} from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

import { wirePresence, setTyping as rtdbSetTyping, subscribeTyping } from "./presence";
import { createRoom, joinRoom, type Session } from "./webrtc";

let _firestoreApis: typeof import("firebase/firestore") | null = null;

const firebaseConfig = {
  apiKey: "AIzaSyAJAOLPEWkMvxW_WGohK02wONs-1-V8nz0",
  authDomain: "senchat-14fa8.firebaseapp.com",
  projectId: "senchat-14fa8",
  storageBucket: "senchat-14fa8.firebasestorage.app",
  messagingSenderId: "400926593186",
  appId: "1:400926593186:web:6d79243068989b21cf87fb",
};

const isBrowser = typeof window !== "undefined";
const PREVIEW_MODE: boolean = (() => {
  try {
    const vite = (import.meta as any)?.env?.VITE_PREVIEW_MODE;
    // @ts-ignore
    const node = typeof process !== 'undefined' ? (process as any)?.env?.PREVIEW_MODE : undefined;
    const raw = vite ?? node ?? 'false';
    return String(raw).toLowerCase() === 'true';
  } catch {
    return false;
  }
})();

let _app: FirebaseApp | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _dbAvailable = false;

async function ensureFirestoreApis() {
  if (_firestoreApis) return _firestoreApis;
  try {
    _firestoreApis = await import("firebase/firestore");
    return _firestoreApis;
  } catch {
    _firestoreApis = null;
    return null;
  }
}

async function ensureFirebaseAsync() {
  if (!isBrowser) return { app: null, auth: null, db: null, storage: null, dbAvailable: false } as const;
  if (!_app) _app = initializeApp(firebaseConfig);

  if (!_auth) {
    try {
      _auth = getAuth(_app);
      // @ts-ignore
      void _auth.app;
    } catch {
      _auth = initializeAuth(_app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    }
  }

  if (!_db) {
    const apis = await ensureFirestoreApis();
    if (apis) {
      try {
        const { getFirestore } = apis;
        _db = getFirestore(_app);
        _dbAvailable = true;
      } catch {
        _db = null; _dbAvailable = false;
      }
    } else {
      _db = null; _dbAvailable = false;
    }
  }

  if (PREVIEW_MODE) _dbAvailable = false;
  return { app: _app, auth: _auth, db: _db, storage: _storage, dbAvailable: _dbAvailable } as const;
}

function ensureFirebaseSync() {
  return { app: _app, auth: _auth, db: _db, storage: _storage, dbAvailable: _dbAvailable } as const;
}

type Conversation = { id: string; type: "channel" | "dm"; name: string; };
type ChatMessage = { id: string; convId: string; author: string; text: string; ts: number; };
type CallState = { active: boolean; type: null | "voice" | "video"; convId: string | null; mic: boolean; cam: boolean; roomId?: string; };

const AppStoreCtx = createContext<{
  user: User | null;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string) => Promise<void>;
  signInAnon: () => Promise<void>;
  doSignOut: () => Promise<void>;

  conversations: Conversation[];
  activeId: string;
  setActiveId: (id: string) => void;
  messagesByConv: Record<string, ChatMessage[]>;
  sendMessage: (text: string) => void;

  startDM: (who: string) => Promise<void>;

  typingUsers: string[];
  setTyping: (typing: boolean) => void;

  call: CallState;
  startCall: (kind: "voice" | "video") => void;
  joinCallById: (roomId: string, kind: "voice" | "video") => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;

  dbAvailable: boolean;
}>({
  user: null,
  signInEmail: async () => {},
  signUpEmail: async () => {},
  signInAnon: async () => {},
  doSignOut: async () => {},
  conversations: [],
  activeId: "",
  setActiveId: () => {},
  messagesByConv: {},
  sendMessage: () => {},
  startDM: async () => {},
  typingUsers: [],
  setTyping: () => {},
  call: { active: false, type: null, convId: null, mic: true, cam: true },
  startCall: () => {},
  joinCallById: () => {},
  endCall: () => {},
  toggleMic: () => {},
  toggleCam: () => {},
  dbAvailable: false,
});

function useAppStore() { return useContext(AppStoreCtx); }

export default function SenChatApp() {
  const [tab, setTab] = useState<"login" | "app" | "settings" | "calls">("app");

  return (
    <AppStoreProvider>
      <div style={{minHeight:760, border:'1px solid #27272a'}}>
        <div style={{height:56, display:'flex', alignItems:'center', padding:'0 12px', borderBottom:'1px solid #27272a'}}>
          <div style={{fontWeight:600}}><MessageCircle /> SenChat – Release Advanced</div>
          <div style={{marginLeft:'auto', display:'flex', gap:8}}>
            {[
              { key: 'login', label:'Login' },
              { key: 'app', label:'App' },
              { key: 'settings', label:'Settings' },
              { key: 'calls', label:'Calls' },
            ].map(t => (
              <Button key={t.key} onClick={()=>setTab(t.key as any)}>{t.label}</Button>
            ))}
          </div>
        </div>
        <div>
          <AnimatePresence mode="wait">
            {tab === "login" && <Section key="login"><LoginView /></Section>}
            {tab === "app" && <Section key="app"><MainApp /></Section>}
            {tab === "settings" && <Section key="settings"><SettingsView /></Section>}
            {tab === "calls" && <Section key="calls"><CallsView /></Section>}
          </AnimatePresence>
        </div>
      </div>
    </AppStoreProvider>
  );
}

// Provider
function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [fatal, setFatal] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { dbAvailable } = await ensureFirebaseAsync();
      if (!PREVIEW_MODE && !dbAvailable) setFatal("Backend unavailable: Firestore is required in release mode.");
    })();
  }, []);

  const { auth } = ensureFirebaseSync();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      await wirePresence(u);
    });
  }, [auth]);

  const signInEmail = useCallback(async (email: string, pass: string) => {
    const { auth } = ensureFirebaseSync();
    if (!auth) throw new Error("Auth not ready");
    await signInWithEmailAndPassword(auth, email, pass);
  }, []);
  const signUpEmail = useCallback(async (email: string, pass: string) => {
    const { auth } = ensureFirebaseSync();
    if (!auth) throw new Error("Auth not ready");
    await createUserWithEmailAndPassword(auth, email, pass);
  }, []);
  const signInAnon = useCallback(async () => {
    const { auth } = ensureFirebaseSync();
    if (!auth) throw new Error("Auth not ready");
    await signInAnonymously(auth);
  }, []);
  const doSignOut = useCallback(async () => {
    const { auth } = ensureFirebaseSync();
    if (!auth) return;
    await signOut(auth);
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [dbAvailable, setDbAvailable] = useState<boolean>(false);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const seedLocalConversations = useCallback(() => {
    setConversations((prev) => {
      if (prev.length) return prev;
      return [
        { id: "c-general", type: "channel", name: "# general" },
        { id: "c-dev", type: "channel", name: "# dev" },
        { id: "c-support", type: "channel", name: "# support" },
      ];
    });
    setActiveId((id) => (id ? id : "c-general"));
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { db, dbAvailable } = await ensureFirebaseAsync();
      setDbAvailable(dbAvailable);
      if (!user) return;

      if (!dbAvailable) {
        if (PREVIEW_MODE) seedLocalConversations();
        return;
      }
      const apis = await ensureFirestoreApis();
      if (!apis || !db) return;
      const { collection, doc, setDoc, onSnapshot } = apis;
      const colRef = collection(db, "conversations");
      unsub = onSnapshot(colRef, async (snap: any) => {
        if (snap.empty) {
          await setDoc(doc(colRef as any, "c-general"), { type: "channel", name: "# general" });
          await setDoc(doc(colRef as any, "c-dev"), { type: "channel", name: "# dev" });
          await setDoc(doc(colRef as any, "c-support"), { type: "channel", name: "# support" });
        } else {
          const list: Conversation[] = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
          setConversations(list);
          setActiveId((cur) => (cur || (list[0]?.id ?? "")));
        }
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [user, seedLocalConversations]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { db, dbAvailable } = ensureFirebaseSync();
      if (!user || !activeId) return;

      // Typing subscription (RTDB)
      const off = await subscribeTyping(activeId, user, (map) => {
        setTypingUsers(Object.keys(map));
      });

      if (!dbAvailable) {
        if (PREVIEW_MODE) {
          setMessagesByConv((prev) => ({ ...prev, [activeId]: prev[activeId] || [] }));
        }
        return () => { off && off(); };
      }

      const apis = await ensureFirestoreApis();
      if (!apis || !db) return;
      const { collection, query, orderBy, onSnapshot } = apis;
      const msgsRef = collection(db, "conversations", activeId, "messages");
      const q = query(msgsRef, orderBy("ts"));
      unsub = onSnapshot(q, (snap: any) => {
        const arr: ChatMessage[] = snap.docs.map((d: any) => {
          const data = d.data() as any;
          const tsVal = (data.ts?.toMillis?.() ?? Date.now()) as number;
          return { id: d.id, convId: activeId, author: data.author ?? "Unknown", text: data.text ?? "", ts: tsVal };
        });
        setMessagesByConv((prev) => ({ ...prev, [activeId]: arr }));
      });

      return () => { off && off(); };
    })();
    return () => { if (unsub) unsub(); };
  }, [user, activeId]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !activeId) return;
    const { db, dbAvailable } = ensureFirebaseSync();
    (async () => { await rtdbSetTyping(activeId, _auth?.currentUser ?? null, false); })();

    if (dbAvailable && db) {
      (async () => {
        const apis = await ensureFirestoreApis();
        if (!apis) return;
        const { collection, addDoc, serverTimestamp } = apis;
        const auth = _auth;
        const msgsRef = collection(db, "conversations", activeId, "messages");
        await addDoc(msgsRef, {
          text,
          author: auth?.currentUser?.isAnonymous ? "Anon" : auth?.currentUser?.email || "User",
          ts: serverTimestamp(),
        });
      })();
    } else if (PREVIEW_MODE) {
      const now = Date.now();
      setMessagesByConv((prev) => {
        const list = prev[activeId] || [];
        const msg: ChatMessage = { id: `${activeId}-${now}`, convId: activeId, author: "LocalUser", text, ts: now };
        return { ...prev, [activeId]: [...list, msg] };
      });
    }
  }, [activeId]);

  const startDM = useCallback(async (who: string) => {
    const { db, dbAvailable } = ensureFirebaseSync();
    if (!who.trim()) return;
    if (dbAvailable && db) {
      const apis = await ensureFirestoreApis();
      if (!apis) return;
      const { collection, addDoc } = apis;
      const newDoc = await addDoc(collection(db, "conversations"), { type: "dm", name: `@${who}` });
      setActiveId(newDoc.id);
    } else if (PREVIEW_MODE) {
      const id = `dm-${who.toLowerCase()}`;
      setConversations((prev) => [...prev, { id, type: "dm", name: `@${who}` }]);
      setActiveId(id);
    }
  }, []);

  // Calls (signaling)
  const [call, setCall] = useState<CallState>({ active: false, type: null, convId: null, mic: true, cam: true });
  const sessionRef = useRef<Session | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (localVideoRef.current && s.local) {
      // @ts-ignore
      localVideoRef.current.srcObject = s.local;
    }
    if (remoteVideoRef.current && s.remote) {
      // @ts-ignore
      remoteVideoRef.current.srcObject = s.remote;
    }
  }, [call]);

  const startCall = useCallback(async (kind: "voice" | "video") => {
    const { db, dbAvailable } = ensureFirebaseSync();
    if (!dbAvailable || !db) throw new Error("Calls require Firestore (release mode).");
    const s = await createRoom(db, kind);
    sessionRef.current = s;
    setCall({ active: true, type: kind, convId: activeId, mic: true, cam: kind === "video", roomId: s.roomId });
  }, [activeId]);

  const joinCallById = useCallback(async (roomId: string, kind: "voice" | "video") => {
    const { db, dbAvailable } = ensureFirebaseSync();
    if (!dbAvailable || !db) throw new Error("Calls require Firestore (release mode).");
    const s = await joinRoom(db, roomId, kind);
    sessionRef.current = s;
    setCall({ active: true, type: kind, convId: activeId, mic: true, cam: kind === "video", roomId });
  }, [activeId]);

  const endCall = useCallback(async () => {
    try { await sessionRef.current?.hangup(); } catch {}
    sessionRef.current = null;
    setCall({ active: false, type: null, convId: null, mic: true, cam: true, roomId: undefined });
  }, []);
  const toggleMic = useCallback(() => {
    setCall((c) => {
      const next = !c.mic;
      const s = sessionRef.current;
      if (s?.local) s.local.getAudioTracks().forEach(t => t.enabled = next);
      return { ...c, mic: next };
    });
  }, []);
  const toggleCam = useCallback(() => {
    setCall((c) => {
      const next = !c.cam;
      const s = sessionRef.current;
      if (s?.local) s.local.getVideoTracks().forEach(t => t.enabled = next);
      return { ...c, cam: next };
    });
  }, []);

  const setTyping = useCallback((typing: boolean) => {
    rtdbSetTyping(activeId, _auth?.currentUser ?? null, typing);
  }, [activeId]);

  const value = useMemo(() => ({
    user, signInEmail, signUpEmail, signInAnon, doSignOut,
    conversations, activeId, setActiveId, messagesByConv, sendMessage,
    startDM,
    typingUsers, setTyping,
    call, startCall, joinCallById, endCall, toggleMic, toggleCam,
    dbAvailable,
  }), [
    user, signInEmail, signUpEmail, signInAnon, doSignOut,
    conversations, activeId, messagesByConv, sendMessage,
    startDM,
    typingUsers, setTyping,
    call, startCall, joinCallById, endCall, toggleMic, toggleCam,
    dbAvailable,
  ]);

  if (fatal) {
    return (
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:760}}>
        <Card className="w-full max-w-lg"><CardHeader><CardTitle>Release Mode Error</CardTitle></CardHeader><CardContent> {fatal} </CardContent></Card>
      </div>
    );
  }

  return (
    <AppStoreCtx.Provider value={value}>
      {children}
      {call.active && (
        <div style={{position:'fixed', left:'50%', bottom:16, transform:'translateX(-50%)', background:'#111827', padding:8, border:'1px solid #27272a', borderRadius:12, display:'flex', alignItems:'center', gap:8}}>
          <span>{call.type === 'video' ? 'Video' : 'Voice'} call • Room: {call.roomId}</span>
          <Button onClick={toggleMic}>{call.mic ? <Mic /> : <MicOff />}</Button>
          <Button onClick={toggleCam} disabled={call.type !== 'video'}>{call.cam ? <Camera /> : <CameraOff />}</Button>
          <Button onClick={endCall}><PhoneOff /> End</Button>
        </div>
      )}
      {/* Hidden video elements for stream sinks */}
      <video ref={localVideoRef} autoPlay muted playsInline style={{display:'none'}} />
      <video ref={remoteVideoRef} autoPlay playsInline style={{display:'none'}} />
    </AppStoreCtx.Provider>
  );
}

// UI views

function Section({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
      {children}
    </motion.div>
  );
}

function LoginView() {
  const { user, signInEmail, signUpEmail, signInAnon } = useAppStore();
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [err, setErr] = useState<string | null>(null);
  if (user) return <div style={{minHeight:680, display:'flex', alignItems:'center', justifyContent:'center'}}>Signed in.</div>;
  return (
    <div style={{minHeight:680, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>SenChat</CardTitle></CardHeader>
        <CardContent>
          {err && <div style={{color:'#f87171', fontSize:12}}>{err}</div>}
          <div><label>Email</label><Input value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div><label>Password</label><Input type="password" value={pass} onChange={e=>setPass(e.target.value)} /></div>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <button onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Create account':'Have an account? Sign in'}</button>
            <button onClick={()=>signInAnon().catch(e=>setErr(e.message))}>Continue as Guest</button>
          </div>
          <Button onClick={()=> (mode==='signin'?signInEmail(email,pass):signUpEmail(email,pass)).catch(e=>setErr(e.message)) }>{mode==='signin'?'Sign In':'Sign Up'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Sidebar() {
  const { conversations, activeId, setActiveId, user, doSignOut, startDM } = useAppStore();
  const channels = conversations.filter((c) => c.type === "channel");
  const dms = conversations.filter((c) => c.type === "dm");
  const [dmName, setDmName] = useState("");
  return (
    <div style={{width:256, padding:12, borderRight:'1px solid #27272a'}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <MessageCircle /> <span>Servers</span>
      </div>
      <div>
        <div>Channels</div>
        {channels.map((c) => (
          <button key={c.id} onClick={() => setActiveId(c.id)} style={{display:'block'}}>
            {c.name}
          </button>
        ))}
      </div>
      <div>
        <div>Direct Messages</div>
        {dms.map((c) => (
          <button key={c.id} onClick={() => setActiveId(c.id)} style={{display:'block'}}>
            {c.name}
          </button>
        ))}
        <div style={{display:'flex', gap:6, marginTop:8}}>
          <Input value={dmName} onChange={e=>setDmName(e.target.value)} placeholder="username" />
          <Button onClick={()=>{ startDM(dmName).then(()=>setDmName("")) }}>Start DM</Button>
        </div>
      </div>
      <div style={{marginTop:16, display:'flex', justifyContent:'space-between'}}>
        <span>{user ? (user.isAnonymous ? "Guest" : user.email) : "Signed out"}</span>
        {user && <button onClick={doSignOut}>Sign out</button>}
      </div>
    </div>
  );
}

function ChatWindow() {
  const { conversations, activeId, messagesByConv, sendMessage, startCall, setTyping, typingUsers } = useAppStore();
  const conv = conversations.find((c) => c.id === activeId);
  const msgs = messagesByConv[activeId] || [];
  const [text, setText] = useState("");
  useEffect(()=>{ setTyping(false) }, [activeId]);

  if (!conv) return <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>No conversation selected.</div>;
  const onSend = () => { sendMessage(text); setText(""); setTyping(false); };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column'}}>
      <div style={{height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid #27272a'}}>
        <div>{conv.name}</div>
        <div>
          <Button onClick={() => startCall("voice")}><Phone /> Voice</Button>
          <Button onClick={() => startCall("video")}><Video /> Video</Button>
        </div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:12}}>
        {msgs.map((m) => (
          <div key={m.id} style={{display:'flex', gap:8}}>
            <div style={{height:36, width:36, borderRadius:18, background:'#27272a'}} />
            <div>
              <div><strong>{m.author}</strong> <span>{new Date(m.ts).toLocaleTimeString()}</span></div>
              <div>{m.text}</div>
            </div>
          </div>
        ))}
        {typingUsers.length > 0 && (
          <div style={{opacity:.7, fontSize:12, marginTop:8}}>{typingUsers.length} typing…</div>
        )}
      </div>
      <div style={{height:64, display:'flex', alignItems:'center', gap:8, padding:'0 12px', borderTop:'1px solid #27272a'}}>
        <Button>+</Button>
        <Input
          value={text}
          onFocus={()=>setTyping(true)}
          onBlur={()=>setTyping(false)}
          onChange={(e)=>{ setText(e.target.value); setTyping(true);}}
          onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); onSend(); } }}
          placeholder="Type a message…"
        />
        <Button onClick={onSend}>Send</Button>
      </div>
    </div>
  );
}

function ProfileDrawer() {
  return (
    <div style={{width:320, borderLeft:'1px solid #27272a'}}>
      <div style={{height:56, borderBottom:'1px solid #27272a', display:'flex', alignItems:'center', padding:'0 12px'}}>
        <Users /> Profile
      </div>
      <div style={{padding:12}}>
        <div>HatD3V</div>
        <div>Game Developer</div>
      </div>
    </div>
  );
}

function MainApp() {
  return (
    <div style={{minHeight:680, display:'flex'}}>
      <Sidebar />
      <ChatWindow />
      <ProfileDrawer />
    </div>
  );
}

function CallsView() {
  const { joinCallById } = useAppStore();
  const [room, setRoom] = useState("");
  const [kind, setKind] = useState<"voice"|"video">("video");
  return (
    <div style={{minHeight:680, padding:24}}>
      <Card><CardHeader><CardTitle>Join a Call</CardTitle></CardHeader><CardContent>
        <div style={{display:'flex', gap:8}}>
          <Input value={room} onChange={e=>setRoom(e.target.value)} placeholder="Room ID" />
          <select value={kind} onChange={e=>setKind(e.target.value as any)}>
            <option value="video">Video</option>
            <option value="voice">Voice</option>
          </select>
          <Button onClick={()=>joinCallById(room, kind)}>Join</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

function SettingsView() {
  return (
    <div style={{minHeight:680, padding:24}}>
      <Card><CardHeader><CardTitle>Settings</CardTitle></CardHeader><CardContent>Release defaults with presence & typing enabled.</CardContent></Card>
    </div>
  );
}

// Smoke tests
;(function __SMOKE__(){
  try {
    console.assert(typeof PREVIEW_MODE === 'boolean', '[TEST] PREVIEW_MODE flag present')
  } catch (e) { console.error(e) }
})()

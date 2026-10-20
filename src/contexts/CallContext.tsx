import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { auth, database } from '../config/firebase';
import { acceptCall, declineCall, endCall as apiEndCall, joinChannel, startCall as apiStartCall, type ActiveCall, type CallCredentials } from '../services/callService';

type CallState = 'idle' | 'calling' | 'ringing' | 'in-call' | 'ended';
type CallSnapshot = { callId: string; orderId: string; channel: string; direction: 'incoming' | 'outgoing'; peerName?: string; status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'cancelled' | 'trip_ended'; expiresAt?: number; startedAt?: number; durationSeconds?: number; };
type CallContextValue = { callState: CallState; peerName: string; elapsedSeconds: number; formattedTime: string; isMuted: boolean; micAvailable: boolean; enableMicrophone: () => Promise<boolean>; endedMessage: string | null; startCall: (orderId: string, peerLabel?: string) => Promise<void>; answerCall: () => Promise<void>; declineCall: () => Promise<void>; endCall: () => Promise<void>; toggleMute: () => Promise<void>; };
const CallContext = createContext<CallContextValue | null>(null);
const terminal = new Set(['ended', 'declined', 'missed', 'cancelled', 'trip_ended']);
const formatTime = (seconds: number) => { const s = Math.max(0, seconds); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0'); const rest = (s % 60).toString().padStart(2, '0'); return h ? `${h}:${m}:${rest}` : `${m}:${rest}`; };
const callErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  return /NOT_SUPPORTED|getUserMedia/i.test(raw)
    ? 'Calls need a secure (https) connection and microphone access.'
    : raw;
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [peerName, setPeerName] = useState('Driver');
  const peerLabelRef = useRef('Driver');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [endedMessage, setEndedMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(null);
  const offsetRef = useRef(0);
  const activeRef = useRef<ActiveCall | null>(null);
  const snapshotRef = useRef<CallSnapshot | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const activeCallIdRef = useRef<string | null>(null);
  const seenRef = useRef(false);
  const endingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const endedTimerRef = useRef<number | null>(null);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  const stopAudio = useCallback(() => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; if (ringTimerRef.current !== null) { window.clearTimeout(ringTimerRef.current); ringTimerRef.current = null; } }, []);
  const leaveAgora = useCallback(async () => { await activeRef.current?.leave().catch(() => undefined); activeRef.current = null; }, []);

  const finishCall = useCallback(async (message: string) => {
    endingRef.current = true;
    stopAudio();
    await leaveAgora();
    setElapsedSeconds(0);
    setIsMuted(false);
    setMicAvailable(false);
    setSnapshot(null);
    snapshotRef.current = null;
    seenRef.current = false;
    setCallState('ended');
    setEndedMessage(message);
    if (endedTimerRef.current !== null) window.clearTimeout(endedTimerRef.current);
    endedTimerRef.current = window.setTimeout(() => { setCallState('idle'); setEndedMessage(null); setPeerName('Driver'); peerLabelRef.current = 'Driver'; endingRef.current = false; activeCallIdRef.current = null; }, 2500);
  }, [leaveAgora, stopAudio]);

  const messageForTerminal = useCallback((next: CallSnapshot) => {
    if (next.status === 'declined') return 'Call declined';
    if (next.status === 'missed') return 'No answer';
    if (next.status === 'trip_ended') return 'Trip ended';
    if ((next.durationSeconds || 0) > 0 || next.startedAt) return `Call ended · ${formatTime(next.durationSeconds || Math.max(0, Math.floor(((Date.now() + offsetRef.current) - (next.startedAt || Date.now())) / 1000)))}`;
    return next.direction === 'outgoing' ? 'Call cancelled' : 'Missed call';
  }, []);

  useEffect(() => {
    const unlock = () => { try { const audio = audioRef.current || new Audio('/sounds/call.mp3'); audioRef.current = audio; audio.loop = true; void audio.play().then(() => { audio.pause(); audio.currentTime = 0; }); } catch { /* optional ringtone */ } };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    let unsubscribeUser = () => undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      unsubscribeUser();
      if (!user) return;
      const offsetUnsub = onValue(ref(database, '.info/serverTimeOffset'), snap => { offsetRef.current = Number(snap.val() || 0); });
      const callsUnsub = onValue(ref(database, `user_calls/${user.uid}`), snap => {
        const next = snap.val() as CallSnapshot | null;
        const current = snapshotRef.current;
        const activeId = activeCallIdRef.current;
        if (!next) return;
        if (!current && terminal.has(next.status)) return;
        if (activeId && next.callId !== activeId) return;
        if (callStateRef.current !== 'idle' && activeId && next.callId !== activeId) return;
        if (next.expiresAt && Date.now() + offsetRef.current >= next.expiresAt && !terminal.has(next.status)) return;
        if (terminal.has(next.status)) {
          if (seenRef.current && (!activeId || next.callId === activeId)) void finishCall(messageForTerminal(next));
          return;
        }
        if (callStateRef.current === 'in-call' && next.direction === 'incoming') return;
        activeCallIdRef.current = next.callId;
        seenRef.current = true;
        setSnapshot(next);
        const resolvedPeerName = next.peerName || (callStateRef.current === 'calling' ? peerLabelRef.current : 'Driver');
        setPeerName(resolvedPeerName);
        if (next.status === 'ringing') {
          setCallState(next.direction === 'incoming' ? 'ringing' : 'calling');
          if (next.direction === 'incoming') { try { const audio = audioRef.current || new Audio('/sounds/call.mp3'); audioRef.current = audio; audio.loop = true; void audio.play().catch(() => undefined); } catch { /* optional ringtone */ } }
          if (next.direction === 'outgoing' && next.expiresAt && ringTimerRef.current === null) {
            const delay = Math.max(0, next.expiresAt - (Date.now() + offsetRef.current));
            ringTimerRef.current = window.setTimeout(async () => { ringTimerRef.current = null; const latest = snapshotRef.current; if (latest?.callId === next.callId && latest.status === 'ringing') { await apiEndCall(next.callId, 'no_answer').catch(() => undefined); await finishCall('No answer'); } }, delay);
          }
        }
        if (next.status === 'active') { stopAudio(); if (ringTimerRef.current !== null) { window.clearTimeout(ringTimerRef.current); ringTimerRef.current = null; } setCallState('in-call'); }
      });
      unsubscribeUser = () => { offsetUnsub(); callsUnsub(); };
    });
    return () => { unsubscribeUser(); unsubscribeAuth(); };
  }, [finishCall, messageForTerminal, stopAudio]);

  useEffect(() => { if (callState !== 'in-call' || !snapshot?.startedAt) return; const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() + offsetRef.current - snapshot.startedAt!) / 1000)), 1000); return () => window.clearInterval(timer); }, [callState, snapshot?.startedAt]);

  const connect = useCallback(async (credentials: CallCredentials) => { const activeCall = await joinChannel(credentials, () => setCallState('in-call')); activeRef.current = activeCall; setMicAvailable(activeCall.micAvailable); }, []);
  const start = useCallback(async (orderId: string, peerLabel = 'Driver') => {
    if (endingRef.current || callStateRef.current !== 'idle') return;
    peerLabelRef.current = peerLabel;
    endingRef.current = true; setCallState('calling'); callStateRef.current = 'calling'; setEndedMessage(null); setElapsedSeconds(0); setIsMuted(false); setPeerName(peerLabel); seenRef.current = true;
    let credentials: CallCredentials | null = null;
    try { credentials = await apiStartCall(orderId); activeCallIdRef.current = credentials.callId || null; const next = { ...credentials, callId: credentials.callId || '', orderId, direction: 'outgoing' as const, status: 'ringing' as const }; setSnapshot(next); snapshotRef.current = next; setPeerName(peerLabel); await connect(credentials); endingRef.current = false; } catch (error) { if (credentials?.callId) await apiEndCall(credentials.callId).catch(() => undefined); await finishCall(callErrorMessage(error)); }
  }, [connect, finishCall]);
  const answer = useCallback(async () => {
    if (endingRef.current || !snapshotRef.current?.callId) return;
    endingRef.current = true;
    const current = snapshotRef.current;
    activeCallIdRef.current = current.callId;
    seenRef.current = true;
    let credentials: CallCredentials;
    try {
      stopAudio();
      credentials = await acceptCall(current.callId);
    } catch (error) {
      await finishCall(callErrorMessage(error));
      return;
    }
    try {
      await connect(credentials);
      endingRef.current = false;
    } catch (error) {
      await apiEndCall(current.callId).catch(() => undefined);
      await finishCall(callErrorMessage(error));
    }
  }, [connect, finishCall, stopAudio]);
  const decline = useCallback(async () => { if (endingRef.current || !snapshotRef.current?.callId) return; endingRef.current = true; const id = snapshotRef.current.callId; await declineCall(id).catch(() => undefined); await finishCall('Call declined'); }, [finishCall]);
  const end = useCallback(async () => { if (endingRef.current || !snapshotRef.current?.callId) return; endingRef.current = true; const current = snapshotRef.current; const message = current.startedAt || callStateRef.current === 'in-call' ? `Call ended · ${formatTime(elapsedSeconds)}` : 'Call cancelled'; await apiEndCall(current.callId).catch(() => undefined); await finishCall(message); }, [elapsedSeconds, finishCall]);
  const mute = useCallback(async () => { const next = !isMuted; await activeRef.current?.setMuted(next); setIsMuted(next); }, [isMuted]);
  const enableMicrophone = useCallback(async () => {
    const enabled = await activeRef.current?.enableMicrophone() ?? false;
    setMicAvailable(enabled);
    return enabled;
  }, []);
  const value = useMemo(() => ({ callState, peerName, elapsedSeconds, formattedTime: formatTime(elapsedSeconds), isMuted, micAvailable, enableMicrophone, endedMessage, startCall: start, answerCall: answer, declineCall: decline, endCall: end, toggleMute: mute }), [answer, callState, decline, elapsedSeconds, enableMicrophone, end, endedMessage, isMuted, micAvailable, mute, peerName, start]);
  return <CallContext.Provider value={value}>
    {children}
    {callState === 'in-call' && !micAvailable && <div className="fixed bottom-28 left-1/2 z-[89] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-800 px-4 py-2 text-xs text-white shadow-lg">
      <span>Your microphone is off. The driver can't hear you.</span>
      <button type="button" onClick={() => void enableMicrophone()} className="shrink-0 font-semibold text-emerald-300">Turn on</button>
    </div>}
  </CallContext.Provider>;
}
export function useCall() { const value = useContext(CallContext); if (!value) throw new Error('useCall must be used inside CallProvider'); return value; }

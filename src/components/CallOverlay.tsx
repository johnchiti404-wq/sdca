import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useCall } from '../contexts/CallContext';

export function CallOverlay() {
  const { callState, peerName, formattedTime, isMuted, endedMessage, answerCall, declineCall, endCall, toggleMute } = useCall();
  return <>
    <AnimatePresence>
      {callState === 'ringing' && <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800" initial={{ y: 30 }} animate={{ y: 0 }}><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Phone /></div><h2 className="text-xl font-bold text-gray-900 dark:text-white">{peerName}</h2><p className="mt-1 text-gray-500 dark:text-gray-300">is calling you</p><div className="mt-6 flex gap-3"><button onClick={() => void declineCall()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-100 px-4 py-3 font-semibold text-red-700"><PhoneOff size={18} /> Decline</button><button onClick={() => void answerCall()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"><Phone size={18} /> Answer</button></div></motion.div></motion.div>}
      {(callState === 'calling' || callState === 'in-call') && <motion.div className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-xl" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><span className="text-sm font-semibold">{callState === 'calling' ? `Calling ${peerName}…` : `${peerName} · ${formattedTime}`}</span>{callState === 'in-call' && <button onClick={() => void toggleMute()} aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'} className="rounded-full bg-gray-700 p-2">{isMuted ? <MicOff size={17} /> : <Mic size={17} />}</button>}<button onClick={() => void endCall()} className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold"><PhoneOff size={15} />{callState === 'calling' ? 'Cancel' : 'End Call'}</button></motion.div>}
      {endedMessage && <motion.div className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>{endedMessage}</motion.div>}
    </AnimatePresence>
  </>;
}

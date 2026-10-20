import { useEffect, useState } from 'react';
import { primeMicrophone, getMicPermissionState } from '../services/callService';
import { useActiveOrder } from '../hooks/useActiveOrder';
import { useCall } from '../contexts/CallContext';

export function MicPermissionPrompt() {
  const { order } = useActiveOrder();
  const { callState } = useCall();
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unsupported' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const activeOrderId = order?.id;

  useEffect(() => {
    try {
      if (sessionStorage.getItem('aletwende-mic-prompt-dismissed') === 'true') setDismissed(true);
    } catch {
      // Keep the prompt usable when session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!activeOrderId) {
      setPermissionState(null);
      return;
    }
    let mounted = true;
    void getMicPermissionState().then(state => {
      if (mounted) setPermissionState(state);
    });
    return () => {
      mounted = false;
    };
  }, [activeOrderId]);

  const dismissForSession = () => {
    try {
      sessionStorage.setItem('aletwende-mic-prompt-dismissed', 'true');
    } catch {
      // Dismiss for this mount if session storage is unavailable.
    }
    setDismissed(true);
  };

  if (!order || permissionState !== 'prompt' || dismissed || callState !== 'idle') return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10" role="status">
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Allow your microphone so your driver can call you.</p>
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={dismissForSession} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300">Not now</button>
        <button type="button" onClick={() => { void primeMicrophone(); setDismissed(true); }} className="rounded-lg bg-[#5B2EFF] px-4 py-2 text-sm font-semibold text-white">Allow</button>
      </div>
    </div>
  );
}

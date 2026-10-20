import React, { ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Loader2, X } from 'lucide-react';
import { useLocation } from '../contexts/LocationContext';

interface LocationGateProps {
  children: ReactNode;
}

/**
 * Non-blocking location indicator.
 *
 * The app ALWAYS renders — navigation is never interrupted. When location
 * permission is denied/unsupported or GPS cannot produce a fix, a small
 * dismissible chip appears in the top-left corner so the user can re-enable it
 * at their convenience. While the first fix is still being acquired, a subtle
 * "locating" chip is shown instead.
 */
export const LocationGate: React.FC<LocationGateProps> = ({ children }) => {
  const {
    permissionStatus,
    gpsEnabled,
    loading,
    latitude,
    longitude,
    error,
    requestPermission
  } = useLocation();

  const [dismissed, setDismissed] = useState(false);
  const [showBlockedHelp, setShowBlockedHelp] = useState(false);

  const hasFix = latitude !== null && longitude !== null;
  const needsAttention =
    permissionStatus === 'denied' ||
    permissionStatus === 'unsupported' ||
    !gpsEnabled;
  const locating = loading && !hasFix && !needsAttention;
  const handleEnable = () => {
    if (permissionStatus === 'denied') {
      setShowBlockedHelp(true);
      return;
    }
    requestPermission();
  };

  const renderChip = () => {
    if (needsAttention && !dismissed) {
      const unsupported = permissionStatus === 'unsupported';
      return (
        <motion.div
          key="needs-attention"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-2 rounded-full bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 pl-3 pr-2 py-1.5"
        >
          <MapPin className="text-[#5B2EFF] shrink-0" size={16} />
          <span className={`text-xs font-medium text-gray-700 dark:text-gray-300 ${unsupported && error?.includes('secure') ? 'max-w-[min(65vw,320px)] whitespace-normal' : 'max-w-[150px] truncate'}`}>
            {unsupported ? (error?.includes('secure') ? error : 'Location unavailable') : 'Location is off'}
          </span>
          {!unsupported && (
            <button
              onClick={handleEnable}
              className="text-xs font-semibold text-[#5B2EFF] hover:underline"
            >
              Enable
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss location notice"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={14} />
          </button>
        </motion.div>
      );
    }

    if (locating) {
      return (
        <motion.div
          key="locating"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-md ring-1 ring-black/5 dark:ring-white/10 px-3 py-1.5"
        >
          <Loader2 className="text-[#5B2EFF] animate-spin shrink-0" size={14} />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Locating…</span>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="fixed top-3 left-3 z-[60] pointer-events-none">
        <div className="pointer-events-auto">
          <AnimatePresence>{renderChip()}</AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {showBlockedHelp && <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="location-blocked-title">
          <motion.div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900" initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}>
            <p id="location-blocked-title" className="text-sm leading-6 text-gray-800 dark:text-gray-100">Location is blocked for this site. Tap the lock icon next to the address, choose Permissions &gt; Location &gt; Allow. Also make sure Location is turned on in your phone&apos;s settings.</p>
            <button type="button" onClick={() => setShowBlockedHelp(false)} className="mt-4 w-full rounded-xl bg-[#5B2EFF] px-4 py-3 text-sm font-semibold text-white">OK</button>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      {children}
    </>
  );
};

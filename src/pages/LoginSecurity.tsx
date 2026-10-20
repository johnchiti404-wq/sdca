import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';

export const LoginSecurity: React.FC = () => {
  const navigate = useNavigate();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPw !== confirmPw) { setPwError("New passwords don't match."); return; }
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return; }

    const user = auth.currentUser;
    if (!user || !user.email) { setPwError('No authenticated user.'); return; }

    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwSuccess(false);
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      }, 2000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.');
      } else {
        setPwError('Failed to change password. Please try again.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header — same pattern as Personal Info */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <button
          onClick={() => navigate('/account')}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors mr-2"
        >
          <ArrowLeft size={22} className="text-gray-800 dark:text-gray-200" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Login & security</h1>
      </div>

      <div className="px-4">
        <div className="bg-white dark:bg-gray-900">
          <button
            onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(false); }}
            className="w-full flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800 last:border-0 text-left"
          >
            <div>
              <p className="text-base text-gray-900 dark:text-gray-100 font-normal">Change password</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Update the password you use to sign in
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Change password modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Change password</h3>

              {pwSuccess ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <CheckCircle size={40} className="text-[#5B2EFF]" />
                  <p className="font-semibold text-gray-900 dark:text-white">Password changed!</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Current password */}
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Current password"
                      required
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF]"
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* New password */}
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="New password"
                      required
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF]"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Confirm new password */}
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF]"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {pwError && (
                    <p className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle size={14} /> {pwError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordModal(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="flex-1 py-3 rounded-xl bg-[#5B2EFF] text-white font-medium hover:bg-[#4a25cc] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {pwLoading ? <Loader2 size={16} className="animate-spin" /> : 'Update'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

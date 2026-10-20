import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface LoginProps {
  onAuthSuccess: (user: User) => void;
  /**
   * Called with `true` right after Firebase Auth account creation succeeds
   * (which fires the app-level onAuthStateChanged listener immediately) and
   * `false` once the Firestore profile-doc write has been confirmed. The
   * parent uses this to hold off switching to the authenticated app until
   * the profile doc write is done, instead of relying purely on the auth
   * state change.
   */
  onProvisioningChange?: (provisioning: boolean) => void;
}

type View = 'login' | 'signup' | 'forgot';

export const Login: React.FC<LoginProps> = ({ onAuthSuccess, onProvisioningChange }) => {
  const [view, setView] = useState<View>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // ── Signup validation ────────────────────────────────────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const getPasswordIssues = (pw: string): string[] => {
    const issues: string[] = [];
    if (!/[A-Z]/.test(pw)) issues.push('Add an uppercase letter');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) issues.push('Add a special character');
    if (pw.length < 6) issues.push('Use at least 6 characters');
    return issues;
  };

  const isSignupReady = (): boolean => {
    return (
      signupName.trim().length >= 3 &&
      emailRegex.test(signupEmail) &&
      getPasswordIssues(signupPassword).length === 0 &&
      signupPassword === signupConfirm
    );
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      onAuthSuccess(cred.user);
    } catch (err: any) {
      setLoginError(friendlyAuthError(err.code));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignupReady()) return;
    setSignupError('');
    setSignupLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, signupEmail.trim(), signupPassword);

      // createUserWithEmailAndPassword fires the app-level onAuthStateChanged
      // listener immediately, which would otherwise unmount this form (and
      // any error UI below) before the Firestore profile write below is
      // guaranteed to finish. Hold the parent on this screen until we know
      // the outcome of that write.
      onProvisioningChange?.(true);

      // Update Firebase Auth display name
      await updateFirebaseProfile(cred.user, { displayName: signupName.trim() });

      // Write to Firestore users/{uid}
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          id: cred.user.uid,
          name: signupName.trim(),
          email: signupEmail.trim(),
          phone: '',
          profilePicture: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (profileErr) {
        console.error('Failed to create user profile document:', profileErr);
        setSignupError("Account created, but we couldn't save your profile — please contact support.");
        setSignupLoading(false);
        return; // keep provisioning=true so the user stays here and sees the error
      }

      onProvisioningChange?.(false);
      onAuthSuccess(cred.user);
    } catch (err: any) {
      onProvisioningChange?.(false);
      setSignupError(friendlyAuthError(err.code));
    } finally {
      setSignupLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotStatus('sent');
    } catch (err: any) {
      setForgotStatus('error');
      setForgotError(friendlyAuthError(err.code));
    } finally {
      setForgotLoading(false);
    }
  };

  const friendlyAuthError = (code: string): string => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const bgImage = view === 'signup' ? '/cars/aletwende-signup.webp' : '/cars/aletwende-login.webp';

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={bgImage}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </AnimatePresence>
      {/* Light blur overlay — slightly darker in dark mode for better contrast */}
      <div
        className="absolute inset-0 z-0"
        style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.25)' }}
      />

      {/* Glassmorphic card */}
      <motion.div
        key={view}
        className="relative z-10 w-full max-w-sm mx-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      >
        <div
          className="rounded-3xl px-8 py-10 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.35)',
          }}
        >
          {/* ── LOGIN ──────────────────────────────────────────────────────── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <h1 className="text-2xl font-bold text-white text-center mb-2">Sign in</h1>

              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
              />

              <div className="relative">
                <input
                  type={showLoginPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70"
                >
                  {showLoginPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setForgotStatus('idle'); setForgotError(''); }}
                  className="text-sm text-white/80 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {loginError && (
                <p className="text-red-300 text-sm flex items-center gap-1.5">
                  <AlertCircle size={14} /> {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#5B2EFF] hover:bg-[#4a25cc] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loginLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
              </button>

              <p className="text-center text-white/70 text-sm">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setView('signup'); setLoginError(''); }}
                  className="text-white font-semibold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* ── SIGNUP ─────────────────────────────────────────────────────── */}
          {view === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <h1 className="text-2xl font-bold text-white text-center mb-2">Create account</h1>

              {/* Name */}
              <div>
                <input
                  type="text"
                  placeholder="Full name"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  required
                  className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                />
                {signupName.length > 0 && signupName.trim().length < 3 && (
                  <p className="text-red-300 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Name must be at least 3 characters
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  required
                  className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                />
                {signupEmail.length > 0 && !emailRegex.test(signupEmail) && (
                  <p className="text-red-300 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Enter a valid email address
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="relative">
                  <input
                    type={showSignupPw ? 'text' : 'password'}
                    placeholder="Password"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    required
                    className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70"
                  >
                    {showSignupPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {signupPassword.length > 0 &&
                  getPasswordIssues(signupPassword).map(issue => (
                    <p key={issue} className="text-red-300 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {issue}
                    </p>
                  ))}
              </div>

              {/* Confirm password */}
              <div>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={signupConfirm}
                    onChange={e => setSignupConfirm(e.target.value)}
                    required
                    className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70"
                  >
                    {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {signupConfirm.length > 0 && signupPassword !== signupConfirm && (
                  <p className="text-red-300 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Passwords don't match
                  </p>
                )}
              </div>

              {signupError && (
                <p className="text-red-300 text-sm flex items-center gap-1.5">
                  <AlertCircle size={14} /> {signupError}
                </p>
              )}

              <button
                type="submit"
                disabled={!isSignupReady() || signupLoading}
                className="w-full bg-[#5B2EFF] hover:bg-[#4a25cc] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {signupLoading ? <Loader2 size={18} className="animate-spin" /> : 'Create account'}
              </button>

              <p className="text-center text-white/70 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setView('login'); setSignupError(''); }}
                  className="text-white font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* ── FORGOT PASSWORD ────────────────────────────────────────────── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <h1 className="text-2xl font-bold text-white text-center mb-1">Reset password</h1>
              <p className="text-white/70 text-sm text-center">
                Enter your email and we'll send you a reset link.
              </p>

              {forgotStatus === 'sent' ? (
                <div className="bg-white/20 rounded-2xl p-4 text-center space-y-2">
                  <CheckCircle size={32} className="text-[#5B2EFF] mx-auto" />
                  <p className="text-white font-medium">Reset email sent!</p>
                  <p className="text-white/70 text-xs">
                    Check your inbox — and your spam/junk folder if it doesn't appear within a few minutes.
                  </p>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    className="w-full bg-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] border border-white/30"
                  />

                  {forgotStatus === 'error' && (
                    <p className="text-red-300 text-sm flex items-center gap-1.5">
                      <AlertCircle size={14} /> {forgotError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className="w-full bg-[#5B2EFF] hover:bg-[#4a25cc] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : 'Send reset email'}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full text-center text-white/70 text-sm hover:text-white transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

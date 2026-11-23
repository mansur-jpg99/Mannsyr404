import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react';
import {
  getMissingSupabaseConfig,
  initSupabaseClient,
} from '../lib/supabase.ts';
import { LogoSymbol } from './Logo.tsx';

const REMEMBER_ME_KEY = 'mansyr404_remember_me';
const REMEMBERED_EMAIL_KEY = 'mansyr404_remembered_email';

function readStoredRememberPreference(): {
  rememberMe: boolean;
  savedEmail: string;
} {
  try {
    const flag = localStorage.getItem(REMEMBER_ME_KEY);
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
    return {
      rememberMe: flag !== 'false',
      savedEmail: flag !== 'false' ? savedEmail : '',
    };
  } catch {
    return { rememberMe: true, savedEmail: '' };
  }
}

function saveRememberPreference(rememberMe: boolean, email: string) {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
    if (rememberMe && email.trim()) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    } else if (!rememberMe) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch {
    // Abaikan jika storage browser dibatasi
  }
}

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function translateSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials')
  ) {
    return 'Email atau password salah. Periksa kembali kredensial Anda.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email Anda belum dikonfirmasi. Silakan periksa kotak masuk atau folder spam email Anda.';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered')
  ) {
    return 'Email ini sudah terdaftar. Silakan masuk menggunakan halaman Login.';
  }
  if (lower.includes('password should be at least')) {
    return 'Password minimal harus terdiri dari 6 karakter.';
  }
  if (
    lower.includes('unable to validate email address') ||
    lower.includes('invalid email')
  ) {
    return 'Format alamat email tidak valid.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat sebelum mencoba lagi.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return 'Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda dan coba lagi.';
  }
  if (lower.includes('database error saving new user')) {
    return 'Server gagal menyimpan akun baru. Silakan coba lagi beberapa saat.';
  }
  if (
    lower.includes('signups not allowed') ||
    lower.includes('signup is disabled')
  ) {
    return 'Pendaftaran akun baru saat ini sedang dinonaktifkan.';
  }
  if (lower.includes('redirect') && lower.includes('not allowed')) {
    return 'URL redirect belum diizinkan pada konfigurasi autentikasi.';
  }
  return message || 'Gagal memproses permintaan autentikasi. Silakan coba lagi.';
}

export function AuthScreen() {
  const initialRemember = readStoredRememberPreference();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialRemember.savedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(initialRemember.rememberMe);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [missingConfig, setMissingConfig] = useState<string[]>([]);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    let active = true;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
    );
    const urlErrorDesc =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');
    if (urlErrorDesc) {
      setErrorMsg(translateSupabaseAuthError(urlErrorDesc));
    }

    initSupabaseClient()
      .then(() => {
        if (!active) return;
        setMissingConfig(getMissingSupabaseConfig());
      })
      .finally(() => {
        if (!active) return;
        setCheckingConfig(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!forgotOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !resetLoading) {
        setForgotOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forgotOpen, resetLoading]);

  const switchMode = (nextMode: 'login' | 'register') => {
    if (loading) return;
    setMode(nextMode);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const openForgotModal = () => {
    setResetEmail(email.trim());
    setResetError('');
    setResetSuccess('');
    setForgotOpen(true);
  };

  const handleToggleRememberMe = () => {
    const next = !rememberMe;
    setRememberMe(next);
    saveRememberPreference(next, email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || checkingConfig) return;

    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Format alamat email tidak valid.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal harus terdiri dari 6 karakter.');
      return;
    }

    if (mode === 'register') {
      if (!fullName.trim()) {
        setErrorMsg('Nama lengkap wajib diisi.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Konfirmasi password tidak cocok dengan password.');
        return;
      }
    }

    const supabase = await initSupabaseClient();
    if (!supabase) {
      const missing = getMissingSupabaseConfig();
      setMissingConfig(missing);
      setErrorMsg(
        `Konfigurasi Supabase belum lengkap (${missing.join(
          ', '
        )}). Periksa pengaturan environment terlebih dahulu.`
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const cleanName = fullName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined' ? window.location.origin : undefined,
            data: {
              full_name: cleanName,
            },
          },
        });

        if (error) {
          setErrorMsg(translateSupabaseAuthError(error.message));
          return;
        }

        if (!data.user) {
          setErrorMsg('Registrasi tidak mengembalikan data pengguna.');
          return;
        }

        if (data.session) {
          try {
            await supabase.from('profiles').upsert(
              {
                uid: data.user.id,
                email: cleanEmail,
                full_name: cleanName,
                trader_style: 'Inner Circle Trader',
              },
              { onConflict: 'uid' }
            );
          } catch {
            // Sinkronisasi profil juga dilakukan otomatis melalui /api/profile saat sesi aktif
          }
          saveRememberPreference(rememberMe, cleanEmail);
          setSuccessMsg(
            'Akun berhasil dibuat dan masuk ke sistem. Mengarahkan ke Dashboard...'
          );
        } else {
          setSuccessMsg(
            'Registrasi berhasil! Silakan periksa kotak masuk email Anda untuk verifikasi sebelum login.'
          );
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg(translateSupabaseAuthError(error.message));
          return;
        }

        if (!data.session || !data.user) {
          setErrorMsg('Login gagal: sesi tidak ditemukan.');
          return;
        }

        saveRememberPreference(rememberMe, cleanEmail);
      }
    } catch (err: any) {
      setErrorMsg(translateSupabaseAuthError(err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async (e: FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;

    setResetError('');
    setResetSuccess('');

    const cleanResetEmail = resetEmail.trim();
    if (!isValidEmail(cleanResetEmail)) {
      setResetError('Masukkan alamat email yang valid.');
      return;
    }

    const supabase = await initSupabaseClient();
    if (!supabase) {
      setResetError('Layanan autentikasi belum siap. Periksa koneksi Anda.');
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanResetEmail,
        {
          redirectTo:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }
      );

      if (error) {
        setResetError(translateSupabaseAuthError(error.message));
        return;
      }

      setResetSuccess(
        `Tautan reset password telah dikirim ke ${cleanResetEmail}. Periksa kotak masuk atau folder spam Anda.`
      );
    } catch (err: any) {
      setResetError(translateSupabaseAuthError(err?.message || ''));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] neu-auth-canvas text-[#172033] relative overflow-hidden flex flex-col items-center justify-center px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Soft Neumorphism Decorative Geometric Elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        {/* Top-left large ambient orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 0.9, scale: 1, y: [0, -8, 0] }}
          transition={{
            opacity: { duration: 0.35 },
            scale: { duration: 0.45 },
            y: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="neu-deco-orb absolute -top-28 -left-24 sm:-top-24 sm:-left-16 w-64 h-64 sm:w-96 sm:h-96 rounded-full"
        />

        {/* Top-right soft radial mint glow + rounded square */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{
            opacity: { duration: 0.4 },
            y: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="hidden sm:block neu-deco-ring absolute top-14 right-[8%] w-36 h-36 rounded-[36px] rotate-12 opacity-75"
        />

        {/* Bottom-right large soft neumorphic circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 0.92, scale: 1, y: [0, 8, 0] }}
          transition={{
            opacity: { duration: 0.35 },
            scale: { duration: 0.45 },
            y: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="neu-deco-orb absolute -bottom-28 -right-24 sm:-bottom-24 sm:-right-16 w-72 h-72 sm:w-[420px] sm:h-[420px] rounded-full"
        />

        {/* Bottom-left subtle teal ring */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7, y: [0, -6, 0] }}
          transition={{
            opacity: { duration: 0.4 },
            y: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="hidden md:block neu-deco-ring absolute bottom-[14%] left-[7%] w-28 h-28 rounded-full"
        />

        {/* Ambient soft radial teal accents */}
        <div className="absolute top-[18%] right-[12%] w-64 h-64 rounded-full bg-[#5EEAD4]/15 blur-3xl" />
        <div className="absolute bottom-[12%] left-[10%] w-72 h-72 rounded-full bg-[#0D9488]/10 blur-3xl" />
      </div>

      {/* Centered Auth Container */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] my-auto"
      >
        <section className="neu-auth-surface rounded-[32px] px-6 py-8 sm:px-9 sm:py-10">
          {/* 1. Logo, Heading MANSYR404 & Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-7"
          >
            <div className="neu-logo-tile w-[68px] h-[68px] rounded-[22px] flex items-center justify-center mx-auto mb-5">
              <LogoSymbol size={36} variant="white" />
            </div>

            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[0.04em] text-[#172033] leading-tight">
              MANSYR404
            </h1>

            <p className="mt-2 text-sm text-[#64748B] leading-relaxed [text-wrap:balance]">
              {mode === 'login'
                ? 'Sign in to continue your trading journey'
                : 'Create your account to start your trading journey'}
            </p>
          </motion.div>

          {/* Config Notice if env missing */}
          {!checkingConfig && missingConfig.length > 0 && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Konfigurasi Supabase Belum Lengkap</div>
                <div className="mt-0.5 text-amber-800">
                  Variabel belum diatur:{' '}
                  <span className="font-mono font-semibold">
                    {missingConfig.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error & Success Feedback */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                key="auth-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                role="alert"
                className="mb-5 p-3.5 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] leading-relaxed font-medium text-center"
              >
                {errorMsg}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                key="auth-success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                role="status"
                className="mb-5 p-3.5 rounded-2xl bg-[#0D9488]/12 border border-[#0D9488]/25 text-xs text-[#115E59] leading-relaxed font-medium flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated Login / Register Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmit}
              className="space-y-4"
              noValidate
            >
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-fullname" className="sr-only">
                    Full Name
                  </label>
                  <div className="relative group">
                    <User className="w-[18px] h-[18px] text-[#64748B] group-focus-within:text-[#0D9488] transition-colors duration-200 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-fullname"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full min-h-[50px] neu-inset-input rounded-[20px] pl-11 pr-4 py-3 text-[15px] sm:text-sm placeholder:text-[#64748B]/85"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="sr-only">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="w-[18px] h-[18px] text-[#64748B] group-focus-within:text-[#0D9488] transition-colors duration-200 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full min-h-[50px] neu-inset-input rounded-[20px] pl-11 pr-4 py-3 text-[15px] sm:text-sm placeholder:text-[#64748B]/85"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="sr-only">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="w-[18px] h-[18px] text-[#64748B] group-focus-within:text-[#0D9488] transition-colors duration-200 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full min-h-[50px] neu-inset-input rounded-[20px] pl-11 pr-12 py-3 text-[15px] sm:text-sm placeholder:text-[#64748B]/85"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#172033] transition-colors cursor-pointer"
                    aria-label={
                      showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-[18px] h-[18px]" />
                    ) : (
                      <Eye className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-confirm-password" className="sr-only">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <Lock className="w-[18px] h-[18px] text-[#64748B] group-focus-within:text-[#0D9488] transition-colors duration-200 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="w-full min-h-[50px] neu-inset-input rounded-[20px] pl-11 pr-12 py-3 text-[15px] sm:text-sm placeholder:text-[#64748B]/85"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#172033] transition-colors cursor-pointer"
                      aria-label={
                        showConfirmPassword
                          ? 'Sembunyikan konfirmasi password'
                          : 'Tampilkan konfirmasi password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password Row */}
              {mode === 'login' && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rememberMe}
                    onClick={handleToggleRememberMe}
                    className="inline-flex items-center gap-2.5 min-h-[44px] pr-2 text-xs sm:text-[13px] font-medium text-[#64748B] hover:text-[#172033] transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                        rememberMe
                          ? 'neu-checkbox-checked text-white'
                          : 'neu-checkbox text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                    </span>
                    <span>Remember Me</span>
                  </button>

                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="min-h-[44px] px-1 text-xs sm:text-[13px] font-semibold text-[#0D9488] hover:text-[#115E59] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Primary Gradient Pill Button */}
              <div className="pt-1">
                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  disabled={loading || checkingConfig}
                  className="neu-pill-btn w-full min-h-[52px] rounded-full text-white font-bold text-sm tracking-[0.06em] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {mode === 'login' ? 'SIGNING IN...' : 'CREATING ACCOUNT...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.form>
          </AnimatePresence>

          {/* Subtle Neumorphic Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full h-px bg-[#172033]/8 shadow-[0_1px_0_rgba(255,255,255,0.85)]" />
          </div>

          {/* Bottom Switch Link */}
          <div className="text-center text-xs sm:text-[13px] text-[#64748B]">
            {mode === 'login' ? (
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span>Don&apos;t have an account?</span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="min-h-[44px] px-1.5 font-semibold text-[#0D9488] hover:text-[#115E59] transition-colors cursor-pointer inline-flex items-center"
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="min-h-[44px] px-1.5 font-semibold text-[#0D9488] hover:text-[#115E59] transition-colors cursor-pointer inline-flex items-center"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </section>
      </motion.main>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172033]/25 backdrop-blur-sm"
            onClick={() => {
              if (!resetLoading) setForgotOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="neu-auth-surface w-full max-w-[400px] rounded-[28px] p-6 sm:p-8 relative"
            >
              <button
                type="button"
                disabled={resetLoading}
                onClick={() => setForgotOpen(false)}
                aria-label="Tutup modal reset password"
                className="absolute right-3 top-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-[#64748B] hover:text-[#172033] hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6 pt-2">
                <div className="neu-logo-tile w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h2
                  id="forgot-password-title"
                  className="text-xl font-bold text-[#172033]"
                >
                  Reset Password
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  Enter your email to receive a password reset link.
                </p>
              </div>

              {resetError && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium text-center"
                >
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div
                  role="status"
                  className="mb-4 p-3.5 rounded-2xl bg-[#0D9488]/12 border border-[#0D9488]/25 text-xs text-[#115E59] font-medium flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSendResetLink} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-email-input" className="sr-only">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="w-[18px] h-[18px] text-[#64748B] group-focus-within:text-[#0D9488] transition-colors duration-200 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-email-input"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full min-h-[50px] neu-inset-input rounded-[20px] pl-11 pr-4 py-3 text-[15px] sm:text-sm placeholder:text-[#64748B]/85"
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  disabled={resetLoading}
                  className="neu-pill-btn w-full min-h-[50px] rounded-full text-white font-bold text-sm tracking-[0.03em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

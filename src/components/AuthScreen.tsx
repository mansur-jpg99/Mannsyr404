import { useEffect, useState, type FormEvent } from 'react';
import {
  getMissingSupabaseConfig,
  initSupabaseClient,
} from '../lib/supabase.ts';
import { BrandLogo } from './Logo.tsx';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [missingConfig, setMissingConfig] = useState<string[]>([]);
  const [checkingConfig, setCheckingConfig] = useState(true);

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

  const isValidEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const translateSupabaseAuthError = (message: string): string => {
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
      return 'Email ini sudah terdaftar di Supabase Authentication. Silakan gunakan tab Login.';
    }
    if (lower.includes('password should be at least')) {
      return 'Password minimal harus terdiri dari 6 karakter.';
    }
    if (lower.includes('unable to validate email address') || lower.includes('invalid email')) {
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
      return 'Gagal terhubung ke server autentikasi Supabase. Periksa koneksi internet dan Project URL Supabase.';
    }
    if (lower.includes('database error saving new user')) {
      return 'Server Supabase gagal menyimpan pengguna baru. Periksa trigger/tabel database pada project Supabase Anda.';
    }
    if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
      return 'Pendaftaran akun baru saat ini dinonaktifkan pada pengaturan Supabase Auth.';
    }
    if (lower.includes('redirect') && lower.includes('not allowed')) {
      return 'URL redirect belum didaftarkan di Supabase Auth (Authentication → URL Configuration → Redirect URLs).';
    }
    return message || 'Gagal memproses autentikasi Supabase. Silakan coba lagi.';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Format alamat email tidak valid.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal terdiri dari 6 karakter.');
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
        )}). Tambahkan pada Secrets / .env terlebih dahulu.`
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
          setSuccessMsg(
            'Akun berhasil dibuat dan masuk ke sistem. Mengarahkan ke Dashboard...'
          );
        } else {
          setSuccessMsg(
            'Registrasi berhasil! Akun telah tersimpan di Supabase Authentication. Silakan periksa email Anda untuk verifikasi sebelum login.'
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
      }
    } catch (err: any) {
      setErrorMsg(translateSupabaseAuthError(err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen sage-canvas text-[#1A2421] flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="lg:w-[50%] flex flex-col justify-between p-6 sm:p-10 lg:p-16">
        <div className="flex items-center">
          <BrandLogo size={42} subtitle="Jurnal Trading Forex" />
        </div>

        <div className="my-10 lg:my-0 max-w-xl">
          <p className="text-xs font-semibold text-[#0D7A72] tracking-wide mb-3">
            Soft Glassmorphism Trading Journal
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold leading-[1.18] tracking-tight text-[#1A2421] [text-wrap:balance] mb-5">
            Disiplin eksekusi, evaluasi terstruktur, dan analitik performa yang presisi.
          </h1>
          <p className="text-sm sm:text-base text-[#52625D] leading-relaxed mb-10">
            Catat setiap transaksi Forex lengkap dengan harga entry, stop loss, take profit,
            komisi, swap, psikologi trading, serta arsip screenshot chart dalam ruang kerja
            pribadi yang tenang dan bersih.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-[#1A2421]/10">
            <div>
              <div className="text-base font-mono font-bold text-[#1A2421] tabular-nums">
                IDR · USD · USC
              </div>
              <div className="text-xs text-[#52625D] mt-1">
                Multi-akun &amp; kalkulasi saldo otomatis
              </div>
            </div>
            <div>
              <div className="text-base font-mono font-bold text-[#0D7A72] tabular-nums">
                3 Tahap Chart
              </div>
              <div className="text-xs text-[#52625D] mt-1">
                Arsip screenshot privat per transaksi
              </div>
            </div>
            <div>
              <div className="text-base font-mono font-bold text-[#1A2421] tabular-nums">
                Analitik Penuh
              </div>
              <div className="text-xs text-[#52625D] mt-1">
                Expectancy, Profit Factor &amp; Drawdown
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-[#52625D]">
          MANSYR404 · Data terenkripsi dan terpisah per akun pengguna
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-16">
        <div className="w-full max-w-md glass-card rounded-[28px] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1A2421]">
              {mode === 'login' ? 'Masuk ke Ruang Kerja' : 'Buat Akun Trader'}
            </h2>
            <p className="text-sm text-[#52625D] mt-1">
              {mode === 'login'
                ? 'Akses jurnal, analitik, dan evaluasi trading Anda.'
                : 'Daftarkan akun pribadi menggunakan Supabase Authentication.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 glass-segmented rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`min-h-[40px] py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-[#0D7A72] shadow-2xs'
                  : 'text-[#52625D] hover:text-[#1A2421]'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`min-h-[40px] py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-[#0D7A72] shadow-2xs'
                  : 'text-[#52625D] hover:text-[#1A2421]'
              }`}
            >
              Buat Akun
            </button>
          </div>

          {!checkingConfig && missingConfig.length > 0 && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-800 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900">
                  Konfigurasi Supabase Belum Lengkap
                </div>
                <div className="mt-1">
                  Variabel environment belum diatur:{' '}
                  <span className="font-mono font-semibold">
                    {missingConfig.join(', ')}
                  </span>
                  .
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] leading-relaxed font-medium"
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] leading-relaxed font-medium flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-xs font-medium text-[#1A2421] mb-1.5"
                >
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#52625D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Andi Pratama"
                    className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#1A2421] mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#52625D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[#1A2421] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#52625D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-10 py-2.5 text-sm placeholder:text-[#6B7C76]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52625D] hover:text-[#1A2421] p-1 cursor-pointer"
                  aria-label={
                    showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-[#1A2421] mb-1.5"
                >
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#52625D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password Anda"
                    className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-10 py-2.5 text-sm placeholder:text-[#6B7C76]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52625D] hover:text-[#1A2421] p-1 cursor-pointer"
                    aria-label={
                      showConfirmPassword
                        ? 'Sembunyikan konfirmasi password'
                        : 'Tampilkan konfirmasi password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || checkingConfig}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-sm transition-all cursor-pointer active:scale-[0.99]"
            >
              <span>
                {loading
                  ? 'Memproses...'
                  : mode === 'login'
                  ? 'Login'
                  : 'Buat Akun'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

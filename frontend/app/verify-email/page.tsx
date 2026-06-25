'use client';
import { Suspense, useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Loader2, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import AuthShell from '@/components/AuthShell';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const setSession = useAppStore((s) => s.setSession);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes

  useEffect(() => {
    if (!emailParam) {
      toast.error('No email provided. Redirecting to register.');
      router.push('/auth/register');
    }
  }, [emailParam, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  async function handleVerifyOTP(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await apiFetch('/api/v1/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: emailParam, otp }),
      });
      
      // Verification successful — seed session into store (syncs cookie + localStorage)
      setSession(
        { id: res.user.id, email: res.user.email, role: res.user.role, business_id: res.user.business_id },
        {
          id: res.business.id,
          name: res.business.name,
          plan: res.business.plan ?? 'free',
          wa_status: 'not_connected',
          onboarding_complete: res.business.onboarding_complete ?? false,
          response_language: 'sinhala_first',
          bot_name: 'AI Assistant',
        }
      );

      toast.success(res.message || 'Email verified! Redirecting...');
      router.push('/onboarding');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setResendLoading(true);
    try {
      const res: any = await apiFetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: emailParam }),
      });
      toast.success(res.message || 'Verification code resent!');
      setCountdown(300); // Reset timer to 5 minutes
    } catch (err: any) {
      const errData = err.data || {};
      if (errData.remaining_seconds) {
        setCountdown(errData.remaining_seconds);
      }
      toast.error(err.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Verify your email."
      panelSub="We need to make sure it's really you before continuing."
    >
      <div className="flex flex-col w-full">
        <h1 className="auth-heading text-center" style={{ marginBottom: '0.25rem' }}>Verify your Email</h1>
        <p className="auth-sub text-center" style={{ marginBottom: '1.5rem' }}>
          Sent to <span className="font-semibold text-gray-900">{emailParam}</span>
        </p>

        <div className="rounded-lg p-3 mb-5 flex items-center gap-3 bg-blue-50 border border-blue-100">
          <KeyRound size={16} className="text-blue-500 shrink-0" />
          <p className="text-sm text-gray-600">
            Check your inbox for a 6-digit code. It expires in <strong className="text-gray-900">15 minutes</strong>.
          </p>
        </div>

        <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
          <div className="form-field">
            <label className="form-label">6-Digit Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="form-input text-center text-xl font-bold tracking-[0.5em]"
            />
          </div>

          <button type="submit" disabled={loading || otp.length !== 6}
            className="auth-submit-btn" style={{ marginTop: '0.5rem' }}
          >
            {loading ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-6 text-center">
          {countdown > 0 ? (
            <p className="auth-sub">
              Resend code in <strong className="text-gray-900">{formatTime(countdown)}</strong>
            </p>
          ) : (
            <button 
              type="button" 
              onClick={handleResendCode}
              disabled={resendLoading}
              className="text-sm font-semibold hover:underline flex items-center justify-center w-full gap-2 text-green-600" 
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              {resendLoading ? <Loader2 size={14} className="spin" /> : <Mail size={14} />}
              Resend Verification Code
            </button>
          )}
        </div>

        <p className="auth-sub" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          Signed up with the wrong email?{' '}
          <Link href="/auth/register" className="text-green-600 font-semibold hover:underline" style={{ textDecoration: 'none' }}>
            Start over
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AuthShell>
  );
}

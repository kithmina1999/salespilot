'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Loader2, MessageCircle, KeyRound, Lock, Check, ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import AuthShell from '@/components/AuthShell';

type Step = 'phone' | 'otp' | 'newpassword' | 'done';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
      {checks.map((c) => (
        <span
          key={c.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.72rem',
            color: c.ok ? '#22c55e' : '#4b5563',
            transition: 'color 0.2s',
          }}
        >
          <Check size={11} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Step 1: Request OTP ─────────────────────────────────────────────────────
  async function handleRequestOTP(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      toast.success('OTP sent! Check your WhatsApp 📲');
      setStep('otp');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────────
  async function handleVerifyOTP(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await apiFetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });
      setResetToken(res.reset_token);
      toast.success('OTP verified! ✅');
      setStep('newpassword');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Set New Password ─────────────────────────────────────────────────
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain an uppercase letter');
      return;
    }
    if (!/\d/.test(newPassword)) {
      toast.error('Password must contain a number');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
      });
      setStep('done');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  const steps: Step[] = ['phone', 'otp', 'newpassword'];
  const stepIndex = steps.indexOf(step);

  return (
    <AuthShell
      panelTitle="Reset your password."
      panelSub="We'll help you securely update your account access."
    >
      <div className="flex flex-col w-full">

        {/* Progress dots */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i <= stepIndex ? 28 : 8,
                    height: 8,
                    background: i <= stepIndex ? '#10b981' : '#e5e7eb',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Phone ── */}
        {step === 'phone' && (
          <>
            <h1 className="auth-heading text-center" style={{ marginBottom: '0.25rem' }}>Forgot Password?</h1>
            <p className="auth-sub text-center" style={{ marginBottom: '1.5rem' }}>We'll send an OTP to your WhatsApp</p>

            <form onSubmit={handleRequestOTP} className="flex flex-col gap-4">
              <div className="form-field">
                <label className="form-label flex items-center gap-1.5">
                  <Phone size={13} /> WhatsApp Number
                </label>
                <input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  className="form-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the number you registered with (include +94)
                </p>
              </div>

              <button type="submit" disabled={loading} className="auth-submit-btn" style={{ marginTop: '0.5rem' }}>
                {loading ? <Loader2 size={17} className="spin" /> : <MessageCircle size={17} />}
                {loading ? 'Sending OTP…' : 'Send OTP via WhatsApp'}
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {step === 'otp' && (
          <>
            <h1 className="auth-heading text-center" style={{ marginBottom: '0.25rem' }}>Enter OTP</h1>
            <p className="auth-sub text-center" style={{ marginBottom: '1.5rem' }}>
              Sent to <span className="font-semibold text-gray-900">{phone}</span>
            </p>

            {/* WhatsApp notify box */}
            <div className="rounded-lg p-3 mb-5 flex items-center gap-3 bg-blue-50 border border-blue-100">
              <MessageCircle size={16} className="text-blue-500 shrink-0" />
              <p className="text-sm text-gray-600">
                Check your WhatsApp for a 6-digit code. It expires in <strong className="text-gray-900">10 minutes</strong>.
              </p>
            </div>

            <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
              <div className="form-field">
                <label className="form-label">6-Digit OTP</label>
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

              <button type="submit" disabled={loading || otp.length !== 6} className="auth-submit-btn" style={{ marginTop: '0.5rem' }}>
                {loading ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>

              <button type="button" onClick={() => setStep('phone')}
                className="w-full py-2 text-sm flex items-center justify-center gap-1 font-medium hover:underline text-gray-500 hover:text-gray-700"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <ArrowLeft size={14} /> Didn't receive it? Go back and try again
              </button>
            </form>
          </>
        )}

        {/* ── STEP 3: New Password ── */}
        {step === 'newpassword' && (
          <>
            <h1 className="auth-heading text-center" style={{ marginBottom: '0.25rem' }}>Set New Password</h1>
            <p className="auth-sub text-center" style={{ marginBottom: '1.5rem' }}>Choose a strong password</p>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="form-field">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="form-input"
                />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="form-field">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="form-input"
                  style={{
                    borderColor: confirmPassword && confirmPassword !== newPassword ? '#ef4444' : undefined,
                  }}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                )}
              </div>

              <button type="submit" disabled={loading || newPassword !== confirmPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)}
                className="auth-submit-btn" style={{ marginTop: '0.5rem' }}>
                {loading ? <Loader2 size={17} className="spin" /> : <Lock size={17} />}
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          </>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-50 border-2 border-green-200">
              <Check size={32} className="text-green-500" />
            </div>
            <h1 className="auth-heading">Password Updated!</h1>
            <p className="auth-sub mb-6">
              Your password has been changed successfully.
            </p>
            <Link href="/auth/login" className="auth-submit-btn inline-flex items-center justify-center" style={{ textDecoration: 'none' }}>
              Sign In Now
            </Link>
          </div>
        )}

        {/* Back to login */}
        {step !== 'done' && (
          <p className="auth-sub" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            Remember it?{' '}
            <Link href="/auth/login" className="text-green-600 font-semibold hover:underline" style={{ textDecoration: 'none' }}>
              Back to Sign In
            </Link>
          </p>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AuthShell>
  );
}

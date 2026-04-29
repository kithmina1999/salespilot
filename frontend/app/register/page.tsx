'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import AuthShell from '@/components/AuthShell';
import { apiFetch } from '@/lib/api';
import PhoneInput, { type PhoneInputValue } from '@/components/ui/PhoneInput';

interface RegisterResponse {
  message: string;
  requires_verification: boolean;
  email: string;
}

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

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [phoneVal, setPhoneVal] = useState<PhoneInputValue>({ e164: '', isValid: false, countryCode: 'LK' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function validate() {
    if (!form.businessName.trim()) return 'Business name is required.';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return 'Valid email is required.';
    if (!phoneVal.e164) return 'Phone number is required.';
    if (!phoneVal.isValid) return 'Please enter a valid phone number with the correct country code.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<RegisterResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          business_name: form.businessName.trim(),
          email: form.email.trim(),
          phone: phoneVal.e164,
          password: form.password,
        }),
      });

      if (data.requires_verification) {
        toast.success(data.message || 'Account created! Please verify your email.');
        router.push(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
      } else {
        toast.success(data.message || 'Account created successfully!');
        router.push('/login');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg.includes('already') || msg.includes('exists')
        ? 'An account with this email/phone already exists. Try logging in.'
        : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Start free. No card required."
      panelSub="Set up your AI WhatsApp bot in under 5 minutes. Sri Lankan businesses trust SalesPilot."
    >
      <h1 className="auth-heading">Create your account</h1>
      <p className="auth-sub">
        Already have an account?{' '}
        <Link href="/login">Sign in instead</Link>
      </p>

      {error && (
        <div className="auth-global-error">
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Business name */}
        <div className="form-field">
          <label htmlFor="reg-biz-name" className="form-label">Business name</label>
          <input
            id="reg-biz-name"
            type="text"
            className="form-input"
            placeholder="e.g. KP Fashion, Sweet Delights"
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            autoFocus
            autoComplete="organization"
          />
        </div>

        {/* Email */}
        <div className="form-field">
          <label htmlFor="reg-email" className="form-label">Email address</label>
          <input
            id="reg-email"
            type="email"
            className="form-input"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
          />
        </div>

        {/* Phone */}
        <div className="form-field">
          <PhoneInput
            id="reg-phone"
            label="WhatsApp number"
            defaultCountry="LK"
            onChange={setPhoneVal}
            required
          />
        </div>

        {/* Password */}
        <div className="form-field">
          <label htmlFor="reg-password" className="form-label">Password</label>
          <div className="form-input-wrap">
            <input
              id="reg-password"
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="form-input-toggle"
              onClick={() => setShowPass(!showPass)}
              tabIndex={-1}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrength password={form.password} />
        </div>

        {/* Confirm password */}
        <div className="form-field">
          <label htmlFor="reg-confirm" className="form-label">Confirm password</label>
          <div className="form-input-wrap">
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              className="form-input"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              autoComplete="new-password"
              style={{
                borderColor: form.confirmPassword && form.confirmPassword !== form.password
                  ? 'rgba(239,68,68,0.5)' : undefined
              }}
            />
            <button
              type="button"
              className="form-input-toggle"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.confirmPassword && form.confirmPassword !== form.password && (
            <p className="form-error-msg"><AlertCircle size={12} /> Passwords don't match</p>
          )}
        </div>

        <button
          id="register-submit"
          type="submit"
          className="auth-submit-btn"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 size={17} className="spin" /> Creating account…</>
          ) : (
            'Create Free Account →'
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: '#374151', lineHeight: 1.6 }}>
        No credit card required · Free 14-day AI trial included<br />
        By registering you agree to our{' '}
        <a href="#" style={{ color: '#4b5563', textDecoration: 'underline' }}>Terms</a>
        {' '}&amp;{' '}
        <a href="#" style={{ color: '#4b5563', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        select option { background: #1a1d27; color: #e8eaf0; }
      `}</style>
    </AuthShell>
  );
}

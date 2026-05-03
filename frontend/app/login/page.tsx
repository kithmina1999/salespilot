'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthShell from '@/components/AuthShell';
import { apiFetch } from '@/lib/api';
import { useAppStore } from '@/lib/store';

interface LoginResponse {
  token: string;
  business: {
    id: number;
    name: string;
    plan: string;
    wa_status: string;
    onboarding_complete: boolean;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter your email/phone and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      // Persist session in Zustand (syncs localStorage + cookies)
      setSession(
        data.token,
        { id: 0, email: identifier.trim(), role: 'admin', business_id: data.business.id },
        {
          id: data.business.id,
          name: data.business.name,
          plan: (data.business.plan ?? 'free') as any,
          wa_status: (data.business.wa_status ?? 'not_connected') as any,
          onboarding_complete: data.business.onboarding_complete,
          response_language: 'sinhala_first',
          bot_name: 'AI Assistant',
        }
      );
      // Also keep raw token in localStorage for apiFetch
      localStorage.setItem('token', data.token);

      toast.success(`Welcome back, ${data.business.name}! 👋`);

      if (!data.business.onboarding_complete) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      
      if (msg.includes('verify your email')) {
        toast.info('Please verify your email to continue.');
        router.push(`/verify-email?email=${encodeURIComponent(identifier.trim())}`);
        return;
      }

      setError(
        msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')
          ? 'Incorrect email/phone or password.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Welcome back. Your AI bot missed you."
      panelSub="Sign in to check your conversations, orders, and sales stats."
    >
      <h1 className="auth-heading">Sign in</h1>
      <p className="auth-sub">
        New to SalesPilot?{' '}
        <Link href="/register">Create a free account</Link>
      </p>

      {error && (
        <div className="auth-global-error">
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-identifier" className="form-label">Email or Phone</label>
          <input
            id="login-identifier"
            type="text"
            className="form-input"
            placeholder="you@company.com or +94 77 123 4567"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="form-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label htmlFor="login-password" className="form-label" style={{ margin: 0 }}>Password</label>
            <Link
              href="/forgot-password"
              style={{ fontSize: '0.78rem', color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="form-input-wrap">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
        </div>

        <button
          id="login-submit"
          type="submit"
          className="auth-submit-btn"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 size={17} className="spin" /> Signing in…</>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.78rem', color: '#374151' }}>
        By signing in you agree to our{' '}
        <a href="#" style={{ color: '#4b5563', textDecoration: 'underline' }}>Terms</a>
        {' '}and{' '}
        <a href="#" style={{ color: '#4b5563', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AuthShell>
  );
}

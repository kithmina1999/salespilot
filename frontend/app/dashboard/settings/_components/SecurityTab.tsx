'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Key, Shield, Monitor, History, AlertTriangle, Lock,
  XCircle, Check, Smartphone, Laptop, CheckCircle2, Download, Trash2, MessageSquare, ChevronDown,
} from 'lucide-react';
import Toggle from '@/components/Toggle';

import { API_URL } from '@/hooks/_shared';

// ── Password strength ────────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-3 mt-2">
      {checks.map(c => (
        <span key={c.label} className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${c.ok ? 'text-emerald-400' : 'text-zinc-600'}`}>
          <Check size={10} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ── OTP digit input ──────────────────────────────────────────────────────────
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = Array.from({ length: 6 });
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => {
            const chars = value.split('');
            chars[i] = e.target.value.replace(/\D/, '');
            onChange(chars.join('').padEnd(6, '').slice(0, 6).trimEnd());
            if (e.target.value && e.target.nextElementSibling) {
              (e.target.nextElementSibling as HTMLInputElement).focus();
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i] && e.currentTarget.previousElementSibling) {
              (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
            }
          }}
          className="w-11 h-12 text-center text-xl font-bold bg-muted border border-border rounded-xl text-foreground outline-none focus:border-emerald-500 focus:bg-secondary transition-all"
        />
      ))}
    </div>
  );
}

// ── Accordion card ───────────────────────────────────────────────────────────
function AccordionCard({
  isOpen, onToggle, icon: Icon, iconBg, iconColor,
  title, subtitle, badge, danger = false, children,
}: {
  isOpen: boolean; onToggle: () => void;
  icon: any; iconBg: string; iconColor: string;
  title: React.ReactNode; subtitle: string;
  badge?: React.ReactNode; danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      danger
        ? isOpen ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-transparent hover:border-red-500/20'
        : isOpen ? 'border-border bg-muted/60 shadow-sm' : 'border-border bg-transparent hover:border-border'
    }`}>
      {/* ── Trigger ─────────────────────────────────────────── */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
          isOpen
            ? danger ? 'bg-red-500/5' : 'bg-secondary/40'
            : 'hover:bg-secondary/20'
        }`}
      >
        {/* Icon badge */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${danger ? 'text-red-400' : 'text-foreground'}`}>
              {title}
            </span>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={15}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Divider (only when open) ─────────────────────────── */}
      {isOpen && (
        <div className={`border-t ${danger ? 'border-red-500/15' : 'border-border/50'}`} />
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200 px-5 py-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Coming Soon pill ─────────────────────────────────────────────────────────
const ComingSoon = () => (
  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
    Coming Soon
  </span>
);

// ── Password modal step type ──────────────────────────────────────────────────
type PasswordStep = 'idle' | 'sending' | 'otp' | 'verifying' | 'password' | 'saving' | 'done';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  SecurityTab                                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export default function SecurityTab() {
  const [open, setOpen] = useState<Record<string, boolean>>({ password: true });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Password change ──
  const [step, setStep]               = useState<PasswordStep>('idle');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp]                 = useState('');
  const [otpError, setOtpError]       = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showModal, setShowModal]     = useState(false);

  function openModal() {
    setStep('idle'); setOtp(''); setOtpError(''); setChangeToken('');
    setNewPass(''); setConfirmPass(''); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setStep('idle'); }

  async function requestOTP() {
    setStep('sending');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/change-password/request`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) { setMaskedEmail(data.masked_email || ''); setStep('otp'); }
    else { toast.error(data.error || 'Failed to send code'); setStep('idle'); }
  }

  async function verifyOTP() {
    if (otp.length < 6) return;
    setStep('verifying'); setOtpError('');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/change-password/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp }),
    });
    const data = await res.json();
    if (res.ok) { setChangeToken(data.change_token); setStep('password'); }
    else { setOtpError(data.error || 'Incorrect code'); setStep('otp'); }
  }

  async function savePassword() {
    if (!newPass || newPass !== confirmPass) return;
    setStep('saving');
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/change-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ change_token: changeToken, new_password: newPass }),
    });
    const data = await res.json();
    if (res.ok) { setStep('done'); toast.success('Password updated!'); setTimeout(closeModal, 1800); }
    else { toast.error(data.error || 'Failed'); setStep('password'); }
  }

  const passwordValid = newPass.length >= 8 && /[A-Z]/.test(newPass) && /\d/.test(newPass);

  // ── Spinner ──
  const Spin = () => <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />;

  return (
    <div className="space-y-3">

      {/* ── 1. Change Password ────────────────────────────────────── */}
      <AccordionCard
        isOpen={open.password} onToggle={() => toggle('password')}
        icon={Key} iconBg="bg-secondary" iconColor="text-muted-foreground"
        title="Change Password"
        subtitle="Send a one-time code to your email to set a new password"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-background border border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Update Login Password</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              A 6-digit verification code will be sent to your registered email address.
            </p>
          </div>
          <button
            onClick={openModal}
            className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition-colors shrink-0 shadow-sm"
          >
            Update Password
          </button>
        </div>
      </AccordionCard>

      {/* ── 2. Two-Factor Authentication ──────────────────────────── */}
      <AccordionCard
        isOpen={open.tfa} onToggle={() => toggle('tfa')}
        icon={Shield} iconBg="bg-emerald-500/10" iconColor="text-emerald-400"
        title="Two-Factor Authentication"
        subtitle="Enhanced login verification via WhatsApp OTP"
        badge={<ComingSoon />}
      >
        <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <MessageSquare size={15} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">WhatsApp OTP</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Requires a verified Meta business account to send outbound auth messages.
              </p>
            </div>
          </div>
          <Toggle defaultChecked={false} disabled />
        </div>
      </AccordionCard>

      {/* ── 3. Active Sessions ────────────────────────────────────── */}
      <AccordionCard
        isOpen={open.sessions} onToggle={() => toggle('sessions')}
        icon={Monitor} iconBg="bg-blue-500/10" iconColor="text-blue-400"
        title="Active Sessions"
        subtitle="Devices currently logged into your account"
        badge={<ComingSoon />}
      >
        <div className="space-y-2">
          {[
            { device: 'Windows PC · Chrome', location: 'Colombo, Sri Lanka', current: true,  Icon: Laptop },
            { device: 'iPhone 14 · Safari',  location: 'Kandy, Sri Lanka · Last active 2h ago', current: false, Icon: Smartphone },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-background border border-border">
              <div className={`p-2.5 rounded-xl shrink-0 ${s.current ? 'bg-blue-500/10 text-blue-400' : 'bg-secondary text-muted-foreground'}`}>
                <s.Icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                  {s.device}
                  {s.current && (
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 size={8} /> This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.location}</p>
              </div>
            </div>
          ))}
        </div>
      </AccordionCard>

      {/* ── 4. Login History ──────────────────────────────────────── */}
      <AccordionCard
        isOpen={open.history} onToggle={() => toggle('history')}
        icon={History} iconBg="bg-purple-500/10" iconColor="text-purple-400"
        title="Login History"
        subtitle="Review recent sign-in activity for anomalies"
        badge={<ComingSoon />}
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left">
            <thead className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 bg-background">
              {[
                { time: 'Today, 09:41 AM',           device: 'Windows PC · Chrome', ip: '112.134.78.11',  ok: true  },
                { time: 'Yesterday, 14:22 PM',        device: 'iPhone 14 · Safari',  ip: '175.157.19.220', ok: true  },
                { time: '05 Apr 2026, 21:05 PM',      device: 'Unknown · Firefox',   ip: '104.28.192.11',  ok: false },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.time}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.device}</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-600">{r.ip}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      r.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                           : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {r.ok ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AccordionCard>

      
      {/* ══ Password Modal ═══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Lock size={14} className="text-emerald-400" />
                </div>
                <p className="font-bold text-foreground text-sm">Change Password</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <XCircle size={16} />
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Step 1: idle / sending */}
              {(step === 'idle' || step === 'sending') && (
                <div className="text-center space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto">
                    <Lock size={24} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-base mb-1">Verify it's you</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We'll send a 6-digit code to your registered email to confirm your identity before changing the password.
                    </p>
                  </div>
                  <button
                    onClick={requestOTP}
                    disabled={step === 'sending'}
                    className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {step === 'sending' ? <><Spin /> Sending…</> : 'Send Verification Code'}
                  </button>
                </div>
              )}

              {/* Step 2: OTP entry */}
              {(step === 'otp' || step === 'verifying') && (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="font-bold text-foreground text-base mb-1">Enter verification code</p>
                    <p className="text-sm text-muted-foreground">
                      Sent to <span className="text-foreground font-mono">{maskedEmail}</span>
                      <br /><span className="text-zinc-600 text-xs">Valid for 10 minutes</span>
                    </p>
                  </div>
                  <OTPInput value={otp} onChange={setOtp} />
                  {otpError && <p className="text-xs text-red-400 text-center">{otpError}</p>}
                  <button
                    onClick={verifyOTP}
                    disabled={otp.length < 6 || step === 'verifying'}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {step === 'verifying' ? <><Spin /> Verifying…</> : 'Verify Code'}
                  </button>
                  <button
                    onClick={() => { setStep('idle'); setOtp(''); setOtpError(''); }}
                    className="w-full text-xs text-zinc-600 hover:text-muted-foreground transition-colors py-1 text-center"
                  >
                    Didn't receive it? Send again
                  </button>
                </div>
              )}

              {/* Step 3: new password */}
              {(step === 'password' || step === 'saving') && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="font-bold text-foreground text-base mb-1">Set new password</p>
                    <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">New Password</label>
                    <input
                      type="password"
                      placeholder="Min. 8 chars, 1 uppercase, 1 number"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors text-foreground"
                    />
                    <PasswordStrength password={newPass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      className={`w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none transition-colors text-foreground border ${
                        confirmPass && confirmPass !== newPass ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-emerald-500'
                      }`}
                    />
                    {confirmPass && confirmPass !== newPass && (
                      <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <button
                    onClick={savePassword}
                    disabled={!passwordValid || newPass !== confirmPass || step === 'saving'}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                  >
                    {step === 'saving' ? <><Spin /> Saving…</> : 'Set New Password'}
                  </button>
                </div>
              )}

              {/* Done */}
              {step === 'done' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <Check size={28} className="text-emerald-400" />
                  </div>
                  <p className="font-bold text-foreground text-base">Password Updated</p>
                  <p className="text-sm text-muted-foreground">Your password has been changed successfully.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

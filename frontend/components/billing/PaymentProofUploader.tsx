'use client';

import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileImage, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

export type PaymentProofFeedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
};

export default function PaymentProofUploader({
  uploading,
  onSubmit,
  disabled,
  supportPhone,
  feedback,
}: {
  uploading: boolean;
  onSubmit: (file: File, declaredAmount: string, paidAt: string, paymentReference: string) => void;
  disabled: boolean;
  supportPhone?: string;
  feedback?: PaymentProofFeedback | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [declaredAmount, setDeclaredAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Only image files are accepted'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error('Please select your payment screenshot'); return; }
    if (!declaredAmount || !paidAt) { toast.error('Please enter the paid amount and date'); return; }
    onSubmit(file, declaredAmount, paidAt, paymentRef);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload Payment Screenshot</p>

      {feedback && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-3 ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : feedback.tone === 'warning'
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold">{feedback.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-85">{feedback.message}</p>
          </div>
        </div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-all ${
          preview
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-border hover:border-zinc-600 bg-background'
        } flex flex-col items-center justify-center min-h-[150px] p-6`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain shadow-lg" />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileImage size={12} /> {file?.name}</p>
            <p className="text-xs text-emerald-400 font-bold">Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <Upload size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Click to upload screenshot</p>
              <p className="text-xs text-zinc-600 mt-1">JPG, PNG — Max 5 MB</p>
            </div>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="space-y-3 pt-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Paid Amount (LKR) *</label>
          <input
            type="number"
            required
            value={declaredAmount}
            onChange={e => setDeclaredAmount(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            placeholder="e.g. 15000"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date of Payment *</label>
          <input
            type="datetime-local"
            required
            value={paidAt}
            onChange={e => setPaidAt(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Reference Number (Optional)</label>
          <input
            type="text"
            value={paymentRef}
            onChange={e => setPaymentRef(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            placeholder="e.g. TR-998822"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={uploading || !file || disabled}
        className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-secondary disabled:text-zinc-600 text-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none"
      >
        {uploading
          ? <><Loader2 size={16} className="animate-spin" /> Checking your payment proof...</>
          : <><Upload size={16} /> Submit Payment Proof</>
        }
      </button>

      {supportPhone && (
      <p className="text-xs text-zinc-600 text-center">
        Prefer WhatsApp?{' '}
        <a
          href={`https://wa.me/${supportPhone}?text=Hi%2C+I%27ve+paid+for+SalesPilot`}
          target="_blank" rel="noreferrer"
          className="text-emerald-400 hover:underline"
        >
          Send screenshot on WhatsApp →
        </a>
      </p>
      )}
    </form>
  );
}

'use client';

import { useRef, useState } from 'react';
import { Upload, FileImage, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentProofUploader({
  uploading,
  onSubmit,
  disabled,
  supportPhone,
}: {
  uploading: boolean;
  onSubmit: (file: File) => void;
  disabled: boolean;
  supportPhone?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
    onSubmit(file);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload Payment Screenshot</p>

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

      <button
        type="submit"
        disabled={uploading || !file || disabled}
        className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-secondary disabled:text-zinc-600 text-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none"
      >
        {uploading
          ? <><Loader2 size={16} className="animate-spin" /> Submitting...</>
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

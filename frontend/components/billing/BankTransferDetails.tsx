import { BankDetails } from '@/hooks/useBillingOptions';

export default function BankTransferDetails({
  bankDetails,
  loading,
  price,
}: {
  bankDetails?: BankDetails;
  loading: boolean;
  price: number;
}) {
  const bankConfigured = Boolean(bankDetails?.configured);

  function formatLKR(n: number) {
    if (!n) return '-';
    return `Rs. ${n.toLocaleString('en-LK')}`;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bank Account Details</p>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {(bankConfigured && bankDetails ? [
          ['Bank', bankDetails.bank_name],
          ['Branch', bankDetails.branch],
          ['Account No', bankDetails.account_no],
          ['Account Name', bankDetails.account_name],
        ] : []).map(([label, val]) => (
          <div key={label}>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-foreground font-mono font-bold">{val}</p>
          </div>
        ))}
      </div>
      
      {loading && (
        <div className="h-10 rounded-lg bg-secondary animate-pulse" />
      )}
      
      {!loading && !bankConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Bank transfer details are being configured. Payment proof upload is paused until the platform owner adds the account details.
        </div>
      )}
      
      <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
        <p className='text-foreground text-lg'><span className="text-emerald-400 text-lg font-bold">Transfer Amount: </span>{formatLKR(price)}/=</p>
        <p><span className="text-emerald-400 font-bold">Reference: </span>Your WhatsApp number (e.g. 0771234567)</p>
      </div>
    </div>
  );
}

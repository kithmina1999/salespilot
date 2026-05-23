import { ArrowLeft, Phone, Hash, Calendar, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BusinessDetail } from "../types";

export function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    pro: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/30",
    starter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    growth: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    free: "bg-secondary text-muted-foreground border-border",
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span className={`px-2.5 py-0.5 border rounded-full text-[0.7rem] font-bold tracking-widest uppercase ${s}`}>
      {plan || "free"}
    </span>
  );
}

export function ProfileHeader({ business }: { business: BusinessDetail }) {
  const router = useRouter();
  
  return (
    <div className="flex flex-col gap-4">
      {/* Suspension Warning Banner */}
      {business.suspended_at && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <div>
            <p className="text-sm font-bold text-destructive">This business is currently suspended.</p>
            <p className="text-xs text-destructive/80">
              Suspended on {new Date(business.suspended_at).toLocaleDateString()} for: {business.suspended_reason}
            </p>
          </div>
        </div>
      )}

      {/* Trial Status Banner */}
      {business.trial_expires_at && new Date(business.trial_expires_at) > new Date() && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold shrink-0">!</div>
          <div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Active Trial</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
              Trial expires on {new Date(business.trial_expires_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/businesses")}
          className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-muted-foreground cursor-pointer transition-all hover:text-foreground hover:border-primary shrink-0 outline-none"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              {business.name}
            </h1>
            <PlanBadge plan={business.plan} />
          </div>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <Phone size={12} /> {business.phone}
            </span>
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <Hash size={12} /> ID: {business.id}
            </span>
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <Calendar size={12} /> Joined {new Date(business.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <button
          onClick={() => router.push(`/businesses/${business.id}/pipeline`)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer border-none flex items-center gap-2 outline-none hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
        >
          Pipeline Debugger
        </button>
      </div>
    </div>
  );
}

import { Bot, Globe2, CreditCard, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import type { BusinessDetail } from "../types";

export function BotConfigCard({ business }: { business: BusinessDetail }) {
  const supportedLangs = business.bot_supported_langs?.split(",") || ["en"];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Bot & Configuration</h2>
      </div>

      <div className="flex flex-col gap-3">
        {/* Identity */}
        <div className="flex flex-col gap-1 py-2 border-b border-border/50">
          <span className="text-xs font-semibold text-muted-foreground">Bot Identity</span>
          <span className="text-sm font-bold text-foreground">{business.bot_name || "AI Assistant"}</span>
          <p className="text-[0.7rem] text-muted-foreground mt-1 line-clamp-2" title={business.bot_personality}>
            {business.bot_personality || "Standard personality"}
          </p>
        </div>

        {/* Languages */}
        <div className="flex flex-col gap-2 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Globe2 className="w-3.5 h-3.5" /> Languages
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold mr-1">Reply:</span>
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[0.65rem] font-bold uppercase">
              {business.bot_reply_language || "en"}
            </span>
            <span className="text-xs font-bold ml-2 mr-1">Supports:</span>
            {supportedLangs.map((lang: string) => (
              <span key={lang} className="px-1.5 py-0.5 bg-secondary text-foreground border border-border rounded text-[0.65rem] font-bold uppercase">
                {lang.trim()}
              </span>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="flex flex-col gap-2 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" /> Payment Methods
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${business.allow_cod ? 'bg-emerald-500' : 'bg-muted'}`} />
              <span className="text-xs font-bold text-foreground">Cash on Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${business.allow_transfer ? 'bg-emerald-500' : 'bg-muted'}`} />
              <span className="text-xs font-bold text-foreground">Bank Transfer</span>
            </div>
          </div>
        </div>

        {/* Status toggles */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="flex items-center gap-2">
            {business.onboarding_complete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            <div className="flex flex-col">
              <span className="text-[0.65rem] font-bold text-muted-foreground uppercase">Onboarding</span>
              <span className="text-xs font-bold text-foreground">{business.onboarding_complete ? "Complete" : "Incomplete"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BarChart3 className={`w-4 h-4 ${business.monthly_report_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="flex flex-col">
              <span className="text-[0.65rem] font-bold text-muted-foreground uppercase">Monthly Report</span>
              <span className="text-xs font-bold text-foreground">{business.monthly_report_enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

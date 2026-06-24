import { MessageCircle, Key, Box, Phone, Briefcase } from "lucide-react";
import type { BusinessDetail } from "../types";

export function WAConnectionCard({ business }: { business: BusinessDetail }) {
  const getStatusBadge = () => {
    switch (business.wa_status) {
      case "connected":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-[0.65rem] font-bold uppercase tracking-wider">Connected</span>;
      case "disconnected":
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-[0.65rem] font-bold uppercase tracking-wider">Disconnected</span>;
      default:
        return <span className="px-2 py-0.5 bg-secondary text-muted-foreground border border-border rounded-full text-[0.65rem] font-bold uppercase tracking-wider">Not Connected</span>;
    }
  };

  const maskString = (str?: string | null) => {
    if (!str || str.length < 8) return "Not set";
    return `${str.substring(0, 4)}••••${str.substring(str.length - 4)}`;
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
          <h2 className="text-sm font-bold text-foreground">WhatsApp Connection</h2>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Phone className="w-3.5 h-3.5" /> Phone Number ID
          </div>
          <span className="text-xs font-mono text-foreground">{maskString(business.wa_phone_number_id)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Briefcase className="w-3.5 h-3.5" /> WABA ID
          </div>
          <span className="text-xs font-mono text-foreground">{maskString(business.waba_id)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Key className="w-3.5 h-3.5" /> Access Token
          </div>
          <span className="text-xs font-bold text-foreground">
            {business.has_wa_access_token ? "Present" : "Missing"}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Box className="w-3.5 h-3.5" /> Meta Catalog
          </div>
          <span className="text-xs font-mono text-foreground">
            {business.meta_catalog_id ? maskString(business.meta_catalog_id) : "Not linked"}
          </span>
        </div>
      </div>

      {business.connected_at && (
        <div className="text-[0.7rem] text-muted-foreground text-center mt-2">
          Connected since {new Date(business.connected_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

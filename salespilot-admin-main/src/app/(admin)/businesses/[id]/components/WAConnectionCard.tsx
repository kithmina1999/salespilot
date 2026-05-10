import { MessageCircle, Link, Key, Box } from "lucide-react";

export function WAConnectionCard({ business }: { business: any }) {
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

  const maskString = (str: string) => {
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
            <PhoneIcon className="w-3.5 h-3.5" /> Phone Number ID
          </div>
          <span className="text-xs font-mono text-foreground">{maskString(business.wa_phone_number_id)}</span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <BriefcaseIcon className="w-3.5 h-3.5" /> WABA ID
          </div>
          <span className="text-xs font-mono text-foreground">{maskString(business.waba_id)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Key className="w-3.5 h-3.5" /> Access Token
          </div>
          <span className="text-xs font-bold text-foreground">
            {business.wa_access_token ? "✅ Present" : "❌ Missing"}
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

// Quick icons
function PhoneIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>;
}

function BriefcaseIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
}

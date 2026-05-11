'use client';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';

export default function DangerZoneTab() {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-red-500/15 flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-400" />
        <h2 className="text-sm font-bold text-red-400">Danger Zone</h2>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These actions are irreversible. Please be certain before proceeding.
        </p>

        {/* Export data */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background/60 border border-border gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">Export Account Data</p>
            <p className="text-xs text-muted-foreground mt-1">Download all your profile data, chat logs, and configurations as a JSON file.</p>
          </div>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-muted-foreground font-bold text-xs rounded-lg border border-border opacity-50 cursor-not-allowed justify-center shrink-0"
            title="Coming soon"
          >
            <Download size={13} /> Request Export
          </button>
        </div>

        {/* Delete account */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background/60 border border-red-500/15 hover:border-red-500/25 transition-colors gap-4">
          <div>
            <p className="text-sm font-bold text-red-400">Delete Account</p>
            <p className="text-xs text-red-400/60 mt-1">
              Permanently delete your account, all products, chat history, and configurations. Cannot be undone.
            </p>
          </div>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 font-bold text-xs rounded-lg border border-red-500/20 opacity-50 cursor-not-allowed justify-center shrink-0"
            title="Coming soon"
          >
            <Trash2 size={13} /> Delete Account
          </button>
        </div>

        <p className="text-[11px] text-zinc-700 text-center pt-2">
          Export and account deletion are coming in a future release. Contact support to request these actions.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { UsageBusiness } from "../types";

function getApiErrorMessage(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  if (err instanceof Error) return err.message;
  return "Failed to reset usage";
}

export function ResetUsageDialog({
  business,
  isOpen,
  onClose,
  onSuccess
}: {
  business: UsageBusiness | null,
  isOpen: boolean,
  onClose: () => void,
  onSuccess: () => void
}) {
  const [selectedCounters, setSelectedCounters] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!business) return null;

  const handleToggle = (counter: string) => {
    if (selectedCounters.includes(counter)) {
      setSelectedCounters(selectedCounters.filter(c => c !== counter));
    } else {
      setSelectedCounters([...selectedCounters, counter]);
    }
  };

  const handleReset = async () => {
    if (selectedCounters.length === 0) {
      setError("Please select at least one counter to reset.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for the audit log.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post(`/system/businesses/${business.id}/reset-usage`, {
        counters: selectedCounters,
        reason: reason.trim()
      });
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCounters([]);
    setReason("");
    setError("");
    onClose();
  };

  const counters = [
    { id: "ai", label: "AI Messages", current: business.ai_message_count },
    { id: "inbound", label: "Inbound Messages", current: business.system_message_count },
    { id: "simulation", label: "Simulations", current: business.simulation_count },
    { id: "rule_gen", label: "Rule Generations", current: business.rule_generation_count },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Reset Usage Counters
          </DialogTitle>
          <DialogDescription>
            Resetting counters for <strong className="text-foreground">{business.name}</strong>. This will set the selected counters back to 0.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground">Select counters to reset:</label>
            <div className="grid grid-cols-2 gap-2">
              {counters.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleToggle(c.id)}
                  className={`flex flex-col p-2 border rounded-lg cursor-pointer transition-colors ${selectedCounters.includes(c.id) ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-border text-muted-foreground hover:bg-secondary/80'}`}
                >
                  <span className="text-xs font-bold">{c.label}</span>
                  <span className="text-[0.65rem] opacity-80">Current: {c.current}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-foreground">Reason <span className="text-destructive">*</span></label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Courtesy reset for customer support"
            />
            <p className="text-[0.65rem] text-muted-foreground">This action will be recorded in the audit log.</p>
          </div>

          {error && <p className="text-sm font-bold text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleReset} disabled={loading || selectedCounters.length === 0 || !reason.trim()} className="bg-amber-500 text-white hover:bg-amber-600">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

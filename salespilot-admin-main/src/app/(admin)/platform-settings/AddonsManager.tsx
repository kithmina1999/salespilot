"use client"

import { useState } from "react"
import useSWR from "swr"
import { Edit, Plus, Save, Server, Loader2 } from "lucide-react"

import { AdminCard, AdminSectionCard } from "@/components/admin/page"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type Addon = {
  key: string
  name: string
  description: string
  amount: number
  billing_type: "one_time" | "monthly"
  purchase_policy: "once_per_business" | "once_per_connection" | "repeatable"
  source: "system" | "custom"
  badge: string
  visibility: "public" | "admin_only"
  requires_wa_status: "any" | "connected" | "not_connected"
  checkout_availability: "subscription_or_standalone" | "subscription_only" | "standalone_only"
  includes_text: string
  not_included_text: string
  is_active: boolean
  sort_order: number
}

const fetcher = (url: string) => api.get(url).then((r) => r.data)

const billingTypeOptions: Array<{ value: Addon["billing_type"]; label: string }> = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
]

const purchasePolicyOptions: Array<{ value: Addon["purchase_policy"]; label: string }> = [
  { value: "once_per_business", label: "Once per Business" },
  { value: "once_per_connection", label: "Once per Connection" },
  { value: "repeatable", label: "Repeatable" },
]

const visibilityOptions: Array<{ value: Addon["visibility"]; label: string }> = [
  { value: "public", label: "Public" },
  { value: "admin_only", label: "Admin Only" },
]

const checkoutAvailabilityOptions: Array<{ value: Addon["checkout_availability"]; label: string }> = [
  { value: "subscription_or_standalone", label: "Sub or Standalone" },
  { value: "subscription_only", label: "Subscription Only" },
  { value: "standalone_only", label: "Standalone Only" },
]

const waStatusOptions: Array<{ value: Addon["requires_wa_status"]; label: string }> = [
  { value: "any", label: "Any Status" },
  { value: "connected", label: "Must be Connected" },
  { value: "not_connected", label: "Must NOT be Connected" },
]

function getApiErrorMessage(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  if (err instanceof Error) return err.message
  return "Failed to save add-on"
}

export function AddonsManager() {
  const { admin } = useAuth()
  const isOwner = admin?.role === "owner"
  
  const { data, isLoading, mutate } = useSWR<{ addons: Addon[], confirmation_phrase: string }>("/system/billing/addons", fetcher)
  
  const [filter, setFilter] = useState("all") // all, public, admin_only, disabled
  const [search, setSearch] = useState("")
  
  const [editingAddon, setEditingAddon] = useState<Partial<Addon> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const [reason, setReason] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const addons = data?.addons || []
  const confirmPhrase = data?.confirmation_phrase || "UPDATE ADDON SERVICES"

  const filteredAddons = addons.filter((a) => {
    if (filter === "public" && (a.visibility !== "public" || !a.is_active)) return false
    if (filter === "admin_only" && (a.visibility !== "admin_only" || !a.is_active)) return false
    if (filter === "disabled" && a.is_active) return false
    
    if (search) {
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.key.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    }
    return true
  })

  function openCreate() {
    setEditingAddon({
      name: "",
      description: "",
      amount: 0,
      billing_type: "one_time",
      purchase_policy: "once_per_business",
      badge: "",
      visibility: "public",
      requires_wa_status: "any",
      checkout_availability: "subscription_or_standalone",
      includes_text: "",
      not_included_text: "",
      is_active: true,
      sort_order: 100,
    })
    setIsCreating(true)
    setDialogOpen(true)
    setReason("")
    setConfirm("")
  }

  function openEdit(addon: Addon) {
    setEditingAddon({ ...addon })
    setIsCreating(false)
    setDialogOpen(true)
    setReason("")
    setConfirm("")
  }

  async function handleSave() {
    if (!editingAddon) return
    setSaving(true)
    setMessage("")
    try {
      const payload = {
        ...editingAddon,
        reason: reason.trim(),
        confirm: confirm.trim()
      }
      
      if (isCreating) {
        await api.post("/system/billing/addons", payload)
      } else {
        await api.put(`/system/billing/addons/${editingAddon.key}`, payload)
      }
      
      await mutate()
      setDialogOpen(false)
      setMessage(isCreating ? "Add-on created successfully." : "Add-on updated successfully.")
    } catch (err: unknown) {
      setMessage(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminSectionCard
      title="Optional Services / Add-ons"
      description="Manage catalog of optional services offered to tenants during or after checkout."
      icon={Server}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="admin_only">Admin Only</TabsTrigger>
              <TabsTrigger value="disabled">Disabled</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-3">
            <Input 
              placeholder="Search services..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-64 bg-background"
            />
            <Button onClick={openCreate} disabled={!isOwner}>
              <Plus className="mr-2 size-4" />
              Add Service
            </Button>
          </div>
        </div>

        {message && (
          <p className={message.toLowerCase().includes("failed") || message.toLowerCase().includes("error") ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-emerald-500"}>
            {message}
          </p>
        )}

        <AdminCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredAddons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No services found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAddons.map((addon) => (
                  <TableRow key={addon.key}>
                    <TableCell>
                      <div className="font-medium">{addon.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{addon.key}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={addon.source === "system" ? "default" : "secondary"} className="text-[10px]">
                        {addon.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        {!addon.is_active ? (
                          <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                        ) : addon.visibility === "admin_only" ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Admin Only</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Public</Badge>
                        )}
                        {addon.badge && (
                          <Badge variant="outline" className="text-[10px]">{addon.badge}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>Rs. {addon.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="text-sm">{addon.billing_type === "one_time" ? "One-time" : "Monthly"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {addon.purchase_policy.replace(/_/g, " ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(addon)} disabled={!isOwner}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminCard>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Optional Service" : "Edit Optional Service"}</DialogTitle>
            <DialogDescription>
              {isCreating ? "Add a new service to the catalog." : "Modify an existing service."}
            </DialogDescription>
          </DialogHeader>

          {editingAddon && (
            <div className="grid gap-4 py-4">
              {!isCreating && (
                <div className="flex gap-4 mb-2 p-3 bg-muted rounded-md border text-sm">
                  <div>
                    <span className="font-semibold mr-2">Key:</span>
                    <span className="font-mono text-muted-foreground">{editingAddon.key}</span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Source:</span>
                    <Badge variant="outline" className="text-[10px]">{editingAddon.source}</Badge>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input 
                    value={editingAddon.name} 
                    onChange={e => setEditingAddon({...editingAddon, name: e.target.value})} 
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Badge (Optional)</Label>
                  <Input 
                    value={editingAddon.badge} 
                    onChange={e => setEditingAddon({...editingAddon, badge: e.target.value})} 
                    maxLength={30}
                    placeholder="e.g. Recommended"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea 
                  value={editingAddon.description} 
                  onChange={e => setEditingAddon({...editingAddon, description: e.target.value})} 
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Amount (Rs)</Label>
                  <Input 
                    type="number"
                    value={editingAddon.amount} 
                    onChange={e => setEditingAddon({...editingAddon, amount: Number(e.target.value)})} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Type</Label>
                  <Select
                    value={editingAddon.billing_type ?? "one_time"}
                    onValueChange={(value) => setEditingAddon({...editingAddon, billing_type: value as Addon["billing_type"]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {billingTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Purchase Policy</Label>
                  <Select
                    value={editingAddon.purchase_policy ?? "once_per_business"}
                    onValueChange={(value) => setEditingAddon({...editingAddon, purchase_policy: value as Addon["purchase_policy"]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {purchasePolicyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Visibility</Label>
                  <Select
                    value={editingAddon.visibility ?? "public"}
                    onValueChange={(value) => setEditingAddon({...editingAddon, visibility: value as Addon["visibility"]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Checkout Availability</Label>
                  <Select
                    value={editingAddon.checkout_availability ?? "subscription_or_standalone"}
                    onValueChange={(value) => setEditingAddon({...editingAddon, checkout_availability: value as Addon["checkout_availability"]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {checkoutAvailabilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>WA Status Req.</Label>
                  <Select
                    value={editingAddon.requires_wa_status ?? "any"}
                    onValueChange={(value) => setEditingAddon({...editingAddon, requires_wa_status: value as Addon["requires_wa_status"]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {waStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Includes (one per line)</Label>
                  <Textarea 
                    value={editingAddon.includes_text} 
                    onChange={e => setEditingAddon({...editingAddon, includes_text: e.target.value})} 
                    className="h-24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Not Included (one per line)</Label>
                  <Textarea 
                    value={editingAddon.not_included_text} 
                    onChange={e => setEditingAddon({...editingAddon, not_included_text: e.target.value})} 
                    className="h-24"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 mt-2 p-3 border rounded-md">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch 
                    checked={editingAddon.is_active} 
                    onCheckedChange={v => setEditingAddon({...editingAddon, is_active: v})} 
                  />
                  Active (Enabled)
                </label>
                <div className="flex items-center gap-2">
                  <Label>Sort Order</Label>
                  <Input 
                    type="number" 
                    value={editingAddon.sort_order} 
                    onChange={e => setEditingAddon({...editingAddon, sort_order: Number(e.target.value)})} 
                    className="w-20 h-8"
                  />
                </div>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 mt-2 grid gap-3">
                <p className="text-sm font-bold text-destructive">Authorization Required</p>
                <div className="grid gap-1.5">
                  <Label>Reason for change</Label>
                  <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Added new onboarding service" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Type {confirmPhrase}</Label>
                  <Input value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !reason || confirm !== confirmPhrase}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSectionCard>
  )
}

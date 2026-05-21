"use client"

import { useState } from "react"
import useSWR from "swr"
import { api } from "@/lib/api"
import { Megaphone, Trash2, Plus, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { AdminCard, AdminSectionCard } from "@/components/admin/page"
import { useAuth } from "@/lib/auth-context"

type Notice = {
  id: number
  title: string
  message: string
  type: "info" | "warning" | "critical"
  is_active: boolean
  created_at: string
}

export function NoticeManager() {
  const { data: notices, mutate } = useSWR<Notice[]>("/system/notices", (url: string) => api.get(url).then(r => r.data))
  const [isOpen, setIsOpen] = useState(false)
  
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState<Notice["type"]>("info")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { admin } = useAuth()
  const isOwner = admin?.role === "owner"

  const activeNotice = notices?.find(n => n.is_active)

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !message) return
    setIsSubmitting(true)
    try {
      await api.post("/system/notices", { title, message, type })
      await mutate()
      setIsOpen(false)
      setTitle("")
      setMessage("")
      setType("info")
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClear(id: number) {
    try {
      await api.delete(`/system/notices/${id}`)
      await mutate()
    } catch (err) {
      console.error(err)
    }
  }

  const iconMap = {
    info: <Info size={16} className="text-indigo-400" />,
    warning: <AlertTriangle size={16} className="text-amber-400" />,
    critical: <AlertCircle size={16} className="text-red-400" />
  }

  return (
    <AdminSectionCard 
      title="Platform Announcements" 
      icon={Megaphone}
      action={
        !isOpen && !activeNotice && (
          <button 
            disabled={!isOwner}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isOwner ? "Owner permissions required" : ""}
          >
            <Plus size={14} /> New Notice
          </button>
        )
      }
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Active Notice Display */}
        {activeNotice && !isOpen && (
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border/50 bg-accent/20">
            <div className="flex gap-3">
              <div className="mt-0.5">{iconMap[activeNotice.type]}</div>
              <div>
                <h4 className="text-sm font-bold">{activeNotice.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{activeNotice.message}</p>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-50 mt-2 block">
                  Published {new Date(activeNotice.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button
              disabled={!isOwner}
              onClick={() => handleClear(activeNotice.id)}
              className="shrink-0 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isOwner ? "Owner permissions required" : "Clear Notice"}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Empty State */}
        {!activeNotice && !isOpen && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No active announcements. Tenants are not seeing any banners.
          </div>
        )}

        {/* Create Form */}
        {isOpen && (
          <form onSubmit={handlePublish} className="flex flex-col gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Megaphone size={14} className="text-primary" /> Publish New Notice
            </h4>
            <input
              required
              placeholder="Title (e.g. Scheduled Maintenance)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              required
              placeholder="Message body..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              {(["info", "warning", "critical"] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 text-xs capitalize cursor-pointer">
                  <input 
                    type="radio" 
                    name="type" 
                    value={t} 
                    checked={type === t} 
                    onChange={() => setType(t)}
                    className="accent-primary"
                  />
                  {t}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || !isOwner}
                className="flex-1 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Publishing..." : "Publish to All Tenants"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminSectionCard>
  )
}

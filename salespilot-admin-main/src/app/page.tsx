"use client"

import { type FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Shield, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

function getLoginError(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return "Invalid credentials"
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()

  useEffect(() => {
    setMounted(true)
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [router, isAuthenticated])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError("")

    if (!email.trim() || !password) {
      setError("Email and password are required.")
      return
    }

    setLoading(true)

    try {
      const res = await api.post("/system/auth/login", {
        email: email.trim(),
        password,
      })

      login(res.data.access_token, res.data.admin)
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(getLoginError(err))
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className={mounted ? "w-full max-w-[420px] border-border/70 py-8 shadow-xl animate-fade-up" : "w-full max-w-[420px] border-border/70 py-8 shadow-xl"}>
        <CardHeader className="items-center px-8 text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
            <Shield className="size-6" strokeWidth={2.25} />
          </div>
          <CardTitle className="text-xl font-black tracking-tight">
            SalesPilot Admin
          </CardTitle>
          <CardDescription>Super admin access only.</CardDescription>
        </CardHeader>

        <CardContent className="px-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-muted-foreground">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@salespilot.lk"
                autoComplete="email"
                aria-invalid={!!error}
                className="h-10 bg-background"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  className="h-10 bg-background pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
              {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
            </div>

            <Button type="submit" disabled={loading} className="mt-2 h-10 w-full font-bold">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            This panel is restricted to super administrators only.
            <br />
            Unauthorized access attempts are logged.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

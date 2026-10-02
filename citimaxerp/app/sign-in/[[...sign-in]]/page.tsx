"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Eye, EyeOff } from "lucide-react"

// /dashboard is viewable by everyone - it shows the full business view to
// users with can_view_dashboard_menu, and just a greeting to everyone else -
// so it's always a safe landing page after sign-in.

export default function SignInPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { signIn } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const hasUserInteracted = useRef(false)

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})


  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Please enter a valid email"
    if (!formData.password) newErrors.password = "Password is required"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    hasUserInteracted.current = true
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Block submission if user hasn't interacted (prevents autofill auto-submit)
    if (!hasUserInteracted.current) return

    if (!validateForm()) return
    setIsLoading(true)
    try {
      const { data, error } = await signIn(formData.email, formData.password)
      if (error) {
        toast({ title: "Sign in failed", description: error.message || "Invalid email or password", variant: "destructive" })
        return
      }
      toast({ title: "Welcome back!", description: "You've been signed in successfully." })
      router.push("/dashboard")
    } catch {
      toast({ title: "Sign in failed", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">

      {/* ═══ Left Column — Hero Image ═══ */}
      <div
        className="hidden lg:block lg:w-1/2 relative overflow-hidden"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1774112168823-63b5842067a1?q=80&w=3431&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/50" />

        <div className="absolute top-8 left-8 z-10">
          <h2 className="text-white text-2xl font-bold tracking-tight drop-shadow-lg">
            CitiMax ERP
          </h2>
        </div>
      </div>

      {/* ═══ Right Column — Login Form ═══ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
              Welcome back to CitiMax ERP
            </h1>
            <p className="text-gray-500 mt-1.5 text-[15px]">
              Simplify and automate your business processes
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                onFocus={() => { hasUserInteracted.current = true }}
                placeholder="you@company.com"
                autoFocus
                autoComplete="username"
                disabled={isLoading}
                className={`
                  w-full h-12 px-4 rounded-xl text-[15px]
                  transition-all duration-200 outline-none
                  ${errors.email
                    ? "border-2 border-red-400 bg-red-50/50"
                    : "border border-gray-200 bg-white hover:border-gray-300 focus:border-gray-900 focus:ring-4 focus:ring-gray-900/5"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                style={{
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onFocus={() => { hasUserInteracted.current = true }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={`
                    w-full h-12 px-4 pr-12 rounded-xl text-[15px]
                    transition-all duration-200 outline-none
                    ${errors.password
                      ? "border-2 border-red-400 bg-red-50/50"
                      : "border border-gray-200 bg-white hover:border-gray-300 focus:border-gray-900 focus:ring-4 focus:ring-gray-900/5"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  style={{
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* Forgot password + Remember me */}
            <div className="flex items-center justify-between">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
              >
                Forgot password?
              </Link>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <span className="text-sm text-gray-600">Remember me</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`
                    relative w-11 h-6 rounded-full transition-all duration-300 outline-none
                    focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400
                    ${rememberMe ? "bg-red-500" : "bg-gray-200"}
                  `}
                  style={{
                    boxShadow: rememberMe
                      ? "0 2px 8px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)"
                      : "inset 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300
                      ${rememberMe ? "translate-x-5" : "translate-x-0"}
                    `}
                    style={{
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)",
                    }}
                  />
                </button>
              </label>
            </div>

            {/* Log in Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full h-12 rounded-xl text-white font-semibold text-[15px]
                transition-all duration-300 outline-none
                focus-visible:ring-4 focus-visible:ring-red-500/20
                disabled:opacity-60 disabled:cursor-not-allowed
                ${!isLoading ? "active:scale-[0.98]" : ""}
              `}
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
                boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Log in"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            Need access? Contact your organization administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff, Lock, CheckCircle2, ShieldCheck } from "lucide-react"
import { setPassword } from "@/lib/setuppassword"

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}

function SetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({ password: "", password_confirmation: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [validationAttempts, setValidationAttempts] = useState(0)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (validationAttempts >= 3) {
      toast({ title: "Invalid link", description: "Password setup link is invalid or expired.", variant: "destructive" })
      router.push("/sign-in")
      return
    }
    const t = searchParams.get("token")
    const id = searchParams.get("id")
    if (t && id) { setToken(t); setUserId(id); setIsValidating(false) }
    else if (validationAttempts === 0) {
      const timer = setTimeout(() => setValidationAttempts((p) => p + 1), 200)
      return () => clearTimeout(timer)
    } else {
      toast({ title: "Invalid link", description: "Missing token or user ID.", variant: "destructive" })
      router.push("/sign-in")
    }
  }, [searchParams, validationAttempts])

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!formData.password) e.password = "Password is required"
    else if (formData.password.length < 8) e.password = "Password must be at least 8 characters"
    if (!formData.password_confirmation) e.password_confirmation = "Please confirm your password"
    else if (formData.password !== formData.password_confirmation) e.password_confirmation = "Passwords do not match"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!token || !userId) { toast({ title: "Error", description: "Invalid setup link.", variant: "destructive" }); return }
    setIsLoading(true)
    try {
      const response = await setPassword(userId, { token, password: formData.password, password_confirmation: formData.password_confirmation })
      if (response.status === "success") {
        setSuccess(true)
        toast({ title: "Password set!", description: "You can now sign in with your new password." })
        setTimeout(() => router.push("/sign-in"), 2000)
      } else {
        toast({ title: "Failed", description: response.message || "An error occurred.", variant: "destructive" })
      }
    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred."
      if (msg.includes("expired") || msg.includes("invalid")) {
        toast({ title: "Link expired", description: "Redirecting to request a new one...", variant: "destructive" })
        setTimeout(() => router.push("/forgot-password"), 2000)
      } else {
        toast({ title: "Failed", description: msg, variant: "destructive" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Validating your link...</p>
        </div>
      </div>
    )
  }

  const inputClass = (field: string) => `
    w-full h-12 px-4 pl-11 pr-12 rounded-xl text-[15px]
    transition-all duration-200 outline-none
    ${errors[field]
      ? "border-2 border-red-400 bg-red-50/50"
      : "border border-gray-200 bg-white hover:border-gray-300 focus:border-gray-900 focus:ring-4 focus:ring-gray-900/5"
    }
    disabled:opacity-50 disabled:cursor-not-allowed
  `

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

      {/* ═══ Right Column ═══ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[420px]">

          <div className="lg:hidden mb-8">
            <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
          </div>

          {!success ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(59, 130, 246, 0.1)",
                    boxShadow: "0 0 0 6px rgba(59, 130, 246, 0.05)",
                  }}
                >
                  <ShieldCheck className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
                  Set your new password
                </h1>
                <p className="text-gray-500 mt-1.5 text-[15px]">
                  Your password must be at least 8 characters long
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      placeholder="Enter new password"
                      disabled={isLoading}
                      autoFocus
                      className={inputClass("password")}
                      style={{ backdropFilter: "blur(8px)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
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

                {/* Confirm Password */}
                <div>
                  <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="password_confirmation"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.password_confirmation}
                      onChange={(e) => handleInputChange("password_confirmation", e.target.value)}
                      placeholder="Confirm new password"
                      disabled={isLoading}
                      className={inputClass("password_confirmation")}
                      style={{ backdropFilter: "blur(8px)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errors.password_confirmation && <p className="text-sm text-red-500 mt-1">{errors.password_confirmation}</p>}
                </div>

                {/* Submit */}
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
                      Setting password...
                    </span>
                  ) : (
                    "Set password"
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ═══ Success State ═══ */
            <div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  boxShadow: "0 0 0 8px rgba(16, 185, 129, 0.05)",
                }}
              >
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
                Password set successfully
              </h1>
              <p className="text-gray-500 mt-1.5 text-[15px]">
                Your password has been updated. Redirecting you to login...
              </p>
              <div className="mt-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-400 mt-8">
            Remember your password?{" "}
            <Link href="/sign-in" className="font-semibold text-red-500 hover:text-red-600 transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

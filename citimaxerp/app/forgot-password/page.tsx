"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react"
import { sendPasswordResetLink } from "@/lib/forgot-password"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const validateEmail = () => {
    if (!email.trim()) { setError("Email address is required"); return false }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Please enter a valid email address"); return false }
    setError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail()) return
    setIsLoading(true)
    try {
      const response = await sendPasswordResetLink(email)
      if (response.status === "success") {
        setSuccess(true)
        toast({ title: "Reset link sent!", description: "Check your email for the password reset link." })
      } else {
        const msg = typeof response.message === "string" ? response.message : Object.values(response.message).flat().join(", ")
        toast({ title: "Failed to send reset link", description: msg, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Failed to send reset link", description: err.message || "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">

      {/* ═══ Left Column — Same hero image as sign-in ═══ */}
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

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
          </div>

          {/* Back link */}
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>

          {!success ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
                  Reset your password
                </h1>
                <p className="text-gray-500 mt-1.5 text-[15px]">
                  Enter your email and we&apos;ll send you a link to reset your password
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError("") }}
                      placeholder="you@company.com"
                      autoFocus
                      disabled={isLoading}
                      className={`
                        w-full h-12 px-4 pl-11 rounded-xl text-[15px]
                        transition-all duration-200 outline-none
                        ${error
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
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
                  </div>
                  {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
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
                      Sending link...
                    </span>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ═══ Success State ═══ */
            <div>
              <div className="mb-6">
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
                  Check your email
                </h1>
                <p className="text-gray-500 mt-1.5 text-[15px]">
                  We&apos;ve sent a password reset link to
                </p>
                <p className="text-gray-900 font-semibold text-[15px] mt-0.5">
                  {email}
                </p>
              </div>

              {/* Steps */}
              <div
                className="rounded-xl p-4 mb-6 space-y-2.5"
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {[
                  "Check your email inbox (and spam folder)",
                  "Click the password reset link",
                  "Create a new password",
                  "Sign in with your new password",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-600">{step}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/sign-in")}
                  className="
                    w-full h-12 rounded-xl text-white font-semibold text-[15px]
                    transition-all duration-300 outline-none active:scale-[0.98]
                  "
                  style={{
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  Return to login
                </button>
                <button
                  onClick={() => { setSuccess(false); setEmail("") }}
                  className="
                    w-full h-12 rounded-xl font-medium text-[15px] text-gray-700
                    transition-all duration-200 outline-none active:scale-[0.98]
                  "
                  style={{
                    background: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px) saturate(150%)",
                    WebkitBackdropFilter: "blur(12px) saturate(150%)",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}
                >
                  Send another link
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
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

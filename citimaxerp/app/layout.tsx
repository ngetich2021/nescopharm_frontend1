import type React from "react"
import type { Metadata } from "next"
import { Urbanist } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context" // Ensure this path is correct
import { AuthGuard } from "@/components/AuthGuard" // Ensure this path is correct and component exists
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { Analytics } from "@vercel/analytics/next"

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Citimax ERP",
  description: "Comprehensive Business Automation ERP Solution",
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={urbanist.variable}>
      <body
        className={`font-sans flex flex-col min-h-screen bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
        <Analytics />
        <AuthProvider>
          <AuthGuard>
            {/* The AuthGuard will handle conditional rendering or redirection */}
            {children}
          </AuthGuard>
          <Toaster />
          <SonnerToaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  )
}


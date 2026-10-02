"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export function SignOutButton() {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/sign-in")
  }

  return (
    <Button variant="ghost" onClick={handleSignOut} className="flex items-center">
      <LogOut className="mr-2 h-4 w-4" />
      <span>Log out</span>
    </Button>
  )
}

"use client"

// One toast store: the mounted <Toaster /> listens to hooks/use-toast, so a second store here
// meant every message sent through this path was never shown.
export { useToast, toast } from "@/hooks/use-toast"

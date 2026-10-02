"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface SendInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (email: string) => Promise<void>
  defaultEmail?: string
}

export function SendInvoiceModal({ isOpen, onClose, onSend, defaultEmail }: SendInvoiceModalProps) {
  const [email, setEmail] = useState(defaultEmail || "")
  // Sync email input with defaultEmail whenever modal opens or defaultEmail changes
  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail || "")
    }
  }, [isOpen, defaultEmail])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.")
      return
    }
    setIsSubmitting(true)
    try {
      await onSend(email)
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to send invoice.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Invoice via Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@example.com"
              required
              autoFocus
            />
            {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

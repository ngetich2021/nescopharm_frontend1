"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, ChartOfAccount } from "@/lib/finance"
import { X } from "lucide-react"

interface ViewAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: ChartOfAccount | null
  onEdit?: () => void
}

export default function ViewAccountDialog({ open, onOpenChange, account, onEdit }: ViewAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{account ? `${account.account_name} — ${account.account_code}` : 'Account Details'}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {account ? (
            <div>
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">Account Code</div>
                  <div className="font-mono font-medium">{account.account_code}</div>

                  <div className="mt-3 text-sm text-muted-foreground">Type</div>
                  <div className="mb-2">
                    <Badge className="text-xs" variant="secondary">{account.account_type.toUpperCase()}</Badge>
                    <span className="ml-2 text-sm text-muted-foreground">{account.account_subtype}</span>
                  </div>

                  <div className="text-sm text-muted-foreground">Normal Balance</div>
                  <div className="text-sm">{account.normal_balance.charAt(0).toUpperCase() + account.normal_balance.slice(1)}</div>

                  <div className="mt-3 text-sm text-muted-foreground">Opening Balance</div>
                  <div className="font-mono">{formatCurrency(account.opening_balance || '0', account.currency_code || 'KES')}</div>

                  {account.full_path && (
                    <>
                      <div className="mt-3 text-sm text-muted-foreground">Full Path</div>
                      <div className="text-sm">{account.full_path}</div>
                    </>
                  )}

                  {account.description && (
                    <>
                      <div className="mt-3 text-sm text-muted-foreground">Description</div>
                      <div className="text-sm">{account.description}</div>
                    </>
                  )}
                </div>

                <div className="w-64">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="mb-3">
                    <Badge variant={account.is_active ? 'default' : 'secondary'} className="text-xs">
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {account.parent && (
                    <>
                      <div className="text-sm text-muted-foreground">Parent</div>
                      <div className="text-sm">{account.parent.account_name} ({account.parent.account_code})</div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                {account.created_at && <div>Created: {new Date(account.created_at).toLocaleString()}</div>}
                {account.updated_at && <div>Updated: {new Date(account.updated_at).toLocaleString()}</div>}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    onEdit && onEdit()
                  }}
                >
                  Edit Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">No account selected</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

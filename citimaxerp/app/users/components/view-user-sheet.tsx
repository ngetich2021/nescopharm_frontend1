"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, Phone, Building2, Shield, Calendar, Clock, CheckCircle2, XCircle, UserX, AlertTriangle, Key, Briefcase } from "lucide-react"
import { format } from "date-fns"
import apiCall from "@/lib/api"
import { UserData } from "@/lib/users"
import { getRolePermissions } from "@/lib/roles"

interface ViewUserSheetProps {
  user: UserData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (user: UserData) => void
}

interface DetailedUser extends UserData {
  company?: UserData["company"] & { description?: string | null }
  role?: UserData["role"] & {
    permissions?: Array<{ id: string; name: string; key: string; description: string; category: string }>
  }
}

export function ViewUserSheet({ user, open, onOpenChange, onEdit }: ViewUserSheetProps) {
  const [detailed, setDetailed] = useState<DetailedUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [permissions, setPermissions] = useState<Array<{ id: string; name: string; key: string; description: string; category: string }>>([])

  useEffect(() => {
    if (!open || !user?.id) {
      setDetailed(null)
      setPermissions([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Try detailed fetch with relationships
        const res: any = await apiCall<any>(`/users/${user.id}`, "GET", undefined, true)
        const fetched: DetailedUser = res.user || res.data || user
        if (!cancelled) {
          setDetailed({ ...user, ...fetched } as DetailedUser)
          // Prefer permissions from fetched role, otherwise fetch separately
          if (fetched?.role?.permissions?.length) {
            setPermissions(fetched.role.permissions as any)
          } else if (fetched?.role?.id) {
            try {
              const perms = await getRolePermissions(fetched.role.id)
              if (!cancelled) setPermissions(perms as any)
            } catch {
              setPermissions([])
            }
          } else if (user.role?.id) {
            try {
              const perms = await getRolePermissions(user.role.id)
              if (!cancelled) setPermissions(perms as any)
            } catch {
              setPermissions([])
            }
          } else {
            setPermissions([])
          }
        }
      } catch {
        if (!cancelled) {
          setDetailed(user as DetailedUser)
          setPermissions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open, user?.id])

  const display = detailed || user
  if (!display) return null

  const initials = `${display.first_name?.[0] || ""}${display.last_name?.[0] || ""}`.toUpperCase() || display.email?.[0]?.toUpperCase() || "U"
  const fullName = [display.first_name, display.last_name].filter(Boolean).join(" ") || "—"
  const isTerminated = !!(display as any).terminated_at
  const isDeleted = !!(display as any).deleted_at
  const isActive = display.is_active && !isDeleted && !isTerminated

  const statusBadge = () => {
    if (isTerminated) return <Badge className="bg-red-600 hover:bg-red-700 text-white">Terminated</Badge>
    if (isDeleted) return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Soft Deleted</Badge>
    return isActive ? <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge> : <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Inactive</Badge>
  }

  const verifiedBadge = display.email_verified
    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-sm"><CheckCircle2 className="h-4 w-4" /> Verified</span>
    : <span className="inline-flex items-center gap-1 text-amber-600 text-sm"><XCircle className="h-4 w-4" /> Pending</span>

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950">
          <SheetTitle className="text-xl">User Details</SheetTitle>
          <SheetDescription>View complete profile, role and permissions.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading details…</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Profile header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border">
                <AvatarImage src={display.avatar_url || undefined} alt={fullName} />
                <AvatarFallback className="bg-zinc-900 text-white text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold leading-tight truncate">{fullName}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {statusBadge()}
                  <span className="text-sm text-muted-foreground truncate">{display.email}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Key className="h-3.5 w-3.5" /> {display.id.slice(0, 8)}…</span>
                  {verifiedBadge}
                </div>
              </div>
            </div>

            {/* Termination / deletion alerts */}
            {isTerminated && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Account terminated</div>
                  <div className="text-red-700/80">On {display.terminated_at ? format(new Date(display.terminated_at as string), "PPP p") : "—"} — {(display as any).termination_reason || "No reason provided"}</div>
                </div>
              </div>
            )}
            {isDeleted && !isTerminated && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2">
                <UserX className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Soft deleted</div>
                  <div className="text-amber-700/80">On {display.deleted_at ? format(new Date(display.deleted_at as string), "PPP p") : "—"} — restore to reactivate.</div>
                </div>
              </div>
            )}

            {/* Contact */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</span>
                  <span className="font-medium truncate text-right">{display.email || "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</span>
                  <span className="font-medium">{display.phone || "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Company & Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Company</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="font-medium">{display.company?.name || "—"}</div>
                  <div className="text-muted-foreground text-xs">{display.company?.email || ""}</div>
                  {display.company?.phone && <div className="text-xs text-muted-foreground">{display.company.phone}</div>}
                  {!display.company && <div className="text-muted-foreground">No company linked</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Role</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {display.role ? (
                    <>
                      <div className="font-medium flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-primary" /> {display.role.name}</div>
                      {display.role.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{display.role.description}</div>}
                      <Badge variant="outline" className="mt-2 text-xs">{display.role.is_active ? "Active role" : "Inactive role"}</Badge>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No role assigned</span>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Permissions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Permissions {permissions.length ? <Badge variant="secondary" className="ml-1">{permissions.length}</Badge> : null}</CardTitle>
              </CardHeader>
              <CardContent>
                {permissions.length ? (
                  <div className="space-y-4">
                    {Object.entries(
                      permissions.reduce((acc: Record<string, typeof permissions>, p) => {
                        const cat = p.category || "Other"
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(p)
                        return acc
                      }, {})
                    ).map(([category, list]) => (
                      <div key={category}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{category}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-xs font-normal bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" title={p.description || p.key}>
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{display.role ? "No permissions assigned to this role." : "Assign a role to see permissions."}</p>
                )}
              </CardContent>
            </Card>

            {/* Account meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Account Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Created</span>
                  <span className="font-medium">{display.created_at ? format(new Date(display.created_at), "PPP") : "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{display.updated_at ? format(new Date(display.updated_at), "PPP") : "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last login</span>
                  <span className="font-medium">{display.last_login_at ? format(new Date(display.last_login_at), "PPP p") : "Never"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <SheetFooter className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {onEdit && display && !isDeleted && (
            <Button onClick={() => { onOpenChange(false); onEdit(display as UserData) }}>Edit user</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

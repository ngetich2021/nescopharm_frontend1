"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  getDispatchSettings,
  updateDispatchSettings,
  getPotentialApprovers,
  type CompanyDispatchSettings,
  type DispatchApprover,
  type PotentialApprover,
  moveApproverUp,
  moveApproverDown,
  removeApprover,
  updateApprover,
  addApprover,
  validateApprovers,
} from "@/lib/approver"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function DispatchApproversTable() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CompanyDispatchSettings | null>(null)
  const [potentialApprovers, setPotentialApprovers] = useState<PotentialApprover[]>([])
  const [requireApproval, setRequireApproval] = useState(true)
  const [approvers, setApprovers] = useState<DispatchApprover[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Fetch potential approvers
      const approversResponse = await getPotentialApprovers()
      setPotentialApprovers(approversResponse.data)

      // Try to fetch settings, but handle if they don't exist yet
      try {
        const settingsData = await getDispatchSettings()
        setSettings(settingsData.data)
        setRequireApproval(settingsData.data.require_approval)
        setApprovers(settingsData.data.default_approvers || [])
      } catch (settingsError: any) {
        // Settings don't exist yet, use defaults
        setRequireApproval(true)
        setApprovers([])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load dispatch approvers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddApprover = () => {
    setApprovers(addApprover(approvers, ""))
  }

  const handleRemoveApprover = (index: number) => {
    setApprovers(removeApprover(approvers, index))
  }

  const handleApproverChange = (index: number, userId: string) => {
    setApprovers(updateApprover(approvers, index, userId))
  }

  const handleMoveUp = (index: number) => {
    setApprovers(moveApproverUp(approvers, index))
  }

  const handleMoveDown = (index: number) => {
    setApprovers(moveApproverDown(approvers, index))
  }

  const handleSave = async () => {
    try {
      // Validate all approvers are selected
      if (requireApproval) {
        const validation = validateApprovers(approvers.filter((a) => a.user_id))
        if (!validation.isValid) {
          toast({
            title: "Validation Error",
            description: validation.error || "Invalid approvers configuration",
            variant: "destructive",
          })
          return
        }
        
        // Check if any approver is not selected
        if (approvers.some((a) => !a.user_id)) {
          toast({
            title: "Validation Error",
            description: "Please select a user for all approvers or remove empty ones",
            variant: "destructive",
          })
          return
        }
      }

      setSaving(true)

      const payload = {
        require_approval: requireApproval,
        default_approvers: approvers.filter((a) => a.user_id),
      }

      const response = await updateDispatchSettings(payload)

      toast({
        title: "Success",
        description: "Dispatch approvers updated successfully",
      })

      // Reload data
      await loadData()
    } catch (error: any) {
      console.error("Error saving dispatch approvers:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save dispatch approvers",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getApproverDetails = (userId: string) => {
    return potentialApprovers.find((a) => a.id === userId)
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Dispatch Approval Workflow</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the default approval chain for order dispatches
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="require-approval"
            checked={requireApproval}
            onCheckedChange={setRequireApproval}
          />
          <Label htmlFor="require-approval">Require approval for dispatches</Label>
        </div>

        {requireApproval && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Order</TableHead>
                    <TableHead>Approver</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No approvers configured. Click &quot;Add Approver&quot; to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    approvers.map((approver, index) => {
                      const details = getApproverDetails(approver.user_id)
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Badge variant="outline">{approver.order}</Badge>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleMoveUp(index)}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleMoveDown(index)}
                                  disabled={index === approvers.length - 1}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={approver.user_id}
                              onValueChange={(value) => handleApproverChange(index, value)}
                            >
                              <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Select approver" />
                              </SelectTrigger>
                              <SelectContent>
                                {potentialApprovers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {details ? (
                              <span className="text-sm text-muted-foreground">{details.email}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {details?.role ? (
                              <Badge variant="secondary">{details.role}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveApprover(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleAddApprover} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Approver
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Approvers must approve dispatches in the order specified above</li>
                <li>The approval process moves to the next approver only after the previous one approves</li>
                <li>If any approver rejects, the dispatch is cancelled</li>
                <li>These are default approvers - you can customize for individual dispatches</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

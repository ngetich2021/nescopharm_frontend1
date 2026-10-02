"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import { FileUp, Download, Trash2, Loader2, AlertCircle } from "lucide-react"
import type { SopComment } from "@/lib/sops"

interface CapaTabProps {
  sopId: string
  capas: SopComment[]
  loading: boolean
  onAddCapa: (comment: string, file?: File) => Promise<void>
  onDeleteCapa: (capaId: string) => Promise<void>
  onDownloadFile: (capaId: string, fileName?: string) => void
}

export function CapaTab({
  sopId,
  capas,
  loading,
  onAddCapa,
  onDeleteCapa,
  onDownloadFile,
}: CapaTabProps) {
  const { toast } = useToast()
  const [isAdding, setIsAdding] = useState(false)
  const [comment, setComment] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  const handleAddCapa = async () => {
    if (!comment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a CAPA issue description",
        variant: "destructive",
      })
      return
    }

    setIsAdding(true)
    try {
      await onAddCapa(comment, selectedFile || undefined)
      setComment("")
      setSelectedFile(null)
      toast({
        title: "Success",
        description: "CAPA added successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add CAPA",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteCapa = async (capaId: string) => {
    if (!confirm("Are you sure you want to delete this CAPA?")) return

    setIsDeletingId(capaId)
    try {
      await onDeleteCapa(capaId)
      toast({
        title: "Success",
        description: "CAPA deleted successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete CAPA",
        variant: "destructive",
      })
    } finally {
      setIsDeletingId(null)
    }
  }

  const capaComments = capas.filter((c) => c.comment_type === "capa")

  return (
    <div className="space-y-6">
      {/* Add CAPA Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add CAPA (Corrective and Preventive Action)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="capa-issue">Issue Description</Label>
            <Textarea
              id="capa-issue"
              placeholder="Describe the issue, root cause, corrective and preventive actions..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2 min-h-32"
              disabled={isAdding}
            />
          </div>

          <div>
            <Label htmlFor="capa-file">Attach CAPA Document (Optional)</Label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                id="capa-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isAdding}
                className="cursor-pointer"
              />
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT (max 10 MB)
            </p>
          </div>

          <Button onClick={handleAddCapa} disabled={isAdding || !comment.trim()}>
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding CAPA...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Add CAPA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* CAPA List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            CAPAs ({capaComments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : capaComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No CAPAs added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {capaComments.map((capa) => (
                <div
                  key={capa.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {capa.commented_by_name || "Unknown"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          CAPA
                        </Badge>
                        {capa.file_name && (
                          <Badge variant="secondary" className="text-xs">
                            📎 File
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(new Date(capa.created_at))}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleDeleteCapa(capa.id)}
                      disabled={isDeletingId === capa.id}
                    >
                      {isDeletingId === capa.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>

                  {/* Issue Description */}
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {capa.comment}
                  </div>

                  <Separator className="my-2" />

                  {/* File Attachment */}
                  {capa.file_name && (
                    <div className="flex items-center justify-between bg-muted/50 rounded p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {capa.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {capa.file_size ? (capa.file_size / 1024).toFixed(0) : "??"} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadFile(capa.id, capa.file_name || 'capa-document')}
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

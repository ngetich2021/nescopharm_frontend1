"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, RefreshCw, Activity, XCircle } from "lucide-react"
import { getEtimsWorklist, getEtimsFailures, getEtimsHealth, type EtimsWorklistCard } from "@/lib/etims"

export default function EtimsReportsPage() {
  const [cards, setCards] = useState<EtimsWorklistCard[]>([])
  const [failures, setFailures] = useState<Array<{ error: string; count: number; sample_invoice_ids: string[] }>>([])
  const [health, setHealth] = useState<Array<{ result_status: string; n: number; avg_latency: number }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wl, fl, hl] = await Promise.all([getEtimsWorklist(), getEtimsFailures(), getEtimsHealth()])
      setCards(wl.cards)
      setFailures(fl.data)
      setHealth(hl.totals)
    } catch (e) {
      toast.error("Failed to load eTIMS reports", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> eTIMS Compliance
          </h1>
          <p className="text-muted-foreground mt-1">Action-required worklist, not vanity success-rate.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Action-required cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.key} className={card.severity === "critical" ? "border-destructive/50" : card.severity === "warning" ? "border-yellow-400/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                {card.severity === "critical" && <XCircle className="h-4 w-4 text-destructive" />}
                {card.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                {card.severity === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grouped failures */}
      <Card>
        <CardHeader>
          <CardTitle>Failures grouped by error</CardTitle>
          <CardDescription>Group repeat errors to triage bulk retries.</CardDescription>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No failures recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error (first 64 chars)</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>Sample invoice IDs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{f.error}</TableCell>
                    <TableCell className="text-right">{f.count}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {f.sample_invoice_ids.slice(0, 3).map(id => id.slice(0, 8)).join(", ")}…
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Health */}
      <Card>
        <CardHeader>
          <CardTitle>Health (last 7 days)</CardTitle>
          <CardDescription>Submission outcomes and average latency.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Avg latency (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No submissions yet.</TableCell></TableRow>
              ) : health.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant={h.result_status === "ok" ? "default" : "destructive"}>{h.result_status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{h.n}</TableCell>
                  <TableCell className="text-right">{Math.round(h.avg_latency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

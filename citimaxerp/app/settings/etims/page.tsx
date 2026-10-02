"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  ShieldCheck, KeyRound, PlugZap, Power, Copy, Loader2,
  CheckCircle2, AlertTriangle, AlertCircle, Lock,
} from "lucide-react"
import {
  getEtimsConfig, updateEtimsIdentity, updateEtimsCredentials, testEtimsConnection,
  updateEtimsActivation,
  type EtimsConfig, type EtimsWizardProgress,
} from "@/lib/etims"

// 3-step wizard per design review:
//   Step 1: Identity    (PIN + branch)
//   Step 2: Credentials (API key + env + Test Connection GATE before step 3)
//   Step 3: Activation  (go-live + enable)
//
// Pre-flip env modal warns that live is irreversible after first submission.
export default function EtimsSettingsPage() {
  const [config, setConfig] = useState<EtimsConfig | null>(null)
  const [wizard, setWizard] = useState<EtimsWizardProgress | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // step 1
  const [integrationName, setIntegrationName] = useState("DigiTax Kenya")
  const [kraPin, setKraPin] = useState("")
  const [branchId, setBranchId] = useState("00")
  const [savingIdentity, setSavingIdentity] = useState(false)

  // step 2
  const [apiKey, setApiKey] = useState("")
  const [environment, setEnvironment] = useState<"test" | "live">("test")
  const [savingCreds, setSavingCreds] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | { success: boolean; message: string; latency_ms: number | null }>(null)

  // step 3
  const [goLiveDate, setGoLiveDate] = useState("")
  const [savingActivation, setSavingActivation] = useState(false)
  const [showLiveConfirm, setShowLiveConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEtimsConfig()
      setConfig(res.config)
      setWizard(res.wizard)
      setWebhookUrl(res.webhook_url)
      if (res.config) {
        setIntegrationName(res.config.name || "DigiTax Kenya")
        setKraPin(res.config.kra_pin ?? "")
        setBranchId(res.config.branch_id ?? "00")
        setEnvironment(res.config.environment)
        if (res.config.go_live_date) setGoLiveDate(res.config.go_live_date)
      }
    } catch (e) {
      toast.error("Failed to load eTIMS configuration", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const onSaveIdentity = async () => {
    setSavingIdentity(true)
    try {
      const res = await updateEtimsIdentity(integrationName.trim(), "KE", kraPin.trim(), branchId.trim() || "00")
      setConfig(res.config)
      setWizard(res.wizard)
      toast.success("Identity saved")
    } catch (e) {
      toast.error("Could not save identity", { description: (e as Error).message })
    } finally {
      setSavingIdentity(false)
    }
  }

  const onSaveCredentials = async (chosenEnv: "test" | "live") => {
    setSavingCreds(true)
    try {
      const res = await updateEtimsCredentials(apiKey.trim(), chosenEnv)
      setConfig(res.config)
      setWizard(res.wizard)
      setWebhookUrl(res.webhook_url)
      setApiKey("")
      toast.success("Credentials saved")
    } catch (e) {
      toast.error("Could not save credentials", { description: (e as Error).message })
    } finally {
      setSavingCreds(false)
    }
  }

  const onTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testEtimsConnection()
      setTestResult({ success: res.success, message: res.message, latency_ms: res.latency_ms })
      // refresh to pick up last_test_connection_result for the gate
      await load()
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message, latency_ms: null })
    } finally {
      setTesting(false)
    }
  }

  const onActivate = async (enable: boolean) => {
    setSavingActivation(true)
    try {
      const res = await updateEtimsActivation(enable, goLiveDate || undefined)
      setConfig(res.config)
      setWizard(res.wizard)
      toast.success(enable ? "eTIMS enabled" : "eTIMS disabled")
    } catch (e) {
      toast.error("Could not change activation state", { description: (e as Error).message })
    } finally {
      setSavingActivation(false)
    }
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Copy failed - please copy manually")
    }
  }

  const currentStep = wizard?.step ?? 1

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> eTIMS (Kenya) Setup
          </h1>
          <p className="text-muted-foreground mt-1">
            Three-step wizard to connect Citimax ERP to KRA via DigiTax.
            <a href="https://ke.docs.digitax.tech/" target="_blank" rel="noopener noreferrer" className="ml-1 underline">
              DigiTax docs ↗
            </a>
          </p>
        </div>
        {config && (
          <Badge variant={config.enabled ? "default" : "secondary"}>
            {config.enabled ? "Live" : "Not enabled"}
          </Badge>
        )}
      </div>

      <Stepper currentStep={currentStep} progress={wizard} />

      {/* ── Step 1: Identity ───────────────────────────────────────── */}
      <Card className={currentStep === 1 ? "ring-2 ring-primary/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Step 1 - Identity
          </CardTitle>
          <CardDescription>Name this connection and enter the Kenya taxpayer identity DigiTax will use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Connection name</Label>
              <Input
                value={integrationName}
                onChange={(e) => setIntegrationName(e.target.value)}
                placeholder="DigiTax Kenya"
                disabled={loading}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input value="Kenya" readOnly disabled />
              <p className="text-xs text-muted-foreground mt-1">eTIMS is currently available for Kenya only.</p>
            </div>
            <div>
              <Label>KRA PIN</Label>
              <Input
                value={kraPin}
                onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                placeholder="P051234567Z"
                pattern="P\d{9}[A-Z]"
                disabled={loading || (config?.environment_locked ?? false)}
              />
              <p className="text-xs text-muted-foreground mt-1">Format: P + 9 digits + 1 uppercase letter</p>
            </div>
            <div>
              <Label>Branch ID</Label>
              <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="00" disabled={loading} />
              <p className="text-xs text-muted-foreground mt-1">Most companies use 00. Get from your KRA portal.</p>
            </div>
          </div>
          {config?.environment_locked && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertTitle>KRA PIN locked</AlertTitle>
              <AlertDescription>
                After a live submission, the PIN can only be changed by re-onboarding (contact support).
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={onSaveIdentity} disabled={savingIdentity || !integrationName.trim() || !kraPin}>
              {savingIdentity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save identity
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Step 2: Credentials + Test ─────────────────────────────── */}
      <Card className={currentStep === 2 ? "ring-2 ring-primary/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" /> Step 2 - Credentials
          </CardTitle>
          <CardDescription>DigiTax API key + environment. Test Connection must succeed before Step 3.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>DigiTax API key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.has_api_key ? "•••••••• (stored)" : "Paste your X-API-Key"}
                autoComplete="off"
              />
            </div>
            <div>
              <Label>Environment</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={environment === "test" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnvironment("test")}
                  disabled={config?.environment_locked}
                >
                  Test
                </Button>
                <Button
                  type="button"
                  variant={environment === "live" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowLiveConfirm(true)}
                  disabled={config?.environment_locked}
                >
                  Live
                </Button>
                {config?.environment_locked && (
                  <span className="text-xs flex items-center gap-1 text-muted-foreground ml-2">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onSaveCredentials(environment)} disabled={!apiKey || savingCreds}>
              {savingCreds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save credentials
            </Button>
            <Button variant="outline" onClick={onTest} disabled={testing || !config?.has_api_key}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Test Connection
            </Button>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{testResult.success ? "Connected" : "Failed"}</AlertTitle>
              <AlertDescription>
                {testResult.message}
                {testResult.latency_ms != null && <> · {testResult.latency_ms}ms</>}
              </AlertDescription>
            </Alert>
          )}

          {/* DigiTax calls this URL after an item or sale finishes syncing. */}
          {webhookUrl && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
              <p className="text-sm font-medium">Callback URL</p>
              <p className="text-xs text-muted-foreground">
                Citimax ERP includes this automatically when it sends items and invoices to DigiTax.
              </p>
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(webhookUrl, "Webhook URL")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 3: Activation ─────────────────────────────────────── */}
      <Card className={currentStep === 3 ? "ring-2 ring-primary/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-4 w-4" /> Step 3 - Activation
          </CardTitle>
          <CardDescription>Set your go-live date and enable eTIMS submissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {wizard && !wizard.credentials && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Complete Step 2 with a successful Test Connection before activating.</AlertDescription>
            </Alert>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Go-live date</Label>
              <Input type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Invoices dated on/after this will be submitted automatically.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {config?.enabled ? (
              <Button variant="outline" onClick={() => onActivate(false)} disabled={savingActivation}>
                Disable eTIMS
              </Button>
            ) : (
              <Button
                onClick={() => onActivate(true)}
                disabled={savingActivation || !wizard?.credentials || !goLiveDate}
              >
                {savingActivation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enable eTIMS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Pre-flip live confirm modal ────────────────────────────── */}
      <Dialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Switch to Live?
            </DialogTitle>
            <DialogDescription>
              After your first Live submission, this environment cannot be changed. KRA treats Live submissions as legally
              filed records - voids must go through credit notes, not deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiveConfirm(false)}>Cancel</Button>
            <Button onClick={() => { setEnvironment("live"); setShowLiveConfirm(false) }}>I understand, use Live</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stepper({
  currentStep,
  progress,
}: {
  currentStep: number
  progress: EtimsWizardProgress | null
}) {
  const steps = [
    { n: 1, label: "Identity", done: progress?.identity },
    { n: 2, label: "Credentials", done: progress?.credentials },
    { n: 3, label: "Activation", done: progress?.activation },
  ]
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-3 flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              s.done
                ? "bg-green-600 text-white"
                : currentStep === s.n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${currentStep === s.n ? "" : "text-muted-foreground"}`}>{s.label}</p>
          </div>
          {i < steps.length - 1 && <div className={`h-px flex-1 ${s.done ? "bg-green-600" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  )
}

"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import {
  PayrollConfiguration,
  getPayrollConfigurations,
  createPayrollConfiguration,
  updatePayrollConfiguration,
  deletePayrollConfiguration,
} from "@/lib/payroll";
import { formatCurrency } from "@/lib/finance";
import { format } from "date-fns";

type FormState = Omit<PayrollConfiguration, "id" | "created_at" | "updated_at">;

const DEFAULT_FORM: FormState = {
  effective_from: "",
  effective_to: null,
  personal_relief: 2400,
  tax_bands: [
    { lower_limit: 0,      upper_limit: 24000,  rate: 0.10 },
    { lower_limit: 24000,  upper_limit: 32333,  rate: 0.25 },
    { lower_limit: 32333,  upper_limit: 500000, rate: 0.30 },
    { lower_limit: 500000, upper_limit: 800000, rate: 0.325 },
    { lower_limit: 800000, upper_limit: null,   rate: 0.35 },
  ],
  nssf_tiers: {
    tier1: { limit: 7000,  rate: 0.06 },
    tier2: { limit: 36000, rate: 0.06 },
  },
  shif_rates: { standard: 0.0275, minimum: 300 },
  minimum_wages: {
    nairobi: { unskilled: 15120, semi_skilled: 18275, skilled: 28000, highly_skilled: 35000 },
    mombasa: { unskilled: 14620, semi_skilled: 17775, skilled: 27500, highly_skilled: 34000 },
    kisumu:  { unskilled: 13572, semi_skilled: 16425, skilled: 25200, highly_skilled: 31500 },
    other:   { unskilled: 13572, semi_skilled: 16425, skilled: 25200, highly_skilled: 31500 },
  },
  overtime_rates: {
    regular: 1.5,
    weekend: 2.0,
    holiday: 2.5,
    standard_monthly_hours: 176,
    max_regular_hours: 208,
  },
};

function toForm(cfg: PayrollConfiguration): FormState {
  return {
    effective_from:  cfg.effective_from,
    effective_to:    cfg.effective_to,
    personal_relief: Number(cfg.personal_relief),
    tax_bands:       cfg.tax_bands,
    nssf_tiers:      cfg.nssf_tiers,
    shif_rates:      cfg.shif_rates,
    minimum_wages:   cfg.minimum_wages,
    overtime_rates:  cfg.overtime_rates,
  };
}

export function PayrollConfigPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PayrollConfiguration[]>([]);
  const [current, setCurrent] = useState<PayrollConfiguration | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PayrollConfiguration | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPayrollConfigurations();
      setConfigs(res.configurations ?? []);
      setCurrent(res.current ?? null);
    } catch {
      toast({ title: "Error", description: "Failed to load configurations.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (cfg: PayrollConfiguration) => {
    setEditingId(cfg.id);
    setForm(toForm(cfg));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.effective_from) {
      toast({ title: "Validation", description: "Effective from date is required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updatePayrollConfiguration(editingId, form);
        toast({ title: "Updated", description: "Payroll configuration updated." });
      } else {
        await createPayrollConfiguration(form);
        toast({ title: "Created", description: "New payroll configuration created." });
      }
      setDialogOpen(false);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save configuration.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deletePayrollConfiguration(deleteTarget.id);
      toast({ title: "Deleted", description: "Configuration deleted." });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete configuration.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const updateTaxBand = (index: number, field: string, value: string) => {
    const bands = [...form.tax_bands];
    bands[index] = { ...bands[index], [field]: field === "rate" ? parseFloat(value) : (value === "" ? null : parseFloat(value)) };
    setForm((f) => ({ ...f, tax_bands: bands }));
  };

  const addTaxBand = () => {
    setForm((f) => ({
      ...f,
      tax_bands: [...f.tax_bands, { lower_limit: 0, upper_limit: null, rate: 0 }],
    }));
  };

  const removeTaxBand = (index: number) => {
    setForm((f) => ({ ...f, tax_bands: f.tax_bands.filter((_, i) => i !== index) }));
  };

  const isCurrent = (cfg: PayrollConfiguration) => current?.id === cfg.id;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Manage statutory rates, tax bands, NSSF/SHIF rates, and minimum wages.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Configuration
          </Button>
        </div>
      </div>

      {/* Active config banner */}
      {!loading && (
        <div className={`flex items-start gap-3 rounded-lg border p-4 ${current ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
          {current ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="font-medium text-sm">
              {current
                ? `Active configuration: effective from ${format(new Date(current.effective_from), "d MMM yyyy")}`
                : "No active configuration — payroll is using built-in defaults"}
            </p>
            {!current && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a configuration record to ensure calculations use your organisation's rates.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Config list */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-48 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No configurations yet. Click <strong>New Configuration</strong> to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((cfg) => (
            <Card key={cfg.id} className={isCurrent(cfg) ? "border-green-400 ring-1 ring-green-300" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Effective {format(new Date(cfg.effective_from), "d MMM yyyy")}
                      {cfg.effective_to && ` – ${format(new Date(cfg.effective_to), "d MMM yyyy")}`}
                    </CardTitle>
                    <CardDescription>Personal relief: {formatCurrency(Number(cfg.personal_relief))}/month</CardDescription>
                  </div>
                  <div className="flex gap-1 items-center">
                    {isCurrent(cfg) && <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cfg)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cfg)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">PAYE Bands</p>
                  <div className="space-y-0.5">
                    {cfg.tax_bands.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{formatCurrency(b.lower_limit)} – {b.upper_limit ? formatCurrency(b.upper_limit) : "∞"}</span>
                        <span className="font-medium">{(b.rate * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">NSSF Tier I</p>
                    <p className="font-medium">{(cfg.nssf_tiers.tier1.rate * 100).toFixed(0)}% up to {formatCurrency(cfg.nssf_tiers.tier1.limit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NSSF Tier II</p>
                    <p className="font-medium">{(cfg.nssf_tiers.tier2.rate * 100).toFixed(0)}% up to {formatCurrency(cfg.nssf_tiers.tier2.limit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">SHIF rate</p>
                    <p className="font-medium">{(cfg.shif_rates.standard * 100).toFixed(2)}% (min {formatCurrency(cfg.shif_rates.minimum)})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Std monthly hours</p>
                    <p className="font-medium">{cfg.overtime_rates.standard_monthly_hours}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "New"} Payroll Configuration</DialogTitle>
            <DialogDescription>
              Configure statutory rates. A new record with a future effective date will automatically become active on that date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Effective dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Effective From *</Label>
                <Input type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Effective To (leave blank for open-ended)</Label>
                <Input type="date" value={form.effective_to ?? ""} onChange={(e) => setForm((f) => ({ ...f, effective_to: e.target.value || null }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Monthly Personal Relief (KES)</Label>
              <Input type="number" value={form.personal_relief} onChange={(e) => setForm((f) => ({ ...f, personal_relief: parseFloat(e.target.value) || 0 }))} />
            </div>

            <Separator />

            {/* Tax bands */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">PAYE Tax Bands</Label>
                <Button variant="outline" size="sm" onClick={addTaxBand}><Plus className="h-3 w-3 mr-1" />Add Band</Button>
              </div>
              <div className="space-y-2">
                {form.tax_bands.map((band, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <div>
                      <Label className="text-xs">Lower Limit</Label>
                      <Input type="number" value={band.lower_limit} onChange={(e) => updateTaxBand(i, "lower_limit", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Upper Limit (blank=∞)</Label>
                      <Input type="number" value={band.upper_limit ?? ""} onChange={(e) => updateTaxBand(i, "upper_limit", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Rate (0–1)</Label>
                      <Input type="number" step="0.001" min="0" max="1" value={band.rate} onChange={(e) => updateTaxBand(i, "rate", e.target.value)} />
                    </div>
                    <div className="pt-5">
                      <Button variant="ghost" size="icon" onClick={() => removeTaxBand(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* NSSF */}
            <div>
              <Label className="text-base font-semibold">NSSF Tiers</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {(["tier1", "tier2"] as const).map((tier) => (
                  <div key={tier} className="space-y-2 p-3 border rounded-md">
                    <p className="text-sm font-medium capitalize">{tier.replace("tier", "Tier ")}</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Earnings Limit (KES)</Label>
                      <Input type="number" value={form.nssf_tiers[tier].limit}
                        onChange={(e) => setForm((f) => ({ ...f, nssf_tiers: { ...f.nssf_tiers, [tier]: { ...f.nssf_tiers[tier], limit: parseFloat(e.target.value) || 0 } } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate (0–1)</Label>
                      <Input type="number" step="0.001" value={form.nssf_tiers[tier].rate}
                        onChange={(e) => setForm((f) => ({ ...f, nssf_tiers: { ...f.nssf_tiers, [tier]: { ...f.nssf_tiers[tier], rate: parseFloat(e.target.value) || 0 } } }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* SHIF */}
            <div>
              <Label className="text-base font-semibold">SHIF Rates</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Standard Rate (0–1)</Label>
                  <Input type="number" step="0.0001" value={form.shif_rates.standard}
                    onChange={(e) => setForm((f) => ({ ...f, shif_rates: { ...f.shif_rates, standard: parseFloat(e.target.value) || 0 } }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minimum (KES/month)</Label>
                  <Input type="number" value={form.shif_rates.minimum}
                    onChange={(e) => setForm((f) => ({ ...f, shif_rates: { ...f.shif_rates, minimum: parseFloat(e.target.value) || 0 } }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Overtime */}
            <div>
              <Label className="text-base font-semibold">Overtime & Working Hours</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {(["regular", "weekend", "holiday"] as const).map((type) => (
                  <div key={type} className="space-y-1">
                    <Label className="text-xs capitalize">{type} Multiplier</Label>
                    <Input type="number" step="0.1" value={form.overtime_rates[type]}
                      onChange={(e) => setForm((f) => ({ ...f, overtime_rates: { ...f.overtime_rates, [type]: parseFloat(e.target.value) || 1 } }))} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs">Standard Monthly Hours</Label>
                  <Input type="number" value={form.overtime_rates.standard_monthly_hours}
                    onChange={(e) => setForm((f) => ({ ...f, overtime_rates: { ...f.overtime_rates, standard_monthly_hours: parseInt(e.target.value) || 176 } }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Regular Hours/Month</Label>
                  <Input type="number" value={form.overtime_rates.max_regular_hours}
                    onChange={(e) => setForm((f) => ({ ...f, overtime_rates: { ...f.overtime_rates, max_regular_hours: parseInt(e.target.value) || 208 } }))} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : (editingId ? "Save Changes" : "Create Configuration")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
            <DialogDescription>
              Delete the configuration effective {deleteTarget && format(new Date(deleteTarget.effective_from), "d MMM yyyy")}?
              If this is the active configuration, payroll calculations will fall back to built-in defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

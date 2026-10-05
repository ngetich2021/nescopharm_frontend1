"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Package, Trash2, UserPlus, Check, ChevronsUpDown, Edit, AlertTriangle, X, Download, Upload } from "lucide-react"
import {
  PURCHASE_ORDER_SCHEMA_KEY,
  downloadTemplate,
  fetchImportSchema,
  parsePurchaseOrderSheet,
} from "@/lib/data-import"
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  getPurchaseOrder,
  itemLabel,
  PurchaseOrder,
} from "@/lib/purchaseorders"
import { getSuppliers, createSupplier, Supplier } from "@/lib/suppliers"
import { getProducts, Product } from "@/lib/products"
import { getStores } from "@/lib/stores"
import { activeSizesOf, sizedName } from "@/lib/product-sizes"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"

interface PurchaseOrderFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // When given, the sheet edits this order; otherwise it creates a new one.
  order?: PurchaseOrder | null
  onSaved: () => void
}

interface Line {
  key: string
  product_id: string
  variant_id: string | null
  item_name: string
  item_number?: number | null
  quantity: number
  unit_price: number
}

const today = () => new Date().toISOString().slice(0, 10)
const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : "")
const lineKey = (productId: string, variantId: string | null) => `${productId}|${variantId ?? ""}`

// Sizes rarely carry their own cost; they share the item's purchase cost.
const purchaseCostOf = (product: any, variant?: any): number => {
  const sizeCost = Number(variant?.cost ?? 0)
  if (sizeCost > 0) return sizeCost
  return Number(product?.unit_cost ?? 0) || 0
}

export function PurchaseOrderFormSheet({ open, onOpenChange, order, onSaved }: PurchaseOrderFormSheetProps) {
  const { toast } = useToast()
  const isEdit = Boolean(order)

  const [saving, setSaving] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [supplierId, setSupplierId] = useState("")
  const [orderDate, setOrderDate] = useState(today())
  const [deliveryDate, setDeliveryDate] = useState("")
  const [storeId, setStoreId] = useState("")
  const [comments, setComments] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [productQuery, setProductQuery] = useState("")
  const [productOpen, setProductOpen] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [picked, setPicked] = useState<Product | null>(null)
  const [pickCost, setPickCost] = useState("")
  const [pickQty, setPickQty] = useState("1")
  const [sizeQty, setSizeQty] = useState<Record<string, string>>({})
  const searchSeq = useRef(0)

  const [supplierDialog, setSupplierDialog] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", email: "" })
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProblems, setImportProblems] = useState<{ row: number; message: string }[]>([])

  const sizes = useMemo(() => activeSizesOf(picked), [picked])

  useEffect(() => {
    if (!open) return
    resetPicker()
    setImportProblems([])
    getSuppliers().then(setSuppliers).catch(() => toast({ title: "Error", description: "Failed to load suppliers.", variant: "destructive" }))
    getStores().then(setStores).catch(() => toast({ title: "Error", description: "Failed to load stores.", variant: "destructive" }))

    if (!order) {
      setSupplierId("")
      setOrderDate(today())
      setDeliveryDate("")
      setStoreId("")
      setComments("")
      setLines([])
      setApprovalStatus(null)
      return
    }

    setLoadingOrder(true)
    getPurchaseOrder(order.id)
      .then((full) => {
        setSupplierId(full.supplier_id)
        setOrderDate(toDateInput(full.order_date) || today())
        setDeliveryDate(toDateInput(full.delivery_date))
        setStoreId(full.store_id || "")
        setComments(full.comments || "")
        setApprovalStatus(full.approval_status || null)
        setLines(
          full.items.map((item) => ({
            key: lineKey(item.product_id, item.variant_id ?? null),
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            item_name: itemLabel(item),
            item_number: item.item_number,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
          }))
        )
      })
      .catch((e) => toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load purchase order", variant: "destructive" }))
      .finally(() => setLoadingOrder(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id])

  // Searched by item name on the server so the whole catalogue is reachable.
  useEffect(() => {
    if (!open || !productOpen) return
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      setLoadingProducts(true)
      try {
        const { data } = await getProducts(1, 40, { name: productQuery.trim() || undefined, status: "active" })
        if (seq === searchSeq.current) setProducts(data)
      } catch (err) {
        if (seq === searchSeq.current) {
          setProducts([])
          toast({ title: "Search failed", description: err instanceof Error ? err.message : "Could not search items.", variant: "destructive" })
        }
      } finally {
        if (seq === searchSeq.current) setLoadingProducts(false)
      }
    }, productQuery ? 300 : 0)
    return () => clearTimeout(timer)
  }, [productQuery, productOpen, open])

  function resetPicker() {
    setPicked(null)
    setPickCost("")
    setPickQty("1")
    setSizeQty({})
    setProductQuery("")
  }

  function pickProduct(product: Product) {
    setPicked(product)
    setPickCost(String(purchaseCostOf(product)))
    setPickQty("1")
    setSizeQty({})
    setProductOpen(false)
  }

  function addLines(newLines: Line[]) {
    setLines((prev) => {
      const next = [...prev]
      for (const line of newLines) {
        const existing = next.findIndex((l) => l.key === line.key)
        if (existing >= 0) {
          next[existing] = { ...next[existing], quantity: next[existing].quantity + line.quantity, unit_price: line.unit_price }
        } else {
          next.push(line)
        }
      }
      return next
    })
  }

  function handleAdd() {
    if (!picked) return
    const cost = parseFloat(pickCost)
    if (isNaN(cost) || cost < 0) {
      toast({ title: "Enter a unit cost", description: "Use 0 only for free stock.", variant: "destructive" })
      return
    }

    if (sizes.length > 0) {
      const chosen = sizes
        .map((size) => ({ size, qty: parseInt(sizeQty[size.id] || "0", 10) }))
        .filter(({ qty }) => qty > 0)
      if (chosen.length === 0) {
        toast({ title: "Enter quantities", description: "Type a quantity against at least one size.", variant: "destructive" })
        return
      }
      addLines(
        chosen.map(({ size, qty }) => ({
          key: lineKey(picked.id, size.id),
          product_id: picked.id,
          variant_id: size.id,
          item_name: sizedName(picked.name, size.name),
          item_number: picked.item_number,
          quantity: qty,
          unit_price: cost,
        }))
      )
    } else {
      const qty = parseInt(pickQty, 10)
      if (!qty || qty <= 0) {
        toast({ title: "Enter a quantity", variant: "destructive" })
        return
      }
      addLines([
        {
          key: lineKey(picked.id, null),
          product_id: picked.id,
          variant_id: null,
          item_name: picked.name,
          item_number: picked.item_number,
          quantity: qty,
          unit_price: cost,
        },
      ])
    }
    resetPicker()
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function handleTemplate() {
    try {
      downloadTemplate(await fetchImportSchema(PURCHASE_ORDER_SCHEMA_KEY))
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not build the template.", variant: "destructive" })
    }
  }

  // The sheet only fills the form - the order is still saved by the usual Save button, so anything
  // the spreadsheet got wrong can be corrected here first.
  async function handleSheet(file: File) {
    setImporting(true)
    try {
      const { header, lines: parsed, problems } = await parsePurchaseOrderSheet(file)
      if (header.supplier_id) setSupplierId(header.supplier_id)
      if (header.order_date) setOrderDate(header.order_date)
      if (header.delivery_date) setDeliveryDate(header.delivery_date)
      if (header.comments) setComments(header.comments)
      addLines(
        parsed.map((l) => ({
          key: lineKey(l.product_id, l.variant_id),
          product_id: l.product_id,
          variant_id: l.variant_id,
          item_name: l.item_name,
          item_number: l.item_number,
          quantity: l.quantity,
          unit_price: l.unit_price,
        }))
      )
      setImportProblems(problems)
      setImportOpen(false)
      toast({
        title: `${parsed.length} item${parsed.length === 1 ? "" : "s"} loaded`,
        description: problems.length
          ? `${problems.length} row${problems.length === 1 ? "" : "s"} could not be read - check the note above the items.`
          : "Check the order and save when you're happy with it.",
      })
    } catch (e) {
      toast({ title: "Could not read the sheet", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  async function handleCreateSupplier() {
    if (!newSupplier.name.trim()) return
    setCreatingSupplier(true)
    try {
      const supplier = await createSupplier({
        name: newSupplier.name.trim(),
        phone: newSupplier.phone.trim() || undefined,
        email: newSupplier.email.trim() || undefined,
        is_active: true,
      })
      setSuppliers(await getSuppliers())
      setSupplierId(supplier.id)
      setNewSupplier({ name: "", phone: "", email: "" })
      setSupplierDialog(false)
      toast({ title: "Supplier added", description: supplier.name })
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to create supplier", variant: "destructive" })
    } finally {
      setCreatingSupplier(false)
    }
  }

  const itemsTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const invalidLine = lines.find((l) => !l.quantity || l.quantity <= 0 || isNaN(l.unit_price) || l.unit_price < 0)
  const canSave = !saving && !loadingOrder && supplierId && orderDate && lines.length > 0 && !invalidLine

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    if (deliveryDate && deliveryDate < orderDate) {
      toast({ title: "Check the dates", description: "Expected delivery can't be before the order date.", variant: "destructive" })
      return
    }
    setSaving(true)
    const payload = {
      supplier_id: supplierId,
      order_date: orderDate,
      delivery_date: deliveryDate || null,
      store_id: storeId || null,
      comments,
      items: lines.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        store_id: storeId || null,
      })),
    }
    try {
      const saved = order ? await updatePurchaseOrder(order.id, payload) : await createPurchaseOrder(payload)
      toast({
        title: order ? "Purchase order updated" : "Purchase order created",
        description:
          order && approvalStatus === "approved" && saved.approval_status !== "approved"
            ? `${saved.order_number} changed, so it has gone back for approval.`
            : saved.order_number,
      })
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save purchase order", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name
  const storeName = stores.find((s) => s.id === storeId)?.name

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:!w-[920px] !max-w-[920px] flex flex-col p-0">
        <div className="border-b px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                {isEdit ? <Edit className="h-5 w-5 text-primary" /> : <Package className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <span className="block">{isEdit ? `Edit ${order?.order_number}` : "New Purchase Order"}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Order items by size from your catalogue. Costs default to each item's unit cost.
                </span>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {loadingOrder ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading purchase order...
              </div>
            ) : (
              <>
                {isEdit && approvalStatus === "approved" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    This order is approved. Changing the supplier, items, quantities or costs sends it back for approval.
                  </div>
                )}

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">Order details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Supplier *</Label>
                      <div className="flex gap-2">
                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                              <span className="truncate">{supplierName || "Select a supplier"}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search suppliers..." />
                              <CommandList>
                                <CommandEmpty>No suppliers found</CommandEmpty>
                                <CommandGroup>
                                  {suppliers.map((s) => (
                                    <CommandItem
                                      key={s.id}
                                      value={`${s.name} ${s.phone || ""} ${s.email || ""}`}
                                      onSelect={() => {
                                        setSupplierId(s.id)
                                        setSupplierOpen(false)
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", supplierId === s.id ? "opacity-100" : "opacity-0")} />
                                      {s.name}
                                      {s.phone ? <span className="ml-1 text-muted-foreground">· {s.phone}</span> : null}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button type="button" variant="outline" size="icon" title="Add supplier" onClick={() => setSupplierDialog(true)}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Receiving store</Label>
                      <Popover open={storeOpen} onOpenChange={setStoreOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                            <span className="truncate">{storeName || "Item's default store"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search stores..." />
                            <CommandList>
                              <CommandEmpty>No stores</CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="__none" onSelect={() => { setStoreId(""); setStoreOpen(false) }}>
                                  <Check className={cn("mr-2 h-4 w-4", !storeId ? "opacity-100" : "opacity-0")} />
                                  Item's default store
                                </CommandItem>
                                {stores.map((s) => (
                                  <CommandItem key={s.id} value={`${s.name} ${s.store_code || ""}`} onSelect={() => { setStoreId(s.id); setStoreOpen(false) }}>
                                    <Check className={cn("mr-2 h-4 w-4", storeId === s.id ? "opacity-100" : "opacity-0")} />
                                    {s.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="po-order-date">Order date *</Label>
                      <Input id="po-order-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="po-delivery-date">Expected delivery</Label>
                      <Input id="po-delivery-date" type="date" min={orderDate} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="po-comments">Comments</Label>
                      <Textarea id="po-comments" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Notes for the supplier or receiving team" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Items</h3>
                      {lines.length > 0 && <Badge variant="secondary">{lines.length} line{lines.length !== 1 ? "s" : ""}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={handleTemplate}>
                        <Download className="mr-2 h-4 w-4" />
                        Excel template
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import from Excel
                      </Button>
                    </div>
                  </div>

                  {importProblems.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-amber-900">
                        <AlertTriangle className="h-4 w-4" />
                        {importProblems.length} row{importProblems.length !== 1 ? "s" : ""} from the sheet could not be used
                      </div>
                      <ul className="mt-2 space-y-1 text-amber-800">
                        {importProblems.map((p, i) => (
                          <li key={i}>Row {p.row}: {p.message}</li>
                        ))}
                      </ul>
                      <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-amber-900" onClick={() => setImportProblems([])}>
                        Dismiss
                      </Button>
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label>Item</Label>
                      <Popover open={productOpen} onOpenChange={setProductOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                            <span className="truncate">
                              {picked ? `${picked.item_number ? `#${picked.item_number} · ` : ""}${picked.name}` : "Search by item name"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="Type an item name, e.g. Endobronchial" value={productQuery} onValueChange={setProductQuery} />
                            <CommandList>
                              {loadingProducts ? (
                                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                                </div>
                              ) : products.length === 0 ? (
                                // Driven directly off our own `products` state rather than cmdk's
                                // internal item-count tracking, which lags a tick behind when the
                                // list is swapped out from an async search (shouldFilter={false}
                                // means cmdk never recomputes its own count from search text).
                                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                  {productQuery ? `No items found for "${productQuery}"` : "No items found"}
                                </div>
                              ) : (
                                <CommandGroup>
                                  {products.map((p) => {
                                    const sizeCount = activeSizesOf(p).length
                                    return (
                                      <CommandItem key={p.id} value={p.id} onSelect={() => pickProduct(p)}>
                                        <div className="flex w-full items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate">
                                              {p.item_number ? <span className="text-muted-foreground">#{p.item_number} · </span> : null}
                                              {p.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {sizeCount > 0 ? `${sizeCount} sizes · ` : ""}
                                              {p.stock_quantity} in stock · cost {formatCurrency(Number(p.unit_cost) || 0)}
                                            </div>
                                          </div>
                                        </div>
                                      </CommandItem>
                                    )
                                  })}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {picked && (
                      <>
                        {sizes.length > 0 ? (
                          <div className="space-y-2">
                            <Label>Quantity per size</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {sizes.map((size) => (
                                <div key={size.id} className="rounded-md border bg-background p-2">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-sm font-medium">{size.name}</span>
                                    <span className="text-xs text-muted-foreground">{size.stock_quantity} in stock</span>
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    aria-label={`Quantity for ${size.name}`}
                                    className="mt-1 h-8"
                                    placeholder="0"
                                    value={sizeQty[size.id] ?? ""}
                                    onChange={(e) => setSizeQty((prev) => ({ ...prev, [size.id]: e.target.value }))}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor="po-pick-cost">Unit cost</Label>
                            <Input id="po-pick-cost" type="number" min="0" step="0.01" value={pickCost} onChange={(e) => setPickCost(e.target.value)} />
                          </div>
                          {sizes.length === 0 && (
                            <div className="space-y-1.5">
                              <Label htmlFor="po-pick-qty">Quantity</Label>
                              <Input id="po-pick-qty" type="number" min="1" value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
                            </div>
                          )}
                          <div className={cn("flex gap-2", sizes.length === 0 ? "col-span-2" : "col-span-1 sm:col-span-3")}>
                            <Button type="button" onClick={handleAdd} className="flex-1">
                              <Plus className="h-4 w-4 mr-2" />
                              {sizes.length > 0 ? "Add sizes" : "Add item"}
                            </Button>
                            <Button type="button" variant="ghost" size="icon" title="Clear" onClick={resetPicker}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {lines.length > 0 ? (
                    <div className="rounded-lg border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="text-left font-medium px-3 py-3 whitespace-nowrap">S/No</th>
                              <th className="text-left font-medium px-3 py-3 whitespace-nowrap">Item #</th>
                              <th className="text-left font-medium px-3 py-3">Item</th>
                              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Unit cost</th>
                              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Qty</th>
                              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Total</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {lines.map((line, index) => (
                              <tr key={line.key}>
                                <td className="px-3 py-3 tabular-nums">{index + 1}</td>
                                <td className="px-3 py-3 tabular-nums text-muted-foreground">{line.item_number ?? "—"}</td>
                                <td className="px-3 py-3 min-w-[180px]">
                                  <div className="font-medium">{line.item_name}</div>
                                </td>
                                <td className="px-3 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    aria-label={`Unit cost for ${line.item_name}`}
                                    className="h-8 w-32 text-right tabular-nums"
                                    value={isNaN(line.unit_price) ? "" : line.unit_price}
                                    onChange={(e) => updateLine(line.key, { unit_price: parseFloat(e.target.value) })}
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <Input
                                    type="number"
                                    min="1"
                                    aria-label={`Quantity for ${line.item_name}`}
                                    className={cn("h-8 w-36 text-right tabular-nums", (!line.quantity || line.quantity <= 0) && "border-destructive")}
                                    value={line.quantity || ""}
                                    onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 0 })}
                                  />
                                </td>
                                <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                                  {formatCurrency((line.quantity || 0) * (line.unit_price || 0))}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                    aria-label={`Remove ${line.item_name}`}
                                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted/50 border-t font-semibold">
                            <tr>
                              <td colSpan={5} className="px-3 py-3 text-right">Items total</td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(itemsTotal)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No items yet. Search for an item above.</p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="border-t bg-background px-6 py-4">
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {lines.length > 0 && (
                  <>
                    Order total <span className="font-semibold text-foreground">{formatCurrency(itemsTotal)}</span>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSave} className="min-w-[180px]">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {isEdit ? "Save changes" : "Create purchase order"}
                </Button>
              </div>
            </div>
          </div>
        </form>

        <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add supplier</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="po-new-supplier-name">Name *</Label>
                <Input id="po-new-supplier-name" value={newSupplier.name} onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="po-new-supplier-phone">Phone</Label>
                <Input id="po-new-supplier-phone" value={newSupplier.phone} onChange={(e) => setNewSupplier((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="po-new-supplier-email">Email</Label>
                <Input id="po-new-supplier-email" type="email" value={newSupplier.email} onChange={(e) => setNewSupplier((s) => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSupplierDialog(false)} disabled={creatingSupplier}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateSupplier} disabled={creatingSupplier || !newSupplier.name.trim()}>
                {creatingSupplier ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={(next) => !importing && setImportOpen(next)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import from Excel</DialogTitle>
              <DialogDescription>
                One row per item, with the headings from the Excel template. The supplier and dates are taken from the
                first row. Items are added to this form &mdash; nothing is saved until you press Save.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) handleSheet(file)
                }}
              />
              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading the sheet...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleTemplate} disabled={importing}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}

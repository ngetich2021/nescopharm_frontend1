"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Link2, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { linkUnlinkedLine, listUnlinkedLines, type LinkableProduct, type UnlinkedInvoiceLine } from "@/lib/etims"

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-")

// Lines written the same way are linked together (e.g. 34 lines of one bandage).
interface Group {
  description: string
  lines: UnlinkedInvoiceLine[]
  pastDated: number
}

/**
 * Invoice lines that are not on a live product - old lines written for a product since deleted,
 * which the name match could not place on exactly one product. Their invoices are not sent to KRA
 * until each is linked to the right existing product. Linking never moves stock.
 */
export function UnlinkedLinesTab({ onCount }: { onCount?: (n: number) => void }) {
  const [lines, setLines] = useState<UnlinkedInvoiceLine[]>([])
  const [products, setProducts] = useState<LinkableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<string, LinkableProduct | undefined>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listUnlinkedLines()
      setLines(res.data)
      setProducts(res.products)
      onCount?.(res.data.length)
    } catch (e) {
      toast.error("Could not load the lines to link", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [onCount])

  useEffect(() => { void load() }, [load])

  const groups = useMemo<Group[]>(() => {
    const byText = new Map<string, Group>()
    for (const line of lines) {
      const g = byText.get(line.description) ?? { description: line.description, lines: [], pastDated: 0 }
      g.lines.push(line)
      if (line.past_dated) g.pastDated++
      byText.set(line.description, g)
    }
    return [...byText.values()].sort((a, b) => b.lines.length - a.lines.length)
  }, [lines])

  const link = async (group: Group) => {
    const product = picked[group.description]
    if (!product) return
    setSaving(group.description)
    try {
      const res = await linkUnlinkedLine(group.lines[0].id, { product_id: product.product_id, variant_id: product.variant_id, same_text: true })
      toast.success(res.message)
      await load()
    } catch (e) {
      toast.error("Could not link", { description: (e as Error).message })
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <CardTitle>Lines to link</CardTitle>
            <CardDescription>
              Invoice lines that are not linked to a product in the system, so their invoices are not sent to KRA.
              Pick the right existing product for each - every line written the same way is linked together.
              Linking only changes which product the line names: it never moves stock, and a past-dated invoice keeps its stock as it is.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S/No</TableHead>
                <TableHead>Line (as on the invoice)</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead className="w-64">Link to product</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    {loading ? "Loading…" : "Every invoice line is linked to a product."}
                  </TableCell>
                </TableRow>
              ) : groups.map((g, i) => (
                <TableRow key={g.description}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{g.description}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1 items-center">
                      <span>{g.lines.length} line{g.lines.length === 1 ? "" : "s"}</span>
                      {g.pastDated > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {g.pastDated === g.lines.length ? "Past-dated - no stock impact" : `${g.pastDated} past-dated - no stock impact`}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {g.lines.slice(0, 4).map((l) => (
                      <div key={l.id}>
                        <Link href={`/sales/invoices/${l.invoice_id}`} className="font-mono hover:underline">{l.invoice_number}</Link>
                        {" · "}{fmtDate(l.invoice_date)}{l.customer ? ` · ${l.customer}` : ""}
                      </div>
                    ))}
                    {g.lines.length > 4 && <div className="text-muted-foreground">and {g.lines.length - 4} more</div>}
                  </TableCell>
                  <TableCell>
                    <ProductPicker
                      products={products}
                      value={picked[g.description]}
                      onChange={(p) => setPicked((prev) => ({ ...prev, [g.description]: p }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => void link(g)} disabled={!picked[g.description] || saving !== null}>
                      {saving === g.description ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                      Link{g.lines.length > 1 ? ` ${g.lines.length}` : ""}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function ProductPicker({ products, value, onChange }: {
  products: LinkableProduct[]
  value?: LinkableProduct
  onChange: (p: LinkableProduct) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{value ? value.name : "Pick a product"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products…" />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={`${p.product_id}:${p.variant_id ?? ""}`}
                  value={p.name}
                  onSelect={() => { onChange(p); setOpen(false) }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.product_id === p.product_id && value?.variant_id === p.variant_id ? "opacity-100" : "opacity-0")} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

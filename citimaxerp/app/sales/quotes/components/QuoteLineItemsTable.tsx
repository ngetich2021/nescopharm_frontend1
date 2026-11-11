"use client"

import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Trash2, Loader2, Pencil, Plus } from "lucide-react"
import { getProducts } from "@/lib/products"
import { DEFAULT_UNIT, defaultPriceOption, describeOption, findAllByPriceCode, findByPriceCode, piecesPerPack, priceCodeHits, type PriceOption } from "@/lib/price-codes"
import { activeSizesOf, sizedName } from "@/lib/product-sizes"
import { SameCodeSizeSelect } from "@/components/same-code-size-select"
import { LineItemEditDialog, type LineEditResult } from "@/components/line-item-edit-dialog"

interface Props {
  form: UseFormReturn<any>
  fields: { id: string }[]
  remove: (index: number) => void
  append: (line: any) => void
  products: any[]
}

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// An item with no price on any list is still offered (never hidden): it comes in at 0.00 as a
// hand-typed ("Custom") price for the person quoting to fill in.
const NO_PRICE: PriceOption = { code: "Custom", list: "Custom", price: 0, unit: DEFAULT_UNIT }
const looksLikeCode = (v: string) => /^[a-z]+\s*\d+$/i.test(v.trim())

// Products matching what was typed, searched on the server as orders do (codes without spaces).
function useProductSearch(text: string, skip: boolean) {
  const [hits, setHits] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const q = text.trim()
    if (skip || q.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await getProducts(1, 100, { search: looksLikeCode(q) ? q.replace(/\s+/g, "") : q })
        if (!cancelled) setHits(data || [])
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [text, skip])
  return { hits, searching }
}

// The same list orders show: price codes containing what was typed, then one line per item at its
// default price (NSPV first). An item's other lists are picked by typing their code.
function SearchResults({ hits, query, searching, onPick }: { hits: any[]; query: string; searching: boolean; onPick: (product: any, option: PriceOption) => void }) {
  if (query.trim().length < 2) return <p className="p-2 text-sm text-gray-500">Type at least 2 characters to search products</p>
  if (searching && hits.length === 0) return <p className="p-2 text-sm text-gray-500">Searching...</p>
  const codes = priceCodeHits(hits, query)
  // Every match is listed, priced or not, so stock that came in is never out of reach.
  const items = hits
  if (codes.length === 0 && items.length === 0) return <p className="p-2 text-sm text-gray-500">No products found</p>
  return (
    <>
      {codes.length > 0 && (
        <div className="py-1">
          <p className="px-2 py-1 text-xs font-medium text-gray-500">Price codes</p>
          {codes.map(({ product, option }) => (
            <button key={`code-${product.id}-${option.code}`} type="button" className="block w-full rounded px-2 py-1.5 text-left hover:bg-gray-100" onClick={() => onPick(product, option)}>
              <span className="block text-sm font-semibold">{option.code}</span>
              <span className="block text-xs text-gray-500">{product.name} | {describeOption(option)}</span>
            </button>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="border-t py-1 first:border-t-0">
          {items.map((product) => {
            const option = defaultPriceOption(product)
            return (
              <button key={product.id} type="button" className="block w-full rounded px-2 py-1.5 text-left hover:bg-gray-100" onClick={() => onPick(product, option ?? NO_PRICE)}>
                <span className="block text-sm">{product.name}</span>
                <span className="block text-xs text-gray-500">
                  No. {product.item_number ?? "-"} | {option ? describeOption(option) : <span className="font-medium text-amber-700">No price set - type it on the line</span>} | {Number(product.stock_quantity ?? 0).toLocaleString()} in stock
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

// "Add Product" under the lines, as on orders: search, pick, and the line is added already filled.
function AddProductPicker({ onAdd }: { onAdd: (product: any, option: PriceOption) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const { hits, searching } = useProductSearch(text, !open)

  const add = (product: any, option: PriceOption) => {
    onAdd(product, option)
    setText("")
    setOpen(false)
  }

  // Typing a full code such as "NSPD 001" adds that item straight away, as on orders.
  useEffect(() => {
    if (!open || searching) return
    const hit = findByPriceCode(hits, text)
    if (hit) add(hit.product, hit.option)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, searching, text, open])

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setText("") }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] p-0">
        <div className="relative border-b p-2">
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by description, item no. or code (e.g. NSPD 001)..."
            className="h-9"
          />
          {searching && <Loader2 className="absolute right-4 top-4 h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          <SearchResults hits={hits} query={text} searching={searching} onPick={add} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// One row per price-list code: the code decides the item, pack size and price; only the quantity is typed.
export function QuoteLineItemsTable({ form, fields, remove, append, products }: Props) {
  // Codes typed for products outside the loaded page are fetched by CodeCell; keep those
  // products around so their sizes stay available to the row.
  const [resolved, setResolved] = useState<Record<string, any>>({})
  // An item edited with the pen is kept here too, and wins over the copy loaded with the page.
  const productById = (id: string) => (id ? resolved[id] ?? products.find((p) => p.id === id) : undefined)
  const remember = (product: any) =>
    setResolved((prev) => (prev[product.id] ? prev : { ...prev, [product.id]: product }))
  const [editing, setEditing] = useState<number | null>(null)
  const editingProduct = editing !== null ? productById(form.getValues(`items.${editing}.product_id`)) : undefined

  // The item changed everywhere, so every line on this quote using it takes the new name, and
  // those priced with the same code take the new price and unit.
  const applyEdit = ({ product: fresh, unitPrice, priceUnit }: LineEditResult) => {
    if (editing === null) return
    const code = form.getValues(`items.${editing}.price_label`)
    setResolved((prev) => ({ ...prev, [fresh.id]: fresh }))
    ;(form.getValues("items") as any[]).forEach((line, i) => {
      if (line.product_id !== fresh.id) return
      const size = line.variant_id ? (fresh.variants ?? []).find((v: any) => v.id === line.variant_id) : undefined
      form.setValue(`items.${i}.description`, size ? sizedName(fresh.name, size.name) : fresh.name)
      if (code && line.price_label === code) {
        form.setValue(`items.${i}.unit_price`, unitPrice)
        form.setValue(`items.${i}.price_unit`, priceUnit)
      }
    })
  }

  // A picked item becomes a filled line; an item with sizes asks for its size on the line.
  const addLine = (product: any, option: PriceOption) => {
    remember(product)
    append({
      product_id: product.id,
      variant_id: null,
      description: product.name,
      quantity: 1,
      unit_price: option.price,
      price_label: option.code,
      price_unit: option.unit,
    })
  }

  return (
    <div className="space-y-3">
    {/* Lines scroll inside a screen-high box so the sideways scrollbar is always in view. */}
    <div className="overflow-auto max-h-[55vh]">
      <table className="w-full min-w-[960px] text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b text-xs font-semibold text-gray-700 uppercase tracking-wide">
            <th className="text-left py-2 pr-2 w-12">S/No</th>
            <th className="text-left py-2 pr-2 w-44">Code / Item Search</th>
            <th className="text-left py-2 pr-2">Item Name</th>
            <th className="text-left py-2 pr-2 w-36">Pack Size</th>
            <th className="text-right py-2 pr-2 w-28">Price per Pack (Ksh)</th>
            <th className="text-right py-2 pr-2 w-32">Order Qty (packs)</th>
            <th className="text-right py-2 pr-2 w-32">Total Value (Ksh)</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => {
            const qty = Number(form.watch(`items.${index}.quantity`)) || 0
            const price = Number(form.watch(`items.${index}.unit_price`)) || 0
            const errors = (form.formState.errors as any).items?.[index]
            const product = productById(form.watch(`items.${index}.product_id`))
            const variantId = form.watch(`items.${index}.variant_id`) as string | null
            const perPack = piecesPerPack(form.watch(`items.${index}.price_unit`)) ?? 1
            const pieces = qty * perPack
            const variant = variantId ? activeSizesOf(product).find((s) => s.id === variantId) : undefined
            const stock = product && (!activeSizesOf(product).length || variant)
              ? Number((variant ?? product).stock_quantity ?? 0)
              : null
            const tracksStock = product?.track_inventory !== false
            const overStock = tracksStock && stock !== null && pieces > stock
            return (
              <tr key={field.id} className="border-b align-top">
                <td className="py-2 pr-2 pt-4 text-gray-600">{index + 1}</td>
                <td className="py-2 pr-2">
                  <CodeCell form={form} index={index} products={products} onResolved={remember} />
                  {errors?.product_id && !form.watch(`items.${index}.product_id`) && !form.watch(`items.${index}.price_label`) && (
                    <p className="text-xs text-red-600 mt-1">Enter a valid code</p>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <ItemNameCell form={form} index={index} product={productById(form.watch(`items.${index}.product_id`))} onResolved={remember} />
                </td>
                <td className="py-2 pr-2 pt-4 text-gray-700">
                  {form.watch(`items.${index}.product_id`)
                    ? form.watch(`items.${index}.price_unit`) || DEFAULT_UNIT
                    : <span className="text-gray-400">-</span>}
                </td>
                <td className="py-2 pr-2">
                  {/* Defaults to the price-list price; can be negotiated per quote. */}
                  {form.watch(`items.${index}.product_id`) ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 w-28 ml-auto text-right"
                      aria-label={`Price per pack for row ${index + 1}`}
                      {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    />
                  ) : <p className="pt-2 text-right text-gray-400">-</p>}
                  {errors?.unit_price && <p className="text-xs text-red-600 mt-1 text-right">{errors.unit_price.message}</p>}
                  {form.watch(`items.${index}.product_id`) && !price && (
                    <p className="text-xs text-amber-700 mt-1 text-right">No price set - type the price</p>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    className={`h-10 text-right ${overStock ? "border-amber-500" : ""}`}
                    aria-label={`Order quantity in packs for row ${index + 1}`}
                    {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {errors?.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity.message}</p>}
                  {product && qty > 0 && (
                    <p className={`text-xs mt-1 text-right ${overStock ? "text-amber-600 font-medium" : "text-gray-500"}`}>
                      = {pieces.toLocaleString()} pcs
                      {stock !== null && tracksStock && (
                        overStock
                          ? <> - only {stock.toLocaleString()} pcs in stock; needs restocking before it can become an order</>
                          : <> of {stock.toLocaleString()}</>
                      )}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-2 pt-4 text-right font-semibold">{money(qty * price)}</td>
                <td className="py-2 whitespace-nowrap">
                  {product && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(index)}
                      className="text-gray-500 hover:text-gray-900"
                      aria-label={`Edit item on row ${index + 1}`}
                      title="Edit name, description, unit, price and expiry"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    aria-label={`Remove row ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <LineItemEditDialog
        open={editing !== null && !!editingProduct}
        onOpenChange={(open) => !open && setEditing(null)}
        product={editingProduct}
        variantId={editing !== null ? form.getValues(`items.${editing}.variant_id`) : null}
        priceCode={editing !== null ? form.getValues(`items.${editing}.price_label`) : null}
        onSaved={applyEdit}
      />
    </div>
    {/* Under the last line so long quotes don't need a scroll back up. */}
    <AddProductPicker onAdd={addLine} />
    </div>
  )
}

// Items like "Endobronchial Tubes Left Fr26,28,31" are one code at one price but many sizes.
// Picking a size names the line for it ("Endobronchial Tubes Left Fr26") and decides which
// stock and batch is dispatched.
function ItemNameCell({ form, index, product, onResolved }: { form: UseFormReturn<any>; index: number; product: any; onResolved: (product: any) => void }) {
  const sizes = activeSizesOf(product)
  const value = (form.watch(`items.${index}.variant_id`) as string | null) ?? ""
  const description = form.watch(`items.${index}.description`) as string

  if (sizes.length === 0) {
    // A code shared by sizes stocked as separate products: the size picks the product, the code keeps the price.
    return (
      <div>
        <span className="block pt-2 text-gray-900">{description || <span className="text-gray-400">-</span>}</span>
        <SameCodeSizeSelect
          code={form.watch(`items.${index}.price_label`)}
          productId={form.watch(`items.${index}.product_id`)}
          label={`Size for row ${index + 1}`}
          onPick={(picked) => {
            onResolved(picked)
            form.setValue(`items.${index}.product_id`, picked.id, { shouldValidate: true })
            form.setValue(`items.${index}.variant_id`, null)
            form.setValue(`items.${index}.description`, picked.name)
          }}
          onPickSize={(picked, size) => {
            onResolved(picked)
            form.setValue(`items.${index}.product_id`, picked.id, { shouldValidate: true })
            form.setValue(`items.${index}.variant_id`, size.id, { shouldValidate: true })
            form.setValue(`items.${index}.description`, sizedName(picked.name, size.name))
          }}
        />
      </div>
    )
  }

  const picked = sizes.find((s) => s.id === value)

  // A native select can't wrap, so once a size is chosen its full name is shown as text and
  // the select shrinks to a compact "change size" control underneath.
  return (
    <div className="space-y-1">
      {picked && (
        <p className="pt-2 text-gray-900 break-words">
          {sizedName(product.name, picked.name)}
          <span className="ml-1 text-xs text-gray-500">({picked.stock_quantity} in stock)</span>
        </p>
      )}
      <select
        value={value}
        aria-label={`Size for row ${index + 1}`}
        className={
          picked
            ? "h-7 w-auto max-w-full rounded border border-input bg-background px-1 text-xs text-gray-600"
            : "h-10 w-full rounded-md border border-red-500 bg-background px-2 text-sm"
        }
        onChange={(e) => {
          const size = sizes.find((s) => s.id === e.target.value)
          form.setValue(`items.${index}.variant_id`, size?.id ?? null, { shouldValidate: true })
          form.setValue(`items.${index}.description`, size ? sizedName(product.name, size.name) : product.name)
        }}
      >
        <option value="">{picked ? "Change size" : `${product.name} - pick size`}</option>
        {sizes.map((size) => (
          <option key={size.id} value={size.id}>
            {picked ? size.name : sizedName(product.name, size.name)} ({size.stock_quantity} in stock)
          </option>
        ))}
      </select>
      {!value && <p className="text-xs text-red-600 mt-1">Pick a size</p>}
    </div>
  )
}

function CodeCell({ form, index, products, onResolved }: { form: UseFormReturn<any>; index: number; products: any[]; onResolved: (product: any) => void }) {
  const saved = form.getValues(`items.${index}.price_label`) as string | null
  const [text, setText] = useState(saved && saved !== "Custom" ? saved : "")
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  // Changing a line's item searches as orders do: price codes first, then one line per item.
  const applied = text.trim() !== "" && text.trim() === form.getValues(`items.${index}.price_label`)
  const { hits, searching } = useProductSearch(text, !listOpen || applied)

  const pickFromSearch = (product: any, option: PriceOption) => {
    apply([product], option)
    setListOpen(false)
  }

  // A code shared by several sizes sets the price but leaves the product empty until a size is picked.
  const apply = (matches: any[], option: PriceOption) => {
    matches.forEach(onResolved)
    const single = matches.length === 1 ? matches[0] : null
    form.setValue(`items.${index}.product_id`, single?.id ?? "", { shouldValidate: !!single })
    form.setValue(`items.${index}.variant_id`, null)
    form.setValue(`items.${index}.description`, single?.name ?? "")
    form.setValue(`items.${index}.unit_price`, option.price)
    form.setValue(`items.${index}.price_label`, option.code)
    form.setValue(`items.${index}.price_unit`, option.unit)
    // A hand-priced item has no code to show; its name stands in the box instead.
    setText(option === NO_PRICE ? single?.name ?? "" : option.code)
    setNotFound(false)
  }

  const clear = () => {
    form.setValue(`items.${index}.product_id`, "")
    form.setValue(`items.${index}.variant_id`, null)
    form.setValue(`items.${index}.description`, "")
    form.setValue(`items.${index}.unit_price`, 0)
    form.setValue(`items.${index}.price_label`, null)
    form.setValue(`items.${index}.price_unit`, null)
  }

  // Exact codes among the loaded products apply as soon as they are typed or picked from the list.
  useEffect(() => {
    if (!text.trim()) return
    const hit = findAllByPriceCode(products, text)
    if (hit && hit.option.code !== form.getValues(`items.${index}.price_label`)) apply(hit.products, hit.option)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, products])

  // Codes outside the loaded page are looked up on the server when the field is left; the loaded
  // page may hold only some of a shared code's sizes, so shared codes are always looked up too.
  const resolveRemotely = async () => {
    const value = text.trim()
    if (!value) {
      clear()
      return
    }
    const local = findAllByPriceCode(products, value)
    // A name or item number is picked from the search list, not resolved here.
    if (!looksLikeCode(value)) return
    if (local && local.products.length === 1) return
    setLooking(true)
    try {
      const { data } = await getProducts(1, 100, { search: value.replace(/\s+/g, "") })
      const hit = findAllByPriceCode(data || [], value)
      if (hit) {
        if (hit.option.code !== form.getValues(`items.${index}.price_label`)) apply(hit.products, hit.option)
        else hit.products.forEach(onResolved)
      } else setNotFound(true)
    } catch {
      setNotFound(true)
    } finally {
      setLooking(false)
    }
  }

  const showList = text.trim().length >= 2 && !applied

  return (
    <Popover open={listOpen && showList} onOpenChange={setListOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            value={text}
            autoComplete="off"
            placeholder="Code (NSPD 001) or name"
            className={`h-10 ${looksLikeCode(text) ? "font-mono uppercase" : ""} ${notFound ? "border-red-500" : ""}`}
            aria-label={`Code or item name for row ${index + 1}`}
            onChange={(e) => {
              setText(e.target.value)
              setNotFound(false)
              setListOpen(true)
              if (form.getValues(`items.${index}.product_id`) && e.target.value.trim() !== form.getValues(`items.${index}.price_label`)) clear()
            }}
            onFocus={() => setListOpen(true)}
            onBlur={resolveRemotely}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                resolveRemotely()
              }
              if (e.key === "Escape") setListOpen(false)
            }}
          />
          {(looking || searching) && <Loader2 className="absolute right-2 top-3 h-4 w-4 animate-spin text-gray-400" />}
          {notFound && <p className="text-xs text-red-600 mt-1">Code not found</p>}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[28rem] max-h-80 overflow-y-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Picking an item must not take focus from the box first.
        onMouseDown={(e) => e.preventDefault()}
      >
        <SearchResults hits={hits} query={text} searching={searching} onPick={pickFromSearch} />
      </PopoverContent>
    </Popover>
  )
}

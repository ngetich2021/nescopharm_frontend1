"use client"

import { useEffect, useId, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { getProducts } from "@/lib/products"
import { DEFAULT_UNIT, findByPriceCode, priceOptionsFor, type PriceOption } from "@/lib/price-codes"
import { activeSizesOf, sizedName } from "@/lib/product-sizes"

interface Props {
  form: UseFormReturn<any>
  fields: { id: string }[]
  remove: (index: number) => void
  products: any[]
}

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const looksLikeCode = (v: string) => /^[a-z]+\s*\d+$/i.test(v.trim())

// One row per price-list code: the code decides the item, pack size and price; only the quantity is typed.
export function QuoteLineItemsTable({ form, fields, remove, products }: Props) {
  const listId = useId()
  const allCodes = products.flatMap((p) => priceOptionsFor(p).filter((o) => o.code !== o.list).map((o) => ({ product: p, option: o })))
  // Codes typed for products outside the loaded page are fetched by CodeCell; keep those
  // products around so their sizes stay available to the row.
  const [resolved, setResolved] = useState<Record<string, any>>({})
  const productById = (id: string) => (id ? products.find((p) => p.id === id) ?? resolved[id] : undefined)
  const remember = (product: any) =>
    setResolved((prev) => (prev[product.id] ? prev : { ...prev, [product.id]: product }))

  return (
    <div className="overflow-x-auto">
      <datalist id={listId}>
        {allCodes.map(({ product, option }) => (
          <option key={`${product.id}-${option.code}`} value={option.code}>
            {product.name} - {money(option.price)}{option.unit ? ` (${option.unit})` : ""}
          </option>
        ))}
      </datalist>
      <table className="w-full min-w-[960px] text-sm border-collapse">
        <thead>
          <tr className="border-b text-xs font-semibold text-gray-700 uppercase tracking-wide">
            <th className="text-left py-2 pr-2 w-12">S/No</th>
            <th className="text-left py-2 pr-2 w-36">Code No.</th>
            <th className="text-left py-2 pr-2">Item Name</th>
            <th className="text-left py-2 pr-2 w-36">Pack Size</th>
            <th className="text-right py-2 pr-2 w-28">Price per Pack (Ksh)</th>
            <th className="text-right py-2 pr-2 w-24">Order Qty</th>
            <th className="text-right py-2 pr-2 w-32">Total Value (Ksh)</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => {
            const qty = Number(form.watch(`items.${index}.quantity`)) || 0
            const price = Number(form.watch(`items.${index}.unit_price`)) || 0
            const errors = (form.formState.errors as any).items?.[index]
            return (
              <tr key={field.id} className="border-b align-top">
                <td className="py-2 pr-2 pt-4 text-gray-600">{index + 1}</td>
                <td className="py-2 pr-2">
                  <CodeCell form={form} index={index} products={products} listId={listId} onResolved={remember} />
                  {errors?.product_id && !form.watch(`items.${index}.product_id`) && (
                    <p className="text-xs text-red-600 mt-1">Enter a valid code</p>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <ItemNameCell form={form} index={index} product={productById(form.watch(`items.${index}.product_id`))} />
                </td>
                <td className="py-2 pr-2 pt-4 text-gray-700">
                  {form.watch(`items.${index}.product_id`)
                    ? form.watch(`items.${index}.price_unit`) || DEFAULT_UNIT
                    : <span className="text-gray-400">-</span>}
                </td>
                <td className="py-2 pr-2 pt-4 text-right">{form.watch(`items.${index}.product_id`) ? money(price) : <span className="text-gray-400">-</span>}</td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    className="h-10 text-right"
                    aria-label={`Order quantity for row ${index + 1}`}
                    {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {errors?.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity.message}</p>}
                </td>
                <td className="py-2 pr-2 pt-4 text-right font-semibold">{money(qty * price)}</td>
                <td className="py-2">
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
    </div>
  )
}

// Items like "Endobronchial Tubes Left Fr26,28,31" are one code at one price but many sizes.
// Picking a size names the line for it ("Endobronchial Tubes Left Fr26") and decides which
// stock and batch is dispatched.
function ItemNameCell({ form, index, product }: { form: UseFormReturn<any>; index: number; product: any }) {
  const sizes = activeSizesOf(product)
  const value = (form.watch(`items.${index}.variant_id`) as string | null) ?? ""
  const description = form.watch(`items.${index}.description`) as string

  if (sizes.length === 0) {
    return <span className="block pt-2 text-gray-900">{description || <span className="text-gray-400">-</span>}</span>
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

function CodeCell({ form, index, products, listId, onResolved }: { form: UseFormReturn<any>; index: number; products: any[]; listId: string; onResolved: (product: any) => void }) {
  const saved = form.getValues(`items.${index}.price_label`) as string | null
  const [text, setText] = useState(saved && saved !== "Custom" ? saved : "")
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const apply = (product: any, option: PriceOption) => {
    onResolved(product)
    form.setValue(`items.${index}.product_id`, product.id, { shouldValidate: true })
    form.setValue(`items.${index}.variant_id`, null)
    form.setValue(`items.${index}.description`, product.name)
    form.setValue(`items.${index}.unit_price`, option.price)
    form.setValue(`items.${index}.price_label`, option.code)
    form.setValue(`items.${index}.price_unit`, option.unit)
    setText(option.code)
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
    const hit = findByPriceCode(products, text)
    if (hit && hit.option.code !== form.getValues(`items.${index}.price_label`)) apply(hit.product, hit.option)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, products])

  // Codes outside the loaded page are looked up on the server when the field is left.
  const resolveRemotely = async () => {
    const value = text.trim()
    if (!value) {
      clear()
      return
    }
    if (findByPriceCode(products, value) || !looksLikeCode(value)) {
      if (!findByPriceCode(products, value)) setNotFound(true)
      return
    }
    setLooking(true)
    try {
      const { data } = await getProducts(1, 10, { search: value })
      const hit = findByPriceCode(data || [], value)
      if (hit) apply(hit.product, hit.option)
      else setNotFound(true)
    } catch {
      setNotFound(true)
    } finally {
      setLooking(false)
    }
  }

  return (
    <div className="relative">
      <Input
        value={text}
        list={listId}
        placeholder="e.g. NSPD 001"
        className={`h-10 font-mono uppercase ${notFound ? "border-red-500" : ""}`}
        aria-label={`Code for row ${index + 1}`}
        onChange={(e) => {
          setText(e.target.value)
          setNotFound(false)
          if (form.getValues(`items.${index}.product_id`) && e.target.value.trim() !== form.getValues(`items.${index}.price_label`)) clear()
        }}
        onBlur={resolveRemotely}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            resolveRemotely()
          }
        }}
      />
      {looking && <Loader2 className="absolute right-2 top-3 h-4 w-4 animate-spin text-gray-400" />}
      {notFound && <p className="text-xs text-red-600 mt-1">Code not found</p>}
    </div>
  )
}

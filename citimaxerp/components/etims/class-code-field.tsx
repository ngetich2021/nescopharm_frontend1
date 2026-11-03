"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getEtimsReference, suggestEtimsClassCode } from "@/lib/etims"

// KRA's class list, loaded once per page for showing a typed code's name.
let classNames: Promise<Map<string, string>> | null = null
function loadClassNames() {
  classNames ??= getEtimsReference()
    .then((ref) => new Map(ref.item_classes.map((c) => [c.code, c.name])))
    .catch(() => {
      classNames = null
      return new Map<string, string>()
    })
  return classNames
}

/**
 * Optional KRA item class code on the product form. A suggestion from the product's name is
 * offered (the same rules that coded the product list for go-live); the person keeps it, types
 * another, or leaves it empty - an empty code goes to KRA under its general code (99010000) and
 * can be set later here or through eTIMS > Product Codes.
 */
export function EtimsClassCodeField({ value, onChange, productName }: {
  value: string
  onChange: (code: string) => void
  productName: string
}) {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [suggestion, setSuggestion] = useState<{ code: string; name: string } | null>(null)

  useEffect(() => { void loadClassNames().then(setNames) }, [])

  // Ask again shortly after the name stops changing.
  useEffect(() => {
    const name = productName.trim()
    if (name.length < 3) {
      setSuggestion(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      suggestEtimsClassCode(name)
        .then((s) => { if (!cancelled) setSuggestion(s) })
        .catch(() => { if (!cancelled) setSuggestion(null) })
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [productName])

  const code = value.trim()
  const known = code ? names.get(code) : undefined

  return (
    <div className="space-y-2">
      <Label htmlFor="etimsItemClassCode">KRA Item Class Code (optional)</Label>
      <Input
        id="etimsItemClassCode"
        inputMode="numeric"
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="e.g. 42270000 - leave empty if unsure"
      />
      {code && (known
        ? <p className="text-xs text-green-700">{known}</p>
        : names.size > 0 && <p className="text-xs text-red-600">{code.length < 8 ? "KRA codes have 8 digits." : "Not in KRA's item class list."}</p>)}
      {suggestion && suggestion.code !== code && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Suggested: <span className="font-mono">{suggestion.code}</span> - {suggestion.name}</span>
          <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange(suggestion.code)}>
            Use
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        For eTIMS. Empty is fine: the product goes to KRA under the general code until one is set here or on eTIMS &gt; Product Codes.
      </p>
    </div>
  )
}

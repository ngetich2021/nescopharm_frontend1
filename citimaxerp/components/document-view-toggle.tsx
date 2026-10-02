"use client"

import { useState } from "react"

export type DocumentView = "official" | "pricing"

// The pricing copy shows which price code (NSPV/NSPH/...) each line was sold at; the official copy goes to the client.
export function useDocumentView(): [DocumentView, (v: DocumentView) => void] {
  return useState<DocumentView>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "pricing"
      ? "pricing"
      : "official"
  )
}

export function DocumentViewToggle({ value, onChange }: { value: DocumentView; onChange: (v: DocumentView) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-white p-0.5 text-sm">
      {(["official", "pricing"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-3 py-1 capitalize ${value === v ? "bg-primary text-primary-foreground" : "text-gray-600 hover:bg-gray-100"}`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

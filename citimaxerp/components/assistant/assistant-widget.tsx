"use client"

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, Loader2, MessageCircle, Minus, Send, Sparkles, X } from "lucide-react"
import apiCall from "@/lib/api"
import { useOptionalAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

// The in-app assistant: a green message button at the bottom right opens the chat. Its X tucks the
// button away behind a small "<" tab at the edge of the screen; the tab brings the button back.
// Answers come from the server, which looks up live data within the user's permissions.

type Mode = "button" | "open" | "tucked"
type Message = { role: "user" | "assistant"; content: string }

const MODE_KEY = "assistant-widget-mode"
const CHAT_KEY = "assistant-widget-chat" // where an earlier version kept the chat; cleared on load
const SUGGESTIONS = [
  "What is the latest invoice and its amount?",
  "How do I add a product?",
  "Which products are low on stock or expiring soon?",
  "How much have we spent on expenses this month?",
]

const read = <T,>(storage: () => Storage, key: string, fallback: T): T => {
  try {
    const raw = storage().getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (storage: () => Storage, key: string, value: unknown) => {
  try { storage().setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

export function AssistantWidget() {
  const firstName = (useOptionalAuth()?.userProfile as any)?.first_name as string | undefined
  const [mode, setMode] = useState<Mode>("button")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Only whether the button is tucked away is remembered. Conversations are just Q&A: they are kept
  // nowhere (not on the server, not in the browser) and are gone when the page reloads.
  useEffect(() => {
    const saved = read<Mode>(() => localStorage, MODE_KEY, "button")
    setMode(saved === "open" ? "button" : saved)
    try { sessionStorage.removeItem(CHAT_KEY) } catch { /* storage unavailable */ }
  }, [])
  const changeMode = (next: Mode) => {
    setMode(next)
    write(() => localStorage, MODE_KEY, next)
  }
  useEffect(() => {
    if (mode === "open") {
      endRef.current?.scrollIntoView({ block: "end" })
      inputRef.current?.focus()
    }
  }, [mode, messages, busy])

  const ask = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    const next = [...messages, { role: "user" as const, content: question }]
    setMessages(next)
    setInput("")
    setBusy(true)
    try {
      const res = await apiCall<{ reply: string }>("/assistant/chat", "POST", { messages: next.slice(-12) })
      setMessages([...next, { role: "assistant", content: res.reply }])
    } catch (err: any) {
      setMessages([...next, { role: "assistant", content: err?.message?.includes("429") || /too many/i.test(err?.message ?? "")
        ? "You're asking quickly - please wait a moment and try again."
        : "Sorry, I couldn't answer just now. Please try again." }])
    } finally {
      setBusy(false)
    }
  }

  if (mode === "tucked") {
    return (
      <button
        type="button"
        onClick={() => changeMode("button")}
        className="fixed bottom-[10px] right-0 z-50 flex h-10 w-6 items-center justify-center rounded-l-md bg-green-600 text-white shadow-lg hover:w-8 hover:bg-green-700 transition-all print:hidden"
        title="Show the assistant"
        aria-label="Show the assistant"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="print:hidden">
      {mode === "open" && (
        <div className="fixed bottom-[78px] right-[10px] z-50 flex h-[min(560px,calc(100vh-100px))] w-[min(380px,calc(100vw-20px))] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
          <div className="flex items-center gap-2 bg-green-600 px-4 py-3 text-white">
            <Sparkles className="h-4 w-4" />
            <div className="flex-1 leading-tight">
              <p className="text-sm font-semibold">Citimax Assistant</p>
              <p className="text-[11px] text-green-100">Live answers from your system</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="rounded px-1.5 py-0.5 text-[11px] text-green-100 hover:bg-white/15" title="Start a new conversation">
                New chat
              </button>
            )}
            <button type="button" onClick={() => changeMode("button")} className="rounded p-1 hover:bg-white/15" title="Minimise" aria-label="Minimise">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => changeMode("tucked")} className="rounded p-1 hover:bg-white/15" title="Close" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-3 text-sm">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white p-3 text-gray-700 shadow-sm">
                  Hi{firstName ? ` ${firstName}` : ""}! Ask me about products, prices and codes, stock, sales, invoices,
                  receipts or expenses, or how to do something in the system.
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-green-200 bg-white px-3 py-1 text-left text-xs text-green-800 hover:bg-green-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[88%] rounded-lg px-3 py-2 shadow-sm",
                  m.role === "user" ? "bg-green-600 text-white" : "bg-white text-gray-800",
                )}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking that up...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t bg-white p-2"
            onSubmit={(e) => { e.preventDefault(); ask(input) }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input) }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask anything..."
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus:border-green-500"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div className="group fixed bottom-[10px] right-[10px] z-50">
        <button
          type="button"
          onClick={() => changeMode(mode === "open" ? "button" : "open")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors"
          title="Citimax Assistant"
          aria-label="Open the assistant"
        >
          {mode === "open" ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
        {mode !== "open" && (
          <button
            type="button"
            onClick={() => changeMode("tucked")}
            className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-600 shadow hover:text-gray-900"
            title="Hide the assistant"
            aria-label="Hide the assistant"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ---- A small, safe Markdown renderer for the assistant's replies: paragraphs, **bold**, `code`,
// headings, bullet/numbered lists and tables. Built from React elements, never raw HTML.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-gray-100 px-1 text-[12px]">{part.slice(1, -1)}</code>
    return <Fragment key={i}>{part}</Fragment>
  })
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n")
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // Table: header row, separator row, body rows.
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const head = cells(line)
      const body: string[][] = []
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]))
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto">
          <table className="my-1 w-full border-collapse text-xs">
            <thead><tr>{head.map((h, k) => <th key={k} className="border-b bg-gray-50 px-2 py-1 text-left font-semibold">{inline(h)}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border-b px-2 py-1 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    // Lists.
    const bullet = /^\s*[-*•]\s+/
    const numbered = /^\s*\d+[.)]\s+/
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line)
      const items: string[] = []
      while (i < lines.length && (bullet.test(lines[i]) || numbered.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        const l = lines[i++]
        if (bullet.test(l) || numbered.test(l)) items.push(l.replace(bullet, "").replace(numbered, ""))
        else items[items.length - 1] += " " + l.trim()
      }
      const List = ordered ? "ol" : "ul"
      blocks.push(
        <List key={blocks.length} className={cn("my-1 space-y-0.5 pl-5", ordered ? "list-decimal" : "list-disc")}>
          {items.map((it, k) => <li key={k}>{inline(it)}</li>)}
        </List>,
      )
      continue
    }

    // Heading.
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (heading) { blocks.push(<p key={blocks.length} className="mt-1 font-semibold">{inline(heading[1])}</p>); i++; continue }

    // Paragraph: consecutive plain lines.
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*\|/.test(lines[i]) && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !/^#{1,4}\s/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={blocks.length} className="my-1 whitespace-pre-wrap">{inline(para.join("\n"))}</p>)
  }
  return <div className="space-y-1 leading-relaxed">{blocks}</div>
}

/**
 * The words to show when something fails. Pages must say the real reason
 * (e.g. "Fill in the Description.") instead of a generic "Failed... try
 * again". lib/api already turns the server's reply into readable text on
 * error.message; this returns it, and only falls back to the page's own
 * wording when there is no usable message.
 */
export function errorText(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? (error as { message?: unknown }).message
        : undefined

  let message = ""
  if (typeof raw === "string") {
    message = raw
  } else if (raw && typeof raw === "object") {
    // Laravel validation bag: { field: ["msg", ...] }
    message = Object.values(raw as Record<string, unknown>)
      .flat()
      .filter((m): m is string => typeof m === "string")
      .join(" ")
  }

  message = message.trim()
  if (!message) return fallback
  // Programming errors from the browser mean nothing to the person using the page.
  if (/^(TypeError|ReferenceError|SyntaxError)\b|is not a function|Cannot read propert|undefined is not/i.test(message)) {
    return fallback
  }
  return message
}

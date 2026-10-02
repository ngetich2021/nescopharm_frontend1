export async function logToFile(message: string, level: "info" | "error" = "info") {
  const timestamp = new Date().toISOString()
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}`

  if (level === "error") {
    // console.error(logEntry) // Removed
  } else {
    // console.log(logEntry) // Removed
  }
}

export function logError(error: unknown) {
  const errorMessage = error instanceof Error ? (error.stack || error.message || String(error)) : String(error)
  logToFile(errorMessage, "error")
  // console.error(errorMessage) // Removed
}

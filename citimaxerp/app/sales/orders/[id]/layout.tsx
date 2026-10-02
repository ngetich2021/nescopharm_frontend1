"use client"

import React from "react"

// Simple layout component for orders/[id]
export default function OrderDetailsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Just render the children without any additional props
  return <>{children}</>
}

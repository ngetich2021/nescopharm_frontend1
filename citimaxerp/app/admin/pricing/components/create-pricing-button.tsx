"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { CreatePricingSheet } from "./create-pricing-sheet"

export function CreatePricingButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add New Plan
      </Button>
      <CreatePricingSheet isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}

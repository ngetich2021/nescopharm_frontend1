"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CreateProductModal } from "@/components/modals/create-product-modal"

interface CreateProductButtonProps {
  onSuccess?: () => void
}

export function CreateProductButton({ onSuccess }: CreateProductButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSuccess = () => {
    setIsModalOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Product
      </Button>

      <CreateProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
    </>
  )
}

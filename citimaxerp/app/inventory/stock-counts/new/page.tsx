"use client"

import type React from "react"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Search, Save, ChevronLeft, ChevronRight, Barcode } from "lucide-react"
import { products } from "@/lib/products-data"
import { toast } from "@/components/ui/use-toast"

export default function NewStockCountPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [stockCount, setStockCount] = useState({
    date: new Date(),
    store: "",
    notes: "",
  })
  const [productCounts, setProductCounts] = useState<{ [key: string]: number }>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [barcode, setBarcode] = useState("")
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Filter products based on the selected store
  const storeProducts = useMemo(() => {
    return products.filter((product) => product.store === stockCount.store)
  }, [stockCount.store])

  // Apply search filter on store products
  const filteredProducts = useMemo(() => {
    return storeProducts.filter(
      (product) =>
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [storeProducts, searchQuery])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = filteredProducts.slice(startIndex, endIndex)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setStockCount((prev) => ({ ...prev, [name]: value }))
  }

  const handleStoreChange = (value: string) => {
    setStockCount((prev) => ({ ...prev, store: value }))
    setProductCounts({})
    setCurrentPage(1)
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    setProductCounts((prev) => ({ ...prev, [productId]: quantity }))
  }

  const handleSave = () => {
    // Here you would typically send the data to your backend
    router.push("/inventory/stock-counts")
  }

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const scannedProduct = storeProducts.find((product) => product.sku === barcode || product.serialNumber === barcode)
    if (scannedProduct) {
      handleQuantityChange(scannedProduct.id, (productCounts[scannedProduct.id] || 0) + 1)
      setBarcode("")
      toast({
        title: "Product Scanned",
        description: `Added 1 to ${scannedProduct.name}`,
      })
    } else {
      toast({
        title: "Product Not Found",
        description: "The scanned barcode does not match any product in this store.",
        variant: "destructive",
      })
    }
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }

  return (
    <div className="container mx-auto py-6">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Stock Counts
      </Button>

      <h1 className="text-3xl font-bold mb-6">New Stock Count</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Stock Count Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store">Store</Label>
              <Select value={stockCount.store} onValueChange={handleStoreChange}>
                <SelectTrigger id="store">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Store 1">Store 1</SelectItem>
                  <SelectItem value="Store 2">Store 2</SelectItem>
                  <SelectItem value="Warehouse 1">Warehouse 1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <p className="text-sm font-medium">{stockCount.date.toLocaleDateString()}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                name="notes"
                value={stockCount.notes}
                onChange={handleInputChange}
                placeholder="Enter any additional notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {stockCount.store && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <form onSubmit={handleBarcodeSubmit} className="flex-grow">
              <div className="relative">
                <Barcode className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  ref={barcodeInputRef}
                  className="pl-8"
                  placeholder="Scan barcode..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onFocus={() => setBarcode("")}
                />
              </div>
            </form>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Product Description</TableHead>
                  <TableHead>Counted Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.serialNumber}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.description}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={productCounts[product.id] || ""}
                        onChange={(e) => handleQuantityChange(product.id, Number.parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Stock Count
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

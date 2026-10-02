"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { getProducts } from "@/lib/products"
import { Button } from "@/components/ui/button"

interface Product {
  id: string
  name: string
  price: string | number
  sku?: string | null
  category?: string | { id: string; name: string } | null
  stock_quantity: number
  image_url?: string | null
  image_urls?: string[]
  primary_image_url?: string | null
  variants?: ProductVariant[]
}

interface ProductVariant {
  id: string | number
  name: string
  price: string | number
  sku?: string | null
  stock_quantity: number
  primary_image_url?: string | null
  image_urls?: string[]
  images?: string[]
}

interface ProductSearchProps {
  onAddToCart: (product: Product, variant?: ProductVariant) => void
}

// Each entry the grid renders/searches over is a concrete sellable item - a
// plain product, or one specific variant of a variant-parent product. A
// product with variants contributes one entry per variant (never the parent
// itself), so every variant is its own directly-searchable, directly-add
// card instead of being hidden behind a "select variant" step.
interface SearchItem {
  key: string
  product: Product
  variant?: ProductVariant
  name: string
  sku: string
  price: string | number
  stock: number
  image: string | null
}

function buildSearchItems(products: Product[]): SearchItem[] {
  const items: SearchItem[] = []
  for (const product of products) {
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        items.push({
          key: `${product.id}-${variant.id}`,
          product,
          variant,
          name: variant.name,
          sku: variant.sku || "",
          price: variant.price,
          stock: variant.stock_quantity ?? 0,
          image:
            variant.primary_image_url ||
            (variant.image_urls && variant.image_urls.length > 0 ? variant.image_urls[0] : null) ||
            (variant.images && variant.images.length > 0 ? variant.images[0] : null) ||
            product.primary_image_url ||
            (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null) ||
            product.image_url ||
            null,
        })
      }
    } else {
      items.push({
        key: product.id,
        product,
        name: product.name,
        sku: product.sku || "",
        price: product.price,
        stock: product.stock_quantity ?? 0,
        image:
          product.primary_image_url ||
          (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null) ||
          product.image_url ||
          null,
      })
    }
  }
  return items
}

export function ProductSearch({ onAddToCart }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Array<string | { id: string; name: string }>>(["All"])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Fetch all products once
  useEffect(() => {
    setLoading(true)
    setError(null)
    getProducts(1, 10000, {
      search: searchTerm,
      category: selectedCategory !== "All" ? selectedCategory : undefined,
    })
      .then((res) => {
        setAllProducts(res.data as Product[])
        // Extract categories from products
        // Extract categories from products, preserving objects if present
        const cats = Array.from(
          new Set(
            res.data
              .map((p) => p.category)
              .filter(Boolean)
              .map((cat) =>
                typeof cat === "string"
                  ? cat
                  : cat && typeof cat === "object" && "id" in cat && "name" in cat
                  ? JSON.stringify(cat)
                  : null
              )
              .filter(Boolean)
          )
        )
          .map((cat) => {
            if (typeof cat === "string" && cat.startsWith("{")) {
              try {
                return JSON.parse(cat)
              } catch {
                return cat
              }
            }
            return cat
          });
        setCategories(["All", ...cats])
        setPage(1)
      })
      .catch((err) => {
        setError(err.message || "Failed to load products")
        setAllProducts([])
      })
      .finally(() => setLoading(false))
  }, [searchTerm, selectedCategory])

  // Flatten once per product-list change - one entry per variant, so a
  // product with 40 variants yields 40 independently searchable/addable items.
  const allItems = useMemo(() => buildSearchItems(allProducts), [allProducts])

  // Fuzzy matching: checks if search term characters appear in sequence (case-insensitive)
  const fuzzyMatch = (text: string | null | undefined, query: string): boolean => {
    if (!text) return false
    const t = text.toLowerCase()
    const q = query.toLowerCase()
    let tIndex = 0
    for (let i = 0; i < q.length; i++) {
      tIndex = t.indexOf(q[i], tIndex)
      if (tIndex === -1) return false
      tIndex++
    }
    return true
  }

  // Filter items by search and category
  const filteredItems = allItems.filter((item) => {
    const term = searchTerm.toLowerCase();
    const product = item.product
    const matchesSearch =
      !searchTerm ||
      fuzzyMatch(item.name, term) ||
      fuzzyMatch(item.sku, term) ||
      // Also match the parent product's own name/SKU, so e.g. searching
      // "Suture" still surfaces all of its variant cards.
      fuzzyMatch(product.name, term) ||
      fuzzyMatch(product.sku || "", term) ||
      (typeof product.category === 'string'
        ? fuzzyMatch(product.category || "", term)
        : fuzzyMatch((product.category as any)?.name || "", term)
      );
    const matchesCategory = selectedCategory === "All" ||
      (typeof product.category === 'string'
        ? product.category === selectedCategory
        : (product.category as any)?.id === selectedCategory
      );
    return matchesSearch && matchesCategory;
  });

  // Paginate filtered items
  const totalCount = filteredItems.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  const handleItemClick = (item: SearchItem) => {
    // Remove out-of-stock check: allow adding any item regardless of stock
    onAddToCart(item.product, item.variant)
  }

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { label: "Out of Stock", color: "destructive" as const }
    if (stock <= 5) return { label: "Low Stock", color: "secondary" as const }
    return { label: "In Stock", color: "default" as const }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category, index) => {
              if (category === "All") {
                return (
                  <SelectItem key="category-all" value="All">
                    All
                  </SelectItem>
                );
              }
              if (typeof category === "string") {
                return (
                  <SelectItem key={`category-str-${category}`} value={category}>
                    {category}
                  </SelectItem>
                );
              }
              if (typeof category === "object" && category !== null && "id" in category && "name" in category) {
                return (
                  <SelectItem key={`category-obj-${category.id}`} value={category.id}>
                    {category.name}
                  </SelectItem>
                );
              }
              return null;
            })}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">Loading products...</div>
      ) : error ? (
        <div className="flex justify-center items-center py-12 text-red-500">{error}</div>
      ) : paginatedItems.length === 0 ? (
        <div className="flex justify-center items-center py-12 text-gray-500">No products found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((item) => {
              const stockStatus = getStockStatus(item.stock)
              const priceNum = parseFloat(typeof item.price === "string" ? item.price : String(item.price || "0"))
              return (
                <Card
                  key={item.key}
                  className="p-4 cursor-pointer hover:shadow-lg transition"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex flex-col items-center">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="w-24 h-24 object-contain mb-2"
                    />
                    <div className="font-semibold text-lg text-center">{item.name}</div>
                    <div className="text-gray-500 text-sm mb-1">{item.sku}</div>
                    <div className="font-bold text-primary">KES {!isNaN(priceNum) && priceNum > 0 ? priceNum.toLocaleString() : "N/A"}</div>
                    <Badge variant={stockStatus.color}>{stockStatus.label}</Badge>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-muted-foreground">Rows per page</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder="12" />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[6, 12, 24, 48].map((size) => (
                      <SelectItem key={`pagesize-${size}`} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string
  image_urls?: string[]
  primary_image_url?: string
  category: string
  stock_quantity: number
}

interface ProductGridProps {
  products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="flex flex-col">
          <CardHeader>
            <div className="aspect-square relative mb-2">
              <Image
                src={product.primary_image_url || (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null) || (product as any).image_url || "/placeholder.svg"}
                alt={product.name}
                fill
                className="object-cover rounded-md"
              />
            </div>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
            <div className="mt-2">
              <Badge variant="secondary">{product.category || "Uncategorized"}</Badge>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between mt-auto">
            <span className="text-lg font-bold">
              {(() => {
                const price = parseFloat(typeof product.price === 'string' ? product.price : product.price?.toString() || '0');
                return !isNaN(price) ? `Ksh. ${price.toFixed(2)}` : "Price not available";
              })()}
            </span>
            <span className="text-sm text-gray-500">
              {typeof product.stock_quantity === "number" && !isNaN(product.stock_quantity)
                ? product.stock_quantity > 0
                  ? `${product.stock_quantity} in stock`
                  : "Out of stock"
                : "Stock unknown"}
            </span>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

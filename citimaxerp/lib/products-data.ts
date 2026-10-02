export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  sku: string
  category: string
  reorderLevel: number
  unitCost: number
  supplier: string
  lastUpdated: string
  serialNumber: string
  store: string
}

export const products: Product[] = [
  {
    id: "1",
    name: "Wireless Earbuds",
    description: "High-quality wireless earbuds with noise cancellation",
    price: 129.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "WE-001",
    category: "Electronics",
    reorderLevel: 10,
    unitCost: 80.0,
    supplier: "TechAudio Inc.",
    lastUpdated: "2023-06-01",
    serialNumber: "SN001",
    store: "Store 1",
  },
  {
    id: "2",
    name: "Smart Watch",
    description: "Feature-packed smartwatch with health tracking",
    price: 199.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "SW-001",
    category: "Electronics",
    reorderLevel: 5,
    unitCost: 120.0,
    supplier: "WearableTech Co.",
    lastUpdated: "2023-05-28",
    serialNumber: "SN002",
    store: "Store 2",
  },
  {
    id: "3",
    name: "Portable Charger",
    description: "High-capacity portable charger for all your devices",
    price: 49.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "PC-001",
    category: "Electronics",
    reorderLevel: 20,
    unitCost: 30.0,
    supplier: "PowerUp Solutions",
    lastUpdated: "2023-06-15",
    serialNumber: "SN003",
    store: "Warehouse 1",
  },
  {
    id: "4",
    name: "Bluetooth Speaker",
    description: "Waterproof Bluetooth speaker with excellent sound quality",
    price: 79.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "BS-001",
    category: "Electronics",
    reorderLevel: 8,
    unitCost: 50.0,
    supplier: "SoundWave Audio",
    lastUpdated: "2023-06-10",
    serialNumber: "SN004",
    store: "Store 1",
  },
  {
    id: "5",
    name: "Laptop Backpack",
    description: "Durable and spacious laptop backpack with multiple compartments",
    price: 59.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "LB-001",
    category: "Accessories",
    reorderLevel: 15,
    unitCost: 35.0,
    supplier: "CarryAll Bags",
    lastUpdated: "2023-05-18",
    serialNumber: "SN005",
    store: "Store 2",
  },
  {
    id: "6",
    name: "Wireless Mouse",
    description: "Ergonomic wireless mouse with long battery life",
    price: 29.99,
    image: "/placeholder.svg?height=200&width=200",
    sku: "WM-001",
    category: "Electronics",
    reorderLevel: 12,
    unitCost: 18.0,
    supplier: "ClickTech Peripherals",
    lastUpdated: "2023-06-05",
    serialNumber: "SN006",
    store: "Warehouse 1",
  },
]

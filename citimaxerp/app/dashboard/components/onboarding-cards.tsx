"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Store, 
  Package, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight,
  Plus,
  Building2,
  ShoppingCart
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCachedStores } from "@/lib/stores"
import { getProducts } from "@/lib/products"
import { useAuth } from "@/lib/auth-context"
import { CreateProductModal } from "@/components/modals/create-product-modal"
import { CreateStoreSheet } from "./create-store-sheet"
import { forceRefreshStores } from "@/lib/stores"

interface OnboardingCardsProps {
  onGoToDashboard?: () => void | Promise<void>
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  completed: boolean
  action: () => void
  actionText: string
}

export function OnboardingCards({ onGoToDashboard }: OnboardingCardsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { updateFirstTimeStatus, refreshUserProfile, companyId } = useAuth()
  const [stores, setStores] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false)
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [storesData, productsResponse] = await Promise.all([
        getCachedStores().catch(() => []),
        getProducts().catch(() => ({ data: [], count: 0 }))
      ])
      setStores(storesData)
      setProducts(productsResponse.data || [])
    } catch (error) {
      // console.error("Error fetching onboarding data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStoreCreated = () => {
    setIsCreateStoreOpen(false)
    fetchData()
    // Force refresh stores in sidebar
    if (companyId) {
      forceRefreshStores(companyId)
    }
    toast({
      title: "Store Created!",
      description: "Your store has been created successfully. Now let's add some products!",
    })
  }

  const handleProductCreated = async () => {
    setIsCreateProductOpen(false)
    fetchData()
    
    // Update the user's is_first_time status to false since they've created a product
    await updateFirstTimeStatus(false)
    
    toast({
      title: "Product Added!",
      description: "Your product has been added successfully. You're all set!",
    })
  }

  const onboardingSteps: OnboardingStep[] = [
    {
      id: "store",
      title: "Create Your First Store",
      description: "Set up your store to start managing inventory and sales",
      icon: <Store className="h-6 w-6" />, 
      completed: stores.length > 0,
      action: () => setIsCreateStoreOpen(true),
      actionText: "Create Store"
    },
    {
      id: "product",
      title: "Add Your First Product",
      description: "Add products to your inventory to start selling",
      icon: <Package className="h-6 w-6" />, 
      completed: products.length > 0,
      action: () => setIsCreateProductOpen(true),
      actionText: "Add Product"
    }
  ]

  const completedSteps = onboardingSteps.filter(step => step.completed).length
  const totalSteps = onboardingSteps.length
  const progressPercentage = (completedSteps / totalSteps) * 100

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Welcome to Citimax!
          </CardTitle>
          <CardDescription>
            Let's get you started with setting up your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If all steps are completed, show a completion card
  if (completedSteps === totalSteps) {
    const handleGoToDashboard = async () => {
      if (onGoToDashboard) {
        await onGoToDashboard()
      }
      window.location.replace("/dashboard")
    }
    return (
      <Card className="w-full border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            Welcome to Citimax!
          </CardTitle>
          <CardDescription className="text-green-700">
            You're all set up! Your business is ready to grow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">Setup Progress</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Complete
              </Badge>
            </div>
            <Progress value={100} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-green-600" />
                <span>{stores.length} Store{stores.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                <span>{products.length} Product{products.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <Button 
              onClick={handleGoToDashboard}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Welcome to Citimax!
          </CardTitle>
          <CardDescription>
            Let's get you started with setting up your business. Complete these steps to unlock the full potential of your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Progress Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Setup Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedSteps} of {totalSteps} completed
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Steps Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {onboardingSteps.map((step) => (
                <Card 
                  key={step.id} 
                  className={`relative overflow-hidden transition-all hover:shadow-md ${
                    step.completed 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200'
                  }`}
                >
                  {step.completed && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        step.completed 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {step.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{step.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {step.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      onClick={step.action}
                      variant={step.completed ? "outline" : "default"}
                      className={`w-full ${
                        step.completed 
                          ? 'border-green-300 text-green-700 hover:bg-green-100' 
                          : ''
                      }`}
                      disabled={step.completed}
                    >
                      {step.completed ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Completed
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          {step.actionText}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stores.length}</div>
                <div className="text-xs text-muted-foreground">Stores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{products.length}</div>
                <div className="text-xs text-muted-foreground">Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{completedSteps}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Store Sheet */}
      <CreateStoreSheet
        isOpen={isCreateStoreOpen}
        onOpenChange={setIsCreateStoreOpen}
        onStoreCreated={handleStoreCreated}
      />

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSuccess={handleProductCreated}
      />
    </>
  )
} 
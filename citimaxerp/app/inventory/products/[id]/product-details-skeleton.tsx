import { Skeleton } from "@/components/ui/skeleton"

export function ProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Floating Navigation */}
      <div className="fixed top-6 left-6 z-50">
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>

      {/* Floating Actions */}
      <div className="fixed top-6 right-6 z-50 flex space-x-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Product Images */}
          <div className="relative">
            <Skeleton className="aspect-square rounded-3xl" />
            <div className="flex space-x-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-20 h-20 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <Skeleton className="h-32 w-full rounded-2xl" />

            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>

            <div>
              <Skeleton className="h-4 w-16 mb-3" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-full" />
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
              <Skeleton className="h-12 flex-1 rounded-lg" />
              <Skeleton className="h-12 w-32 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-12">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8">
            <Skeleton className="h-8 w-64 mb-6" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8">
            <Skeleton className="h-8 w-48 mb-8" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-6">
                  <Skeleton className="h-6 w-32" />
                  <div className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex justify-between items-center py-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

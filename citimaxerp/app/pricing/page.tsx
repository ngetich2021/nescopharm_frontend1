import { Suspense } from "react"
import AdditionalPricing from "./components/additional-pricing"
import CTASection from "./components/cta-section"
import FAQ from "./components/faq"
import PricingCards from "./components/pricing-card"
import PricingHeader from "./components/pricing-header"

export default function PricingPage() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <PricingHeader />
        <PricingCards />
        <AdditionalPricing />
        <FAQ />
        <CTASection />
      </Suspense>
    </main>
  )
}

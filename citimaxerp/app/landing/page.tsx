import type { Metadata } from "next"
import LandingPage from "../components/landing-page"

export const metadata: Metadata = {
  title: "Citimax - Enterprise Resource Management",
  description: "Simplify and automate your business processes and grow with Citimax",
}

export default function LandingPageRoute() {
  return (
    <div className="flex flex-col min-h-screen">
      <LandingPage />
    </div>
  )
}
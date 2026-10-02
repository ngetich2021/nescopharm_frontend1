"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Menu, Cloud, Zap, Shield, Globe, Rocket, Star, ArrowRight, TrendingUp } from "lucide-react"
import { Users, DollarSign, Megaphone, Package, Truck, Share2, CreditCard, BarChart2 } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

// ERP-focused features for business management
const features = [
  {
    title: "Sales Management",
    description: "Streamline your sales pipeline with comprehensive lead tracking, opportunity management, and deal closure tools designed for modern businesses.",
    icon: DollarSign,
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=900&auto=format&fit=crop&w=800&q=80",
    stats: "Streamlined sales process",
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Marketing & Campaigns",
    description: "Create and manage marketing campaigns across multiple channels with built-in analytics and customer engagement tracking.",
    icon: Megaphone,
    image: "https://images.unsplash.com/photo-1665799871677-f1fd17338b43?q=80&w=2228&auto=format&fit=crop&w=800&q=80",
    stats: "Multi-channel campaigns",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    title: "Inventory Control",
    description: "Complete inventory management with real-time stock tracking, automated reordering, and supplier management capabilities.",
    icon: Package,
    image: "https://images.unsplash.com/photo-1749244768351-2726dc23d26c?q=80&w=2224&auto=format&fit=crop&w=800&q=80",
    stats: "Real-time stock control",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Customer Relationship Management",
    description: "Build stronger customer relationships with comprehensive contact management, interaction history, and personalized communication tools.",
    icon: Users,
    image: "https://images.unsplash.com/photo-1747660723131-e46a1776da45?q=80&w=2340&auto=format&fit=crop&w=800&q=80",
    stats: "360° customer view",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Supply Chain & Logistics",
    description: "Optimize your supply chain operations with delivery tracking, route planning, and comprehensive logistics management.",
    icon: Truck,
    image: "https://images.unsplash.com/photo-1485575301924-6891ef935dcd?q=80&w=2340&auto=format&fit=crop&w=800&q=80",
    stats: "Optimized operations",
    gradient: "from-amber-500 to-amber-600",
  },
  {
    title: "Social Media Integration",
    description: "Connect your social media channels with integrated posting, monitoring, and customer engagement across platforms.",
    icon: Share2,
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    stats: "Unified social presence",
    gradient: "from-sky-500 to-sky-600",
  },
  {
    title: "Financial Management",
    description: "Comprehensive financial tools including invoicing, payment processing, expense tracking, and financial reporting.",
    icon: CreditCard,
    image: "https://images.unsplash.com/photo-1707157284454-553ef0a4ed0d?q=80&w=2340&auto=format&fit=crop&w=800&q=80",
    stats: "Complete financial control",
    gradient: "from-green-500 to-green-600",
  },
  {
    title: "Business Analytics",
    description: "Make informed decisions with comprehensive reporting, data visualization, and business intelligence dashboards.",
    icon: BarChart2,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    stats: "Data-driven insights",
    gradient: "from-indigo-500 to-indigo-600",
  },
]

// Cloud service benefits
const cloudBenefits = [
  {
    title: "99.9% Uptime Guarantee",
    description: "Enterprise-grade infrastructure with automatic failover and disaster recovery",
    icon: Shield,
  },
  {
    title: "Global Scale",
    description: "Serve customers worldwide with edge computing and CDN acceleration",
    icon: Globe,
  },
  {
    title: "Lightning Fast",
    description: "Sub-second response times with optimized cloud architecture",
    icon: Zap,
  },
  {
    title: "Auto-Scaling",
    description: "Handle traffic spikes seamlessly with intelligent resource allocation",
    icon: TrendingUp,
  },
]

// Primary brand color - modern and appealing
const primaryColor = "#1E2764"
const signupFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfDiDahIMbcr_Gcl3SIJ5MLXYofSJM1ynPzutDnTwmbFd62yw/viewform?usp=dialog"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section with Cloud Theme */}
      <section className="relative min-h-screen overflow-hidden bg-white">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Floating cloud elements */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-50 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-blue-100/60 rounded-full blur-lg animate-bounce"></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-blue-50 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/3 w-28 h-28 bg-blue-100/40 rounded-full blur-xl animate-bounce"></div>
          
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJtIDYwIDAgTCAwIDAgMCA2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRDIwOTJEIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMDUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        </div>

        {/* Navigation */}
        <nav className="relative z-50 bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <Link href="/" className="flex items-center">
                  <img src="/logo.png" alt="Citimax Logo" className="h-8 object-contain" />
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-8">
                {/* Navigation links removed */}
              </div>

              {/* Mobile Menu */}
              <div className="flex md:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-900">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] bg-white border-gray-200">
                    <div className="flex items-center mb-8">
                      <img src="/logo.png" alt="Citimax Logo" className="h-6 object-contain" />
                    </div>
                    <nav className="grid gap-4">
                      {/* Navigation links removed */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <Link href="/" className="text-gray-900 hover:text-[#1E2764] transition-colors py-2 block" onClick={() => setMobileMenuOpen(false)}>
                          Sign In
                        </Link>
                        <Button asChild className="w-full mt-3 bg-gradient-to-r from-[#1E2764] to-blue-600 hover:from-blue-700 hover:to-blue-800">
                          <a href={signupFormUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}>
                            Get Started Free
                          </a>
                        </Button>
                      </div>
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Desktop Auth */}
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/" className="text-gray-900 hover:text-[#1E2764] transition-colors font-medium">
                  Sign In
                </Link>
                <Button asChild className="bg-gradient-to-r from-[#1E2764] to-blue-600 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <a href={signupFormUrl} target="_blank" rel="noopener noreferrer">
                    Get Started Free
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 mt-16">
          <div className="max-w-5xl mx-auto text-center">
            {/* Trust badges */}
            <div className="flex justify-center items-center gap-6 mb-8 opacity-70">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Shield className="h-4 w-4" />
                <span>100% Data Protection</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Globe className="h-4 w-4" />
                <span>99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Zap className="h-4 w-4" />
                <span>Lightning Fast</span>
              </div>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
              Transform Your Business with
              <span className="block bg-gradient-to-r from-[#1E2764] via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Citimax ERP Solution
              </span>
            </h1>

            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
              Introducing Citimax - the comprehensive ERP platform designed to streamline your business operations, 
              boost productivity, and drive growth. Built for modern businesses ready to scale.
            </p>

            {/* Social proof stats */}
            <div className="flex justify-center items-center gap-8 mb-12 text-gray-500">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#1E2764]">All-in-One</div>
                <div className="text-sm">ERP Platform</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#1E2764]">Cloud-Based</div>
                <div className="text-sm">Technology</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#1E2764]">99.9%</div>
                <div className="text-sm">Uptime SLA</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center items-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-[#1E2764] to-blue-600 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 px-8 py-4 text-lg font-semibold">
                <a href={signupFormUrl} target="_blank" rel="noopener noreferrer">
                  <Rocket className="mr-2 h-5 w-5" />
                  Start Free Trial Today
                </a>
              </Button>
            </div>

            {/* Trust indicators */}
            <p className="text-gray-500 text-sm mt-6">
              ✓ No credit card required • ✓ Setup in under 5 minutes • ✓ Cancel anytime
            </p>
          </div>
        </div>

        {/* Floating dashboard preview */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 hidden lg:block">
          <div className="relative w-[800px] h-[400px] bg-gray-50 backdrop-blur-md rounded-xl border border-gray-200 shadow-2xl">
            <div className="absolute inset-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="p-6 text-gray-700 text-sm">
                <div className="mb-4 font-semibold text-[#1E2764]">Citimax Dashboard</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/80 rounded p-3 border border-gray-200">
                    <div className="text-2xl font-bold text-[#1E2764]">Ksh. 2.4M</div>
                    <div className="text-xs text-gray-600">Revenue This Month</div>
                  </div>
                  <div className="bg-white/80 rounded p-3 border border-gray-200">
                    <div className="text-2xl font-bold text-[#1E2764]">15,432</div>
                    <div className="text-xs text-gray-600">Active Customers</div>
                  </div>
                  <div className="bg-white/80 rounded p-3 border border-gray-200">
                    <div className="text-2xl font-bold text-[#1E2764]">94%</div>
                    <div className="text-xs text-gray-600">Customer Satisfaction</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Creative Design */}
      <section className="py-16 sm:py-20 md:py-24 relative overflow-hidden" id="features">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gray-50"></div>
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+CjxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDYwIDYwTTYwIDBMMCA2MCIgc3Ryb2tlPSIjRTMwMDQwIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMiI+PC9wYXRoPgo8L3N2Zz4=')]"></div>
        </div>

        {/* Decorative Elements */}
        <div
          className="absolute top-20 left-10 w-64 h-64 rounded-full"
          style={{ background: `radial-gradient(circle, ${primaryColor}10 0%, transparent 70%)` }}
        ></div>
        <div
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full"
          style={{ background: `radial-gradient(circle, ${primaryColor}10 0%, transparent 70%)` }}
        ></div>

        <div className="container px-4 sm:px-6 md:px-8 mx-auto relative z-10">
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center mb-12 sm:mb-16">
            <div
              className="inline-flex items-center px-3 py-1 rounded-full"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <span className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>
                All-in-One Solution
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter text-gray-900">
                Everything You Need to Grow Your Business
              </h2>
              <p className="max-w-[900px] text-sm sm:text-base md:text-lg text-gray-500 mx-auto">
                Cherry provides a comprehensive suite of tools to manage every aspect of your business operations.
              </p>
            </div>
          </div>

          {/* Creative Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <div key={feature.title} className="group relative">
                {/* Card with 3D effect */}
                <div className="absolute inset-0 rounded-2xl bg-white transform group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300"></div>
                <div
                  className="absolute inset-0 rounded-2xl transform group-hover:translate-x-1 group-hover:translate-y-1 transition-transform duration-300"
                  style={{ backgroundColor: `${primaryColor}20` }}
                ></div>

                <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-300 group-hover:shadow-md z-10">
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={feature.image || "/placeholder.svg"}
                      alt={feature.title}
                      width={400}
                      height={200}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                    {/* Animated icon overlay */}
                    <div
                      className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <feature.icon className="w-5 h-5" />
                    </div>

                    {/* Feature number */}
                    <div className="absolute bottom-4 left-4 text-3xl font-bold text-white/30">
                      {(index + 1).toString().padStart(2, "0")}
                    </div>
                  </div>

                  <div className="p-6 relative">
                    {/* Decorative element */}
                    <div
                      className="absolute -top-3 left-6 w-10 h-1 rounded-full transition-all duration-300 group-hover:w-16"
                      style={{ backgroundColor: primaryColor }}
                    ></div>

                    <h3 className="text-lg font-bold mb-2 group-hover:text-[#1E2764] transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center relative">
            {/* Decorative line */}
            <div
              className="absolute left-1/2 -top-8 transform -translate-x-1/2 w-16 h-0.5"
              style={{ backgroundColor: primaryColor }}
            ></div>

            <Link href={signupFormUrl} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="text-white shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden group"
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                <span className="relative z-10">Explore All Features</span>
                <ArrowRight className="relative z-10 ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />

                {/* Button hover effect */}
                <span className="absolute inset-0 h-full w-0 bg-black/10 transition-all duration-300 group-hover:w-full"></span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-white" id="how-it-works">
        <div className="container px-4 sm:px-6 md:px-8 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center mb-12 sm:mb-16">
            <div
              className="inline-flex items-center px-3 py-1 rounded-full"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <span className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>
                Simple Process
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter text-gray-900">
                How Citimax ERP Works
              </h2>
              <p className="max-w-[900px] text-sm sm:text-base md:text-lg text-gray-500 mx-auto">
                Get up and running with Citimax ERP in just three simple steps
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute left-1/2 top-24 bottom-24 w-0.5 bg-gray-100 hidden md:block"></div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="relative flex flex-col items-center text-center">
                <div
                  className="w-16 h-16 mb-6 rounded-full flex items-center justify-center text-white relative z-10"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="text-xl font-bold">1</span>
                  <div
                    className="absolute -inset-3 rounded-full border border-dashed"
                    style={{ borderColor: `${primaryColor}30` }}
                  ></div>
                </div>
                <h3 className="text-xl font-bold mb-3">Sign Up & Import</h3>
                <p className="text-gray-600 text-sm">
                  Create your account and import your existing customer data with our easy-to-use migration tools.
                </p>
                <div className="mt-6 h-40 w-full relative rounded-lg overflow-hidden shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1747660723131-e46a1776da45?q=80&w=2340&auto=format&fit=crop&w=800&q=80"
                    alt="Sign up and import"
                    width={300}
                    height={160}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col items-center text-center md:mt-24">
                <div
                  className="w-16 h-16 mb-6 rounded-full flex items-center justify-center text-white relative z-10"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="text-xl font-bold">2</span>
                  <div
                    className="absolute -inset-3 rounded-full border border-dashed"
                    style={{ borderColor: `${primaryColor}30` }}
                  ></div>
                </div>
                <h3 className="text-xl font-bold mb-3">Customize & Connect</h3>
                <p className="text-gray-600 text-sm">
                  Tailor the platform to your needs and connect your existing tools and communication channels.
                </p>
                <div className="mt-6 h-40 w-full relative rounded-lg overflow-hidden shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1558655146-d09347e92766?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                    alt="Customize and connect"
                    width={300}
                    height={160}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col items-center text-center">
                <div
                  className="w-16 h-16 mb-6 rounded-full flex items-center justify-center text-white relative z-10"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="text-xl font-bold">3</span>
                  <div
                    className="absolute -inset-3 rounded-full border border-dashed"
                    style={{ borderColor: `${primaryColor}30` }}
                  ></div>
                </div>
                <h3 className="text-xl font-bold mb-3">Engage & Grow</h3>
                <p className="text-gray-600 text-sm">
                  Start engaging with your customers more effectively and watch your business relationships flourish.
                </p>
                <div className="mt-6 h-40 w-full relative rounded-lg overflow-hidden shadow-md">
                  <Image
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                    alt="Engage and grow"
                    width={300}
                    height={160}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-16 text-center">
            <Link href={signupFormUrl} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="text-white shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden group"
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                <span className="relative z-10">Get Started Today</span>
                <ArrowRight className="relative z-10 ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                <span className="absolute inset-0 h-full w-0 bg-black/10 transition-all duration-300 group-hover:w-full"></span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJtIDYwIDAgTCAwIDAgMCA2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-[#1E2764] text-sm font-semibold mb-8">
              <Rocket className="mr-2 h-4 w-4" />
              Get Started for Free
            </div>
            
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Ready to Transform Your Business?
              <span className="block bg-gradient-to-r from-[#1E2764] to-blue-600 bg-clip-text text-transparent">
                Experience Citimax ERP
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Be among the first to experience the future of business management. 
              Start your free trial today and discover what Citimax ERP can do for your business.
            </p>
            
            <div className="flex justify-center items-center mb-12">
              <Button asChild size="lg" className="bg-gradient-to-r from-[#1E2764] to-blue-600 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 px-10 py-5 text-xl font-bold">
                <a href={signupFormUrl} target="_blank" rel="noopener noreferrer">
                  <Rocket className="mr-3 h-6 w-6" />
                  Start Your Free Trial
                </a>
              </Button>
            </div>
            
            <div className="flex justify-center items-center space-x-8 text-gray-500">
              <div className="flex items-center">
                <Shield className="h-5 w-5 mr-2 text-[#1E2764]" />
                <span className="text-sm">Enterprise Security</span>
              </div>
              <div className="flex items-center">
                <Globe className="h-5 w-5 mr-2 text-[#1E2764]" />
                <span className="text-sm">Global Infrastructure</span>
              </div>
              <div className="flex items-center">
                <Star className="h-5 w-5 mr-2 text-[#1E2764]" />
                <span className="text-sm">5-Star Support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <img src="/logo.png" alt="Citimax Logo" className="h-8 object-contain bg-white rounded px-2 center"/>
                <span className="text-xl font-bold text-gray-900"></span>
              </div>
              <p className="text-gray-600 max-w-md">
                Comprehensive ERP solution designed to streamline your business operations and drive growth.
              </p>
            </div>
            
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} Citimax. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

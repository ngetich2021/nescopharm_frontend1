"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Main navigation items for the landing page
const mainNavItems = [
  { name: "Features", href: "/#features" },
  { name: "About Us", href: "/#about" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Contact Us", href: "/contact" },
]

export function TopNav() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <span className="text-xl font-semibold text-gray-800">Cherry</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {mainNavItems.map((item) => (
              <Link key={item.name} href={item.href}>
                <span className="text-sm font-medium hover:text-blue-600 transition-colors">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <div className="py-4">
                  <Link href="/" className="flex items-center space-x-2 mb-6">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                    </div>
                    <span className="text-xl font-semibold text-gray-800">Cherry</span>
                  </Link>
                  <nav className="flex flex-col space-y-4">
                    {mainNavItems.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="block px-3 py-2 text-base font-medium rounded-md hover:bg-muted"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex flex-col space-y-3 px-3">
                      <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-center">
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/sign-up" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700">Start for Free</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">Start for Free</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

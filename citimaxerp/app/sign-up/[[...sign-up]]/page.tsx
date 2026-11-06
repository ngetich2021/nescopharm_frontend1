"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, User, Building2, Mail } from "lucide-react"

type Step = 1 | 2 | 3 | 4

interface FormData {
  // Step 1: Account
  email: string
  // Step 2: Personal
  firstName: string // Kept for UI input
  lastName: string // Kept for UI input
  phone: string
  // Step 3: Company
  companyName: string
  companyEmail: string
  companyPhone: string
}

export default function SignUpPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { signUp } = useAuth()

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    companyEmail: "",
    companyPhone: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [emailSent, setEmailSent] = useState(false)

  const steps = [
    { number: 1, title: "Account", icon: Mail, description: "Your login email" },
    { number: 2, title: "Personal", icon: User, description: "Tell us about yourself" },
    { number: 3, title: "Company", icon: Building2, description: "Set up your company" },
    { number: 4, title: "Complete", icon: CheckCircle, description: "Review and finish" },
  ]

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.email.trim()) newErrors.email = "Email is required"
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Please enter a valid email"
        break

      case 2:
        if (!formData.firstName.trim()) newErrors.firstName = "First name is required"
        if (!formData.lastName.trim()) newErrors.lastName = "Last name is required"
        if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
        break

      case 3:
        if (!formData.companyName.trim()) newErrors.companyName = "Company name is required"
        if (formData.companyEmail && !/\S+@\S+\.\S+/.test(formData.companyEmail)) {
          newErrors.companyEmail = "Please enter a valid email"
        }
        break
    }

    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0
    return isValid
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4) as Step)
    } else {
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as Step)
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      return
    }

    setIsLoading(true)

    try {
      const { error } = await signUp(
        formData.email.trim(),
        { firstName: formData.firstName.trim(), lastName: formData.lastName.trim(), phone: formData.phone.trim() },
        { name: formData.companyName.trim(), email: formData.companyEmail.trim(), phone: formData.companyPhone.trim() },
      )

      if (error) {
        toast({
          title: "Signup failed",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        })
        return
      }

      setEmailSent(true)
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    // ... (no changes needed here, as it's just rendering UI)
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Mail className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-xl font-semibold">Create Your Account</h3>
              <p className="text-gray-600">We&apos;ll email you a link to set your password</p>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={errors.email ? "border-red-500" : ""}
                placeholder="you@company.com"
                autoFocus
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <User className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-xl font-semibold">Personal Information</h3>
              <p className="text-gray-600">Help us personalize your experience</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className={errors.firstName ? "border-red-500" : ""}
                  placeholder="John"
                  autoFocus
                />
                {errors.firstName && <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className={errors.lastName ? "border-red-500" : ""}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
                placeholder="+254712345678"
              />
              {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-xl font-semibold">Company Setup</h3>
              <p className="text-gray-600">Set up your company profile</p>
            </div>

            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                className={errors.companyName ? "border-red-500" : ""}
                placeholder="Acme Corporation"
                autoFocus
              />
              {errors.companyName && <p className="text-sm text-red-500 mt-1">{errors.companyName}</p>}
            </div>

            <div>
              <Label htmlFor="companyEmail">Company Email (Optional)</Label>
              <Input
                id="companyEmail"
                type="email"
                value={formData.companyEmail}
                onChange={(e) => handleInputChange("companyEmail", e.target.value)}
                className={errors.companyEmail ? "border-red-500" : ""}
                placeholder="info@company.com"
              />
              {errors.companyEmail && <p className="text-sm text-red-500 mt-1">{errors.companyEmail}</p>}
              <p className="text-sm text-gray-500 mt-1">Leave blank to use your personal email</p>
            </div>

            <div>
              <Label htmlFor="companyPhone">Company Phone (Optional)</Label>
              <Input
                id="companyPhone"
                type="tel"
                value={formData.companyPhone}
                onChange={(e) => handleInputChange("companyPhone", e.target.value)}
                placeholder="+254712345678"
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-xl font-semibold">Ready to Get Started!</h3>
              <p className="text-gray-600">Review your information and create your account</p>
            </div>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Account</h4>
                <p className="text-sm text-gray-600">{formData.email}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">Personal</h4>
                <p className="text-sm text-gray-600">
                  {formData.firstName} {formData.lastName}
                  {formData.phone && ` • ${formData.phone}`}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">Company</h4>
                <p className="text-sm text-gray-600">
                  {formData.companyName}
                  {formData.companyEmail && ` • ${formData.companyEmail}`}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>We&apos;ll email you a link to set your password (it works for 24 hours)</li>
                      <li>You&apos;ll be the administrator for your company</li>
                      <li>Then log in with your email and new password</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  const progress = (currentStep / 4) * 100

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Mail className="h-12 w-12 text-blue-600 mx-auto mb-3" />
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              Your account is created. We sent a link to set your password to <span className="font-semibold text-gray-900">{formData.email.trim()}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-gray-600">
            <p>Look in your spam folder if it isn&apos;t in your inbox. The link works for 24 hours.</p>
            <Button className="w-full" onClick={() => router.push("/sign-in")}>Go to login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/logo.png" alt="Citimax Logo" className="h-12 object-contain mb-2" style={{ width: 'auto', maxWidth: 180 }} />
        </div>
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Join CitiMax ERP</h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in here
            </Link>
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            {steps.map((step) => (
              <div
                key={step.number}
                className={`flex flex-col items-center ${
                  currentStep >= step.number ? "text-blue-600" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    currentStep > step.number ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep > step.number ? <CheckCircle className="h-4 w-4" /> : step.number}
                </div>
                <span className="mt-1 text-xs">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Step {currentStep} of 4</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep < 4 ? (
                <Button onClick={nextStep} className="flex items-center">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isLoading} className="flex items-center">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <CheckCircle className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

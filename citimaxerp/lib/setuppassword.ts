import apiCall from "@/lib/api"

interface SetPasswordPayload {
  token: string
  password: string
  password_confirmation: string
}

interface SetPasswordResponse {
  status: "success" | "failed"
  message: string
  data?: {
    user?: any
    token?: string
  }
}

export async function setPassword(userId: string, data: SetPasswordPayload): Promise<SetPasswordResponse> {
  try {
    const response = await apiCall<SetPasswordResponse>(
      `/users/${userId}/set-password`,
      "POST",
      data,
      false // No auth required for setting password
    )
    return response
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.message) {
      // Handle specific error cases
      if (error.message.includes("Invalid or expired token") || error.message.includes("Token has expired")) {
        throw new Error("This password reset link has expired or is invalid. Please request a new one.")
      }
      if (error.message.includes("Email not verified")) {
        throw new Error("Your email address has not been verified. Please verify your email first.")
      }
      throw new Error(error.message)
    }
    throw new Error("Failed to set password. Please try again.")
  }
}
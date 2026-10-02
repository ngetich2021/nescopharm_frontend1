import apiCall from "@/lib/api"

interface SendPasswordResetLinkPayload {
    email: string
}

interface SendPasswordResetLinkResponse {
    status: "success" | "failed"
    message: string | Record<string, string[]>
}

/**
 * Send password reset link to user's email
 * @param email - User's email address
 * @returns Promise with success/error response
 */
export async function sendPasswordResetLink(email: string): Promise<SendPasswordResetLinkResponse> {
    try {
        const response = await apiCall<SendPasswordResetLinkResponse>(
            `/users/send-password-reset-link`,
            "POST",
            { email },
            false // No auth required for sending reset link
        )
        return response
    } catch (error: any) {
        // Handle validation errors
        if (error.message && typeof error.message === 'object') {
            throw new Error(Object.values(error.message).flat().join(' '))
        }
        throw new Error(error.message || "Failed to send password reset link. Please try again.")
    }
}

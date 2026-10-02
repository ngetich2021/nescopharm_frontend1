import apiCall from "./api";

interface MediaUploadResponse {
  url: any;
  status: string;
  data?: any;
  message?: string;
}

/**
 * Uploads a file to the server using FormData
 * @param file The file to upload
 * @param folder The folder to store the file in
 * @returns URL of the uploaded file
 */
export const uploadMedia = async (file: File, folder = "whatsapp-media") => {
    try {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            throw new Error("uploadMedia must be called client-side");
        }
        
        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);
        
        // Get token for authorization
        const token = localStorage.getItem("token");
        if (!token) {
            throw new Error("Authentication required, but no token found.");
        }
        
        // Use apiCall for file upload
        const response = await apiCall<MediaUploadResponse>("/media/upload", "POST", formData, true);

        if (response.status === "success" && response.data) {
            return response.data as MediaUploadResponse;
        } else {
            const errorMessage = typeof response.message === "string" 
                ? response.message 
                : "Failed to upload media";
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        throw new Error(`Failed to upload file: ${error.message || "Unknown error"}`);
    }
};

"use client";

import { logToFile } from "@/lib/logger";

export async function sendWhatsAppMessage(to: string, message: string) {
    try {
        const response = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ to, message }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`WhatsApp API error: ${response.status} ${errorData}`);
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        await logToFile(`Error sending WhatsApp message: ${error}`, "error");
        return null;
    }
}

/**
 * Sends a media message via WhatsApp with an optional caption
 * This sends a single message that includes both the media and caption
 */
export async function sendWhatsAppMedia(
    to: string,
    file: File,
    type: "image" | "video" | "audio" | "document",
    caption?: string
) {
    try {
        // 1. First upload to Supabase to get public URL
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", file.type);

        const uploadResponse = await fetch("/api/whatsapp/upload-media", {
            method: "POST",
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);
        }

        const { id, url } = await uploadResponse.json();

        // 2. Then upload to WhatsApp to get media ID
        const whatsappUploadResponse = await fetch("/api/whatsapp/upload-whatsapp-media", {
            method: "POST",
            body: formData,
        });

        if (!whatsappUploadResponse.ok) {
            const errorData = await whatsappUploadResponse.json();
            throw new Error(`WhatsApp upload failed: ${JSON.stringify(errorData)}`);
        }

        const { mediaId } = await whatsappUploadResponse.json();

        // 3. Now send the message with the WhatsApp media ID
        const messageResponse = await fetch("/api/whatsapp/send-media", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to,
                mediaId,
                type,
                caption: caption || undefined,
            }),
        });

        if (!messageResponse.ok) {
            const errorData = await messageResponse.json();
            throw new Error(`Send failed: ${JSON.stringify(errorData)}`);
        }

        return {
            ...await messageResponse.json(),
            mediaId: id,
            mediaUrl: url
        };
    } catch (error) {
        throw error;
    }
}

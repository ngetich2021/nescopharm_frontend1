"use client";

import React from "react";
import { FileText } from "lucide-react";

interface AttachmentPreviewProps {
    attachment: {
        file: File | null;
        type: "image" | "video" | "audio" | "document" | null;
        previewUrl: string | null;
    };
    removeAttachment: () => void;
}

export function AttachmentPreview({ attachment, removeAttachment }: AttachmentPreviewProps) {
    return (
        <div className="relative mb-2 p-2 bg-gray-100 rounded-lg">
            {attachment.type === "image" && attachment.previewUrl && (
                <img
                    src={attachment.previewUrl}
                    alt="Attachment preview"
                    className="max-w-[200px] max-h-[200px] rounded"
                />
            )}
            {attachment.type === "video" && attachment.previewUrl && (
                <video
                    src={attachment.previewUrl}
                    controls
                    className="max-w-[200px] max-h-[200px] rounded"
                />
            )}
            {attachment.type === "audio" && (
                <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    <span>{attachment.file?.name}</span>
                </div>
            )}
            {attachment.type === "document" && (
                <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    <span>{attachment.file?.name}</span>
                </div>
            )}
            <button
                onClick={removeAttachment}
                className="absolute top-1 right-1 bg-gray-200 rounded-full p-1 hover:bg-gray-300"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    );
}

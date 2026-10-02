"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X } from "lucide-react";
import { uploadDocument } from "@/lib/documents";

interface DocumentUploadProps {
  documentableType: string;
  documentableId: string;
  onUploadSuccess?: () => void;
}

export function DocumentUpload({ documentableType, documentableId, onUploadSuccess }: DocumentUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [regulatoryBody, setRegulatoryBody] = useState("");
  const [otherInformation, setOtherInformation] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL for images
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (document.getElementById("document-file")) {
      (document.getElementById("document-file") as HTMLInputElement).value = "";
    }
  };

  const validateForm = () => {
    if (!documentName.trim()) {
      toast({
        title: "Validation Error",
        description: "Document name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!selectedFile) {
      toast({
        title: "Validation Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsUploading(true);
    try {
      // Get company ID from localStorage or context
      const companyId = localStorage.getItem("companyId") || "";
      
      if (!companyId) {
        throw new Error("Company ID is missing");
      }

      await uploadDocument({
        document_name: documentName,
        reference_number: referenceNumber || undefined,
        expiry_date: expiryDate || undefined,
        regulatory_body: regulatoryBody || undefined,
        other_information: otherInformation || undefined,
        documentable_type: documentableType,
        documentable_id: documentableId,
        document_image: selectedFile!, // Asserting that selectedFile is not null
        company_id: companyId,
      });

      toast({
        title: "Success! ✅",
        description: "Document uploaded successfully",
      });

      // Reset form
      setDocumentName("");
      setReferenceNumber("");
      setExpiryDate("");
      setRegulatoryBody("");
      setOtherInformation("");
      removeFile();
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name *</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Business License, ID, etc."
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference-number">Reference Number (Optional)</Label>
            <Input
              id="reference-number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="REF-12345"
              disabled={isUploading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Expiry Date (Optional)</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regulatory-body">Regulatory Body (Optional)</Label>
              <Input
                id="regulatory-body"
                value={regulatoryBody}
                onChange={(e) => setRegulatoryBody(e.target.value)}
                placeholder="Issuing authority"
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="other-information">Other Information (Optional)</Label>
            <Input
              id="other-information"
              value={otherInformation}
              onChange={(e) => setOtherInformation(e.target.value)}
              placeholder="Additional details"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-file">Document File *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="document-file"
                type="file"
                onChange={handleFileChange}
                accept="image/*,application/pdf,text/*"
                disabled={isUploading}
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {previewUrl && (
              <div className="mt-2">
                <img 
                  src={previewUrl} 
                  alt="Document preview" 
                  className="max-h-40 rounded border"
                />
              </div>
            )}
            
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={isUploading || !documentName || !selectedFile}
            className="bg-[primary] hover:bg-[primary]/90 text-white"
          >
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
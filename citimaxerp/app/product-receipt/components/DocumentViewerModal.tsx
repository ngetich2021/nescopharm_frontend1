"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Eye,
  File,
  Image,
  FileImage,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string | null;
  documentName?: string;
  receiptNumber?: string;
}

export function DocumentViewerModal({
  open,
  onOpenChange,
  documentUrl,
  documentName = "Document",
  receiptNumber
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentBlob, setDocumentBlob] = useState<string | null>(null);

  if (!documentUrl) return null;

  const getFileExtension = (url: string): string => {
    const urlWithoutQuery = url.split('?')[0]; // Remove query parameters
    return urlWithoutQuery.split('.').pop()?.toLowerCase() || '';
  };

  const getFileType = (url: string): 'pdf' | 'image' | 'text' | 'other' => {
    const extension = getFileExtension(url);
    if (extension === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) return 'image';
    if (['txt', 'csv', 'json', 'xml'].includes(extension)) return 'text';
    return 'other';
  };

  const fileType = getFileType(documentUrl);
  const fileExtension = getFileExtension(documentUrl);

  // Load document when modal opens
  useEffect(() => {
    if (open && documentUrl) {
      setLoading(true);
      setError(null);
      setDocumentBlob(null);
      
      // For images, we can load them directly
      if (fileType === 'image') {
        console.log('Loading image document:', documentUrl);
        // Test if image loads successfully
        const img = document.createElement('img');
        img.onload = () => {
          console.log('Image loaded successfully');
          setDocumentBlob(documentUrl);
          setLoading(false);
        };
        img.onerror = () => {
          console.error('Image loading error');
          setError('Failed to load image. The image may be corrupted or the URL is invalid.');
          setLoading(false);
        };
        img.src = documentUrl;
      } else if (fileType === 'pdf') {
        console.log('Loading PDF document:', documentUrl);
        // For PDFs, try to load and create blob URL for better compatibility
        loadPdfDocument(documentUrl);
      } else if (fileType === 'text') {
        console.log('Loading text document:', documentUrl);
        // For text files, try to fetch and display
        loadTextDocument(documentUrl);
      } else {
        console.log('Unsupported file type:', fileType);
        // For other files, just show download options
        setLoading(false);
      }
    }
  }, [open, documentUrl, fileType]);

  const loadPdfDocument = async (url: string) => {
    try {
      console.log('Loading PDF document:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf,*/*'
        }
      });
      
      console.log('PDF fetch response status:', response.status);
      console.log('PDF fetch response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('PDF blob type:', blob.type, 'size:', blob.size);
      
      if (blob.size === 0) {
        throw new Error('Document is empty');
      }
      
      if (blob.type === 'application/pdf' || url.toLowerCase().includes('.pdf')) {
        const blobUrl = URL.createObjectURL(blob);
        console.log('Created blob URL:', blobUrl);
        setDocumentBlob(blobUrl);
      } else {
        setError(`Invalid document type: ${blob.type}`);
      }
    } catch (err: any) {
      console.error('PDF loading error:', err);
      setError(`Failed to load PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTextDocument = async (url: string) => {
    try {
      console.log('Loading text document:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log('Text document loaded, length:', text.length);
      setDocumentBlob(text);
    } catch (err: any) {
      console.error('Text loading error:', err);
      setError(`Failed to load text document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup blob URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (documentBlob && documentBlob.startsWith('blob:')) {
        URL.revokeObjectURL(documentBlob);
      }
    };
  }, [documentBlob]);

  const handleDownload = async () => {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName || `receipt-document.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab
      window.open(documentUrl, '_blank');
    }
  };

  const handleOpenExternal = () => {
    window.open(documentUrl, '_blank');
  };

  const renderDocumentViewer = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <div>
              <p className="text-gray-600 font-medium">Loading document...</p>
              <p className="text-sm text-gray-500">Please wait while we prepare your document</p>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-16 w-16 text-red-400 mx-auto" />
            <div>
              <p className="text-gray-600 font-medium">Unable to preview this document</p>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You can still download or open the document externally using the buttons below.
                  <br />
                  <span className="text-xs text-gray-400 mt-1 block">Document URL: {documentUrl}</span>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setError(null);
                        setLoading(true);
                        // Trigger reload
                        if (fileType === 'image') {
                          const img = document.createElement('img');
                          img.onload = () => {
                            setDocumentBlob(documentUrl);
                            setLoading(false);
                          };
                          img.onerror = () => {
                            setError('Failed to load image after retry');
                            setLoading(false);
                          };
                          img.src = documentUrl + '?retry=' + Date.now();
                        } else if (fileType === 'pdf') {
                          loadPdfDocument(documentUrl);
                        }
                      }}
                      className="text-xs"
                    >
                      Try Again
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      );
    }

    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex-1 border rounded-lg overflow-hidden bg-gray-50">
            {documentBlob ? (
              <>
                <iframe
                  src={`${documentBlob}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-full min-h-[600px] bg-white"
                  title="PDF Viewer"
                  style={{ border: 'none' }}
                />
                {/* Fallback message for PDFs that might not display */}
                <div className="text-center p-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    If the PDF doesn't display properly, try the "External" or "Download" buttons above.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">PDF preview not available</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Use the external view or download buttons above
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 rounded-lg">
            {documentBlob ? (
              <div className="max-w-full max-h-full overflow-auto">
                <img
                  src={documentBlob}
                  alt="Document"
                  className="max-w-full h-auto rounded-lg shadow-lg border bg-white"
                  style={{ maxHeight: '80vh' }}
                />
              </div>
            ) : (
              <div className="text-center">
                <Image className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Image preview not available</p>
              </div>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="flex-1 border rounded-lg overflow-hidden bg-gray-50">
            {documentBlob ? (
              <div className="w-full h-full p-4 bg-white overflow-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words max-w-full">
                  {documentBlob}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Text preview not available</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'other':
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <FileText className="h-16 w-16 text-gray-400 mx-auto" />
              <div>
                <p className="text-gray-600 font-medium">Preview not available</p>
                <p className="text-sm text-gray-500">
                  This file type (.{fileExtension}) cannot be previewed in the browser
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Use the download or external view options below
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  const getFileTypeIcon = () => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-600" />;
      case 'image':
        return <FileImage className="h-5 w-5 text-green-600" />;
      case 'text':
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <File className="h-5 w-5 text-gray-600" />;
    }
  };

  const getFileTypeBadge = () => {
    switch (fileType) {
      case 'pdf':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">PDF</Badge>;
      case 'image':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Image</Badge>;
      case 'text':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Text</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">{fileExtension.toUpperCase()}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl lg:max-w-6xl flex flex-col h-full">
        <SheetHeader className="border-b border-gray-200 pb-4">
          <SheetTitle className="flex items-center gap-2">
            {getFileTypeIcon()}
            Document Viewer
          </SheetTitle>
          <SheetDescription>
            {receiptNumber ? (
              <>Viewing document for receipt {receiptNumber}</>
            ) : (
              "Document preview"
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Document Info Bar */}
        <div className="py-3 px-1 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 truncate">{documentName}</span>
              {getFileTypeBadge()}
              {documentUrl && (
                <span className="text-xs text-gray-500 font-mono truncate max-w-xs">
                  {documentUrl.split('/').pop()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="flex items-center gap-2"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
                External
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
                title="Download document"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Document Viewer */}
        <div className="flex-1 overflow-hidden py-4">
          {renderDocumentViewer()}
        </div>

        <SheetFooter className="border-t border-gray-200 pt-4">
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                onClick={handleOpenExternal}
                className="bg-[#E30040] hover:bg-[#E30040]/90 text-white flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open External
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
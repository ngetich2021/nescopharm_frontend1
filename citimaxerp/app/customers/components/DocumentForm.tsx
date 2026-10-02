"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, FileText, Plus } from "lucide-react";

export interface DocumentData {
  id?: string; // For existing documents
  document_name: string;
  reference_number?: string;
  expiry_date?: string;
  regulatory_body?: string;
  other_information?: string;
  file?: File; // For new documents
  document_image?: string; // For existing documents (URL)
}

interface DocumentFormProps {
  documents: DocumentData[];
  onChange: (documents: DocumentData[]) => void;
}

export function DocumentForm({ documents, onChange }: DocumentFormProps) {
  const regulatoryBodies = [
    "Pharmacy and Poisons Board (PPB)",
    "Kenya Bureau of Standards (KEBS)",
    "Kenya Revenue Authority",
    "Register of Companies",
    "Energy and Petroleum Regulatory Authority (EPRA)",
    "National Environment Management Authority (NEMA)"
  ];

  const addDocument = () => {
    onChange([
      ...documents,
      {
        document_name: "",
        reference_number: "",
        expiry_date: "",
        regulatory_body: "",
        other_information: "",
      },
    ]);
  };

  const updateDocument = (index: number, field: keyof DocumentData, value: string | File | undefined) => {
    const updatedDocuments = [...documents];
    (updatedDocuments[index] as any)[field] = value;
    onChange(updatedDocuments);
  };

  const removeDocument = (index: number) => {
    const updatedDocuments = documents.filter((_, i) => i !== index);
    onChange(updatedDocuments);
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateDocument(index, "file", file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {documents.map((doc, index) => (
          <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Document {index + 1}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeDocument(index)}
                className="text-red-600 border-red-600 hover:bg-red-600/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`doc-name-${index}`}>Document Name *</Label>
              <Input
                id={`doc-name-${index}`}
                value={doc.document_name}
                onChange={(e) => updateDocument(index, "document_name", e.target.value)}
                placeholder="Business License, ID, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`doc-ref-${index}`}>Reference Number (Optional)</Label>
              <Input
                id={`doc-ref-${index}`}
                value={doc.reference_number || ""}
                onChange={(e) => updateDocument(index, "reference_number", e.target.value)}
                placeholder="REF-12345"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`doc-expiry-${index}`}>Expiry Date (Optional)</Label>
                <Input
                  id={`doc-expiry-${index}`}
                  type="date"
                  value={doc.expiry_date || ""}
                  onChange={(e) => updateDocument(index, "expiry_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`doc-regulatory-${index}`}>Regulatory Body (Optional)</Label>
                <Select
                  value={doc.regulatory_body || ""}
                  onValueChange={(value) => updateDocument(index, "regulatory_body", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select regulatory body" />
                  </SelectTrigger>
                  <SelectContent>
                    {regulatoryBodies.map((body) => (
                      <SelectItem key={body} value={body}>
                        {body}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`doc-other-${index}`}>Other Information (Optional)</Label>
              <Input
                id={`doc-other-${index}`}
                value={doc.other_information || ""}
                onChange={(e) => updateDocument(index, "other_information", e.target.value)}
                placeholder="Additional details"
              />
            </div>

            {doc.id ? (
              <div className="text-sm text-muted-foreground">
                {doc.document_image ? (
                  <div>
                    <p>Current document: {doc.document_name}</p>
                    <a 
                      href={doc.document_image} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Document
                    </a>
                  </div>
                ) : (
                  <p>Existing document: {doc.document_name}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`doc-file-${index}`}>Document File *</Label>
                <Input
                  id={`doc-file-${index}`}
                  type="file"
                  onChange={(e) => handleFileChange(index, e)}
                  accept="image/*,application/pdf,text/*"
                />
                {doc.file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {doc.file.name} ({(doc.file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addDocument}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Document
        </Button>
      </CardContent>
    </Card>
  );
}
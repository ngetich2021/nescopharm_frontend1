"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Mail,
    Phone,
    FileText,
    ChevronDown,
    Plus,
    X as XIcon,
    Pencil,
    Trash2,
} from "lucide-react";
import type { Conversation } from "./message-area";
import apiCall from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useRef } from "react";
import { assignConversation } from "@/lib/chat-api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCallback } from "react";

interface CustomerSidebarProps {
    conversation: Conversation;
}

const mockAgents = [
  { id: "1", name: "Alice Agent" },
  { id: "2", name: "Bob Support" },
  { id: "3", name: "Charlie Admin" },
];

const mockTags = ["VIP", "Billing", "Escalated", "New"];

const API_BASE = "/api/chat";

// Helper to get auth token (replace with your actual method)
function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sanctum_token");
  }
  return null;
}

export function CustomerSidebar({ conversation }: CustomerSidebarProps) {
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [assignedAgent, setAssignedAgent] = useState<string>(mockAgents[0].id);
    const [tags, setTags] = useState<string[]>(["VIP"]);
    const [newTag, setNewTag] = useState("");
    const [assignLoading, setAssignLoading] = useState(false);
    const [tagLoading, setTagLoading] = useState(false);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateContent, setNewTemplateContent] = useState("");

    // Local state for templates
    const [templates, setTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesError, setTemplatesError] = useState<string | null>(null);

    // Fetch templates from backend
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") {
          setTemplates(data.templates);
        } else {
          setTemplatesError(data.message || "Failed to load templates");
        }
      } catch (e: any) {
        setTemplatesError(e.message || "Failed to load templates");
      } finally {
        setTemplatesLoading(false);
      }
    };

    // Fetch on modal open
    const prevModalOpen = useRef(false);
    useEffect(() => {
      if (templateModalOpen && !prevModalOpen.current) {
        fetchTemplates();
      }
      prevModalOpen.current = templateModalOpen;
    }, [templateModalOpen]);

    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [editTemplateName, setEditTemplateName] = useState("");
    const [editTemplateContent, setEditTemplateContent] = useState("");

    const handleDeleteTemplate = useCallback((id: number) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const handleCreateTemplate = async () => {
      if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
      setCreateLoading(true);
      setCreateError(null);
      // Example payload, adjust as needed
      const payload = {
        name: newTemplateName.trim().toLowerCase().replace(/\s+/g, "_"),
        display_name: newTemplateName.trim(),
        platform: "whatsapp", // or allow user to select
        language: "en",
        category: "TRANSACTIONAL",
        header_type: "text",
        header_content: newTemplateName.trim(),
        body_content: newTemplateContent.trim(),
        footer_content: "",
        variables: Array.from(newTemplateContent.matchAll(/{{(.*?)}}/g)).map(m => m[1].trim()),
      };
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/templates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.status === "success") {
          setTemplates((prev) => [data.template, ...prev]);
          setShowNewTemplateForm(false);
          setNewTemplateName("");
          setNewTemplateContent("");
        } else {
          setCreateError(data.message || "Failed to create template");
        }
      } catch (e: any) {
        setCreateError(e.message || "Failed to create template");
      } finally {
        setCreateLoading(false);
      }
    };

    const handleEditTemplate = (template: { id: number; name: string; content: string }) => {
      setEditingTemplateId(template.id);
      setEditTemplateName(template.name);
      setEditTemplateContent(template.content);
    };

    const handleSaveEditTemplate = () => {
      if (!editTemplateName.trim() || !editTemplateContent.trim()) return;
      setTemplates((prev) => prev.map(t =>
        t.id === editingTemplateId ? { ...t, name: editTemplateName.trim(), content: editTemplateContent.trim() } : t
      ));
      setEditingTemplateId(null);
      setEditTemplateName("");
      setEditTemplateContent("");
    };

    const handleCancelEditTemplate = () => {
      setEditingTemplateId(null);
      setEditTemplateName("");
      setEditTemplateContent("");
    };

    const socketService = useWebSocket();

    useEffect(() => {
      if (!socketService) return;
      const handleConversationUpdate = (update: any) => {
        if (update.id === conversation.id) {
          if (update.assigned_agent_id) setAssignedAgent(update.assigned_agent_id);
          if (update.tags) setTags(update.tags);
        }
      };
      socketService.onConversationUpdate(handleConversationUpdate);
      return () => {
        socketService.off("conversation_update");
      };
    }, [socketService, conversation.id]);

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    const handleAssignAgent = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const agentId = e.target.value;
      setAssignedAgent(agentId);
      setAssignLoading(true);
      try {
        await assignConversation(conversation.id, agentId);
        toast({ title: "Assigned", description: "Conversation assigned successfully." });
      } catch (error: any) {
        toast({ title: "Error", description: error?.message || "Failed to assign agent.", variant: "destructive" });
      } finally {
        setAssignLoading(false);
      }
    };

    // Tag add/remove functionality is disabled due to missing API functions
    const handleAddTag = async () => {
      if (!newTag || tags.includes(newTag)) return;
      setTags([...tags, newTag]);
      setNewTag("");
      toast({ title: "Tag added", description: `Tag '${newTag}' added.` });
    };

    const handleRemoveTag = async (tag: string) => {
      setTags(tags.filter((t) => t !== tag));
      toast({ title: "Tag removed", description: `Tag '${tag}' removed.` });
    };

    return (
        <div className="w-full lg:w-80 border-l border-b border-r border-gray-200 bg-white overflow-y-auto shadow-lg max-h-full flex flex-col">
            <div className="p-6 space-y-6">
                {/* Assignment & Tags */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-4">
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Assigned Agent</label>
                    <select
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={assignedAgent}
                      onChange={handleAssignAgent}
                      disabled={assignLoading}
                    >
                      {mockAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium">
                          {tag}
                          <button
                            className="ml-1 text-blue-400 hover:text-red-500"
                            onClick={() => handleRemoveTag(tag)}
                            aria-label={`Remove tag ${tag}`}
                            disabled={tagLoading}
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs flex-1"
                        placeholder="Add tag"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                      />
                      <Button size="sm" variant="outline" onClick={handleAddTag} disabled={tagLoading}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {/* Customer info card removed as per user request */}

                {/* Orders Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleSection("orders")}
                  >
                    <h3 className="text-base font-semibold text-gray-900">Orders</h3>
                    <ChevronDown
                      className={`h-5 w-5 ml-2 transition-transform ${openSection === "orders" ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className={`transition-all duration-200 overflow-hidden ${openSection === "orders" ? "max-h-96 mt-3" : "max-h-0"}`}>
                    {openSection === "orders" && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Order #1234</span>
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Delivered</span>
                          </div>
                          <div className="text-sm text-gray-600">Ksh. 120.00</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payments Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleSection("payments")}
                  >
                    <h3 className="text-base font-semibold text-gray-900">Payments</h3>
                    <ChevronDown
                      className={`h-5 w-5 ml-2 transition-transform ${openSection === "payments" ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className={`transition-all duration-200 overflow-hidden ${openSection === "payments" ? "max-h-96 mt-3" : "max-h-0"}`}>
                    {openSection === "payments" && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Ksh. 2,500.00</span>
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Completed</span>
                          </div>
                          <div className="text-xs text-gray-500">Paid on 2024-06-20</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleSection("documents")}
                  >
                    <h3 className="text-base font-semibold text-gray-900">Documents</h3>
                    <ChevronDown
                      className={`h-5 w-5 ml-2 transition-transform ${openSection === "documents" ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className={`transition-all duration-200 overflow-hidden ${openSection === "documents" ? "max-h-96 mt-3" : "max-h-0"}`}>
                    {openSection === "documents" && (
                      <div className="space-y-3">
                        <div className="flex items-center p-2 bg-gray-50 rounded hover:bg-gray-100">
                          <FileText className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-700">Invoice-2024.pdf</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleSection("notes")}
                  >
                    <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                    <ChevronDown
                      className={`h-5 w-5 ml-2 transition-transform ${openSection === "notes" ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className={`transition-all duration-200 overflow-hidden ${openSection === "notes" ? "max-h-96 mt-3" : "max-h-0"}`}>
                    {openSection === "notes" && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Note 1</span>
                            <span className="text-xs text-gray-500">2024-06-20</span>
                          </div>
                          <p className="text-sm text-gray-700">This is a note for the conversation.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Templates Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleSection("templates")}
                  >
                    <h3 className="text-base font-semibold text-gray-900">Templates</h3>
                    <ChevronDown
                      className={`h-5 w-5 ml-2 transition-transform ${openSection === "templates" ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className={`transition-all duration-200 overflow-hidden ${openSection === "templates" ? "max-h-96 mt-3" : "max-h-0"}`}>
                    {openSection === "templates" && (
                      <div className="space-y-3">
                        <div className="flex justify-end mb-2">
                          <Button
                            size="sm"
                            className="bg-[#ff3366] hover:bg-[#ff6666] text-white font-semibold"
                            onClick={() => setTemplateModalOpen(true)}
                          >
                            Manage Templates
                          </Button>
                        </div>
                        {/* Mock template list */}
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <span className="text-sm font-medium">Order Confirmation</span>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded w-max">Active</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <span className="text-sm font-medium">Payment Reminder</span>
                          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded w-max">Pending</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg shadow-sm flex flex-col gap-1">
                          <span className="text-sm font-medium">Welcome Message</span>
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded w-max">Draft</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Template Management Sheet (slide-in) */}
                <Sheet open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
                  <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Manage Templates</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div className="flex justify-end mb-4">
                        {!showNewTemplateForm ? (
                          <Button
                            size="sm"
                            className="bg-[#ff3366] hover:bg-[#ff6666] text-white font-semibold flex items-center gap-1"
                            onClick={() => setShowNewTemplateForm(true)}
                          >
                            <Plus className="w-4 h-4" /> New Template
                          </Button>
                        ) : (
                          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2 border border-gray-200 w-full max-w-md">
                            <input
                              className="border border-gray-300 rounded px-2 py-1 text-sm mb-2"
                              placeholder="Template Name"
                              value={newTemplateName}
                              onChange={e => setNewTemplateName(e.target.value)}
                              autoFocus
                              disabled={createLoading}
                            />
                            <textarea
                              className="border border-gray-300 rounded px-2 py-1 text-sm mb-2 min-h-[60px] resize-y"
                              placeholder="Template Content (use variables like {{customer_name}})"
                              value={newTemplateContent}
                              onChange={e => setNewTemplateContent(e.target.value)}
                              disabled={createLoading}
                            />
                            {createError && <div className="text-xs text-red-500 mb-2">{createError}</div>}
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => setShowNewTemplateForm(false)} disabled={createLoading}>Cancel</Button>
                              <Button size="sm" className="bg-[#ff3366] hover:bg-[#ff6666] text-white font-semibold" onClick={handleCreateTemplate} disabled={createLoading}>{createLoading ? "Saving..." : "Save"}</Button>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Template list with actions */}
                      {templatesLoading && <div className="text-center text-xs text-gray-500">Loading templates...</div>}
                      {templatesError && <div className="text-center text-xs text-red-500">{templatesError}</div>}
                      {templates.map((template) => (
                        editingTemplateId === template.id ? (
                          <div key={template.id} className="bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2 border border-gray-200 w-full max-w-md">
                            <input
                              className="border border-gray-300 rounded px-2 py-1 text-sm mb-2"
                              placeholder="Template Name"
                              value={editTemplateName}
                              onChange={e => setEditTemplateName(e.target.value)}
                              autoFocus
                            />
                            <textarea
                              className="border border-gray-300 rounded px-2 py-1 text-sm mb-2 min-h-[60px] resize-y"
                              placeholder="Template Content (use variables like {{customer_name}})"
                              value={editTemplateContent}
                              onChange={e => setEditTemplateContent(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={handleCancelEditTemplate}>Cancel</Button>
                              <Button size="sm" className="bg-[#ff3366] hover:bg-[#ff6666] text-white font-semibold" onClick={handleSaveEditTemplate}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          <div key={template.id} className="bg-gray-50 rounded-lg shadow-sm p-4 flex flex-col gap-1 relative">
                            <span className="text-sm font-medium">{template.name}</span>
                            <span className="text-xs text-gray-500 break-words whitespace-pre-line mb-2">{template.content}</span>
                            <div className="absolute top-3 right-3 flex gap-2">
                              <Button size="icon" variant="ghost" className="p-1" title="Edit" onClick={() => handleEditTemplate(template)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="p-1" title="Delete" onClick={() => handleDeleteTemplate(template.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="p-6 border-t border-gray-200 flex justify-end">
                      <Button onClick={() => setTemplateModalOpen(false)} variant="outline">Close</Button>
                    </div>
                  </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
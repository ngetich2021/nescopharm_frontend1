import apiCall from "./api";
import { getApiUrl } from "./config";

// --- Conversations ---
export async function getConversations(params?: Record<string, any>) {
  // Only use query params for GET
  return apiCall(`/chat/conversations${params ? "?" + new URLSearchParams(params).toString() : ""}`, "GET");
}
export async function getConversation(conversationId: string) {
  return apiCall(`/chat/conversations/${conversationId}`, "GET");
}
export async function sendMessage(conversationId: string, payload: any) {
  // For media: use FormData, otherwise send JSON
  if (payload.media_file instanceof File) {
    const formData = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        // FormData.append requires string or Blob
        if (v instanceof Blob || typeof v === 'string') {
          formData.append(k, v);
        } else {
          formData.append(k, String(v));
        }
      }
    });
    return apiCall(`/chat/conversations/${conversationId}/messages`, "POST", formData);
  }
  return apiCall(`/chat/conversations/${conversationId}/messages`, "POST", payload);
}
export async function assignConversation(conversationId: string, agent_id: string) {
  return apiCall(`/chat/conversations/${conversationId}/assign`, "PUT", { agent_id });
}
export async function closeConversation(conversationId: string) {
  return apiCall(`/chat/conversations/${conversationId}/close`, "PUT", {});
}
export async function reopenConversation(conversationId: string) {
  return apiCall(`/chat/conversations/${conversationId}/reopen`, "PUT", {});
}
export async function addConversationTags(conversationId: string, tags: string[]) {
  return apiCall(`/chat/conversations/${conversationId}/tags`, "POST", { tags });
}
export async function removeConversationTags(conversationId: string, tags: string[]) {
  return apiCall(`/chat/conversations/${conversationId}/tags`, "DELETE", { tags });
}
export async function addConversationNote(conversationId: string, note: string) {
  return apiCall(`/chat/conversations/${conversationId}/notes`, "POST", { note });
}

// --- Initiate/Start Conversation ---
export async function initiateConversation(payload: any) {
  // Always send JSON body
  return apiCall(`/chat/conversations/initiate`, "POST", payload);
}
export async function startWhatsAppConversation(payload: any) {
  // Always send JSON body
  return apiCall(`/chat/conversations/whatsapp/start`, "POST", payload);
}

// --- Start or Continue Conversation ---
export async function startOrContinueConversation(payload: any) {
  return apiCall(`/chat/conversations/start-or-continue`, "POST", payload);
}

// --- Customers ---
export async function getAvailableCustomers(params: { platform: string; search?: string; page?: number; per_page?: number }) {
  // Only use query params for GET
  return apiCall(`/chat/customers/available${params ? "?" + new URLSearchParams(params as any).toString() : ""}`, "GET");
}

// --- Get Customer by Phone ---
export async function getCustomerByPhone(phone: string, platform: string) {
  const params = new URLSearchParams({ phone, platform });
  return apiCall(`/chat/customers/by-phone?${params.toString()}`, "GET");
}

// --- Templates ---
export async function getTemplates(params?: Record<string, any>) {
  // Only use query params for GET
  return apiCall(`/chat/templates${params ? "?" + new URLSearchParams(params).toString() : ""}`, "GET");
}
export async function getTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}`, "GET");
}
export async function createTemplate(payload: any) {
  return apiCall(`/chat/templates`, "POST", payload);
}
export async function updateTemplate(templateId: string, payload: any) {
  return apiCall(`/chat/templates/${templateId}`, "PUT", payload);
}
export async function deleteTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}`, "DELETE");
}
export async function activateTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/activate`, "PUT", {});
}
export async function deactivateTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/deactivate`, "PUT", {});
}
export async function approveTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/approve`, "PUT", {});
}
export async function rejectTemplate(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/reject`, "PUT", {});
}
export async function previewTemplate(templateId: string, variables: Record<string, string>) {
  return apiCall(`/chat/templates/${templateId}/preview`, "POST", { variables });
}
export async function submitTemplateForApproval(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/submit`, "POST", {});
}
export async function checkTemplateStatus(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/status`, "GET");
}
export async function deleteTemplateFromPlatform(templateId: string) {
  return apiCall(`/chat/templates/${templateId}/platform`, "DELETE");
}
export async function getTemplateMetadata() {
  return apiCall(`/chat/templates/metadata/all`, "GET");
}

// --- Credentials ---
export async function getCredentials() {
  return apiCall(`/chat/credentials`, "GET");
}
export async function createCredential(payload: any) {
  return apiCall(`/chat/credentials`, "POST", payload);
}
export async function updateCredential(credentialId: string, payload: any) {
  return apiCall(`/chat/credentials/${credentialId}`, "PUT", payload);
}
export async function deleteCredential(credentialId: string) {
  return apiCall(`/chat/credentials/${credentialId}`, "DELETE");
}
export async function activateCredential(credentialId: string) {
  return apiCall(`/chat/credentials/${credentialId}/activate`, "PUT", {});
}
export async function deactivateCredential(credentialId: string) {
  return apiCall(`/chat/credentials/${credentialId}/deactivate`, "PUT", {});
}
export async function testCredential(credentialId: string) {
  return apiCall(`/chat/credentials/${credentialId}/test`, "POST", {});
}
export async function getWebhookUrl(platform: string) {
  return apiCall(`/chat/credentials/webhook-url/${platform}`, "GET");
}

// --- Stats ---
export async function getChatStats(params?: Record<string, any>) {
  // Only use query params for GET
  return apiCall(`/chat/stats${params ? "?" + new URLSearchParams(params).toString() : ""}`, "GET");
}
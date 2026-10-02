/**
 * Dispatch Approver Management Module
 * 
 * This module handles dispatch approval workflow settings for a company.
 * It provides functions to manage default approvers and approval requirements.
 * 
 * API Endpoint: /api/company/dispatch-settings
 * 
 * @example
 * // Fetch current dispatch settings
 * const settings = await getDispatchSettings();
 * 
 * @example
 * // Update dispatch settings with approvers
 * const payload = {
 *   require_approval: true,
 *   default_approvers: [
 *     { user_id: "29590834-4d79-46b7-ab0b-fb6be2842c95", order: 1 },
 *     { user_id: "a1b2c3d4-5678-90ab-cdef-1234567890ab", order: 2 },
 *     { user_id: "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234", order: 3 }
 *   ]
 * };
 * await updateDispatchSettings(payload);
 * 
 * @example
 * // Get list of potential approvers
 * const approvers = await getPotentialApprovers();
 * 
 * @module lib/approver
 */

import apiCall from "./api";

// ============================================
// Dispatch Approver Types
// ============================================

export interface DispatchApprover {
  user_id: string;
  order: number;
}

export interface CompanyDispatchSettings {
  id?: string;
  company_id?: string;
  require_approval: boolean;
  default_approvers: DispatchApprover[];
  created_at?: string;
  updated_at?: string;
}

export interface UpdateDispatchSettingsPayload {
  require_approval: boolean;
  default_approvers: DispatchApprover[];
}

export interface PotentialApprover {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  is_active: boolean;
}

// ============================================
// API Response Types
// ============================================

interface GetDispatchSettingsResponse {
  success: boolean;
  data: CompanyDispatchSettings;
}

interface UpdateDispatchSettingsResponse {
  success: boolean;
  message?: string;
  data: CompanyDispatchSettings;
}

interface GetPotentialApproversResponse {
  success: boolean;
  data: PotentialApprover[];
}

// ============================================
// API Functions
// ============================================

/**
 * Get company dispatch settings including approvers
 * @returns Promise with dispatch settings
 */
export async function getDispatchSettings(): Promise<GetDispatchSettingsResponse> {
  try {
    const response = await apiCall<GetDispatchSettingsResponse>(
      "/company/dispatch-settings",
      "GET",
      undefined,
      true
    );
    return response;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch dispatch settings");
  }
}

/**
 * Update company dispatch settings including approvers
 * @param payload - The dispatch settings to update
 * @returns Promise with updated dispatch settings
 */
export async function updateDispatchSettings(
  payload: UpdateDispatchSettingsPayload
): Promise<UpdateDispatchSettingsResponse> {
  try {
    // Validate payload
    if (payload.require_approval && payload.default_approvers.length === 0) {
      throw new Error("At least one approver is required when approval is enabled");
    }

    // Validate approvers have unique user_ids
    const userIds = payload.default_approvers.map((a) => a.user_id);
    const uniqueUserIds = new Set(userIds);
    if (userIds.length !== uniqueUserIds.size) {
      throw new Error("Duplicate approvers are not allowed");
    }

    // Ensure proper ordering
    const orderedApprovers = payload.default_approvers.map((approver, index) => ({
      user_id: approver.user_id,
      order: index + 1,
    }));

    const normalizedPayload: UpdateDispatchSettingsPayload = {
      require_approval: payload.require_approval,
      default_approvers: orderedApprovers,
    };

    const response = await apiCall<UpdateDispatchSettingsResponse>(
      "/company/dispatch-settings",
      "PUT",
      normalizedPayload,
      true
    );

    return response;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update dispatch settings");
  }
}

/**
 * Get list of potential approvers (active users)
 * @returns Promise with list of potential approvers
 */
export async function getPotentialApprovers(): Promise<GetPotentialApproversResponse> {
  try {
    const response = await apiCall<GetPotentialApproversResponse>(
      "/company/dispatch-settings/potential-approvers",
      "GET",
      undefined,
      true
    );
    return response;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch potential approvers");
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Validate a list of approvers
 * @param approvers - List of approvers to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateApprovers(approvers: DispatchApprover[]): {
  isValid: boolean;
  error?: string;
} {
  if (!Array.isArray(approvers)) {
    return { isValid: false, error: "Approvers must be an array" };
  }

  if (approvers.length === 0) {
    return { isValid: false, error: "At least one approver is required" };
  }

  // Check for empty user_ids
  const hasEmptyUserId = approvers.some((a) => !a.user_id || a.user_id.trim() === "");
  if (hasEmptyUserId) {
    return { isValid: false, error: "All approvers must have a valid user_id" };
  }

  // Check for duplicate user_ids
  const userIds = approvers.map((a) => a.user_id);
  const uniqueUserIds = new Set(userIds);
  if (userIds.length !== uniqueUserIds.size) {
    return { isValid: false, error: "Duplicate approvers are not allowed" };
  }

  // Check for valid order numbers
  const hasInvalidOrder = approvers.some((a) => typeof a.order !== "number" || a.order < 1);
  if (hasInvalidOrder) {
    return { isValid: false, error: "All approvers must have a valid order number (>= 1)" };
  }

  return { isValid: true };
}

/**
 * Reorder approvers sequentially
 * @param approvers - List of approvers to reorder
 * @returns Reordered list of approvers with sequential order numbers
 */
export function reorderApprovers(approvers: DispatchApprover[]): DispatchApprover[] {
  return approvers.map((approver, index) => ({
    ...approver,
    order: index + 1,
  }));
}

/**
 * Add a new approver to the list
 * @param approvers - Existing list of approvers
 * @param userId - User ID of the new approver
 * @returns Updated list of approvers
 */
export function addApprover(
  approvers: DispatchApprover[],
  userId: string
): DispatchApprover[] {
  const newOrder = approvers.length > 0 ? Math.max(...approvers.map((a) => a.order)) + 1 : 1;
  return [...approvers, { user_id: userId, order: newOrder }];
}

/**
 * Remove an approver from the list
 * @param approvers - Existing list of approvers
 * @param index - Index of the approver to remove
 * @returns Updated and reordered list of approvers
 */
export function removeApprover(
  approvers: DispatchApprover[],
  index: number
): DispatchApprover[] {
  const newApprovers = approvers.filter((_, i) => i !== index);
  return reorderApprovers(newApprovers);
}

/**
 * Move an approver up in the order
 * @param approvers - Existing list of approvers
 * @param index - Index of the approver to move up
 * @returns Updated list of approvers
 */
export function moveApproverUp(
  approvers: DispatchApprover[],
  index: number
): DispatchApprover[] {
  if (index === 0) return approvers;
  
  const newApprovers = [...approvers];
  [newApprovers[index - 1], newApprovers[index]] = [
    newApprovers[index],
    newApprovers[index - 1],
  ];
  
  return reorderApprovers(newApprovers);
}

/**
 * Move an approver down in the order
 * @param approvers - Existing list of approvers
 * @param index - Index of the approver to move down
 * @returns Updated list of approvers
 */
export function moveApproverDown(
  approvers: DispatchApprover[],
  index: number
): DispatchApprover[] {
  if (index === approvers.length - 1) return approvers;
  
  const newApprovers = [...approvers];
  [newApprovers[index], newApprovers[index + 1]] = [
    newApprovers[index + 1],
    newApprovers[index],
  ];
  
  return reorderApprovers(newApprovers);
}

/**
 * Update an approver's user_id
 * @param approvers - Existing list of approvers
 * @param index - Index of the approver to update
 * @param userId - New user ID
 * @returns Updated list of approvers
 */
export function updateApprover(
  approvers: DispatchApprover[],
  index: number,
  userId: string
): DispatchApprover[] {
  const newApprovers = [...approvers];
  newApprovers[index] = { ...newApprovers[index], user_id: userId };
  return newApprovers;
}

/**
 * Format approver name
 * @param approver - Potential approver object
 * @returns Formatted full name
 */
export function formatApproverName(approver: PotentialApprover): string {
  return `${approver.first_name} ${approver.last_name}`.trim();
}

/**
 * Find an approver by user ID in the potential approvers list
 * @param potentialApprovers - List of potential approvers
 * @param userId - User ID to find
 * @returns Potential approver or undefined
 */
export function findApproverById(
  potentialApprovers: PotentialApprover[],
  userId: string
): PotentialApprover | undefined {
  return potentialApprovers.find((a) => a.id === userId);
}

/**
 * Check if a user is already in the approvers list
 * @param approvers - List of approvers
 * @param userId - User ID to check
 * @returns True if user is already an approver
 */
export function isUserAlreadyApprover(
  approvers: DispatchApprover[],
  userId: string
): boolean {
  return approvers.some((a) => a.user_id === userId);
}

import apiCall from './api';

// ============================================
// TypeScript Interfaces for Journal Entries
// ============================================

export interface JournalEntryCompany {
  id: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string | null;
  country?: string;
  postal_code?: string | null;
  website?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  current_subscription_id?: string | null;
}

export interface JournalEntryChartOfAccount {
  id: string;
  company_id: string;
  parent_id: string | null;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  account_subtype: string;
  description?: string;
  is_active: boolean;
  is_system_account: boolean;
  opening_balance: string;
  normal_balance: 'debit' | 'credit';
  tax_code?: string | null;
  level: number;
  full_path: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryItem {
  id: string;
  journal_entry_id: string;
  account_id: string;
  company_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
  contact_id?: string | null;
  contact_type?: string | null;
  reference?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  chart_of_account: JournalEntryChartOfAccount;
}

export interface JournalEntryCreator {
  id: string;
  company_id: string;
  email: string;
  frontend_url?: string | null;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
}

// Approver interface (same structure as creator)
export interface JournalEntryApprover {
  id: string;
  company_id: string;
  email: string;
  frontend_url?: string | null;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  entry_number: string;
  entry_date: string;
  reference: string;
  description: string;
  total_debit: string;
  total_credit: string;
  status: 'draft' | 'pending' | 'posted' | 'cancelled' | 'reversed';
  entry_type: 'manual' | 'automatic' | 'adjusting' | 'closing' | 'reversing';
  source_id?: string | null;
  source_type?: string | null;
  created_by: string;
  posted_by?: string | null;
  posted_at?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  company?: JournalEntryCompany;
  items: JournalEntryItem[];
  creator?: JournalEntryCreator;
  approver?: JournalEntryApprover;
}

// Legacy interface for backward compatibility
export interface JournalEntryLine {
  id?: string;
  chart_of_account_id: number;
  account?: {
    id?: number;
    account_code: string;
    account_name: string;
    account_type?: string;
    account_subtype?: string;
  };
  description: string;
  debit_amount: number;
  credit_amount: number;
}

// ============================================
// API Response Interfaces
// ============================================

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface JournalEntriesResponse {
  status: string;
  message: string;
  entries: JournalEntry[];
  meta?: PaginationMeta;
}

export interface JournalEntryResponse {
  status: string;
  message: string;
  entry: JournalEntry;
}

export interface JournalEntryPostResponse {
  status: string;
  message: string;
  entry: JournalEntry;
}

export interface JournalEntryReverseResponse {
  status: string;
  message: string;
  reversing_entry: JournalEntry;
}

export interface JournalEntryDeleteResponse {
  status: string;
  message: string;
}

// ============================================
// Create Journal Entry Input Interface
// ============================================

export interface CreateJournalEntryInput {
  entry_date: string;
  reference: string;
  description: string;
  entry_type?: 'manual' | 'automatic' | 'adjusting' | 'closing' | 'reversing';
  status?: 'draft' | 'pending';
  items: Array<{
    account_id: string;
    description: string;
    debit_amount: number | string;
    credit_amount: number | string;
    contact_id?: string;
    contact_type?: string;
    reference?: string;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

export interface UpdateJournalEntryInput {
  entry_date?: string;
  reference?: string;
  description?: string;
  entry_type?: 'manual' | 'automatic' | 'adjusting' | 'closing' | 'reversing';
  items?: Array<{
    id?: string;
    account_id: string;
    description: string;
    debit_amount: number | string;
    credit_amount: number | string;
    contact_id?: string;
    contact_type?: string;
    reference?: string;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

// ============================================
// Filter Parameters Interface
// ============================================

export interface JournalEntryFilters {
  entry_date_from?: string;
  entry_date_to?: string;
  status?: string;
  entry_type?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch all journal entries with optional filters
 */
export const getJournalEntries = async (
  params?: JournalEntryFilters
): Promise<JournalEntriesResponse> => {
  const queryString = params
    ? new URLSearchParams(params as Record<string, string>).toString()
    : '';
  const url = queryString
    ? `/finance/journal-entries?${queryString}`
    : '/finance/journal-entries';
  const response = await apiCall<JournalEntriesResponse>(url, 'GET');
  return response;
};

/**
 * Fetch a single journal entry by ID
 */
export const getJournalEntry = async (
  id: string
): Promise<JournalEntryResponse> => {
  const response = await apiCall<JournalEntryResponse>(
    `/finance/journal-entries/${id}`,
    'GET'
  );
  return response;
};

/**
 * Create a new journal entry
 */
export const createJournalEntry = async (
  data: CreateJournalEntryInput
): Promise<JournalEntryResponse> => {
  const response = await apiCall<JournalEntryResponse>(
    '/finance/journal-entries',
    'POST',
    data
  );
  return response;
};

/**
 * Update an existing journal entry (only draft/pending entries)
 */
export const updateJournalEntry = async (
  id: string,
  data: UpdateJournalEntryInput
): Promise<JournalEntryResponse> => {
  const response = await apiCall<JournalEntryResponse>(
    `/finance/journal-entries/${id}`,
    'PUT',
    data
  );
  return response;
};

/**
 * Post a journal entry (change status from draft/pending to posted)
 */
export const postJournalEntry = async (
  id: string
): Promise<JournalEntryPostResponse> => {
  const response = await apiCall<JournalEntryPostResponse>(
    `/finance/journal-entries/${id}/post`,
    'POST'
  );
  return response;
};

/**
 * Reverse a posted journal entry
 */
export const reverseJournalEntry = async (
  id: string,
  reason?: string
): Promise<JournalEntryReverseResponse> => {
  const response = await apiCall<JournalEntryReverseResponse>(
    `/finance/journal-entries/${id}/reverse`,
    'POST',
    { reason }
  );
  return response;
};

/**
 * Delete a journal entry (only draft/pending entries)
 */
export const deleteJournalEntry = async (
  id: string
): Promise<JournalEntryDeleteResponse> => {
  const response = await apiCall<JournalEntryDeleteResponse>(
    `/finance/journal-entries/${id}`,
    'DELETE'
  );
  return response;
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get status badge color class
 */
export const getJournalEntryStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-blue-100 text-blue-800',
    posted: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    reversed: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Get entry type badge color class
 */
export const getJournalEntryTypeColor = (entryType: string): string => {
  const colors: Record<string, string> = {
    manual: 'bg-blue-100 text-blue-800',
    automatic: 'bg-green-100 text-green-800',
    adjusting: 'bg-purple-100 text-purple-800',
    closing: 'bg-orange-100 text-orange-800',
    reversing: 'bg-red-100 text-red-800',
  };
  return colors[entryType] || 'bg-gray-100 text-gray-800';
};

/**
 * Get account type color class
 */
export const getAccountTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    asset: 'text-green-600',
    liability: 'text-red-600',
    equity: 'text-blue-600',
    income: 'text-purple-600',
    expense: 'text-orange-600',
  };
  return colors[type] || 'text-gray-600';
};

/**
 * Check if journal entry is balanced
 */
export const isJournalEntryBalanced = (entry: JournalEntry): boolean => {
  const totalDebit = parseFloat(entry.total_debit) || 0;
  const totalCredit = parseFloat(entry.total_credit) || 0;
  return Math.abs(totalDebit - totalCredit) < 0.01;
};

/**
 * Calculate totals from journal entry items
 */
export const calculateJournalEntryTotals = (
  items: Array<{ debit_amount: string | number; credit_amount: string | number }>
): { totalDebit: number; totalCredit: number; isBalanced: boolean } => {
  const totalDebit = items.reduce(
    (sum, item) => sum + (parseFloat(String(item.debit_amount)) || 0),
    0
  );
  const totalCredit = items.reduce(
    (sum, item) => sum + (parseFloat(String(item.credit_amount)) || 0),
    0
  );
  return {
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
};

/**
 * Format entry type for display
 */
export const formatEntryType = (entryType: string): string => {
  return entryType.charAt(0).toUpperCase() + entryType.slice(1);
};

/**
 * Check if journal entry can be edited
 */
export const canEditJournalEntry = (entry: JournalEntry): boolean => {
  return entry.status === 'draft' || entry.status === 'pending';
};

/**
 * Check if journal entry can be posted
 */
export const canPostJournalEntry = (entry: JournalEntry): boolean => {
  return (
    (entry.status === 'draft' || entry.status === 'pending') &&
    isJournalEntryBalanced(entry)
  );
};

/**
 * Check if journal entry can be reversed
 */
export const canReverseJournalEntry = (entry: JournalEntry): boolean => {
  return entry.status === 'posted';
};

/**
 * Check if journal entry can be deleted
 */
export const canDeleteJournalEntry = (entry: JournalEntry): boolean => {
  return entry.status === 'draft' || entry.status === 'pending';
};

// ============================================
// Journal Entries API Object
// ============================================

export const journalEntriesApi = {
  // CRUD operations
  getAll: getJournalEntries,
  getOne: getJournalEntry,
  create: createJournalEntry,
  update: updateJournalEntry,
  delete: deleteJournalEntry,
  
  // Actions
  post: postJournalEntry,
  reverse: reverseJournalEntry,
  
  // Utility functions
  getStatusColor: getJournalEntryStatusColor,
  getTypeColor: getJournalEntryTypeColor,
  getAccountTypeColor,
  isBalanced: isJournalEntryBalanced,
  calculateTotals: calculateJournalEntryTotals,
  formatEntryType,
  canEdit: canEditJournalEntry,
  canPost: canPostJournalEntry,
  canReverse: canReverseJournalEntry,
  canDelete: canDeleteJournalEntry,
};

export default journalEntriesApi;

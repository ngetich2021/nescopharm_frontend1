import apiCall from './api';

// Re-export journal entries module
export * from './journal-entries';
export { journalEntriesApi } from './journal-entries';

// TypeScript interfaces for Finance module
export interface ChartOfAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  account_subtype: string;
  parent_id: string | null;
  is_active: boolean;
  normal_balance: 'debit' | 'credit';
  level: number;
  // Optional fields for backward compatibility
  company_id?: string;
  description?: string;
  is_system?: boolean;
  opening_balance?: string;
  current_balance?: string | null;
  currency_code?: string;
  created_at?: string;
  updated_at?: string;
  parent?: ChartOfAccount | null;
  children?: ChartOfAccount[];
  company?: {
    id: string;
    name: string;
  };
}

// Bank Management interfaces
export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch_name?: string;
  account_type: 'current' | 'savings' | 'checking' | 'money_market' | 'certificate_of_deposit' | 'other';
  currency_code: string;
  current_balance: number;
  is_active: boolean;
  opening_balance: number;
  opening_date: string;
  bank_details?: {
    mpesa_paybill?: string;
    mpesa_account?: string;
    [key: string]: unknown;
  } | null;
  chart_of_account_id?: number;
  chart_of_account?: {
    id: number;
    account_code: string;
    account_name: string;
    account_type: string;
  };
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: number;
  bank_account?: {
    account_name: string;
    account_number: string;
    bank_name: string;
  };
  transaction_date: string;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'fee';
  amount: number;
  description: string;
  reference: string;
  balance_after: number;
  journal_entry_id?: number;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliation {
  id: string;
  bank_account_id: number;
  bank_account?: {
    account_name: string;
    account_number: string;
    bank_name: string;
  };
  reconciliation_date: string;
  statement_balance: number;
  book_balance: number;
  difference: number;
  status: 'pending' | 'completed';
  notes?: string;
  reconciled_by?: number;
  reconciled_at?: string;
  created_at: string;
  updated_at: string;
}

// Budget interfaces
export interface Budget {
  id: string;
  budget_name: string;
  budget_type: 'annual' | 'quarterly' | 'monthly' | 'project';
  financial_period_id?: number;
  financial_period?: {
    period_name: string;
    start_date: string;
    end_date: string;
  };
  start_date: string;
  end_date: string;
  total_budgeted_amount: number;
  total_actual_amount: number;
  variance: number;
  variance_percentage: number;
  status: 'draft' | 'approved' | 'active' | 'closed';
  description?: string;
  approved_by?: number;
  approved_at?: string;
  budget_lines?: BudgetLine[];
  created_at: string;
  updated_at: string;
}

export interface BudgetLine {
  id: string;
  chart_of_account_id: number;
  account?: {
    id: number;
    account_code: string;
    account_name: string;
    account_type: string;
  };
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  description?: string;
}

// Fixed Assets interfaces
export interface FixedAsset {
  id: string;
  asset_name: string;
  asset_tag: string;
  asset_category: 'building' | 'vehicle' | 'equipment' | 'furniture' | 'software';
  purchase_date: string;
  purchase_cost: number;
  useful_life_years: number;
  depreciation_method: 'straight_line' | 'double_declining' | 'units_of_production';
  salvage_value: number;
  current_book_value: number;
  accumulated_depreciation: number;
  annual_depreciation?: number;
  monthly_depreciation?: number;
  status: 'active' | 'disposed' | 'sold' | 'written_off';
  location?: string;
  supplier?: string;
  chart_of_account_id: number;
  chart_of_account?: {
    id: number;
    account_code: string;
    account_name: string;
    account_type: string;
  };
  description?: string;
  disposal_date?: string;
  disposal_amount?: number;
  disposal_method?: string;
  disposal_gain_loss?: number;
  depreciation_history?: AssetDepreciation[];
  created_at: string;
  updated_at: string;
}

export interface AssetDepreciation {
  id: string;
  fixed_asset_id: number;
  fixed_asset?: {
    asset_name: string;
    asset_tag: string;
    asset_category: string;
  };
  depreciation_date: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value_after: number;
  depreciation_method: string;
  journal_entry_id?: number;
  created_at: string;
  updated_at: string;
}


// Tax Management interfaces
export interface TaxRate {
  id: string;
  tax_name: string;
  tax_type: 'paye' | 'vat' | 'withholding' | 'nhif' | 'nssf' | 'shif';
  rate_percentage?: number;
  is_progressive: boolean;
  effective_date: string;
  is_active: boolean;
  description?: string;
  min_amount?: number;
  max_amount?: number;
  tax_brackets?: TaxBracket[];
  created_at: string;
  updated_at: string;
}

export interface TaxBracket {
  id: string;
  min_amount: number;
  max_amount?: number;
  rate_percentage?: number;
  fixed_amount: number;
}

// Trial Balance interface
export interface TrialBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: string;
  credit_balance: string;
}

// Financial Report interface
export interface FinancialReport {
  status: string;
  message: string;
  [key: string]: any;
}

// Type aliases for specific report types
export type IncomeStatement = FinancialReport;
export type CashFlowStatement = FinancialReport;
export type FinancialRatios = FinancialReport;

// Accounting Settings interfaces
export interface AccountingSettings {
  id: string;
  company_id: string;
  accounting_method: 'accrual' | 'cash';
  sales_recognition_trigger: string;
  purchase_recognition_trigger: string;
  expense_recognition_trigger: string;
  auto_record_cash_sales: boolean;
  credit_sales_on_invoice_send?: boolean;
  auto_record_customer_payments: boolean;
  auto_record_supplier_payments: boolean;
  record_proforma_invoices?: boolean;
  record_draft_invoices?: boolean;
  require_expense_approval: boolean;
  require_invoice_approval?: boolean;
  require_journal_approval?: boolean;
  expense_approval_threshold?: number | null;
  accounting_integration_enabled: boolean;
  vat_recognition?: 'invoice_date' | 'payment_date';
  cogs_recognition?: 'on_sale' | 'on_dispatch' | 'on_delivery';
  perpetual_inventory?: boolean;
  log_failed_entries?: boolean;
  soft_fail_on_accounting_error: boolean;
  financial_year_start_month?: number;
  lock_closed_periods?: boolean;
  current_period_end?: string | null;
  default_account_mappings?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface AccountingSettingsOptions {
  sales_recognition_triggers: Record<string, string>;
  purchase_recognition_triggers: Record<string, string>;
  expense_recognition_triggers: Record<string, string>;
  accounting_methods: Record<string, string>;
  vat_recognition_options?: Record<string, string>;
  cogs_recognition_options?: Record<string, string>;
}

export interface AccountingSettingsResponse {
  data: AccountingSettings;
  options: AccountingSettingsOptions;
}

export interface AccountingSettingsSummary {
  enabled: boolean;
  method: string;
  summary: string[];
}

export interface UpdateAccountingSettingsInput {
  accounting_method?: 'accrual' | 'cash';
  sales_recognition_trigger?: string;
  purchase_recognition_trigger?: string;
  expense_recognition_trigger?: string;
  auto_record_cash_sales?: boolean;
  credit_sales_on_invoice_send?: boolean;
  auto_record_customer_payments?: boolean;
  auto_record_supplier_payments?: boolean;
  record_proforma_invoices?: boolean;
  record_draft_invoices?: boolean;
  require_expense_approval?: boolean;
  require_invoice_approval?: boolean;
  require_journal_approval?: boolean;
  expense_approval_threshold?: number | null;
  accounting_integration_enabled?: boolean;
  vat_recognition?: 'invoice_date' | 'payment_date';
  cogs_recognition?: 'on_sale' | 'on_dispatch' | 'on_delivery';
  perpetual_inventory?: boolean;
  log_failed_entries?: boolean;
  soft_fail_on_accounting_error?: boolean;
  financial_year_start_month?: number;
  lock_closed_periods?: boolean;
  current_period_end?: string | null;
}

// API Functions

// Chart of Accounts
export const getChartOfAccounts = async (params?: {
  company_id?: string;
  account_type?: string;
  is_active?: boolean;
  parent_id?: string;
  search?: string;
}): Promise<{ accounts: ChartOfAccount[] }> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/chart-of-accounts?${queryString}` : '/finance/chart-of-accounts';
  const response = await apiCall<{ accounts: ChartOfAccount[] }>(url, 'GET');
  return response;
};

export const getChartOfAccount = async (id: string): Promise<{ account: ChartOfAccount }> => {
  const response = await apiCall<{ account: ChartOfAccount }>(`/finance/chart-of-accounts/${id}`, 'GET');
  return response;
};

export const createChartOfAccount = async (data: Partial<ChartOfAccount>): Promise<{ account: ChartOfAccount }> => {
  const response = await apiCall<{ account: ChartOfAccount }>('/finance/chart-of-accounts', 'POST', data);
  return response;
};

export const updateChartOfAccount = async (id: string, data: Partial<ChartOfAccount>): Promise<{ account: ChartOfAccount }> => {
  const response = await apiCall<{ account: ChartOfAccount }>(`/finance/chart-of-accounts/${id}`, 'PUT', data);
  return response;
};

export const deleteChartOfAccount = async (id: string): Promise<void> => {
  await apiCall<void>(`/finance/chart-of-accounts/${id}`, 'DELETE');
};

export const getAccountTypes = async (): Promise<{ account_types: Record<string, string> }> => {
  const response = await apiCall<{ account_types: Record<string, string> }>('/finance/account-types', 'GET');
  return response;
};

export const getAccountsByType = async (type: string): Promise<{ accounts: ChartOfAccount[] }> => {
  const response = await apiCall<{ accounts: ChartOfAccount[] }>(`/finance/accounts/by-type/${type}`, 'GET');
  return response;
};

// Journal Entries API Response interface
// General Ledger
export const getGeneralLedger = async (params?: {
  company_id?: string;
  date_from?: string;
  date_to?: string;
  account_id?: string;
  account_type?: string;
}): Promise<any> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/general-ledger?${queryString}` : '/finance/general-ledger';
  const response = await apiCall<any>(url, 'GET');
  return response;
};

export const getAccountLedger = async (id: string, params?: {
  date_from?: string;
  date_to?: string;
}): Promise<any> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/accounts/${id}/ledger?${queryString}` : `/finance/accounts/${id}/ledger`;
  const response = await apiCall<any>(url, 'GET');
  return response;
};

export const getTrialBalance = async (params?: {
  company_id?: string;
  as_of_date?: string;
}): Promise<{ accounts: TrialBalance[]; totals: any }> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/trial-balance?${queryString}` : '/finance/trial-balance';
  const response = await apiCall<{ accounts: TrialBalance[]; totals: any }>(url, 'GET');
  return response;
};

export const getAccountBalance = async (id: string, params?: {
  as_of_date?: string;
}): Promise<any> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/accounts/${id}/balance?${queryString}` : `/finance/accounts/${id}/balance`;
  const response = await apiCall<any>(url, 'GET');
  return response;
};

// Bank Accounts
export const getBankAccounts = async (params?: {
  company_id?: string;
  is_active?: boolean;
  account_type?: string;
  bank_name?: string;
  search?: string;
}): Promise<{ accounts: BankAccount[] }> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/bank-accounts?${queryString}` : '/finance/bank-accounts';
  const response = await apiCall<{ accounts: BankAccount[] }>(url, 'GET');
  return response;
};

export const createBankAccount = async (data: Partial<BankAccount>): Promise<{ account: BankAccount }> => {
  const response = await apiCall<{ account: BankAccount }>('/finance/bank-accounts', 'POST', data);
  return response;
};

export const getBankAccountBalance = async (id: string): Promise<any> => {
  const response = await apiCall<any>(`/finance/bank-accounts/${id}/balance`, 'GET');
  return response;
};

export const getBankAccountTransactions = async (id: string, params?: {
  date_from?: string;
  date_to?: string;
  transaction_type?: string;
  status?: string;
  is_reconciled?: boolean;
}): Promise<any> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/bank-accounts/${id}/transactions?${queryString}` : `/finance/bank-accounts/${id}/transactions`;
  const response = await apiCall<any>(url, 'GET');
  return response;
};

// Financial Reports
export const getBalanceSheet = async (params?: {
  company_id?: string;
  as_of_date?: string;
}): Promise<FinancialReport> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/reports/balance-sheet?${queryString}` : '/finance/reports/balance-sheet';
  const response = await apiCall<FinancialReport>(url, 'GET');
  return response;
};

export const getIncomeStatement = async (params?: {
  company_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<FinancialReport> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/reports/income-statement?${queryString}` : '/finance/reports/income-statement';
  const response = await apiCall<FinancialReport>(url, 'GET');
  return response;
};

export const getCashFlowStatement = async (params?: {
  company_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<FinancialReport> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/reports/cash-flow?${queryString}` : '/finance/reports/cash-flow';
  const response = await apiCall<FinancialReport>(url, 'GET');
  return response;
};

export const getFinancialRatios = async (params?: {
  company_id?: string;
  as_of_date?: string;
  date_from?: string;
}): Promise<FinancialReport> => {
  const queryString = params ? new URLSearchParams(params as any).toString() : '';
  const url = queryString ? `/finance/reports/financial-ratios?${queryString}` : '/finance/reports/financial-ratios';
  const response = await apiCall<FinancialReport>(url, 'GET');
  return response;
};

// Accounting Settings
export const getAccountingSettings = async (): Promise<AccountingSettingsResponse> => {
  const response = await apiCall<AccountingSettingsResponse>('/finance/accounting-settings', 'GET');
  return response;
};

export const updateAccountingSettings = async (data: UpdateAccountingSettingsInput): Promise<{ message: string; data: AccountingSettings }> => {
  const response = await apiCall<{ message: string; data: AccountingSettings }>('/finance/accounting-settings', 'PUT', data);
  return response;
};

export const resetAccountingSettings = async (): Promise<{ message: string; data: AccountingSettings }> => {
  const response = await apiCall<{ message: string; data: AccountingSettings }>('/finance/accounting-settings/reset', 'POST');
  return response;
};

export const getAccountingSettingsSummary = async (): Promise<AccountingSettingsSummary> => {
  const response = await apiCall<AccountingSettingsSummary>('/finance/accounting-settings/summary', 'GET');
  return response;
};

// Utility functions
export const formatCurrency = (amount: string | number | null | undefined, currencyCode: string = 'KES'): string => {
  // Handle null, undefined, or invalid values
  if (amount === null || amount === undefined || amount === '') {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currencyCode,
    }).format(0);
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN values
  if (isNaN(numAmount)) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currencyCode,
    }).format(0);
  }
  
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currencyCode,
  }).format(numAmount);
};

export const formatAccountCode = (code: string): string => {
  return code.padStart(4, '0');
};

export const getAccountTypeColor = (type: string): string => {
  const colors = {
    asset: 'bg-green-100 text-green-800',
    liability: 'bg-red-100 text-red-800',
    equity: 'bg-blue-100 text-blue-800',
    revenue: 'bg-purple-100 text-purple-800',
    expense: 'bg-orange-100 text-orange-800',
  };
  return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export const getStatusColor = (status: string): string => {
  const colors = {
    draft: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-blue-100 text-blue-800',
    posted: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    reversed: 'bg-gray-100 text-gray-800',
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

// Import journal entry functions for financeApi
import {
  getJournalEntries,
  createJournalEntry,
  getJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
} from './journal-entries';

// Finance API object for easier imports
export const financeApi = {
  // Chart of Accounts
  getChartOfAccounts,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getAccountTypes,
  getAccountsByType,
  
  // Journal Entries (from journal-entries.ts)
  getJournalEntries,
  createJournalEntry,
  getJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
  
  // General Ledger
  getGeneralLedger,
  getAccountLedger,
  getTrialBalance,
  getAccountBalance,
  
  // Bank Accounts
  getBankAccounts,
  createBankAccount,
  getBankAccountBalance,
  getBankAccountTransactions,
  
  // Financial Reports
  getBalanceSheet,
  getIncomeStatement,
  getCashFlowStatement,
  getFinancialRatios,
  
  // Accounting Settings
  getAccountingSettings,
  updateAccountingSettings,
  resetAccountingSettings,
  getAccountingSettingsSummary,
};

import apiCall from "./api";
import type { Expense, ExpenseCategory, PaymentMethod, RecurringFrequency, ExpenseStatus, Store } from "@/types/expenses";

// API Response interface for typing the response
interface ExpenseApiResponse {
  status: string;
  message: string;
  expenses?: Expense[];
  expense?: Expense;
}

interface ExpenseCategoryApiResponse {
  status: string;
  message: string;
  categories?: ExpenseCategory[];
  category?: ExpenseCategory;
}

interface StoreApiResponse {
  status: string;
  message: string;
  stores?: Store[];
  store?: Store;
}

/**
 * Fetches expenses data from the API - client-side only
 * @param filters Optional filters including company_id
 * @returns Promise with expenses data
 */
export async function getExpenses(
  filters: {
    company_id?: string;
    search?: string;
    status?: ExpenseStatus | "all";
    dateRange?: { from: string; to: string };
  } = {}
): Promise<Expense[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return [];
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (filters.company_id) queryParams.append('company_id', filters.company_id);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.dateRange?.from) queryParams.append('from_date', filters.dateRange.from);
    if (filters.dateRange?.to) queryParams.append('to_date', filters.dateRange.to);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<ExpenseApiResponse>(
        `/expenses${queryString}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.expenses) {
        return response.expenses;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch expenses data";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return [];
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch expenses data: ${error.message || "Unknown error"}`);
  }
}

/**
 * Fetches a single expense by ID
 * @param expenseId The ID of the expense to fetch
 * @returns Promise with expense data
 */
export async function getExpenseById(expenseId: string): Promise<Expense | null> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<ExpenseApiResponse>(
        `/expenses/${expenseId}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.expense) {
        return response.expense;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch expense details";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return null;
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch expense details: ${error.message || "Unknown error"}`);
  }
}

/**
 * Creates a new expense
 * @param expenseData The expense data to create
 * @returns Promise with created expense
 */
export async function createExpense(expenseData: Partial<Expense>): Promise<Expense> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("createExpense must be called client-side");
    }
    
    const response = await apiCall<ExpenseApiResponse>(
      "/expenses",
      "POST",
      expenseData,
      true
    );
    
    if (response.status === "success" && response.expense) {
      return response.expense;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to create expense";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to create expense: ${error.message || "Unknown error"}`);
  }
}

/**
 * Updates an existing expense
 * @param expenseId The ID of the expense to update
 * @param updates The expense data to update
 * @returns Promise with updated expense
 */
export async function updateExpense(
  expenseId: string, 
  updates: Partial<Expense>
): Promise<Expense> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("updateExpense must be called client-side");
    }
    
    const response = await apiCall<ExpenseApiResponse>(
      `/expenses/${expenseId}`,
      "PUT",
      updates,
      true
    );
    
    if (response.status === "success" && response.expense) {
      return response.expense;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to update expense";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to update expense: ${error.message || "Unknown error"}`);
  }
}

/**
 * Deletes an expense
 * @param expenseId The ID of the expense to delete
 * @returns Promise that resolves when expense is deleted
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("deleteExpense must be called client-side");
    }
    
    const response = await apiCall<ExpenseApiResponse>(
      `/expenses/${expenseId}`,
      "DELETE",
      undefined,
      true
    );
    
    if (response.status !== "success") {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to delete expense";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to delete expense: ${error.message || "Unknown error"}`);
  }
}

/**
 * Approves an expense by updating its status to 'approved'
 * @param expenseId The ID of the expense to approve
 * @returns Promise with updated expense
 */
export async function approveExpense(expenseId: string): Promise<Expense> {
  return updateExpense(expenseId, { status: 'approved' })
}

/**
 * Fetches expense categories from the API - client-side only
 * @param company_id Optional company ID to filter categories
 * @returns Promise with expense categories
 */
export async function getExpenseCategories(company_id?: string): Promise<ExpenseCategory[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return [];
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (company_id) queryParams.append('company_id', company_id);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<ExpenseCategoryApiResponse>(
        `/expense-categories${queryString}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.categories) {
        return response.categories;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch expense categories";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return [];
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch expense categories: ${error.message || "Unknown error"}`);
  }
}

/**
 * Creates a new expense category
 * @param categoryData The category data to create
 * @returns Promise with created category
 */
export async function createExpenseCategory(
  categoryData: Partial<ExpenseCategory>
): Promise<ExpenseCategory> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("createExpenseCategory must be called client-side");
    }
    
    const response = await apiCall<ExpenseCategoryApiResponse>(
      "/expense-categories",
      "POST",
      categoryData,
      true
    );
    
    if (response.status === "success" && response.category) {
      return response.category;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to create expense category";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to create expense category: ${error.message || "Unknown error"}`);
  }
}

/**
 * Updates an existing expense category
 * @param categoryId The ID of the category to update
 * @param updates The category data to update
 * @returns Promise with updated category
 */
export async function updateExpenseCategory(
  categoryId: string, 
  updates: Partial<ExpenseCategory>
): Promise<ExpenseCategory> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("updateExpenseCategory must be called client-side");
    }
    
    const response = await apiCall<ExpenseCategoryApiResponse>(
      `/expense-categories/${categoryId}`,
      "PUT",
      updates,
      true
    );
    
    if (response.status === "success" && response.category) {
      return response.category;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to update expense category";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to update expense category: ${error.message || "Unknown error"}`);
  }
}

/**
 * Fetches stores from the API - client-side only
 * @returns Promise with stores data
 */
export async function getStores(): Promise<Store[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return [];
    }
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<StoreApiResponse>(
        "/stores",
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.stores) {
        return response.stores;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch stores data";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return [];
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch stores data: ${error.message || "Unknown error"}`);
  }
}

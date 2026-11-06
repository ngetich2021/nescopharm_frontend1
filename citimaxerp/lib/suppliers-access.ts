// Who sees what on the Suppliers page. Supplier and delivery invoices moved there from
// Sales > Invoices, and everyone who could see them keeps them without needing the Suppliers menu.

// Supplier bills: whoever sees supplier payments or the payables books.
export const SUPPLIER_INVOICE_PERMISSIONS = ["can_view_payments", "can_view_accounts_payable", "can_view_accounts"]
export const DELIVERY_INVOICE_PERMISSIONS = ["can_view_delivery_invoices"]
export const SUPPLIERS_PAGE_PERMISSIONS = ["can_view_suppliers_menu", ...SUPPLIER_INVOICE_PERMISSIONS, ...DELIVERY_INVOICE_PERMISSIONS]

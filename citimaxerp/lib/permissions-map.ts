// Complete Permissions Mapping for Cherry360 Application
// This file maps all documented permissions to their respective modules and functions

export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  module: string;
}

export const PERMISSIONS_MAP: PermissionDefinition[] = [
  // System-Level Permissions
  {
    key: "can_manage_system",
    name: "Manage System",
    description: "Full system administration access (overrides all other permissions)",
    category: "System Administration",
    module: "admin"
  },
  {
    key: "can_manage_company",
    name: "Manage Company",
    description: "Company-level administration access",
    category: "System Administration",
    module: "admin"
  },
  {
    key: "can_manage_all_users",
    name: "Manage All Users",
    description: "Manage all users across all companies",
    category: "User Management",
    module: "admin"
  },
  {
    key: "can_manage_companies",
    name: "Manage Companies",
    description: "Manage company entities",
    category: "Company Management",
    module: "admin"
  },
  {
    key: "can_manage_subscriptions",
    name: "Manage Subscriptions",
    description: "Manage subscription plans and billing",
    category: "Subscription Management",
    module: "admin"
  },

  // Customer Management
  {
    key: "can_create_customers",
    name: "Create Customers",
    description: "Create new customers",
    category: "Customer Management",
    module: "customers"
  },
  {
    key: "can_view_customers",
    name: "View Customers",
    description: "View customer information and lists",
    category: "Customer Management",
    module: "customers"
  },
  {
    key: "can_view_customers_menu",
    name: "View Customers Menu",
    description: "Access to the customers section in the main navigation menu",
    category: "Customer Management",
    module: "customers"
  },
  {
    key: "can_update_customers",
    name: "Update Customers",
    description: "Update customer details",
    category: "Customer Management",
    module: "customers"
  },
  {
    key: "can_delete_customers",
    name: "Delete Customers",
    description: "Delete customers",
    category: "Customer Management",
    module: "customers"
  },

  // Customer Accounts Management
  {
    key: "can_create_accounts",
    name: "Create Accounts",
    description: "Create new customer accounts",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_view_accounts",
    name: "View Accounts",
    description: "View customer account information",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_update_accounts",
    name: "Update Accounts",
    description: "Update customer account details",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_delete_accounts",
    name: "Delete Accounts",
    description: "Delete customer accounts",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_view_account_approvals",
    name: "View Account Approvals",
    description: "View customer account approval requests",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_approve_account",
    name: "Approve Account",
    description: "Approve or reject customer account requests",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_record_accounts",
    name: "Record Accounts",
    description: "Record account transactions",
    category: "Customer Accounts",
    module: "customers"
  },
  {
    key: "can_view_accounts_reports",
    name: "View Account Reports",
    description: "View account-related reports",
    category: "Customer Accounts",
    module: "customers"
  },

  // Order Management
  {
    key: "can_create_orders",
    name: "Create Orders",
    description: "Create new orders",
    category: "Order Management",
    module: "sales"
  },
  {
    key: "can_view_orders",
    name: "View Orders",
    description: "View order information and lists",
    category: "Order Management",
    module: "sales"
  },
  {
    key: "can_update_orders",
    name: "Update Orders",
    description: "Update order details",
    category: "Order Management",
    module: "sales"
  },
  {
    key: "can_delete_orders",
    name: "Delete Orders",
    description: "Delete orders",
    category: "Order Management",
    module: "sales"
  },
  {
    key: "can_dispatch_orders",
    name: "Dispatch Orders",
    description: "Dispatch/ship orders",
    category: "Order Management",
    module: "logistics"
  },
  {
    key: "can_manage_all_orders",
    name: "Manage All Orders",
    description: "Manage orders across all companies (system admin)",
    category: "Order Management",
    module: "sales"
  },

  // Quote Management
  {
    key: "can_create_quotes",
    name: "Create Quotes",
    description: "Create new quotes",
    category: "Quote Management",
    module: "sales"
  },
  {
    key: "can_view_quotes",
    name: "View Quotes",
    description: "View quote information and lists",
    category: "Quote Management",
    module: "sales"
  },
  {
    key: "can_update_quotes",
    name: "Update Quotes",
    description: "Update quote details",
    category: "Quote Management",
    module: "sales"
  },
  {
    key: "can_delete_quotes",
    name: "Delete Quotes",
    description: "Delete quotes",
    category: "Quote Management",
    module: "sales"
  },
  {
    key: "can_manage_all_quotes",
    name: "Manage All Quotes",
    description: "Manage quotes across all companies",
    category: "Quote Management",
    module: "sales"
  },

  // Product Management
  {
    key: "can_create_products",
    name: "Create Products",
    description: "Create new products",
    category: "Product Management",
    module: "inventory"
  },
  {
    key: "can_view_products",
    name: "View Products",
    description: "View product information and catalogs",
    category: "Product Management",
    module: "inventory"
  },
  {
    key: "can_update_products",
    name: "Update Products",
    description: "Update product details",
    category: "Product Management",
    module: "inventory"
  },
  {
    key: "can_delete_products",
    name: "Delete Products",
    description: "Delete products",
    category: "Product Management",
    module: "inventory"
  },
  {
    key: "can_manage_inventory",
    name: "Manage Inventory",
    description: "Manage product inventory levels",
    category: "Product Management",
    module: "inventory"
  },

  // Serial Number Management
  {
    key: "can_create_serial_numbers",
    name: "Create Serial Numbers",
    description: "Create new serial numbers",
    category: "Serial Number Management",
    module: "inventory"
  },
  {
    key: "can_view_serial_numbers",
    name: "View Serial Numbers",
    description: "View serial number information",
    category: "Serial Number Management",
    module: "inventory"
  },
  {
    key: "can_update_serial_numbers",
    name: "Update Serial Numbers",
    description: "Update serial number details",
    category: "Serial Number Management",
    module: "inventory"
  },
  {
    key: "can_delete_serial_numbers",
    name: "Delete Serial Numbers",
    description: "Delete serial numbers",
    category: "Serial Number Management",
    module: "inventory"
  },
  {
    key: "can_assign_serial_numbers_to_batches",
    name: "Assign Serial Numbers to Batches",
    description: "Assign serial numbers to batches",
    category: "Serial Number Management",
    module: "inventory"
  },

  // Product Receipt Management
  {
    key: "can_create_product_receipts",
    name: "Create Product Receipts",
    description: "Create new product receipts",
    category: "Product Receipt Management",
    module: "product-receipt"
  },
  {
    key: "can_view_product_receipts",
    name: "View Product Receipts",
    description: "View product receipt information",
    category: "Product Receipt Management",
    module: "product-receipt"
  },
  {
    key: "can_update_product_receipts",
    name: "Update Product Receipts",
    description: "Update product receipt details",
    category: "Product Receipt Management",
    module: "product-receipt"
  },
  {
    key: "can_delete_product_receipts",
    name: "Delete Product Receipts",
    description: "Delete product receipts",
    category: "Product Receipt Management",
    module: "product-receipt"
  },

  // Purchase Order Management
  {
    key: "can_create_purchase_orders",
    name: "Create Purchase Orders",
    description: "Create new purchase orders",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },
  {
    key: "can_view_purchase_orders",
    name: "View Purchase Orders",
    description: "View purchase order information",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },
  {
    key: "can_update_purchase_orders",
    name: "Update Purchase Orders",
    description: "Update purchase order details",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },
  {
    key: "can_delete_purchase_orders",
    name: "Delete Purchase Orders",
    description: "Delete purchase orders",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },
  {
    key: "can_receive_purchase_orders",
    name: "Receive Purchase Orders",
    description: "Mark purchase orders as received",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },
  {
    key: "can_manage_all_purchase_orders",
    name: "Manage All Purchase Orders",
    description: "Manage purchase orders across all companies",
    category: "Purchase Order Management",
    module: "purchase-orders"
  },

  // Requisition Management
  {
    key: "can_create_requisitions",
    name: "Create Requisitions",
    description: "Create new requisitions",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_view_requisitions",
    name: "View Requisitions",
    description: "View requisition information",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_update_requisitions",
    name: "Update Requisitions",
    description: "Update requisition details",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_delete_requisitions",
    name: "Delete Requisitions",
    description: "Delete requisitions",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_approve_requisitions",
    name: "Approve Requisitions",
    description: "Approve/reject requisitions",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_acknowledge_requisitions",
    name: "Acknowledge Requisitions",
    description: "Acknowledge requisition completion",
    category: "Requisition Management",
    module: "requisitions"
  },
  {
    key: "can_manage_all_requisitions",
    name: "Manage All Requisitions",
    description: "Manage requisitions across all companies",
    category: "Requisition Management",
    module: "requisitions"
  },

  // Breakage Management
  {
    key: "can_create_breakages",
    name: "Create Breakages",
    description: "Create new breakage reports",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_view_breakages",
    name: "View Breakages",
    description: "View breakage information",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_update_breakages",
    name: "Update Breakages",
    description: "Update breakage details",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_delete_breakages",
    name: "Delete Breakages",
    description: "Delete breakage records",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_approve_breakages",
    name: "Approve Breakages",
    description: "Approve/reject breakage claims",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_replace_breakage_items",
    name: "Replace Breakage Items",
    description: "Replace items due to breakage",
    category: "Breakage Management",
    module: "breakages"
  },
  {
    key: "can_manage_all_breakages",
    name: "Manage All Breakages",
    description: "Manage breakages across all companies",
    category: "Breakage Management",
    module: "breakages"
  },

  // Payment Management
  {
    key: "can_create_payments",
    name: "Create Payments",
    description: "Create new payments",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_view_payments",
    name: "View Payments",
    description: "View payment information",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_update_payments",
    name: "Update Payments",
    description: "Update payment details",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_delete_payments",
    name: "Delete Payments",
    description: "Delete payment records",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_refund_payments",
    name: "Refund Payments",
    description: "Process payment refunds",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_manage_payments",
    name: "Manage Payments",
    description: "General payment management",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_manage_all_payments",
    name: "Manage All Payments",
    description: "Manage payments across all companies",
    category: "Payment Management",
    module: "payments"
  },
  {
    key: "can_view_payment_reports",
    name: "View Payment Reports",
    description: "View payment reports and analytics",
    category: "Payment Management",
    module: "payments"
  },

  // Supplier Management
  {
    key: "can_create_suppliers",
    name: "Create Suppliers",
    description: "Create new suppliers",
    category: "Supplier Management",
    module: "suppliers"
  },
  {
    key: "can_view_suppliers",
    name: "View Suppliers",
    description: "View supplier information",
    category: "Supplier Management",
    module: "suppliers"
  },
  {
    key: "can_update_suppliers",
    name: "Update Suppliers",
    description: "Update supplier details",
    category: "Supplier Management",
    module: "suppliers"
  },
  {
    key: "can_delete_suppliers",
    name: "Delete Suppliers",
    description: "Delete suppliers",
    category: "Supplier Management",
    module: "suppliers"
  },
  {
    key: "can_manage_suppliers",
    name: "Manage Suppliers",
    description: "General supplier management operations",
    category: "Supplier Management",
    module: "suppliers"
  },

  // Sales Management
  {
    key: "can_view_sales_menu",
    name: "View Sales Menu",
    description: "Access to the sales section in the main navigation menu",
    category: "Sales Management",
    module: "sales"
  },
  
  // Orders Management
  {
    key: "can_view_orders_menu",
    name: "View Orders Menu",
    description: "Access to the orders section in the main navigation menu",
    category: "Order Management",
    module: "sales"
  },
  
  // Quotes Management
  {
    key: "can_view_quotes_menu",
    name: "View Quotes Menu",
    description: "Access to the quotes section in the main navigation menu",
    category: "Quote Management",
    module: "sales"
  },
  
  // Invoices Management
  {
    key: "can_view_invoices_menu",
    name: "View Invoices Menu",
    description: "Access to the invoices section in the main navigation menu",
    category: "Invoicing",
    module: "sales"
  },
  
  // Products Management
  {
    key: "can_view_products_menu",
    name: "View Products Menu",
    description: "Access to the products section in the main navigation menu",
    category: "Product Management",
    module: "inventory"
  },
  
  // Serial Numbers Management
  {
    key: "can_view_serial_numbers_menu",
    name: "View Serial Numbers Menu",
    description: "Access to the serial numbers section in the main navigation menu",
    category: "Serial Number Management",
    module: "inventory"
  },
  
  // Stock Counts Management
  {
    key: "can_view_stock_counts_menu",
    name: "View Stock Counts Menu",
    description: "Access to the stock counts section in the main navigation menu",
    category: "Inventory Management",
    module: "inventory"
  },
  
  // Payment Reports Management
  {
    key: "can_view_payment_reports_menu",
    name: "View Payment Reports Menu",
    description: "Access to the payment reports section in the main navigation menu",
    category: "Payment Management",
    module: "finance"
  },
  
  // Analytics Dashboard Management
  {
    key: "can_view_analytics_dashboard_menu",
    name: "View Analytics Dashboard Menu",
    description: "Access to the analytics dashboard section in the main navigation menu",
    category: "Reporting & Analytics",
    module: "analytics"
  },
  
  // Finance Dashboard Management
  {
    key: "can_view_finance_dashboard_menu",
    name: "View Finance Dashboard Menu",
    description: "Access to the finance dashboard section in the main navigation menu",
    category: "Financial Reporting",
    module: "finance"
  },
  
  // Logistics Management
  {
    key: "can_view_logistics_menu",
    name: "View Logistics Menu",
    description: "Access to the logistics section in the main navigation menu",
    category: "Logistics Management",
    module: "logistics"
  },
  
  // Dispatch Management
  {
    key: "can_view_dispatch_menu",
    name: "View Dispatch Menu",
    description: "Access to the dispatch section in the main navigation menu",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_create_order_dispatches",
    name: "Create Order Dispatches",
    description: "Create dispatches from orders",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_view_order_dispatches",
    name: "View Order Dispatches",
    description: "View order dispatch details and lists",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_update_order_dispatches",
    name: "Update Order Dispatches",
    description: "Update order dispatches in draft status",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_delete_order_dispatches",
    name: "Delete Order Dispatches",
    description: "Delete order dispatches in draft status",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_submit_dispatches_for_approval",
    name: "Submit Dispatches for Approval",
    description: "Submit order dispatches for approval workflow",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_approve_dispatches",
    name: "Approve Dispatches",
    description: "Approve order dispatches in approval workflow",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_reject_dispatches",
    name: "Reject Dispatches",
    description: "Reject order dispatches in approval workflow",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_create_dispatch_logistics",
    name: "Create Dispatch Logistics",
    description: "Create logistics from approved dispatches",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_mark_dispatches_delivered",
    name: "Mark Dispatches Delivered",
    description: "Mark dispatches as delivered with delivery confirmation",
    category: "Dispatch Management",
    module: "logistics"
  },
  {
    key: "can_manage_dispatch_settings",
    name: "Manage Dispatch Settings",
    description: "Manage company dispatch approval settings and default approvers",
    category: "Dispatch Management",
    module: "logistics"
  },
  
  // Product Receipt Management
  {
    key: "can_view_product_receipt_menu",
    name: "View Product Receipt Menu",
    description: "Access to the product receipt section in the main navigation menu",
    category: "Product Receipt Management",
    module: "inventory"
  },
  
  // Requisitions Management
  {
    key: "can_view_requisitions_menu",
    name: "View Requisitions Menu",
    description: "Access to the requisitions section in the main navigation menu",
    category: "Requisitions Management",
    module: "inventory"
  },
  
  // Breakages Management
  {
    key: "can_view_breakages_menu",
    name: "View Breakages Menu",
    description: "Access to the breakages section in the main navigation menu",
    category: "Breakages Management",
    module: "inventory"
  },
  
  // Repairs Management
  {
    key: "can_view_repairs_menu",
    name: "View Repairs Menu",
    description: "Access to the repairs section in the main navigation menu",
    category: "Repairs Management",
    module: "inventory"
  },
  
  // Payments Management
  {
    key: "can_view_payments_menu",
    name: "View Payments Menu",
    description: "Access to the payments section in the main navigation menu",
    category: "Payments Management",
    module: "finance"
  },
  
  // Suppliers Management
  {
    key: "can_view_suppliers_menu",
    name: "View Suppliers Menu",
    description: "Access to the suppliers section in the main navigation menu",
    category: "Suppliers Management",
    module: "procurement"
  },
  
  // Purchase Orders Management
  {
    key: "can_view_purchase_orders_menu",
    name: "View Purchase Orders Menu",
    description: "Access to the purchase orders section in the main navigation menu",
    category: "Purchase Orders Management",
    module: "procurement"
  },
  
  // Expenses Management
  {
    key: "can_view_expenses_menu",
    name: "View Expenses Menu",
    description: "Access to the expenses section in the main navigation menu",
    category: "Expenses Management",
    module: "finance"
  },
  
  // Finance Management
  {
    key: "can_view_finance_menu",
    name: "View Finance Menu",
    description: "Access to the finance section in the main navigation menu",
    category: "Finance Management",
    module: "finance"
  },
  
  // HR & Payroll Management
  {
    key: "can_view_employees_menu",
    name: "View HR & Payroll Menu",
    description: "Access to the HR & payroll section in the main navigation menu",
    category: "HR Management",
    module: "hr"
  },
  {
    key: "can_view_payroll_menu",
    name: "View Payroll Menu",
    description: "Access to the payroll section in the main navigation menu",
    category: "Payroll Management",
    module: "hr"
  },
  
  // POS Management
  {
    key: "can_view_pos_menu",
    name: "View POS Menu",
    description: "Access to the POS section in the main navigation menu",
    category: "POS Management",
    module: "sales"
  },
  {
    key: "can_view_pos",
    name: "View POS",
    description: "Access to the Point of Sale interface",
    category: "POS Management",
    module: "sales"
  },

  // Chat Management
  {
    key: "can_view_chat_menu",
    name: "View Chat Menu",
    description: "Access to the chat section in the main navigation menu",
    category: "Chat Management",
    module: "communication"
  },
  
  // Reports Management
  {
    key: "can_view_reports_menu",
    name: "View Reports Menu",
    description: "Access to the reports section in the main navigation menu",
    category: "Reports Management",
    module: "reports"
  },
  
  // HR Dashboard Management
  {
    key: "can_view_hr_dashboard_menu",
    name: "View HR Dashboard Menu",
    description: "Access to the HR dashboard section in the main navigation menu",
    category: "HR Management",
    module: "hr"
  },
  
  // Settings Management
  {
    key: "can_view_settings_menu",
    name: "View Settings Menu",
    description: "Access to the settings section in the main navigation menu",
    category: "Settings Management",
    module: "settings"
  },
  
  // Inventory Management
  {
    key: "can_view_inventory_menu",
    name: "View Inventory Menu",
    description: "Access to the inventory section in the main navigation menu",
    category: "Inventory Management",
    module: "inventory"
  },
  
  // Inventory & Stock Management
  {
    key: "can_view_inventory",
    name: "View Inventory",
    description: "View inventory levels and reports",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_update_inventory",
    name: "Update Inventory",
    description: "Update inventory quantities",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_manage_stock_counts",
    name: "Manage Stock Counts",
    description: "Perform stock counts and adjustments",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_view_stock_counts",
    name: "View Stock Counts",
    description: "View stock count information",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_create_stock_counts",
    name: "Create Stock Counts",
    description: "Create new stock counts",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_update_stock_counts",
    name: "Update Stock Counts",
    description: "Update stock count details",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_delete_stock_counts",
    name: "Delete Stock Counts",
    description: "Delete stock count records",
    category: "Inventory Management",
    module: "inventory"
  },
  {
    key: "can_dispatch_items",
    name: "Dispatch Items",
    description: "Dispatch inventory items",
    category: "Inventory Management",
    module: "logistics"
  },

  // Document Management
  {
    key: "can_create_documents",
    name: "Create Documents",
    description: "Create new documents",
    category: "Document Management",
    module: "documents"
  },
  {
    key: "can_view_documents",
    name: "View Documents",
    description: "View document information",
    category: "Document Management",
    module: "documents"
  },
  {
    key: "can_update_documents",
    name: "Update Documents",
    description: "Update document details",
    category: "Document Management",
    module: "documents"
  },
  {
    key: "can_delete_documents",
    name: "Delete Documents",
    description: "Delete documents",
    category: "Document Management",
    module: "documents"
  },

  // Logistics Management
  {
    key: "can_create_logistics",
    name: "Create Logistics",
    description: "Create new logistics entries",
    category: "Logistics Management",
    module: "logistics"
  },
  {
    key: "can_view_logistics",
    name: "View Logistics",
    description: "View logistics information",
    category: "Logistics Management",
    module: "logistics"
  },
  {
    key: "can_update_logistics",
    name: "Update Logistics",
    description: "Update logistics details",
    category: "Logistics Management",
    module: "logistics"
  },
  {
    key: "can_delete_logistics",
    name: "Delete Logistics",
    description: "Delete logistics records",
    category: "Logistics Management",
    module: "logistics"
  },
  {
    key: "can_manage_all_logistics",
    name: "Manage All Logistics",
    description: "Manage logistics across all companies",
    category: "Logistics Management",
    module: "logistics"
  },

  // Financial Management - Banking & Accounts
  {
    key: "can_view_bank_accounts",
    name: "View Bank Accounts",
    description: "View bank account information",
    category: "Banking & Accounts",
    module: "finance"
  },
  {
    key: "can_create_bank_accounts",
    name: "Create Bank Accounts",
    description: "Create new bank accounts",
    category: "Banking & Accounts",
    module: "finance"
  },
  {
    key: "can_update_bank_accounts",
    name: "Update Bank Accounts",
    description: "Update bank account details",
    category: "Banking & Accounts",
    module: "finance"
  },
  {
    key: "can_delete_bank_accounts",
    name: "Delete Bank Accounts",
    description: "Delete bank accounts",
    category: "Banking & Accounts",
    module: "finance"
  },
  {
    key: "can_view_bank_transactions",
    name: "View Bank Transactions",
    description: "View bank transaction records",
    category: "Banking & Accounts",
    module: "finance"
  },
  {
    key: "can_update_bank_transactions",
    name: "Update Bank Transactions",
    description: "Update bank transaction records",
    category: "Banking & Accounts",
    module: "finance"
  },

  // Financial Management - Chart of Accounts
  {
    key: "can_view_chart_of_accounts",
    name: "View Chart of Accounts",
    description: "View chart of accounts",
    category: "Chart of Accounts",
    module: "finance"
  },
  {
    key: "can_create_chart_of_accounts",
    name: "Create Chart of Accounts",
    description: "Create new chart of account entries",
    category: "Chart of Accounts",
    module: "finance"
  },
  {
    key: "can_update_chart_of_accounts",
    name: "Update Chart of Accounts",
    description: "Update chart of accounts",
    category: "Chart of Accounts",
    module: "finance"
  },
  {
    key: "can_delete_chart_of_accounts",
    name: "Delete Chart of Accounts",
    description: "Delete chart of account entries",
    category: "Chart of Accounts",
    module: "finance"
  },

  // Financial Management - Budgets
  {
    key: "can_view_budgets",
    name: "View Budgets",
    description: "View budget information",
    category: "Budgets",
    module: "finance"
  },
  {
    key: "can_manage_budgets",
    name: "Manage Budgets",
    description: "Manage budget planning and tracking",
    category: "Budgets",
    module: "finance"
  },

  // Financial Management - Expenses
  {
    key: "can_view_expenses",
    name: "View Expenses",
    description: "View expense information",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_create_expenses",
    name: "Create Expenses",
    description: "Create expense records",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_update_expenses",
    name: "Update Expenses",
    description: "Update expense details",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_delete_expenses",
    name: "Delete Expenses",
    description: "Delete expense records",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_approve_expenses",
    name: "Approve Expenses",
    description: "Approve/reject expense claims",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_delete_approved_expenses",
    name: "Delete Approved Expenses",
    description: "Delete approved expenses",
    category: "Expenses",
    module: "expenses"
  },
  {
    key: "can_manage_all_expenses",
    name: "Manage All Expenses",
    description: "Manage expenses across all companies",
    category: "Expenses",
    module: "expenses"
  },

  // Financial Management - Accounts Payable & Receivable
  {
    key: "can_view_accounts_payable",
    name: "View Accounts Payable",
    description: "View accounts payable information",
    category: "Accounts Payable & Receivable",
    module: "finance"
  },
  {
    key: "can_manage_accounts_payable",
    name: "Manage Accounts Payable",
    description: "Manage accounts payable",
    category: "Accounts Payable & Receivable",
    module: "finance"
  },
  {
    key: "can_view_accounts_receivable",
    name: "View Accounts Receivable",
    description: "View accounts receivable information",
    category: "Accounts Payable & Receivable",
    module: "finance"
  },
  {
    key: "can_manage_accounts_receivable",
    name: "Manage Accounts Receivable",
    description: "Manage accounts receivable",
    category: "Accounts Payable & Receivable",
    module: "finance"
  },

  // Financial Management - Financial Reporting
  {
    key: "can_view_financial_reports",
    name: "View Financial Reports",
    description: "View financial reports and analytics",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_manage_all_finance",
    name: "Manage All Finance",
    description: "Manage all financial operations across companies",
    category: "Financial Reporting",
    module: "finance"
  },

  // Financial Management - Fixed Assets
  {
    key: "can_view_fixed_assets",
    name: "View Fixed Assets",
    description: "View fixed asset records",
    category: "Fixed Assets",
    module: "finance"
  },
  {
    key: "can_create_fixed_assets",
    name: "Create Fixed Assets",
    description: "Create new fixed asset records",
    category: "Fixed Assets",
    module: "finance"
  },
  {
    key: "can_update_fixed_assets",
    name: "Update Fixed Assets",
    description: "Update fixed asset details",
    category: "Fixed Assets",
    module: "finance"
  },
  {
    key: "can_delete_fixed_assets",
    name: "Delete Fixed Assets",
    description: "Delete fixed asset records",
    category: "Fixed Assets",
    module: "finance"
  },
  {
    key: "can_calculate_depreciation",
    name: "Calculate Depreciation",
    description: "Calculate asset depreciation",
    category: "Fixed Assets",
    module: "finance"
  },

  // Financial Management - Tax Management
  {
    key: "can_update_tax_rates",
    name: "Update Tax Rates",
    description: "Update tax rate information",
    category: "Tax Management",
    module: "finance"
  },

  // Financial Management - Journal Entries
  {
    key: "can_view_journal_entries",
    name: "View Journal Entries",
    description: "View journal entries",
    category: "Journal Entries",
    module: "finance"
  },

  // Financial Management - General Ledger
  {
    key: "can_view_general_ledger",
    name: "View General Ledger",
    description: "View general ledger",
    category: "General Ledger",
    module: "finance"
  },
  
  // Financial Management - Trial Balance
  {
    key: "can_view_trial_balance",
    name: "View Trial Balance",
    description: "View trial balance",
    category: "Trial Balance",
    module: "finance"
  },
  
  // Invoicing
  {
    key: "can_view_invoices",
    name: "View Invoices",
    description: "View invoice information",
    category: "Invoicing",
    module: "sales"
  },
  {
    key: "can_create_invoices",
    name: "Create Invoices",
    description: "Create new invoices",
    category: "Invoicing",
    module: "sales"
  },
  {
    key: "can_update_invoices",
    name: "Update Invoices",
    description: "Update invoice details",
    category: "Invoicing",
    module: "sales"
  },
  {
    key: "can_delete_invoices",
    name: "Delete Invoices",
    description: "Delete invoices",
    category: "Invoicing",
    module: "sales"
  },

  // Employee & Payroll Management
  {
    key: "can_create_employees",
    name: "Create Employees",
    description: "Create new employee records",
    category: "Employee Management",
    module: "hr"
  },
  {
    key: "can_view_employees",
    name: "View Employees",
    description: "View employee information",
    category: "Employee Management",
    module: "hr"
  },
  {
    key: "can_update_employees",
    name: "Update Employees",
    description: "Update employee details",
    category: "Employee Management",
    module: "hr"
  },
  {
    key: "can_delete_employees",
    name: "Delete Employees",
    description: "Delete employee records",
    category: "Employee Management",
    module: "hr"
  },
  {
    key: "can_manage_payroll",
    name: "Manage Payroll",
    description: "Manage payroll processing",
    category: "Payroll Management",
    module: "hr"
  },
  {
    key: "can_view_payroll",
    name: "View Payroll",
    description: "View payroll information",
    category: "Payroll Management",
    module: "hr"
  },

  // Store Management
  {
    key: "can_create_stores",
    name: "Create Stores",
    description: "Create new store locations",
    category: "Store Management",
    module: "inventory"
  },
  {
    key: "can_view_stores",
    name: "View Stores",
    description: "View store information",
    category: "Store Management",
    module: "inventory"
  },
  {
    key: "can_update_stores",
    name: "Update Stores",
    description: "Update store details",
    category: "Store Management",
    module: "inventory"
  },
  {
    key: "can_delete_stores",
    name: "Delete Stores",
    description: "Delete stores",
    category: "Store Management",
    module: "inventory"
  },

  // Category Management
  {
    key: "can_create_categories",
    name: "Create Categories",
    description: "Create new product categories",
    category: "Category Management",
    module: "inventory"
  },
  {
    key: "can_view_categories",
    name: "View Categories",
    description: "View category information",
    category: "Category Management",
    module: "inventory"
  },
  {
    key: "can_update_categories",
    name: "Update Categories",
    description: "Update category details",
    category: "Category Management",
    module: "inventory"
  },
  {
    key: "can_update_product_categories",
    name: "Update Product Categories",
    description: "Update product category details",
    category: "Category Management",
    module: "inventory"
  },
  {
    key: "can_delete_categories",
    name: "Delete Categories",
    description: "Delete categories",
    category: "Category Management",
    module: "inventory"
  },

  // Delivery Management
  {
    key: "can_create_deliveries",
    name: "Create Deliveries",
    description: "Create new delivery records",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_view_deliveries",
    name: "View Deliveries",
    description: "View delivery information",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_update_deliveries",
    name: "Update Deliveries",
    description: "Update delivery details",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_update_dispatches",
    name: "Update Dispatches",
    description: "Update dispatch records",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_delete_deliveries",
    name: "Delete Deliveries",
    description: "Delete delivery records",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_create_delivery_persons",
    name: "Create Delivery Persons",
    description: "Create delivery personnel records",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_update_delivery_persons",
    name: "Update Delivery Persons",
    description: "Update delivery personnel information",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_deactivate_delivery_persons",
    name: "Deactivate Delivery Persons",
    description: "Deactivate delivery personnel",
    category: "Delivery Management",
    module: "logistics"
  },
  {
    key: "can_manage_delivery_persons",
    name: "Manage Delivery Persons",
    description: "Manage delivery personnel",
    category: "Delivery Management",
    module: "logistics"
  },

  // Repair Management
  {
    key: "can_create_repairs",
    name: "Create Repairs",
    description: "Create new repair records",
    category: "Repair Management",
    module: "repairs"
  },
  {
    key: "can_view_repairs",
    name: "View Repairs",
    description: "View repair information",
    category: "Repair Management",
    module: "repairs"
  },
  {
    key: "can_update_repairs",
    name: "Update Repairs",
    description: "Update repair details",
    category: "Repair Management",
    module: "repairs"
  },
  {
    key: "can_delete_repairs",
    name: "Delete Repairs",
    description: "Delete repair records",
    category: "Repair Management",
    module: "repairs"
  },

  // Communication & Chat
  {
    key: "can_manage_chat",
    name: "Manage Chat",
    description: "Manage chat system functionality",
    category: "Communication",
    module: "chat"
  },
  {
    key: "can_view_conversations",
    name: "View Conversations",
    description: "View customer conversations",
    category: "Communication",
    module: "chat"
  },
  {
    key: "can_send_messages",
    name: "Send Messages",
    description: "Send messages to customers",
    category: "Communication",
    module: "chat"
  },
  {
    key: "can_manage_whatsapp",
    name: "Manage WhatsApp",
    description: "Manage WhatsApp integration",
    category: "Communication",
    module: "chat"
  },

  // Subscription Management
  {
    key: "can_view_subscriptions",
    name: "View Subscriptions",
    description: "View subscription information",
    category: "Subscription Management",
    module: "admin"
  },
  {
    key: "can_manage_subscription_plans",
    name: "Manage Subscription Plans",
    description: "Manage subscription plans",
    category: "Subscription Management",
    module: "admin"
  },
  {
    key: "can_upgrade_subscriptions",
    name: "Upgrade Subscriptions",
    description: "Upgrade/downgrade subscriptions",
    category: "Subscription Management",
    module: "admin"
  },

  // M-Pesa & Payment Integration
  {
    key: "can_manage_mpesa_config",
    name: "Manage M-Pesa Config",
    description: "Manage M-Pesa configuration",
    category: "Payment Integration",
    module: "payments"
  },
  {
    key: "can_view_mpesa_transactions",
    name: "View M-Pesa Transactions",
    description: "View M-Pesa transaction history",
    category: "Payment Integration",
    module: "payments"
  },
  {
    key: "can_process_mpesa_payments",
    name: "Process M-Pesa Payments",
    description: "Process M-Pesa payments",
    category: "Payment Integration",
    module: "payments"
  },

  // Asset Management
  {
    key: "can_view_assets_menu",
    name: "View Assets Menu",
    description: "Access to the assets section in the main navigation menu",
    category: "Menu Permissions",
    module: "assets"
  },
  {
    key: "can_view_assets",
    name: "View Assets",
    description: "View the company asset register",
    category: "Asset Management",
    module: "assets"
  },
  {
    key: "can_create_assets",
    name: "Create Assets",
    description: "Add and import assets",
    category: "Asset Management",
    module: "assets"
  },
  {
    key: "can_update_assets",
    name: "Update Assets",
    description: "Edit existing assets",
    category: "Asset Management",
    module: "assets"
  },
  {
    key: "can_delete_assets",
    name: "Delete Assets",
    description: "Remove assets from the register",
    category: "Asset Management",
    module: "assets"
  },
  {
    key: "can_manage_assets",
    name: "Manage Assets",
    description: "Full management of the asset register",
    category: "Asset Management",
    module: "assets"
  },

  // Reporting & Analytics
  {
    key: "can_view_dashboard_menu",
    name: "View Dashboard Menu",
    description: "Access to the dashboard section in the main navigation menu",
    category: "Menu Permissions",
    module: "dashboard"
  },
  {
    key: "can_view_dashboard",
    name: "View Dashboard",
    description: "Access main dashboard",
    category: "Reporting & Analytics",
    module: "dashboard"
  },
  {
    key: "can_view_reports",
    name: "View Reports",
    description: "View general reports",
    category: "Reporting & Analytics",
    module: "reports"
  },
  {
    key: "can_export_data",
    name: "Export Data",
    description: "Export data to various formats",
    category: "Reporting & Analytics",
    module: "reports"
  },
  {
    key: "can_view_analytics",
    name: "View Analytics",
    description: "View analytics and insights",
    category: "Reporting & Analytics",
    module: "analytics"
  },
  
  // Financial Reports
  {
    key: "can_view_balance_sheet",
    name: "View Balance Sheet",
    description: "View balance sheet reports",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_view_income_statement",
    name: "View Income Statement",
    description: "View income statement reports",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_view_cash_flow_statement",
    name: "View Cash Flow Statement",
    description: "View cash flow statement reports",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_view_financial_ratios",
    name: "View Financial Ratios",
    description: "View financial ratios reports",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_view_account_aging",
    name: "View Account Aging",
    description: "View account aging reports",
    category: "Financial Reporting",
    module: "finance"
  },
  {
    key: "can_view_budget_variance",
    name: "View Budget Variance",
    description: "View budget variance reports",
    category: "Financial Reporting",
    module: "finance"
  },

  // User & Role Management
  {
    key: "can_create_users",
    name: "Create Users",
    description: "Create new user accounts",
    category: "User Management",
    module: "admin"
  },
  {
    key: "can_view_users",
    name: "View Users",
    description: "View user information",
    category: "User Management",
    module: "admin"
  },
  {
    key: "can_update_users",
    name: "Update Users",
    description: "Update user details",
    category: "User Management",
    module: "admin"
  },
  {
    key: "can_delete_users",
    name: "Delete Users",
    description: "Delete user accounts",
    category: "User Management",
    module: "admin"
  },
  {
    key: "can_create_roles",
    name: "Create Roles",
    description: "Create new roles",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_view_roles",
    name: "View Roles",
    description: "View role information",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_update_roles",
    name: "Update Roles",
    description: "Update role details",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_delete_roles",
    name: "Delete Roles",
    description: "Delete roles",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_assign_roles",
    name: "Assign Roles",
    description: "Assign roles to users",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_view_all_roles",
    name: "View All Roles",
    description: "View all roles across companies",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_manage_roles",
    name: "Manage Roles",
    description: "Manage user roles",
    category: "Role Management",
    module: "admin"
  },
  {
    key: "can_assign_permissions",
    name: "Assign Permissions",
    description: "Assign permissions to roles/users",
    category: "Permission Management",
    module: "admin"
  },

  // System Administration
  {
    key: "can_access_admin_portal",
    name: "Access Admin Portal",
    description: "Access administrative portal",
    category: "System Administration",
    module: "admin"
  },
  {
    key: "can_manage_system_permissions",
    name: "Manage System Permissions",
    description: "Manage system-level permissions",
    category: "Permission Management",
    module: "admin"
  }
];

// Group permissions by module for easier access
export const MODULE_PERMISSIONS: Record<string, PermissionDefinition[]> = 
  PERMISSIONS_MAP.reduce((acc: Record<string, PermissionDefinition[]>, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {});

// Group permissions by category for UI organization
export const CATEGORY_PERMISSIONS: Record<string, PermissionDefinition[]> = 
  PERMISSIONS_MAP.reduce((acc: Record<string, PermissionDefinition[]>, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {});

// Export permission keys for easy access
export const PERMISSION_KEYS = PERMISSIONS_MAP.map(p => p.key);
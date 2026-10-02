<?php

use App\Http\Controllers\ProductReceiptController;
use App\Http\Controllers\MpesaTransactionController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\DeliveryPersonController;
use App\Http\Controllers\DeliveryLocationController;
use App\Http\Controllers\DeliveryDetailController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ImageController;
use App\Http\Controllers\StockCountController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\LogisticController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\SupplierPaymentController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\MessageTemplateController;
use App\Http\Controllers\MetaPlatformCredentialController;
// Finance Controllers
use App\Http\Controllers\ChartOfAccountController;
use App\Http\Controllers\JournalEntryController;
use App\Http\Controllers\GeneralLedgerController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\BankTransactionController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\PayrollConfigurationController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\SalaryAdvanceController;
use App\Http\Controllers\EmployeeSelfServiceController;
use App\Http\Controllers\DailyWorkReportController;
use App\Http\Controllers\TimeEntryController;
use App\Http\Controllers\TaxRateController;
use App\Http\Controllers\FinancialReportController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\FixedAssetController;
use App\Http\Controllers\FinancialPeriodController;
// New Finance Controllers
use App\Http\Controllers\BankReconciliationController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\AccountsPayableController;
use App\Http\Controllers\AccountsReceivableController;
use App\Http\Controllers\AssetDepreciationController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\CompanyMpesaConfigController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ChequeController;
use App\Http\Controllers\CreditNoteController;
use App\Http\Controllers\ProductCategoryController;
// Dashboard Controllers
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DashboardWidgetController;
use App\Http\Controllers\ReportController;

use App\Http\Controllers\RepairController;

use App\Http\Controllers\PermissionController;
use App\Http\Controllers\CustomerAccountController;
use App\Http\Controllers\CustomerAccountApprovalController;
use App\Http\Controllers\CustomerApprovalController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\SopController;
use App\Http\Controllers\SopAnnexureController;
use App\Http\Controllers\SopAnnexureEntryController;
use App\Http\Controllers\SopCommentController;

// Ensure route parameter 'payroll' only matches UUIDs so literal segments like "bulk" aren't
// accidentally treated as a payroll id by resource routes (prevents collisions).
Route::pattern('payroll', '[0-9a-fA-F\-]{36}');

Route::post('/register', [UserController::class, 'createNewUser']);
Route::post('/login', [UserController::class, 'login']);

// Company branding assets (logo/letterhead), served with CORS headers so they can
// load into <img crossorigin> for PDF export. This must be an actual route (not a
// static public/ file) because php artisan serve serves existing public/ files
// directly, bypassing all middleware/headers entirely.
Route::get('/company-assets/{filename}', [CompanyController::class, 'asset']);
Route::withoutMiddleware([\Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class, 'auth:sanctum'])->group(function () {
    Route::post('/users/send-password-reset-link', [UserController::class, 'sendPasswordResetLink']);
    Route::post('/users/{userId}/set-password', [UserController::class, 'setPasswordAfterVerification']);
});

// Temporary signed SOP document access (frontend viewer fallback without auth headers)
Route::get('/sops/{id}/document/public-view', [SopController::class, 'publicViewDocument'])
    ->name('sops.document.public-view')
    ->middleware('signed');

Route::middleware('auth:sanctum')->group(function () {

    // Employees
    Route::get('employees', [EmployeeController::class, 'index']); // List employees
    Route::get('employees/statistics', [EmployeeController::class, 'statistics']);
    Route::get('employees/{id}', [EmployeeController::class, 'show']); // Show employee details
    Route::post('employees', [EmployeeController::class, 'store']); // Create employee
    Route::match(['patch', 'put'], 'employees/{id}', [EmployeeController::class, 'update']); // Update employee
    Route::post('employees/{id}/terminate', [EmployeeController::class, 'terminate']);
    Route::delete('employees/{id}', [EmployeeController::class, 'destroy']); // Delete employee
    Route::get('employment-types', [EmployeeController::class, 'getEmploymentTypes']); // Employment types

    // Payroll Runs (Kingston-style)
    Route::get('payroll-runs/stats', [\App\Http\Controllers\PayrollRunController::class, 'stats']);
    Route::get('payroll-runs', [\App\Http\Controllers\PayrollRunController::class, 'index']);
    Route::post('payroll-runs', [\App\Http\Controllers\PayrollRunController::class, 'store']);
    Route::get('payroll-runs/{id}', [\App\Http\Controllers\PayrollRunController::class, 'show']);
    Route::post('payroll-runs/{id}/process', [\App\Http\Controllers\PayrollRunController::class, 'process']);
    Route::post('payroll-runs/{id}/approve', [\App\Http\Controllers\PayrollRunController::class, 'approve']);
    Route::post('payroll-runs/{id}/mark-paid', [\App\Http\Controllers\PayrollRunController::class, 'markPaid']);
    Route::get('payroll-runs/{id}/payslips', [\App\Http\Controllers\PayrollRunController::class, 'payslips']);
    Route::get('payroll-runs/{id}/payslips/{payslipId}/download', [\App\Http\Controllers\PayrollRunController::class, 'downloadPayslip']);
    Route::put('payroll-runs/{id}/payslips/{payslipId}', [\App\Http\Controllers\PayrollRunController::class, 'updatePayslip']);
    Route::get('payroll-runs/{id}/export/p10', [\App\Http\Controllers\PayrollRunController::class, 'exportP10']);
    Route::get('payroll-runs/{id}/export/csv', [\App\Http\Controllers\PayrollRunController::class, 'exportCsv']);

    // Employee Allowances & Deductions
    Route::get('employees/{employeeId}/allowances', [\App\Http\Controllers\EmployeeAllowanceController::class, 'index']);
    Route::post('employees/{employeeId}/allowances', [\App\Http\Controllers\EmployeeAllowanceController::class, 'store']);
    Route::put('employees/{employeeId}/allowances/{id}', [\App\Http\Controllers\EmployeeAllowanceController::class, 'update']);
    Route::delete('employees/{employeeId}/allowances/{id}', [\App\Http\Controllers\EmployeeAllowanceController::class, 'destroy']);

    // Legacy payroll routes (kept for backward compatibility)
    Route::post('payroll/bulk', [PayrollController::class, 'processBulkPayroll']);
    Route::apiResource('payroll', PayrollController::class);
    Route::post('payroll/{id}/approve',  [PayrollController::class, 'approve']);
    Route::post('payroll/{id}/pay',      [PayrollController::class, 'pay']);
    Route::post('payroll/{id}/cancel',   [PayrollController::class, 'cancel']);
    Route::get('payroll/{id}/payslip',   [PayrollController::class, 'payslip']);
    Route::get('payroll-company-summary', [PayrollController::class, 'getCompanyPayrollSummary']);

    // Payroll Configuration (versioned statutory rates)
    Route::get('payroll-configurations/current', [PayrollConfigurationController::class, 'current']);
    Route::apiResource('payroll-configurations', PayrollConfigurationController::class);

    // Leave Management
    Route::apiResource('leave-requests', LeaveController::class);
    Route::post('leave-requests/{id}/approve', [LeaveController::class, 'approve']);

    // Salary Advances
    Route::apiResource('salary-advances', SalaryAdvanceController::class);
    Route::post('salary-advances/{id}/approve', [SalaryAdvanceController::class, 'approve']);

    // Daily Work Reports (skip Sundays; workers -> GM, GM -> Managing Director)
    Route::get('daily-reports', [DailyWorkReportController::class, 'index']);
    Route::get('daily-reports/{id}', [DailyWorkReportController::class, 'show']);
    Route::post('daily-reports/{id}/approve', [DailyWorkReportController::class, 'approve']);
    Route::post('daily-reports/{id}/reject', [DailyWorkReportController::class, 'reject']);

    Route::get('employee-portal/me', [EmployeeSelfServiceController::class, 'me']);
    Route::get('employee-portal/leave-requests', [EmployeeSelfServiceController::class, 'leaveIndex']);
    Route::post('employee-portal/leave-requests', [EmployeeSelfServiceController::class, 'leaveStore']);
    Route::get('employee-portal/salary-advances', [EmployeeSelfServiceController::class, 'salaryAdvanceIndex']);
    Route::post('employee-portal/salary-advances', [EmployeeSelfServiceController::class, 'salaryAdvanceStore']);
    Route::get('employee-portal/daily-reports', [EmployeeSelfServiceController::class, 'dailyReportIndex']);
    Route::post('employee-portal/daily-reports', [EmployeeSelfServiceController::class, 'dailyReportStore']);
    Route::delete('employee-portal/daily-reports/{id}', [EmployeeSelfServiceController::class, 'dailyReportDestroy']);

    // Time Entries
    Route::apiResource('time-entries', TimeEntryController::class);
    Route::post('time-entries/{id}/approve', [TimeEntryController::class, 'approve']);

    // Image serving routes (authenticated access to private images)
    Route::get('/images/view', [ImageController::class, 'show']);
    Route::post('/images/signed-url', [ImageController::class, 'getSignedUrl']);
    Route::post('/images/batch-signed-urls', [ImageController::class, 'getBatchSignedUrls']);

    // Inventory batch management routes
    Route::get('/products/{product}/inventory/summary', [ProductController::class, 'getInventorySummary']);
    Route::get('/products/{product}/inventory/batches', [ProductController::class, 'getInventoryBatches']);
    Route::post('/products/{product}/inventory/batches', [ProductController::class, 'createInventoryBatch']);
    Route::get('/products/{product}/inventory/batches/{batch}', [ProductController::class, 'getInventoryBatch']);
    Route::put('/products/{product}/inventory/batches/{batch}', [ProductController::class, 'updateInventoryBatch']);
    Route::post('/products/{product}/inventory/batches/{batch}/allocate', [ProductController::class, 'allocateInventoryBatch']);
    Route::post('/products/{product}/inventory/batches/{batch}/sell', [ProductController::class, 'recordBatchSale']);
    Route::post('/products/{product}/inventory/batches/{batch}/adjust', [ProductController::class, 'adjustInventoryBatch']);

    // Product-level inventory management
    Route::get('/products/{product}/inventory/availability', [ProductController::class, 'getProductBatchAvailability']);
    Route::post('/products/{product}/inventory/adjust-stock', [ProductController::class, 'adjustProductStock']);
    Route::get('/products/{product}/inventory/movements', [ProductController::class, 'getInventoryMovements']);
    Route::get('/products/{product}/inventory/expiring', [ProductController::class, 'getExpiringBatches']);

    // Company-wide inventory routes
    Route::get('/inventory/summary', [ProductController::class, 'getInventorySummary']);
    Route::get('/inventory/batches', [ProductController::class, 'getInventoryBatches']);
    Route::get('/inventory/movements', [ProductController::class, 'getInventoryMovements']);
    Route::get('/inventory/expiring', [ProductController::class, 'getExpiringBatches']);
    Route::get('/inventory/low-stock', [ProductController::class, 'getLowStockProducts']);
    Route::post('/inventory/bulk-allocate', [ProductController::class, 'bulkAllocateInventory']);

    // Serial number tracking
    Route::get('/inventory/track-serial/{serial_number}', [ProductController::class, 'trackSerialNumber']);

    // Individual Serial Number Management Routes
    Route::get('/serials', [ProductController::class, 'getAllSerialNumbers']);
    Route::get('/serials/statistics', [ProductController::class, 'getSerialsStatistics']);
    Route::post('/products/{product}/serials', [ProductController::class, 'addProductSerialNumbers']);
    Route::get('/products/{product}/serials', [ProductController::class, 'getProductSerialNumbers']);
    Route::patch('/serials/{serial}', [ProductController::class, 'updateProductSerial']);
    Route::delete('/serials/{serial}', [ProductController::class, 'deleteProductSerial']);
    Route::post('/serials/{serial}/mark-sold', [ProductController::class, 'markSerialAsSold']);
    Route::post('/serials/{serial}/mark-returned', [ProductController::class, 'markSerialAsReturned']);
    Route::get('/serials/track/{serial_number}', [ProductController::class, 'trackIndividualSerial']);
    Route::get('/serials/warranty-expiring', [ProductController::class, 'getWarrantyExpiringSerials']);
    Route::post('/serials/bulk-generate', [ProductController::class, 'bulkGenerateSerialNumbers']);

    // Receipt integration
    Route::post('/inventory/create-batches-from-receipt', [ProductController::class, 'createBatchesFromReceipt']);

    // User management routes
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'createInternalUser']);
    Route::get('/users/{id}', [UserController::class, 'show']); // View user details
    Route::match(['patch', 'put'], '/users/{id}', [UserController::class, 'update']); // Update user (supports role_id + permission_ids)
    Route::post('/users/{id}/soft-delete', [UserController::class, 'softDelete']);
    Route::post('/users/{id}/terminate', [UserController::class, 'terminate']);
    Route::post('/users/{id}/restore', [UserController::class, 'restore']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']); // soft by default, ?hard=true for permanent
    // Password reset routes are public (outside auth:sanctum group)

    Route::post('/logout', [UserController::class, 'logout']);

    Route::apiResource('stock-counts', StockCountController::class);

    // Stock Adjustment routes
    Route::get('/stock-adjustments', [StockAdjustmentController::class, 'index']);
    Route::get('/stock-adjustments/statistics', [StockAdjustmentController::class, 'statistics']);
    Route::get('/stock-adjustments/activities', [StockAdjustmentController::class, 'activities']);
    Route::post('/stock-adjustments/bulk', [StockAdjustmentController::class, 'bulkStore']);
    Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);
    Route::get('/stock-adjustments/{id}', [StockAdjustmentController::class, 'show']);
    Route::get('/stock-adjustments/{id}/activities', [StockAdjustmentController::class, 'adjustmentActivities']);
    Route::patch('/stock-adjustments/{id}', [StockAdjustmentController::class, 'update']);
    Route::delete('/stock-adjustments/{id}', [StockAdjustmentController::class, 'destroy']);
    Route::post('/stock-adjustments/{id}/approve', [StockAdjustmentController::class, 'approve']);
    Route::post('/stock-adjustments/{id}/reject', [StockAdjustmentController::class, 'reject']);
    Route::post('/stock-adjustments/{id}/apply', [StockAdjustmentController::class, 'apply']);

    Route::get('/roles', [RoleController::class, 'fetchRoles']);
    Route::post('/roles', [RoleController::class, 'createRole']);
    Route::post('/roles/{roleId}/assign-permissions', [PermissionController::class, 'assignToRole']);
    Route::get('/roles', [RoleController::class, 'getAllRoles']);
    Route::post('/roles', [RoleController::class, 'createRole']);
    Route::patch('/roles/{roleId}', [RoleController::class, 'updateRole']);
    Route::delete('/roles/{roleId}', [RoleController::class, 'deleteRole']);
    Route::post('/roles/{roleId}/clone', [RoleController::class, 'cloneRole']);
    Route::get('/roles/{roleId}/permissions', [RoleController::class, 'showRolePermissions']);



    Route::post('/users/{userId}/assign-role', [RoleController::class, 'assignRole']);
    Route::patch('/permissions/{roleId}', [RoleController::class, 'updatePermissions']);

    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::post('/permissions', [PermissionController::class, 'store']);
    Route::patch('/permissions/{permissionId}', [PermissionController::class, 'update']);
    Route::delete('/permissions/{permissionId}', [PermissionController::class, 'destroy']);
    Route::post('/permissions/bulk-create', [PermissionController::class, 'bulkCreate']);
    Route::get('/permissions/categories', [PermissionController::class, 'getCategories']);


    // Customer routes
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::patch('/update_customer/{customerId}', [CustomerController::class, 'update']);
    Route::match(['patch', 'put'], '/customers/{customerId}', [CustomerController::class, 'update'])->name('customers.update');
    Route::get('/customers/{customer_id}/profile', [CustomerController::class, 'showProfile'])->name('customers.profile');
    Route::get('/customers/{customer_id}/statement', [CustomerController::class, 'statement'])->name('customers.statement');
    Route::get('/customers/{customerId}/credit-terms', [CustomerController::class, 'creditTerms'])->name('customers.credit-terms');
    Route::delete('/customers/{customerId}', [CustomerController::class, 'destroy'])->name('customers.destroy');

    // Customer document routes
    Route::get('/customers/{customerId}/documents', [CustomerController::class, 'getDocuments'])->name('customers.documents.index');
    Route::post('/customers/{customerId}/documents', [CustomerController::class, 'createDocument'])->name('customers.documents.store');

    // Two-stage credit-approval workflow for rep-created customers
    Route::get('/customers/{customerId}/approvals', [CustomerApprovalController::class, 'index']);
    Route::post('/customers/{customerId}/approvals', [CustomerApprovalController::class, 'store']);
    Route::post('/customers/{customerId}/signed-application', [CustomerApprovalController::class, 'uploadSignedApplication']);
    Route::post('/customers/{customerId}/stamped-application', [CustomerApprovalController::class, 'uploadStampedApplication']);

    // Customer Account routes
    Route::get('/customer-accounts', [CustomerAccountController::class, 'index']);
    Route::post('/customer-accounts', [CustomerAccountController::class, 'store']);
    Route::get('/customer-accounts/{id}', [CustomerAccountController::class, 'show']);
    Route::match(['patch', 'put'], '/customer-accounts/{id}', [CustomerAccountController::class, 'update']);
    Route::delete('/customer-accounts/{id}', [CustomerAccountController::class, 'destroy']);

    // Credit limit update request route
    Route::post('/customer-accounts/{id}/request-credit-update', [CustomerAccountController::class, 'requestCreditLimitUpdate']);

    // Customer account approval workflows
    Route::get('/customer-accounts/{id}/approvals', [CustomerAccountApprovalController::class, 'index']);
    Route::post('/customer-accounts/{id}/approvals', [CustomerAccountApprovalController::class, 'store']);
    Route::post('/customer-accounts/{id}/request-credit-limit-update', [CustomerAccountController::class, 'requestCreditLimitUpdate']);
    // Document routes
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents/{id}', [DocumentController::class, 'show']);
    Route::match(['patch', 'put'], '/documents/{id}', [DocumentController::class, 'update']);
    Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

    // Generic media upload (used for ad-hoc attachments not tied to an
    // existing entity yet, e.g. an expense receipt uploaded before the
    // Expense record is created)
    Route::post('/media/upload', [MediaController::class, 'upload']);

    // Company routes
    Route::get('/companies', [CompanyController::class, 'getCompanies']);
    Route::post('/companies', [CompanyController::class, 'store']);
    Route::get('/companies/{companyId}', [CompanyController::class, 'show']);
    Route::match(['patch', 'put'], '/companies/{companyId}', [CompanyController::class, 'update']);


    Route::prefix('whs')->group(function () {
        // Update status of one or more repair items

        // Repairs routes
        Route::post('repairs', [RepairController::class, 'store']); // Create a new repair
        Route::post('repairs/{repairId}/assign-items', [RepairController::class, 'assignRepairItem']); // Assign repair items
        Route::get('repairs', [RepairController::class, 'index']); // List all repairs
        Route::get('repairs/{id}', [RepairController::class, 'show']); // Get a single repair
        Route::match(['patch', 'put'], 'repairs/{id}', [RepairController::class, 'update']); // Update a repair and its items
        Route::patch('repairs/{id}/approve', [RepairController::class, 'approve']); // Approve a repair
        Route::patch('repairs/{id}/complete', [RepairController::class, 'complete']); // Mark a repair as completed
        Route::match(['patch', 'put'], 'repairs/{repairId}/items/status', [RepairController::class, 'updateItemStatus']);
        Route::delete('repairs/{id}', [RepairController::class, 'destroy']);


        // Mark a breakage item as replaced via a dispatch
        Route::post('breakages/{breakage}/items/{item}/replace', [\App\Http\Controllers\BreakageController::class, 'replaceItemViaDispatch']);

        // Product Receipt summary route (must be before resource route)
        Route::get('product-receipts/summary', [ProductReceiptController::class, 'getReceiptSummary'])->name('product-receipts.summary');
        Route::get('product-receipts/batch-summary', [ProductReceiptController::class, 'getBatchSummary'])->name('product-receipts.batch-summary');
        Route::apiResource('product-receipts', ProductReceiptController::class);

        // Breakage routes
        Route::get('breakages', [\App\Http\Controllers\BreakageController::class, 'index']); // List all breakages
        Route::post('breakages', [\App\Http\Controllers\BreakageController::class, 'store']); // Create a new breakage
        Route::get('breakages/my-assignable-items', [\App\Http\Controllers\BreakageController::class, 'myAssignableItems']); // List items assigned to the logged-in user and acknowledged
        Route::get('breakages/{id}', [\App\Http\Controllers\BreakageController::class, 'show']); // Get a single breakage
        Route::match(['patch', 'put'], 'breakages/{id}', [\App\Http\Controllers\BreakageController::class, 'update']); // Update a breakage
        Route::delete('breakages/{id}', [\App\Http\Controllers\BreakageController::class, 'destroy']); // Delete a breakage
        Route::patch('breakages/{id}/approve', [\App\Http\Controllers\BreakageController::class, 'approve']); // Approve/reject a breakage
        Route::get('breakages/my', [\App\Http\Controllers\BreakageController::class, 'myBreakages']); // List breakages for the logged-in user
        Route::get('breakages/company/{companyId}', [\App\Http\Controllers\BreakageController::class, 'companyBreakages']); // List breakages for a company
        Route::post('breakage-items/{itemId}/upload-image', [\App\Http\Controllers\BreakageController::class, 'uploadImage']); // Upload image for a breakage item


        // Dispatch (Transfers/Dispatch) routes
        Route::get('dispatches', [\App\Http\Controllers\DispatchController::class, 'index']); // List all dispatches
        Route::post('dispatches', [\App\Http\Controllers\DispatchController::class, 'store']); // Create a new dispatch
        Route::get('dispatches/{id}', [\App\Http\Controllers\DispatchController::class, 'show']); // Get a single dispatch
        Route::match(['patch', 'put'], 'dispatches/{id}', [\App\Http\Controllers\DispatchController::class, 'update']); // Update a dispatch
        Route::delete('dispatches/{id}', [\App\Http\Controllers\DispatchController::class, 'destroy']); // Delete a dispatch
        Route::patch('dispatches/{id}/acknowledge', [\App\Http\Controllers\DispatchController::class, 'acknowledge']); // Acknowledge receipt of items
        Route::patch('dispatches/{id}/return', [\App\Http\Controllers\DispatchController::class, 'markReturned']); // Mark items as returned
        Route::get('dispatches/overdue', [\App\Http\Controllers\DispatchController::class, 'overdue']); // List overdue dispatch items
        Route::get('dispatches/{id}/requisition-note', [\App\Http\Controllers\DispatchController::class, 'printRequisitionNote']); // Download requisition note PDF

        // Requisition routes
        Route::get('requisitions', [\App\Http\Controllers\RequisitionController::class, 'index']); // List all requisitions
        Route::post('requisitions', [\App\Http\Controllers\RequisitionController::class, 'store']); // Create a new requisition
        Route::get('requisitions/{id}', [\App\Http\Controllers\RequisitionController::class, 'show']); // Get a single requisition
        Route::get('requisitions/{id}/official-purpose', [\App\Http\Controllers\RequisitionController::class, 'printOfficialPurpose']); // Download Official Purpose PDF
        Route::match(['patch', 'put'], 'requisitions/{id}', [\App\Http\Controllers\RequisitionController::class, 'update']); // Update a requisition
        Route::delete('requisitions/{id}', [\App\Http\Controllers\RequisitionController::class, 'destroy']); // Delete a requisition
        Route::patch('requisitions/{id}/approve', [\App\Http\Controllers\RequisitionController::class, 'approve']); // Approve a requisition
        Route::patch('requisitions/{id}/acknowledge', [\App\Http\Controllers\RequisitionController::class, 'acknowledge']); // Acknowledge receipt


    });


    // System Admin Company Management routes
    Route::prefix('admin')->middleware('system.admin')->group(function () {
        Route::get('/companies', [App\Http\Controllers\CompanyManagementController::class, 'getAllCompanies']);
        Route::get('/companies/{companyId}', [App\Http\Controllers\CompanyManagementController::class, 'getCompanyDetails']);
        Route::patch('/companies/{companyId}/status', [App\Http\Controllers\CompanyManagementController::class, 'toggleCompanyStatus']);
        Route::post('/companies/{companyId}/subscription', [App\Http\Controllers\CompanyManagementController::class, 'manageSubscription']);
        Route::delete('/companies/{companyId}/subscription', [App\Http\Controllers\CompanyManagementController::class, 'cancelSubscription']);
        Route::post('/companies/{companyId}/payment', [App\Http\Controllers\CompanyManagementController::class, 'recordPayment']);
        Route::get('/subscription-stats', [App\Http\Controllers\CompanyManagementController::class, 'getSubscriptionStats']);

        // Admin User Management routes
        Route::get('/users', [App\Http\Controllers\AdminUserController::class, 'getAllUsers']);
        Route::get('/companies/{companyId}/users', [App\Http\Controllers\AdminUserController::class, 'getCompanyUsers']);
        Route::post('/users', [App\Http\Controllers\AdminUserController::class, 'createUser']);
        Route::patch('/users/{userId}', [App\Http\Controllers\AdminUserController::class, 'updateUser']);
        Route::patch('/users/{userId}/status', [App\Http\Controllers\AdminUserController::class, 'toggleUserStatus']);
        Route::post('/users/{userId}/terminate', [App\Http\Controllers\AdminUserController::class, 'terminateUser']);
        Route::post('/users/{userId}/restore', [App\Http\Controllers\AdminUserController::class, 'restoreUser']);
        Route::delete('/users/{userId}', [App\Http\Controllers\AdminUserController::class, 'deleteUser']);
        Route::get('/users/{userId}/activity', [App\Http\Controllers\AdminUserController::class, 'getUserActivity']);
        Route::post('/users/bulk', [App\Http\Controllers\AdminUserController::class, 'bulkOperation']);
        Route::get('/users/export', [App\Http\Controllers\AdminUserController::class, 'exportUsers']);

        // Admin Role Management routes

        Route::get('/permissions', [RoleController::class, 'getAvailablePermissions']);

        // ...existing code...
        // Permission Management routes (moved from system.admin group)
    });

    // Subscription Plan Management routes
    Route::apiResource('subscription-plans', App\Http\Controllers\SubscriptionPlanController::class);
    Route::patch('/subscription-plans/{planId}/status', [App\Http\Controllers\SubscriptionPlanController::class, 'toggleStatus']);
    Route::get('/subscription-plans-stats', [App\Http\Controllers\SubscriptionPlanController::class, 'getStatistics']);

    // Order routes
    Route::get('/orders', [OrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{id}', [OrderController::class, 'show'])->name('orders.show');
    Route::post('/orders', [OrderController::class, 'store'])->name('orders.store');
    Route::match(['patch', 'put'], '/orders/{id}', [OrderController::class, 'update'])->name('orders.update');
    Route::delete('/orders/{id}', [OrderController::class, 'destroy'])->name('orders.destroy');
    Route::post('/orders/{id}/dispatch', [OrderController::class, 'dispatch'])->name('orders.dispatch');

    // Quote routes
    Route::get('/quotes', [QuoteController::class, 'index']);
    Route::get('/quotes/sales-reps', [QuoteController::class, 'salesReps'])->name('quotes.salesReps');
    Route::get('/quotes/{quoteId}', [QuoteController::class, 'show'])->name('quotes.show');
    Route::patch('/quotes/{quoteId}/sales-rep', [QuoteController::class, 'assignSalesRep'])->name('quotes.assignSalesRep');
    Route::post('/quotes', [QuoteController::class, 'store'])->name('quotes.store');
    Route::match(['patch', 'put'], '/quotes/{quoteId}', [QuoteController::class, 'update'])->name('quotes.update');
    Route::delete('/quotes/{id}', [QuoteController::class, 'destroy'])->name('quotes.destroy');
    Route::post('/quotes/{quoteId}/convert-to-order', [QuoteController::class, 'convertToOrder'])->name('quotes.convertToOrder');
    Route::post('/quotes/{quoteId}/confirm', [QuoteController::class, 'confirm'])->name('quotes.confirm');
    Route::post('/quotes/{quoteId}/request-changes', [QuoteController::class, 'requestChanges'])->name('quotes.requestChanges');
    Route::post('/quotes/{id}/send', [QuoteController::class, 'sendQuote'])->name('quotes.send');
    // Delivery Person routes
    Route::get('/delivery-people', [DeliveryPersonController::class, 'index']);
    Route::get('/delivery-people/{id}', [DeliveryPersonController::class, 'show']);
    Route::post('/delivery-people', [DeliveryPersonController::class, 'store']);
    Route::match(['put', 'patch'], '/delivery-people/{id}', [DeliveryPersonController::class, 'update']);
    Route::delete('/delivery-people/{id}', [DeliveryPersonController::class, 'destroy']);

    // Delivery Location routes
    Route::get('/delivery-locations', [DeliveryLocationController::class, 'index']);
    Route::get('/delivery-locations/customer/{customerId}', [DeliveryLocationController::class, 'customerLocations']);
    Route::get('/delivery-locations/{id}', [DeliveryLocationController::class, 'show']);
    Route::post('/delivery-locations', [DeliveryLocationController::class, 'store']);
    Route::post('/delivery-locations/{id}', [DeliveryLocationController::class, 'update']);
    Route::delete('/delivery-locations/{id}', [DeliveryLocationController::class, 'destroy']);

    // Delivery Detail routes
    Route::get('/delivery-details', [DeliveryDetailController::class, 'index']);
    Route::get('/delivery-details/{id}', [DeliveryDetailController::class, 'show']);
    Route::post('/delivery-details', [DeliveryDetailController::class, 'store']);
    Route::match(['put', 'patch'], '/delivery-details/{id}', [DeliveryDetailController::class, 'update']);
    Route::delete('/delivery-details/{id}', [DeliveryDetailController::class, 'destroy']);
    Route::patch('/delivery-details/{id}/status', [DeliveryDetailController::class, 'updateStatus']);

    // Store routes
    Route::get('/stores', [StoreController::class, 'index'])->name('stores.index');
    Route::post('/stores', [StoreController::class, 'store'])->name('stores.store');
    Route::match(['patch', 'put'], '/stores/{id}', [StoreController::class, 'update'])->name('stores.update');
    Route::delete('/stores/{id}/deactivate', [StoreController::class, 'deactivate'])->name('stores.deactivate');

    // Product routes
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/summary', [ProductController::class, 'getProductSummary'])->name('products.summary');
    Route::get('/products/{id}', [ProductController::class, 'show'])->name('products.show');
    Route::post('/products', [ProductController::class, 'store'])->name('products.store');
    Route::post('products/bulk', [ProductController::class, 'bulkStore']);
    Route::match(['patch', 'put'], '/products/{id}', [ProductController::class, 'update'])->name('products.update');
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->name('products.destroy');

    // Product Packaging routes
    Route::post('/products/{productId}/packaging/setup', [\App\Http\Controllers\ProductPackagingController::class, 'setupPackaging']);
    Route::get('/products/{productId}/packaging/units', [\App\Http\Controllers\ProductPackagingController::class, 'getPackagingUnits']);
    Route::post('/products/{productId}/packaging/units', [\App\Http\Controllers\ProductPackagingController::class, 'addPackagingUnit']);
    Route::put('/packaging/units/{unitId}', [\App\Http\Controllers\ProductPackagingController::class, 'updatePackagingUnit']);
    Route::delete('/packaging/units/{unitId}', [\App\Http\Controllers\ProductPackagingController::class, 'deletePackagingUnit']);
    Route::post('/products/{productId}/packaging/calculate-breakdown', [\App\Http\Controllers\ProductPackagingController::class, 'calculateBreakdown']);
    Route::post('/packaging/convert', [\App\Http\Controllers\ProductPackagingController::class, 'convertUnits']);
    Route::get('/products/{productId}/packaging/inventory', [\App\Http\Controllers\ProductPackagingController::class, 'getInventorySummary']);
    Route::post('/products/{productId}/packaging/inventory/add', [\App\Http\Controllers\ProductPackagingController::class, 'addInventory']);
    Route::post('/products/{productId}/packaging/inventory/transfer', [\App\Http\Controllers\ProductPackagingController::class, 'transferInventory']);
    Route::post('/products/{productId}/packaging/inventory/initialize', [\App\Http\Controllers\ProductPackagingController::class, 'initializeInventory']);
    Route::get('/products/{productId}/packaging/validate', [\App\Http\Controllers\ProductPackagingController::class, 'validateConfiguration']);
    Route::delete('/products/{productId}/packaging', [\App\Http\Controllers\ProductPackagingController::class, 'disablePackaging']);

    // Product Inventory Management routes
    Route::get('/products/inventory/summary', [ProductController::class, 'getInventorySummary']);
    Route::get('/products/inventory/movements', [ProductController::class, 'getInventoryMovements']);
    Route::get('/products/inventory/batches', [ProductController::class, 'getInventoryBatches']);
    Route::get('/products/inventory/expiring', [ProductController::class, 'getExpiringBatches']);
    Route::get('/products/inventory/low-stock', [ProductController::class, 'getLowStockProducts']);

    // Product-specific inventory routes
    Route::get('/products/{id}/inventory/batches', [ProductController::class, 'getProductBatchAvailability']);
    Route::get('/products/{id}/inventory/movements', [ProductController::class, 'getInventoryMovements']);
    Route::get('/products/{id}/inventory/expiring', [ProductController::class, 'getExpiringBatches']);
    Route::post('/products/{id}/inventory/adjust', [ProductController::class, 'adjustProductStock']);

    // Batch-specific routes
    Route::post('/products/{id}/inventory/batches', [ProductController::class, 'createInventoryBatch']);
    Route::get('/products/{productId}/inventory/batches/{batchId}', [ProductController::class, 'getInventoryBatch']);
    Route::patch('/products/{productId}/inventory/batches/{batchId}', [ProductController::class, 'updateInventoryBatch']);
    Route::post('/products/{productId}/inventory/batches/{batchId}/allocate', [ProductController::class, 'allocateInventoryBatch']);
    Route::post('/products/{productId}/inventory/batches/{batchId}/sell', [ProductController::class, 'recordBatchSale']);
    Route::post('/products/{productId}/inventory/batches/{batchId}/adjust', [ProductController::class, 'adjustInventoryBatch']);

    // Product Category routes
    Route::get('/product-categories', [ProductCategoryController::class, 'index'])->name('product_categories.index');
    Route::get('/product-categories/{id}', [ProductCategoryController::class, 'show'])->name('product_categories.show');
    Route::post('/product-categories', [ProductCategoryController::class, 'store'])->name('product_categories.store');
    Route::match(['patch', 'put'], '/product-categories/{id}', [ProductCategoryController::class, 'update'])->name('product_categories.update');
    Route::delete('/product-categories/{id}', [ProductCategoryController::class, 'destroy'])->name('product_categories.destroy');

    // Logistics routes
    Route::get('/logistics', [LogisticController::class, 'index'])->name('logistics.index');
    Route::get('/logistics/{id}', [LogisticController::class, 'show'])->name('logistics.show');
    Route::post('/logistics', [LogisticController::class, 'store'])->name('logistics.store');
    Route::match(['patch', 'put'], '/logistics/{id}', [LogisticController::class, 'update'])->name('logistics.update');
    Route::post('/logistics/{id}/upload-delivery-note', [LogisticController::class, 'uploadDeliveryNote'])->name('logistics.upload-delivery-note');
    Route::post('/logistics/{id}/review-delivery-note', [LogisticController::class, 'reviewDeliveryNote'])->name('logistics.review-delivery-note');

    // Delivery Rates (per-transporter, per-zone; warehouse manager creates, GM/Director approves)
    Route::get('/delivery-rates', [\App\Http\Controllers\DeliveryRateController::class, 'index']);
    Route::get('/delivery-rates/{id}', [\App\Http\Controllers\DeliveryRateController::class, 'show']);
    Route::post('/delivery-rates', [\App\Http\Controllers\DeliveryRateController::class, 'store']);
    Route::match(['patch', 'put'], '/delivery-rates/{id}', [\App\Http\Controllers\DeliveryRateController::class, 'update']);
    Route::post('/delivery-rates/{id}/approve', [\App\Http\Controllers\DeliveryRateController::class, 'approve']);
    Route::post('/delivery-rates/{id}/reject', [\App\Http\Controllers\DeliveryRateController::class, 'reject']);
    Route::delete('/delivery-rates/{id}', [\App\Http\Controllers\DeliveryRateController::class, 'destroy']);

    // Delivery Invoices (auto-created when logistics is created with a rate; accountant pays)
    Route::get('/delivery-invoices', [\App\Http\Controllers\DeliveryInvoiceController::class, 'index']);
    Route::get('/delivery-invoices/export/excel', [\App\Http\Controllers\DeliveryInvoiceController::class, 'exportExcel']);
    Route::get('/delivery-invoices/{id}', [\App\Http\Controllers\DeliveryInvoiceController::class, 'show']);
    Route::post('/delivery-invoices/{id}/pay', [\App\Http\Controllers\DeliveryInvoiceController::class, 'pay']);
    Route::post('/delivery-invoices/{id}/cancel', [\App\Http\Controllers\DeliveryInvoiceController::class, 'cancel']);

    // Delivery Notes (auto-generated once a dispatch is marked delivered)
    Route::get('/delivery-notes', [\App\Http\Controllers\DeliveryNoteController::class, 'index']);
    Route::get('/delivery-notes/{id}', [\App\Http\Controllers\DeliveryNoteController::class, 'show']);

    // Payment routes
    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
    Route::get('/payments/{id}', [PaymentController::class, 'show'])->name('payments.show');
    Route::post('/payments', [PaymentController::class, 'store'])->name('payments.store');
    Route::match(['patch', 'put'], '/payments/{id}', [PaymentController::class, 'update'])->name('payments.update');
    Route::post('/payments/{id}/refund', [PaymentController::class, 'refund'])->name('payments.refund');
    Route::get('/payment-reports', [PaymentController::class, 'reports'])->name('payments.reports');

    // Expense Category routes
    Route::get('/expense-categories', [ExpenseCategoryController::class, 'index'])->name('expense_categories.index');
    Route::get('/expense-categories/{id}', [ExpenseCategoryController::class, 'show'])->name('expense_categories.show');
    Route::post('/expense-categories', [ExpenseCategoryController::class, 'store'])->name('expense_categories.store');
    Route::match(['patch', 'put'], '/expense-categories/{id}', [ExpenseCategoryController::class, 'update'])->name('expense_categories.update');
    Route::delete('/expense-categories/{id}', [ExpenseCategoryController::class, 'destroy'])->name('expense_categories.destroy');

    // Expense routes
    Route::get('/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
    Route::get('/expenses/{id}', [ExpenseController::class, 'show'])->name('expenses.show');
    Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
    Route::match(['patch', 'put'], '/expenses/{id}', [ExpenseController::class, 'update'])->name('expenses.update');
    Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');
    Route::post('/expenses/{id}/approve', [ExpenseController::class, 'approve'])->name('expenses.approve');
    Route::post('/expenses/{id}/reject', [ExpenseController::class, 'reject'])->name('expenses.reject');
    Route::post('/expenses/{id}/mark-as-paid', [ExpenseController::class, 'markAsPaid'])->name('expenses.mark_as_paid');
    Route::get('/expense-summary', [ExpenseController::class, 'summary'])->name('expenses.summary');

    // Debt routes
    Route::apiResource('debts', DebtController::class);
    Route::get('debts/customers', [DebtController::class, 'customersWithDebt']);
    Route::match(['patch', 'put'], 'debts/order/{order_id}', [DebtController::class, 'updateByOrderId']);

    // Supplier routes
    Route::apiResource('suppliers', SupplierController::class);

    // Purchase Order routes
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::post('/purchase-orders/{id}/receipt', [PurchaseOrderController::class, 'receive'])->name('purchase-orders.receive');
    Route::post('/purchase-orders/{id}/approve', [PurchaseOrderController::class, 'approve'])->name('purchase-orders.approve');

    // Supplier Payment routes
    Route::apiResource('supplier-payments', SupplierPaymentController::class);

    // Mpesa config endpoints
    Route::apiResource('company-mpesa-configs', CompanyMpesaConfigController::class);

    // Mpesa transaction endpoints
    Route::apiResource('mpesa-transaction', MpesaTransactionController::class);

    Route::get('mpesa-transactions', [MpesaTransactionController::class, 'index']);
    Route::post('mpesa-transactions/trigger', [MpesaTransactionController::class, 'triggerPayment']);
    Route::post('mpesa-transactions/incoming', [MpesaTransactionController::class, 'handleIncomingPayment']);
});

// M-Pesa callback route (no auth)
Route::post('/api/mpesa/callback', [PaymentController::class, 'mpesaCallback'])->name('mpesa.callback');


// Mpesa STK callback
Route::post('mpesa-transactions/stk-callback', [MpesaTransactionController::class, 'handleStkCallback']);
Route::post('mpesa-transactions/incoming', [MpesaTransactionController::class, 'handleIncomingPayment']);


Route::get('/email/verify/{id}/{hash}', function (Request $request, $id, $hash) {
    $user = User::find($id);

    if (!$user) {
        $frontendUrl = config('app.frontend_url', 'https://cherry360.africa');
        if ($request->expectsJson()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'User not found'
            ], 404);
        }
        return redirect($frontendUrl . '/sign-in?error=user_not_found');
    }

    // Use the frontend URL stored with the user (from when they were created)
    $frontendUrl = $user->frontend_url ?? config('app.frontend_url', 'https://cherry360.africa');
    $frontendUrl = rtrim($frontendUrl, '/');

    if (!hash_equals($hash, sha1($user->email))) {
        if ($request->expectsJson()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid verification link'
            ], 400);
        }
        return redirect($frontendUrl . '/sign-in?error=invalid_link');
    }

    if ($user->hasVerifiedEmail()) {
        if ($request->expectsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => 'Email already verified'
            ], 200);
        }
        // Redirect to password setup page if already verified
        return redirect($frontendUrl . '/set-password?token=' . $user->password_setup_token . '&id=' . $user->id);
    }

    try {
        $user->forceFill(['email_verified' => true])->save();
    } catch (\Exception $e) {
        Log::error('Failed to verify email for user ID: ' . $id . '. Error: ' . $e->getMessage());
        if ($request->expectsJson()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to verify email'
            ], 500);
        }
        return redirect($frontendUrl . '/sign-in?error=verification_failed');
    }

    if ($request->expectsJson()) {
        return response()->json([
            'status' => 'success',
            'message' => 'Email verified successfully'
        ], 200);
    }
    // Redirect to password setup page after successful verification
    return redirect($frontendUrl . '/set-password?token=' . $user->password_setup_token . '&id=' . $user->id);
})->name('verification.verify');

Route::middleware('auth:sanctum')->group(function () {
    // Order Dispatch Routes
    Route::prefix('order-dispatches')->group(function () {
        Route::get('/', [App\Http\Controllers\OrderDispatchController::class, 'index']);
        Route::post('/', [App\Http\Controllers\OrderDispatchController::class, 'store']);
        Route::get('/{id}', [App\Http\Controllers\OrderDispatchController::class, 'show']);
        Route::match(['patch', 'put'], '/{id}', [App\Http\Controllers\OrderDispatchController::class, 'update']);
        Route::delete('/{id}', [App\Http\Controllers\OrderDispatchController::class, 'destroy']);

        // Approval actions
        Route::post('/{id}/submit', [App\Http\Controllers\OrderDispatchController::class, 'submitForApproval']);
        Route::post('/{id}/approve', [App\Http\Controllers\OrderDispatchController::class, 'approve']);
        Route::post('/{id}/reject', [App\Http\Controllers\OrderDispatchController::class, 'reject']);

        // Logistics and delivery
        Route::post('/{id}/create-logistics', [App\Http\Controllers\OrderDispatchController::class, 'createLogistics']);
        Route::post('/{id}/mark-delivered', [App\Http\Controllers\OrderDispatchController::class, 'markDelivered']);
    });

    // Company Dispatch Settings Routes
    Route::prefix('company/dispatch-settings')->group(function () {
        Route::get('/', [App\Http\Controllers\CompanyDispatchSettingsController::class, 'getSettings']);
        Route::post('/', [App\Http\Controllers\CompanyDispatchSettingsController::class, 'updateSettings']);
        Route::get('/potential-approvers', [App\Http\Controllers\CompanyDispatchSettingsController::class, 'getPotentialApprovers']);
    });

    // Chat System Routes
    Route::prefix('chat')->group(function () {
        // Conversations
        Route::get('/conversations', [ChatController::class, 'getConversations']);
        Route::get('/conversations/{conversationId}', [ChatController::class, 'getConversation']);
        Route::post('/conversations/{conversationId}/messages', [ChatController::class, 'sendMessage']);
        Route::put('/conversations/{conversationId}/assign', [ChatController::class, 'assignConversation']);
        Route::put('/conversations/{conversationId}/close', [ChatController::class, 'closeConversation']);
        Route::put('/conversations/{conversationId}/reopen', [ChatController::class, 'reopenConversation']);
        Route::post('/conversations/{conversationId}/tags', [ChatController::class, 'addConversationTags']);
        Route::delete('/conversations/{conversationId}/tags', [ChatController::class, 'removeConversationTags']);
        Route::post('/conversations/{conversationId}/notes', [ChatController::class, 'addConversationNote']);

        // Initiate Conversations
        Route::post('/conversations/initiate', [ChatController::class, 'initiateConversation']);
        Route::post('/conversations/start-or-continue', [ChatController::class, 'startOrContinueConversation']);
        Route::post('/conversations/whatsapp/start', [ChatController::class, 'startWhatsAppConversation']);
        Route::get('/customers/available', [ChatController::class, 'getAvailableCustomers']);
        Route::get('/customers/by-phone', [ChatController::class, 'getCustomerByPhone']);
        Route::get('/debug/phone-search', [ChatController::class, 'debugPhoneSearch']);
        Route::post('/conversations/send-by-phone', [ChatController::class, 'sendMessageByPhone']);

        Route::get('/stats', [ChatController::class, 'getConversationStats']);

        // Message Templates
        Route::prefix('templates')->group(function () {
            Route::get('/', [MessageTemplateController::class, 'index']);
            Route::post('/', [MessageTemplateController::class, 'store']);
            Route::get('/{templateId}', [MessageTemplateController::class, 'show']);
            Route::put('/{templateId}', [MessageTemplateController::class, 'update']);
            Route::delete('/{templateId}', [MessageTemplateController::class, 'destroy']);
            Route::put('/{templateId}/activate', [MessageTemplateController::class, 'activate']);
            Route::put('/{templateId}/deactivate', [MessageTemplateController::class, 'deactivate']);
            Route::put('/{templateId}/approve', [MessageTemplateController::class, 'approve']);
            Route::put('/{templateId}/reject', [MessageTemplateController::class, 'reject']);
            Route::post('/{templateId}/preview', [MessageTemplateController::class, 'preview']);

            // Meta Platform Integration
            Route::post('/{templateId}/submit', [MessageTemplateController::class, 'submitForApproval']);
            Route::get('/{templateId}/status', [MessageTemplateController::class, 'checkApprovalStatus']);
            Route::delete('/{templateId}/platform', [MessageTemplateController::class, 'deleteFromPlatform']);

            // Direct platform creation (testing)
            Route::post('/create-on-platform', [MessageTemplateController::class, 'createOnPlatform']);

            Route::get('/metadata/all', [MessageTemplateController::class, 'getMetadata']);
        });

        // Platform Credentials
        Route::prefix('credentials')->group(function () {
            Route::get('/', [MetaPlatformCredentialController::class, 'index']);
            Route::post('/', [MetaPlatformCredentialController::class, 'store']);
            Route::get('/{credentialId}', [MetaPlatformCredentialController::class, 'show']);
            Route::put('/{credentialId}', [MetaPlatformCredentialController::class, 'update']);
            Route::delete('/{credentialId}', [MetaPlatformCredentialController::class, 'destroy']);
            Route::put('/{credentialId}/activate', [MetaPlatformCredentialController::class, 'activate']);
            Route::put('/{credentialId}/deactivate', [MetaPlatformCredentialController::class, 'deactivate']);
            Route::post('/{credentialId}/test', [MetaPlatformCredentialController::class, 'testCredentials']);
            Route::get('/webhook-url/{platform}', [MetaPlatformCredentialController::class, 'getWebhookUrl']);
        });
    });

    // SOP Management Routes
    Route::prefix('sops')->group(function () {
        // SOP documents
        Route::get('/', [SopController::class, 'index']);
        Route::post('/', [SopController::class, 'store']);
        Route::get('/{id}', [SopController::class, 'show']);
        Route::match(['patch', 'put'], '/{id}', [SopController::class, 'update']);
        Route::delete('/{id}', [SopController::class, 'destroy']);
        Route::get('/{id}/document/view', [SopController::class, 'viewDocument']);
        Route::get('/{id}/document/access-url', [SopController::class, 'getDocumentAccessUrl']);
        Route::get('/{id}/document/download', [SopController::class, 'downloadDocument']);
        Route::post('/{id}/email', [SopController::class, 'emailDocument']);
        Route::get('/{id}/print-data', [SopController::class, 'printData']);

        // Annexures
        Route::get('/{sopId}/annexures', [SopAnnexureController::class, 'index']);
        Route::post('/{sopId}/annexures', [SopAnnexureController::class, 'store']);
        Route::match(['patch', 'put'], '/{sopId}/annexures/{annexureId}', [SopAnnexureController::class, 'update']);
        Route::delete('/{sopId}/annexures/{annexureId}', [SopAnnexureController::class, 'destroy']);

        // Annexure entries (only assigned updater can amend)
        Route::get('/{sopId}/annexures/{annexureId}/entries', [SopAnnexureEntryController::class, 'index']);
        Route::post('/{sopId}/annexures/{annexureId}/entries', [SopAnnexureEntryController::class, 'store']);
        Route::match(['patch', 'put'], '/{sopId}/annexures/{annexureId}/entries/{entryId}', [SopAnnexureEntryController::class, 'update']);
        Route::delete('/{sopId}/annexures/{annexureId}/entries/{entryId}', [SopAnnexureEntryController::class, 'destroy']);

        // User-tracked comments (includes CAPA documents via comment_type='capa' with file upload)
        Route::get('/{sopId}/comments', [SopCommentController::class, 'index']);
        Route::post('/{sopId}/comments', [SopCommentController::class, 'store']);
        Route::get('/{sopId}/comments/{commentId}/download', [SopCommentController::class, 'downloadFile']);
        Route::get('/{sopId}/comments/{commentId}/access-url', [SopCommentController::class, 'getFileAccessUrl']);
        Route::delete('/{sopId}/comments/{commentId}', [SopCommentController::class, 'destroy']);
    });

    // Daily temperature record charts - a sub-feature of SOPs/compliance.
    Route::prefix('temperature-logs')->group(function () {
        Route::get('/', [App\Http\Controllers\TemperatureLogController::class, 'index']);
        Route::post('/', [App\Http\Controllers\TemperatureLogController::class, 'store']);
        Route::match(['patch', 'put'], '/{id}', [App\Http\Controllers\TemperatureLogController::class, 'update']);
        Route::delete('/{id}', [App\Http\Controllers\TemperatureLogController::class, 'destroy']);
    });
});

// Finance & Accounting Routes
Route::middleware('auth:sanctum')->prefix('finance')->group(function () {

    // Company Account Mappings - Configure account codes per company
    Route::get('account-mappings', [App\Http\Controllers\CompanyAccountMappingController::class, 'index']);
    Route::post('account-mappings', [App\Http\Controllers\CompanyAccountMappingController::class, 'store']);
    Route::get('account-mappings/available-keys', [App\Http\Controllers\CompanyAccountMappingController::class, 'availableKeys']);
    Route::post('account-mappings/bulk', [App\Http\Controllers\CompanyAccountMappingController::class, 'bulkUpdate']);
    Route::post('account-mappings/initialize', [App\Http\Controllers\CompanyAccountMappingController::class, 'initialize']);
    Route::get('account-mappings/validate', [App\Http\Controllers\CompanyAccountMappingController::class, 'validateConfig']);
    Route::post('account-mappings/preview-entries', [App\Http\Controllers\CompanyAccountMappingController::class, 'previewJournalEntries']);
    Route::get('account-mappings/payment-methods', [App\Http\Controllers\CompanyAccountMappingController::class, 'getPaymentMethods']);
    Route::post('account-mappings/payment-methods', [App\Http\Controllers\CompanyAccountMappingController::class, 'configurePaymentMethod']);
    Route::get('account-mappings/{id}', [App\Http\Controllers\CompanyAccountMappingController::class, 'show']);
    Route::delete('account-mappings/{id}', [App\Http\Controllers\CompanyAccountMappingController::class, 'destroy']);

    // Company Accounting Settings - Configure accounting workflow triggers per company
    Route::get('accounting-settings', [App\Http\Controllers\CompanyAccountingSettingsController::class, 'show']);
    Route::put('accounting-settings', [App\Http\Controllers\CompanyAccountingSettingsController::class, 'update']);
    Route::post('accounting-settings/reset', [App\Http\Controllers\CompanyAccountingSettingsController::class, 'reset']);
    Route::get('accounting-settings/summary', [App\Http\Controllers\CompanyAccountingSettingsController::class, 'summary']);

    // Accounting Trigger Configuration - Database-driven trigger management
    Route::prefix('accounting-triggers')->group(function () {
        // Categories
        Route::get('categories', [App\Http\Controllers\AccountingTriggerController::class, 'categories']);

        // Trigger configurations
        Route::get('/', [App\Http\Controllers\AccountingTriggerController::class, 'index']);
        Route::get('available-keys', [App\Http\Controllers\AccountingTriggerController::class, 'availableTriggerKeys']);
        Route::get('defaults', [App\Http\Controllers\AccountingTriggerController::class, 'defaults']);
        Route::post('/', [App\Http\Controllers\AccountingTriggerController::class, 'store']);
        Route::post('bulk-update-status', [App\Http\Controllers\AccountingTriggerController::class, 'bulkUpdateStatus']);
        Route::get('{id}', [App\Http\Controllers\AccountingTriggerController::class, 'show']);
        Route::put('{id}', [App\Http\Controllers\AccountingTriggerController::class, 'update']);
        Route::delete('{id}', [App\Http\Controllers\AccountingTriggerController::class, 'destroy']);
        Route::post('{id}/set-default', [App\Http\Controllers\AccountingTriggerController::class, 'setDefault']);
    });

    // Chart of Accounts
    Route::apiResource('chart-of-accounts', ChartOfAccountController::class);
    Route::get('chart-of-accounts-hierarchical', [ChartOfAccountController::class, 'index']); // alias with ?view=hierarchical
    Route::get('account-types', [ChartOfAccountController::class, 'getAccountTypes']);
    Route::get('account-subtypes', [ChartOfAccountController::class, 'getAccountSubtypes']);
    Route::get('accounts/by-type/{type}', [ChartOfAccountController::class, 'getAccountsByType']);

    // Journal Entries
    Route::apiResource('journal-entries', JournalEntryController::class);
    Route::post('journal-entries/{id}/post', [JournalEntryController::class, 'post']);
    Route::post('journal-entries/{id}/reverse', [JournalEntryController::class, 'reverse']);

    // General Ledger & Reporting
    Route::get('general-ledger', [GeneralLedgerController::class, 'getGeneralLedger']);
    Route::get('accounts/{id}/ledger', [GeneralLedgerController::class, 'getAccountLedger']);
    Route::get('trial-balance', [GeneralLedgerController::class, 'getTrialBalance']);
    Route::get('accounts/{id}/balance', [GeneralLedgerController::class, 'getAccountBalance']);
    Route::get('account-types', [GeneralLedgerController::class, 'getAccountTypes']);

    // Bank Accounts
    Route::apiResource('bank-accounts', BankAccountController::class);
    Route::get('bank-accounts/{id}/balance', [BankAccountController::class, 'getBalance']);
    Route::get('bank-accounts/{id}/transactions', [BankAccountController::class, 'getTransactions']);

    // Bank Transactions - Specific routes must come before resource routes
    Route::post('bank-transactions/import', [BankTransactionController::class, 'importFromStatement']);
    Route::apiResource('bank-transactions', BankTransactionController::class);
    Route::get('bank-accounts/{bankAccountId}/transactions', [BankTransactionController::class, 'getByBankAccount']);


    // Tax Rates
    Route::apiResource('tax-rates', TaxRateController::class);
    Route::get('tax-types', [TaxRateController::class, 'getTaxTypes']);
    Route::get('tax-rates/by-type/{type}', [TaxRateController::class, 'getByType']);
    Route::post('tax-rates/calculate', [TaxRateController::class, 'calculateTax']);

    // Financial Reports
    Route::get('reports/trial-balance', [FinancialReportController::class, 'trialBalance']);
    Route::get('reports/balance-sheet', [FinancialReportController::class, 'balanceSheet']);
    Route::get('reports/income-statement', [FinancialReportController::class, 'incomeStatement']);
    Route::get('reports/cash-flow', [FinancialReportController::class, 'cashFlowStatement']);
    Route::get('reports/financial-ratios', [FinancialReportController::class, 'financialRatios']);
    Route::get('reports/comparative-income', [FinancialReportController::class, 'comparativeIncomeStatement']);
    Route::get('reports/financial-periods', [FinancialReportController::class, 'financialPeriods']);
    Route::get('reports/account-ledger/{accountId}', [FinancialReportController::class, 'accountLedger']);
    Route::get('reports/package', [FinancialReportController::class, 'financialReportPackage']);

    // Fixed Assets
    Route::apiResource('fixed-assets', FixedAssetController::class);
    Route::get('asset-categories', [FixedAssetController::class, 'getAssetCategories']);
    Route::get('asset-statuses', [FixedAssetController::class, 'getAssetStatuses']);
    Route::post('fixed-assets/{id}/dispose', [FixedAssetController::class, 'dispose']);

    // Asset Depreciation - Specific routes must come before resource routes
    Route::post('asset-depreciation/bulk-calculate', [AssetDepreciationController::class, 'calculateBulkDepreciation']);
    Route::get('assets/{assetId}/depreciation-schedule', [AssetDepreciationController::class, 'getDepreciationSchedule']);
    Route::get('depreciation-summary', [AssetDepreciationController::class, 'getSummaryReport']);
    Route::apiResource('asset-depreciation', AssetDepreciationController::class);

    // Financial Periods
    Route::apiResource('financial-periods', FinancialPeriodController::class);
    Route::post('financial-periods/{id}/close', [FinancialPeriodController::class, 'closePeriod']);
    Route::post('financial-periods/{id}/reopen', [FinancialPeriodController::class, 'reopenPeriod']);
    Route::get('financial-periods/current', [FinancialPeriodController::class, 'getCurrentPeriod']);

    // Bank Reconciliation
    Route::apiResource('bank-reconciliation', BankReconciliationController::class);
    Route::get('bank-reconciliation/unreconciled-transactions', [BankReconciliationController::class, 'getUnreconciledTransactions']);
    Route::post('bank-reconciliation/{id}/complete', [BankReconciliationController::class, 'complete']);
    Route::get('bank-reconciliation-summary', [BankReconciliationController::class, 'getSummary']);

    // Budgets - Specific routes must come before resource routes
    Route::get('budget-summary', [BudgetController::class, 'getSummary']);
    Route::post('budgets/copy-from-previous', [BudgetController::class, 'copyFromPrevious']);
    Route::apiResource('budgets', BudgetController::class);
    Route::post('budgets/{id}/approve', [BudgetController::class, 'approve']);
    Route::post('budgets/{id}/reject', [BudgetController::class, 'reject']);
    Route::get('budgets/{id}/vs-actual', [BudgetController::class, 'getBudgetVsActual']);

    // Accounts Payable - Specific routes must come before resource routes
    Route::get('accounts-payable/aging-report', [AccountsPayableController::class, 'getAgingReport']);
    Route::get('accounts-payable-summary', [AccountsPayableController::class, 'getSummary']);
    Route::apiResource('accounts-payable', AccountsPayableController::class);
    Route::post('accounts-payable/{id}/record-payment', [AccountsPayableController::class, 'recordPayment']);

    // Accounts Receivable - Specific routes must come before resource routes
    Route::get('accounts-receivable/aging-report', [AccountsReceivableController::class, 'getAgingReport']);
    Route::get('accounts-receivable-summary', [AccountsReceivableController::class, 'getSummary']);
    Route::apiResource('accounts-receivable', AccountsReceivableController::class);
    Route::post('accounts-receivable/{id}/record-payment', [AccountsReceivableController::class, 'recordPayment']);
    Route::get('accounts-receivable/{id}/generate-invoice', [AccountsReceivableController::class, 'generateInvoice']);
    Route::post('accounts-receivable/{id}/send-reminder', [AccountsReceivableController::class, 'sendReminder']);
});

// Dashboard Routes
Route::middleware('auth:sanctum')->prefix('dashboard')->group(function () {
    // Main dashboard endpoints
    Route::get('overview', [DashboardController::class, 'overview']);
    Route::get('sales-analytics', [DashboardController::class, 'salesAnalytics']);
    Route::get('financial-analytics', [DashboardController::class, 'financialAnalytics']);
    Route::get('customer-analytics', [DashboardController::class, 'customerAnalytics']);
    Route::get('inventory-analytics', [DashboardController::class, 'inventoryAnalytics']);

    // Dashboard configuration
    Route::get('config', [DashboardController::class, 'getDashboardConfig']);
    Route::put('config', [DashboardController::class, 'updateDashboardConfig']);

    // Widget management
    Route::get('widget-types', [DashboardWidgetController::class, 'getWidgetTypes']);
    Route::get('widgets', [DashboardWidgetController::class, 'index']);
    Route::post('widgets', [DashboardWidgetController::class, 'store']);
    Route::get('widgets/{id}', [DashboardWidgetController::class, 'show']);
    Route::put('widgets/{id}', [DashboardWidgetController::class, 'update']);
    Route::delete('widgets/{id}', [DashboardWidgetController::class, 'destroy']);
    Route::get('widgets/{id}/data', [DashboardWidgetController::class, 'getWidgetData']);
    Route::post('widgets/initialize-defaults', [DashboardWidgetController::class, 'initializeDefaultWidgets']);
});

// Invoice Routes (Outside finance prefix for direct /api/invoices access)
Route::middleware('auth:sanctum')->group(function () {
    // Invoices - Specific routes must come before resource routes
    Route::get('invoices/statistics', [InvoiceController::class, 'getStatistics']);
    Route::get('invoices/aging-report', [InvoiceController::class, 'getAgingReport']);
    Route::get('invoices/by-order/{orderId}', [InvoiceController::class, 'getByOrderId']);
    Route::post('invoices/from-order/{orderId}', [InvoiceController::class, 'createFromOrder']);
    Route::post('invoices/{id}/send', [InvoiceController::class, 'sendInvoice']);
    Route::post('invoices/{id}/record-payment', [InvoiceController::class, 'recordPayment']);
    Route::post('invoices/{id}/map-payment', [InvoiceController::class, 'mapPayment']);
    Route::get('invoices/{id}/payment-history', [InvoiceController::class, 'getPaymentHistory']);
    Route::get('invoices/{id}/balance', [InvoiceController::class, 'getInvoiceBalance']);
    Route::post('invoices/{id}/sync-amounts', [InvoiceController::class, 'syncInvoiceAmounts']);
    Route::post('payments/allocate-to-invoices', [InvoiceController::class, 'allocatePaymentToInvoices']);
    Route::get('payments/{paymentId}/available-amount', [InvoiceController::class, 'getPaymentAvailableAmount']);
    Route::post('payments/{paymentId}/refund-overpayment', [InvoiceController::class, 'refundPaymentOverpayment']);
    Route::get('payments/{paymentId}/allocations', [InvoiceController::class, 'getPaymentAllocations']);
    Route::delete('payment-allocations/{allocationId}', [InvoiceController::class, 'deallocatePayment']);
    Route::get('invoices-sales-reps', [InvoiceController::class, 'getSalesReps']);
    Route::post('invoices/{id}/assign-rep', [InvoiceController::class, 'assignRep']);
    Route::get('products/batch-list', [InvoiceController::class, 'productBatchList']);
    Route::apiResource('invoices', InvoiceController::class);

    // PD Cheques
    Route::get('cheques', [ChequeController::class, 'index']);
    Route::get('cheques/{id}', [ChequeController::class, 'show']);
    Route::post('cheques', [ChequeController::class, 'store']);
    Route::post('cheques/{id}/approve', [ChequeController::class, 'approve']);
    Route::post('cheques/{id}/bounce', [ChequeController::class, 'bounce']);
    Route::post('cheques/{id}/cancel', [ChequeController::class, 'cancel']);

    // In-app notifications
    Route::get('notifications', [App\Http\Controllers\NotificationController::class, 'index']);
    Route::post('notifications/{id}/read', [App\Http\Controllers\NotificationController::class, 'markRead']);
    Route::post('notifications/mark-all-read', [App\Http\Controllers\NotificationController::class, 'markAllRead']);

    // Credit Note Routes (linked to invoices)
    Route::get('credit-notes/by-invoice/{invoiceId}', [CreditNoteController::class, 'getByInvoice']);
    Route::get('credit-notes/customers/{customerId}/unapplied-credits', [CreditNoteController::class, 'getCustomerUnappliedCredits']);
    Route::post('credit-notes/{id}/issue', [CreditNoteController::class, 'issueCredit']);
    Route::post('credit-notes/{id}/apply', [CreditNoteController::class, 'applyToInvoice']);
    Route::post('credit-notes/{id}/refund', [CreditNoteController::class, 'refundCredit']);
    Route::post('credit-notes/{id}/void', [CreditNoteController::class, 'voidCredit']);
    Route::apiResource('credit-notes', CreditNoteController::class);

    // Approval Workflow Routes
    Route::prefix('workflows')->group(function () {
        // Workflow Management
        Route::get('/', [App\Http\Controllers\ApprovalWorkflowController::class, 'index']);
        Route::post('/', [App\Http\Controllers\ApprovalWorkflowController::class, 'store']);
        Route::get('/{id}', [App\Http\Controllers\ApprovalWorkflowController::class, 'show']);
        Route::match(['patch', 'put'], '/{id}', [App\Http\Controllers\ApprovalWorkflowController::class, 'update']);
        Route::delete('/{id}', [App\Http\Controllers\ApprovalWorkflowController::class, 'destroy']);
        Route::get('/approvers/available', [App\Http\Controllers\ApprovalWorkflowController::class, 'getAvailableApprovers']);
    });

    // Approval Routes
    Route::prefix('approvals')->group(function () {
        // Get pending approvals for current user
        Route::get('/pending', [App\Http\Controllers\ApprovalController::class, 'getPendingApprovals']);

        // Workflow instance management
        Route::get('/instances/{instanceId}', [App\Http\Controllers\ApprovalController::class, 'getWorkflowInstance']);
        Route::post('/instances/{instanceId}/cancel', [App\Http\Controllers\ApprovalController::class, 'cancelWorkflow']);

        // Step approvals
        Route::post('/steps/{stepInstanceId}/approve', [App\Http\Controllers\ApprovalController::class, 'approveStep']);
        Route::post('/steps/{stepInstanceId}/reject', [App\Http\Controllers\ApprovalController::class, 'rejectStep']);

        // Entity workflows
        Route::get('/entity-workflows', [App\Http\Controllers\ApprovalController::class, 'getEntityWorkflows']);
        Route::post('/initiate', [App\Http\Controllers\ApprovalController::class, 'initiateWorkflow']);

        // Workflow statistics and reports
        Route::get('/statistics', [App\Http\Controllers\ApprovalController::class, 'getWorkflowStatistics']);
    });

    // Flexible Reporting Routes
    Route::prefix('reports')->group(function () {
        Route::get('/inventory', [ReportController::class, 'inventoryReports']);
        Route::get('/sales', [ReportController::class, 'salesReports']);
        Route::get('/logistics', [ReportController::class, 'logisticsReports']);
        Route::get('/procurement', [ReportController::class, 'procurementReports']);
        Route::get('/customers', [ReportController::class, 'customerReports']);
    });
});

Route::middleware('auth:sanctum')->post('/broadcasting/auth', function (Request $request) {
    $user = $request->user();
    return response()->json([
        'auth' => $user->id . ':' . hash('sha256', $user->id . env('APP_KEY'))
    ]);
});

// Kenya eTIMS integration through DigiTax. The callback is token-routed and
// intentionally public; its controller performs webhook verification.
Route::post('/webhooks/etims/{token}', [App\Http\Controllers\Etims\EtimsWebhookController::class, 'handle']);

Route::middleware('auth:sanctum')->prefix('etims')->group(function () {
    Route::get('/config', [App\Http\Controllers\Etims\EtimsConfigController::class, 'show']);
    Route::patch('/config/identity', [App\Http\Controllers\Etims\EtimsConfigController::class, 'updateIdentity']);
    Route::patch('/config/credentials', [App\Http\Controllers\Etims\EtimsConfigController::class, 'updateCredentials']);
    Route::post('/config/test-connection', [App\Http\Controllers\Etims\EtimsConfigController::class, 'testConnection']);
    Route::patch('/config/activation', [App\Http\Controllers\Etims\EtimsConfigController::class, 'updateActivation']);
    Route::post('/config/regenerate-secret', [App\Http\Controllers\Etims\EtimsConfigController::class, 'regenerateCallbackSecret']);

    Route::get('/items/reference', [App\Http\Controllers\Etims\EtimsItemController::class, 'reference']);
    Route::get('/items', [App\Http\Controllers\Etims\EtimsItemController::class, 'index']);
    Route::get('/items/{productId}', [App\Http\Controllers\Etims\EtimsItemController::class, 'show']);
    Route::patch('/items/{productId}', [App\Http\Controllers\Etims\EtimsItemController::class, 'update']);
    Route::post('/items/{productId}/sync', [App\Http\Controllers\Etims\EtimsItemController::class, 'sync']);

    Route::get('/invoices/{invoiceId}/status', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'status']);
    Route::post('/invoices/{invoiceId}/submit', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'submit']);
    Route::post('/invoices/{invoiceId}/retry', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'retry']);
    Route::post('/invoices/{invoiceId}/force-unlock', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'forceUnlock']);
    Route::get('/credit-notes/{creditNoteId}/status', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'creditNoteStatus']);
    Route::post('/credit-notes/{creditNoteId}/retry', [App\Http\Controllers\Etims\EtimsInvoiceController::class, 'retryCreditNote']);

    Route::get('/supplier-receipts', [App\Http\Controllers\Etims\EtimsSupplierReceiptController::class, 'index']);
    Route::post('/supplier-receipts', [App\Http\Controllers\Etims\EtimsSupplierReceiptController::class, 'store']);
    Route::post('/supplier-receipts/{id}/verify', [App\Http\Controllers\Etims\EtimsSupplierReceiptController::class, 'verify']);
    Route::post('/supplier-receipts/{id}/link-bill', [App\Http\Controllers\Etims\EtimsSupplierReceiptController::class, 'linkBill']);
    Route::get('/supplier-receipts/reconciliation', [App\Http\Controllers\Etims\EtimsSupplierReceiptController::class, 'reconciliation']);

    Route::get('/reports/worklist', [App\Http\Controllers\Etims\EtimsReportsController::class, 'worklist']);
    Route::get('/reports/failures', [App\Http\Controllers\Etims\EtimsReportsController::class, 'failures']);
    Route::get('/reports/health', [App\Http\Controllers\Etims\EtimsReportsController::class, 'health']);
});

// Webhook Routes (Public - no authentication)
Route::prefix('webhooks')->group(function () {
    Route::any('/meta/whatsapp', [WebhookController::class, 'whatsapp']);
    Route::any('/meta/instagram', [WebhookController::class, 'instagram']);
    Route::any('/meta/messenger', [WebhookController::class, 'messenger']);
    Route::any('/test', [WebhookController::class, 'test']);
    Route::any('/debug', [WebhookController::class, 'debug']);
    Route::get('/health', [WebhookController::class, 'health']);
});

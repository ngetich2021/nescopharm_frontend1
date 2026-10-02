<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * CompanyAccountMapping
 * 
 * A scalable solution for mapping logical account purposes to actual chart of account
 * codes. Supports:
 * 
 * 1. Company-specific configurations
 * 2. Context-aware mappings (e.g., different expense accounts per category)
 * 3. Fallback chains for hierarchical lookups
 * 4. Custom payment method mappings
 * 5. Efficient batch loading with smart caching
 * 
 * USAGE:
 * ```php
 * // Simple lookup
 * $accountId = CompanyAccountMapping::resolve($companyId, 'accounts_receivable');
 * 
 * // Context-aware lookup (e.g., expense account for a specific category)
 * $accountId = CompanyAccountMapping::resolve($companyId, 'expense', [
 *     'context_type' => 'expense_category',
 *     'context_id' => $categoryId
 * ]);
 * 
 * // Payment method lookup
 * $accountId = CompanyAccountMapping::resolveForPaymentMethod($companyId, 'mpesa');
 * ```
 */
class CompanyAccountMapping extends Model
{
    use HasFactory;

    protected $table = 'company_account_mappings';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'mapping_key',
        'account_code',
        'chart_of_account_id',
        'context_type',
        'context_id',
        'parent_mapping_id',
        'description',
        'priority',
        'is_active',
        'is_system',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_system' => 'boolean',
        'priority' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // =========================================================================
    // MAPPING KEY DEFINITIONS
    // =========================================================================

    /**
     * Core account mapping keys - these are the standard mappings every company needs
     */
    public const CORE_MAPPING_KEYS = [
        // Assets
        'cash_on_hand' => ['description' => 'Cash on Hand', 'type' => 'asset', 'required' => true],
        'petty_cash' => ['description' => 'Petty Cash', 'type' => 'asset', 'required' => false],
        'main_bank' => ['description' => 'Main Operating Account (Bank)', 'type' => 'asset', 'required' => true],
        'accounts_receivable' => ['description' => 'Accounts Receivable', 'type' => 'asset', 'required' => true],
        'inventory' => ['description' => 'Inventory', 'type' => 'asset', 'required' => true],
        'input_vat' => ['description' => 'Input VAT (VAT Receivable)', 'type' => 'asset', 'required' => false],
        
        // Liabilities
        'accounts_payable' => ['description' => 'Accounts Payable', 'type' => 'liability', 'required' => true],
        'vat_payable' => ['description' => 'VAT Payable (Output VAT)', 'type' => 'liability', 'required' => false],
        'customer_deposits' => ['description' => 'Customer Deposits', 'type' => 'liability', 'required' => false],
        
        // Income
        'sales_revenue' => ['description' => 'Sales Revenue', 'type' => 'income', 'required' => true],
        'service_revenue' => ['description' => 'Service Revenue', 'type' => 'income', 'required' => false],
        'other_income' => ['description' => 'Other Income', 'type' => 'income', 'required' => false],
        'discounts_allowed' => ['description' => 'Discounts Allowed', 'type' => 'income', 'required' => false],
        
        // Cost of Goods Sold
        'cogs' => ['description' => 'Cost of Goods Sold', 'type' => 'expense', 'required' => true],
        
        // Operating Expenses (default/catch-all)
        'miscellaneous_expense' => ['description' => 'Miscellaneous Expense', 'type' => 'expense', 'required' => true],
        'depreciation' => ['description' => 'Depreciation Expense', 'type' => 'expense', 'required' => false],
        'bank_charges' => ['description' => 'Bank Charges', 'type' => 'expense', 'required' => false],
        'bad_debt_expense' => ['description' => 'Bad Debt Expense', 'type' => 'expense', 'required' => false],
        
        // Contra accounts
        'accumulated_depreciation' => ['description' => 'Accumulated Depreciation', 'type' => 'asset', 'required' => false],
        'allowance_doubtful_accounts' => ['description' => 'Allowance for Doubtful Accounts', 'type' => 'asset', 'required' => false],
    ];

    /**
     * Extended mapping keys - optional, for more detailed configurations
     */
    public const EXTENDED_MAPPING_KEYS = [
        // Additional asset accounts
        'mpesa_float' => ['description' => 'M-Pesa Float', 'type' => 'asset', 'required' => false],
        'trade_receivables' => ['description' => 'Trade Receivables', 'type' => 'asset', 'required' => false],
        'finished_goods' => ['description' => 'Finished Goods Inventory', 'type' => 'asset', 'required' => false],
        'raw_materials' => ['description' => 'Raw Materials Inventory', 'type' => 'asset', 'required' => false],
        
        // Additional liability accounts
        'trade_payables' => ['description' => 'Trade Payables', 'type' => 'liability', 'required' => false],
        
        // Additional expense accounts
        'salaries_expense' => ['description' => 'Salaries Expense', 'type' => 'expense', 'required' => false],
        'rent_expense' => ['description' => 'Rent Expense', 'type' => 'expense', 'required' => false],
        'utilities_expense' => ['description' => 'Utilities Expense', 'type' => 'expense', 'required' => false],
        'office_supplies' => ['description' => 'Office Supplies', 'type' => 'expense', 'required' => false],
        'purchase_returns' => ['description' => 'Purchase Returns', 'type' => 'expense', 'required' => false],
        'freight_in' => ['description' => 'Freight In', 'type' => 'expense', 'required' => false],
    ];

    /**
     * Context types that support granular mappings
     */
    public const CONTEXT_TYPES = [
        'expense_category' => 'Expense Category',
        'payment_method' => 'Payment Method',
        'store' => 'Store/Location',
        'product_category' => 'Product Category',
        'customer_type' => 'Customer Type',
        'supplier' => 'Supplier',
    ];

    /**
     * Default payment method to mapping key associations
     */
    public const DEFAULT_PAYMENT_METHOD_MAPPINGS = [
        'cash' => 'cash_on_hand',
        'bank_transfer' => 'main_bank',
        'bank' => 'main_bank',
        'mpesa' => 'mpesa_float',
        'm-pesa' => 'mpesa_float',
        'paybill' => 'mpesa_float',
        'mobile_money' => 'mpesa_float',
        'card' => 'main_bank',
        'credit_card' => 'main_bank',
        'debit_card' => 'main_bank',
        'cheque' => 'main_bank',
        'check' => 'main_bank',
    ];

    // =========================================================================
    // CACHE CONFIGURATION
    // =========================================================================

    protected const CACHE_TTL = 3600; // 1 hour
    protected const CACHE_PREFIX = 'cam:'; // company_account_mapping

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function chartOfAccount()
    {
        return $this->belongsTo(ChartOfAccount::class, 'chart_of_account_id');
    }

    public function parentMapping()
    {
        return $this->belongsTo(self::class, 'parent_mapping_id');
    }

    public function childMappings()
    {
        return $this->hasMany(self::class, 'parent_mapping_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    /**
     * Scope a query to only include active mappings.
     * Uses whereRaw for PostgreSQL boolean compatibility.
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    /**
     * Scope a query to only include mappings for a specific company.
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    // =========================================================================
    // MUTATORS FOR POSTGRESQL BOOLEAN COMPATIBILITY
    // =========================================================================

    /**
     * Set the is_active attribute - ensure proper boolean for PostgreSQL
     */
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Set the is_system attribute - ensure proper boolean for PostgreSQL
     */
    public function setIsSystemAttribute($value)
    {
        $this->attributes['is_system'] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    // =========================================================================
    // MODEL EVENTS
    // =========================================================================

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            // Ensure boolean values are properly cast for PostgreSQL
            $model->is_active = $model->is_active ?? true;
            $model->is_system = $model->is_system ?? false;
        });

        // Handle boolean casting before saving for PostgreSQL compatibility
        static::saving(function ($model) {
            // These will be properly cast by the casts array
            if (isset($model->attributes['is_active'])) {
                $model->attributes['is_active'] = (bool) $model->attributes['is_active'];
            }
            if (isset($model->attributes['is_system'])) {
                $model->attributes['is_system'] = (bool) $model->attributes['is_system'];
            }
        });

        // Invalidate cache on changes
        static::saved(function ($model) {
            self::invalidateCompanyCache($model->company_id);
        });

        static::deleted(function ($model) {
            self::invalidateCompanyCache($model->company_id);
        });
    }

    // =========================================================================
    // MAIN RESOLUTION METHODS (PUBLIC API)
    // =========================================================================

    /**
     * Resolve an account ID for a mapping key with optional context
     * 
     * @param string $companyId
     * @param string $mappingKey The logical account key (e.g., 'accounts_receivable')
     * @param array $context Optional context for granular lookups ['context_type' => '...', 'context_id' => '...']
     * @return string|null Account ID
     */
    public static function resolve(string $companyId, string $mappingKey, array $context = []): ?string
    {
        $resolver = self::getResolver($companyId);
        return $resolver->getAccountId($mappingKey, $context);
    }

    /**
     * Resolve an account code for a mapping key with optional context
     */
    public static function resolveCode(string $companyId, string $mappingKey, array $context = []): ?string
    {
        $resolver = self::getResolver($companyId);
        return $resolver->getAccountCode($mappingKey, $context);
    }

    /**
     * Resolve account ID for a payment method
     */
    public static function resolveForPaymentMethod(string $companyId, string $paymentMethod): ?string
    {
        $resolver = self::getResolver($companyId);
        return $resolver->getAccountIdForPaymentMethod($paymentMethod);
    }

    /**
     * Batch resolve multiple mapping keys at once (more efficient)
     * 
     * @param string $companyId
     * @param array $keys Array of mapping keys or ['key' => 'mapping_key', 'context' => [...]]
     * @return array ['mapping_key' => 'account_id', ...]
     */
    public static function resolveMultiple(string $companyId, array $keys): array
    {
        $resolver = self::getResolver($companyId);
        return $resolver->getMultipleAccountIds($keys);
    }

    // =========================================================================
    // RESOLVER CLASS (Efficient batch-loaded resolution)
    // =========================================================================

    /**
     * Get a resolver instance for a company (cached and batch-loaded)
     */
    public static function getResolver(string $companyId): AccountMappingResolver
    {
        $cacheKey = self::CACHE_PREFIX . "resolver:{$companyId}";
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($companyId) {
            return new AccountMappingResolver($companyId);
        });
    }

    // =========================================================================
    // CONFIGURATION METHODS
    // =========================================================================

    /**
     * Set a mapping for a company
     * Uses raw SQL for boolean values to ensure PostgreSQL compatibility
     */
    public static function setMapping(
        string $companyId,
        string $mappingKey,
        string $accountCode,
        ?string $chartOfAccountId = null,
        array $options = []
    ): self {
        $contextType = $options['context_type'] ?? null;
        $contextId = $options['context_id'] ?? null;

        // If no chart_of_account_id provided, look it up
        if (!$chartOfAccountId && $accountCode) {
            $account = ChartOfAccount::where('company_id', $companyId)
                ->where('account_code', $accountCode)
                ->first();
            $chartOfAccountId = $account?->id;
        }

        // Check if mapping exists
        $existing = static::where('company_id', $companyId)
            ->where('mapping_key', $mappingKey)
            ->where(function ($q) use ($contextType) {
                if ($contextType === null) {
                    $q->whereNull('context_type');
                } else {
                    $q->where('context_type', $contextType);
                }
            })
            ->where(function ($q) use ($contextId) {
                if ($contextId === null) {
                    $q->whereNull('context_id');
                } else {
                    $q->where('context_id', $contextId);
                }
            })
            ->first();

        $isActive = ($options['is_active'] ?? true) ? 'true' : 'false';
        $isSystem = ($options['is_system'] ?? false) ? 'true' : 'false';

        if ($existing) {
            // Update existing record using raw SQL for booleans
            DB::statement(
                "UPDATE company_account_mappings SET 
                    account_code = ?,
                    chart_of_account_id = ?,
                    description = ?,
                    priority = ?,
                    is_active = {$isActive},
                    is_system = {$isSystem},
                    parent_mapping_id = ?,
                    updated_by = ?,
                    updated_at = NOW()
                WHERE id = ?",
                [
                    $accountCode,
                    $chartOfAccountId,
                    $options['description'] ?? self::getKeyDescription($mappingKey),
                    $options['priority'] ?? 0,
                    $options['parent_mapping_id'] ?? null,
                    auth()->id(),
                    $existing->id,
                ]
            );
            $mapping = static::find($existing->id);
        } else {
            // Insert new record using raw SQL for booleans
            $id = (string) Str::uuid();
            DB::statement(
                "INSERT INTO company_account_mappings 
                    (id, company_id, mapping_key, account_code, chart_of_account_id, 
                     context_type, context_id, description, priority, is_active, is_system, 
                     parent_mapping_id, updated_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, {$isActive}, {$isSystem}, ?, ?, NOW(), NOW())",
                [
                    $id,
                    $companyId,
                    $mappingKey,
                    $accountCode,
                    $chartOfAccountId,
                    $contextType,
                    $contextId,
                    $options['description'] ?? self::getKeyDescription($mappingKey),
                    $options['priority'] ?? 0,
                    $options['parent_mapping_id'] ?? null,
                    auth()->id(),
                ]
            );
            $mapping = static::find($id);
        }

        self::invalidateCompanyCache($companyId);

        return $mapping;
    }

    /**
     * Set multiple mappings at once (efficient)
     */
    public static function setMappings(string $companyId, array $mappings): int
    {
        $count = 0;
        
        DB::transaction(function () use ($companyId, $mappings, &$count) {
            foreach ($mappings as $key => $data) {
                if (is_string($data)) {
                    // Simple format: 'mapping_key' => 'account_code'
                    self::setMapping($companyId, $key, $data);
                } else {
                    // Detailed format
                    self::setMapping(
                        $companyId,
                        $data['mapping_key'] ?? $key,
                        $data['account_code'],
                        $data['chart_of_account_id'] ?? null,
                        $data
                    );
                }
                $count++;
            }
        });

        self::invalidateCompanyCache($companyId);
        
        return $count;
    }

    /**
     * Set payment method mapping for a company
     * Uses raw SQL for PostgreSQL boolean compatibility
     */
    public static function setPaymentMethodMapping(
        string $companyId,
        string $paymentMethod,
        string $mappingKey,
        ?string $displayName = null
    ): void {
        $method = strtolower($paymentMethod);
        $display = $displayName ?? ucfirst($paymentMethod);
        
        // Check if exists
        $exists = DB::table('company_payment_method_mappings')
            ->where('company_id', $companyId)
            ->where('payment_method', $method)
            ->exists();

        if ($exists) {
            DB::statement(
                "UPDATE company_payment_method_mappings SET 
                    mapping_key = ?,
                    display_name = ?,
                    is_active = true,
                    updated_at = NOW()
                WHERE company_id = ? AND payment_method = ?",
                [$mappingKey, $display, $companyId, $method]
            );
        } else {
            DB::statement(
                "INSERT INTO company_payment_method_mappings 
                    (id, company_id, payment_method, mapping_key, display_name, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), ?, ?, ?, ?, true, NOW(), NOW())",
                [$companyId, $method, $mappingKey, $display]
            );
        }

        self::invalidateCompanyCache($companyId);
    }

    // =========================================================================
    // VALIDATION METHODS
    // =========================================================================

    /**
     * Validate that required mappings are configured for a company
     */
    public static function validateConfiguration(string $companyId): array
    {
        $resolver = self::getResolver($companyId);
        $issues = [];
        $configured = [];

        foreach (self::CORE_MAPPING_KEYS as $key => $config) {
            $accountId = $resolver->getAccountId($key);
            
            if ($accountId) {
                $configured[$key] = $accountId;
            } elseif ($config['required']) {
                $issues[] = [
                    'key' => $key,
                    'description' => $config['description'],
                    'severity' => 'error',
                    'message' => "Required mapping '{$key}' ({$config['description']}) is not configured",
                ];
            }
        }

        return [
            'is_valid' => empty(array_filter($issues, fn($i) => $i['severity'] === 'error')),
            'configured_count' => count($configured),
            'required_count' => count(array_filter(self::CORE_MAPPING_KEYS, fn($c) => $c['required'])),
            'configured' => $configured,
            'issues' => $issues,
        ];
    }

    // =========================================================================
    // INITIALIZATION METHODS
    // =========================================================================

    /**
     * Initialize mappings for a company by auto-detecting from chart of accounts
     */
    public static function initializeFromChartOfAccounts(string $companyId): array
    {
        $patterns = self::getDefaultCodePatterns();
        $accounts = ChartOfAccount::where('company_id', $companyId)
            ->whereRaw('is_active = true')
            ->get()
            ->keyBy('account_code');

        $mapped = [];
        $unmapped = [];

        DB::transaction(function () use ($companyId, $patterns, $accounts, &$mapped, &$unmapped) {
            foreach ($patterns as $mappingKey => $codePatterns) {
                $found = false;
                
                foreach ($codePatterns as $pattern) {
                    if ($accounts->has($pattern)) {
                        $account = $accounts->get($pattern);
                        self::setMapping($companyId, $mappingKey, $pattern, $account->id, [
                            'is_system' => false,
                        ]);
                        $mapped[$mappingKey] = $pattern;
                        $found = true;
                        break;
                    }
                }
                
                if (!$found) {
                    $unmapped[$mappingKey] = self::getKeyDescription($mappingKey);
                }
            }

            // Initialize default payment method mappings
            foreach (self::DEFAULT_PAYMENT_METHOD_MAPPINGS as $method => $key) {
                self::setPaymentMethodMapping($companyId, $method, $key);
            }
        });

        self::invalidateCompanyCache($companyId);

        return [
            'mapped' => $mapped,
            'unmapped' => $unmapped,
            'mapped_count' => count($mapped),
            'unmapped_count' => count($unmapped),
        ];
    }

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================

    /**
     * Invalidate all caches for a company
     */
    public static function invalidateCompanyCache(string $companyId): void
    {
        Cache::forget(self::CACHE_PREFIX . "resolver:{$companyId}");
        Cache::forget(self::CACHE_PREFIX . "mappings:{$companyId}");
        Cache::forget(self::CACHE_PREFIX . "payment_methods:{$companyId}");
    }

    /**
     * Alias for invalidateCompanyCache
     */
    public static function clearCache(string $companyId): void
    {
        self::invalidateCompanyCache($companyId);
    }

    /**
     * Warm the cache for a company (call after bulk operations)
     */
    public static function warmCache(string $companyId): void
    {
        self::getResolver($companyId);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Get fallback keys for a mapping key
     */
    public static function getFallbackKeys(string $mappingKey): array
    {
        $fallbacks = [
            'mpesa_float' => ['main_bank', 'cash_on_hand'],
            'trade_receivables' => ['accounts_receivable'],
            'trade_payables' => ['accounts_payable'],
            'finished_goods' => ['inventory'],
            'raw_materials' => ['inventory'],
            'petty_cash' => ['cash_on_hand'],
            'service_revenue' => ['sales_revenue'],
            'other_income' => ['sales_revenue'],
            'transport_expense' => ['miscellaneous_expense'],
            'utilities_expense' => ['miscellaneous_expense'],
            'rent_expense' => ['miscellaneous_expense'],
        ];

        return $fallbacks[$mappingKey] ?? [];
    }

    /**
     * Get all mapping keys with descriptions
     */
    public static function getAllMappingKeys(): array
    {
        return array_merge(self::CORE_MAPPING_KEYS, self::EXTENDED_MAPPING_KEYS);
    }

    /**
     * Get description for a mapping key
     */
    public static function getKeyDescription(string $key): string
    {
        return self::CORE_MAPPING_KEYS[$key]['description'] 
            ?? self::EXTENDED_MAPPING_KEYS[$key]['description'] 
            ?? $key;
    }

    /**
     * Get default account code patterns for auto-detection
     */
    protected static function getDefaultCodePatterns(): array
    {
        return [
            'cash_on_hand' => ['1010', '1000', '100', '1001'],
            'petty_cash' => ['1020', '1001', '1015'],
            'main_bank' => ['1110', '1100', '110', '1101'],
            'mpesa_float' => ['1130', '1120', '1131'],
            'accounts_receivable' => ['1200', '120', '1210', '1201'],
            'trade_receivables' => ['1210', '1200', '1211'],
            'inventory' => ['1300', '130', '1310', '1301'],
            'finished_goods' => ['1310', '1300', '1311'],
            'raw_materials' => ['1320', '1321'],
            'input_vat' => ['1430', '1400', '1431'],
            'accumulated_depreciation' => ['1610', '1600', '1611'],
            'allowance_doubtful_accounts' => ['1220', '1221'],
            'accounts_payable' => ['2100', '210', '2110', '2101'],
            'trade_payables' => ['2110', '2100', '2111'],
            'vat_payable' => ['2310', '2300', '2311'],
            'customer_deposits' => ['2460', '2400', '2461'],
            'sales_revenue' => ['4100', '410', '4000', '4101'],
            'service_revenue' => ['4200', '420', '4201'],
            'other_income' => ['4500', '450', '4501'],
            'discounts_allowed' => ['4600', '460', '4601'],
            'cogs' => ['5100', '510', '5000', '5101'],
            'purchase_returns' => ['5200', '520', '5201'],
            'freight_in' => ['5300', '530', '5301'],
            'salaries_expense' => ['6100', '610', '6101'],
            'rent_expense' => ['6200', '620', '6201'],
            'utilities_expense' => ['6300', '630', '6301'],
            'office_supplies' => ['6400', '640', '6401'],
            'depreciation' => ['6500', '650', '6501'],
            'bank_charges' => ['6600', '660', '6601'],
            'bad_debt_expense' => ['6700', '670', '6701'],
            'miscellaneous_expense' => ['6900', '690', '6901'],
        ];
    }
}

// =========================================================================
// RESOLVER CLASS - Efficient batch-loaded mapping resolution
// =========================================================================

/**
 * AccountMappingResolver
 * 
 * This class handles efficient resolution of account mappings by batch-loading
 * all mappings for a company upfront, then resolving from memory.
 * 
 * It's designed to be cached as a whole object, avoiding multiple DB queries.
 */
class AccountMappingResolver
{
    protected string $companyId;
    protected array $mappings = [];
    protected array $contextMappings = [];
    protected array $paymentMethods = [];
    protected array $accountIdCache = [];

    public function __construct(string $companyId)
    {
        $this->companyId = $companyId;
        $this->loadMappings();
    }

    /**
     * Load all mappings for the company in a single query
     */
    protected function loadMappings(): void
    {
        // Load all account mappings
        $allMappings = CompanyAccountMapping::where('company_id', $this->companyId)
            ->whereRaw('is_active = true')
            ->orderBy('priority', 'desc')
            ->get();

        foreach ($allMappings as $mapping) {
            if ($mapping->context_type && $mapping->context_id) {
                // Context-specific mapping
                $contextKey = "{$mapping->mapping_key}:{$mapping->context_type}:{$mapping->context_id}";
                $this->contextMappings[$contextKey] = [
                    'account_id' => $mapping->chart_of_account_id,
                    'account_code' => $mapping->account_code,
                    'parent_mapping_id' => $mapping->parent_mapping_id,
                ];
            } else {
                // Base mapping (no context)
                $this->mappings[$mapping->mapping_key] = [
                    'account_id' => $mapping->chart_of_account_id,
                    'account_code' => $mapping->account_code,
                    'parent_mapping_id' => $mapping->parent_mapping_id,
                ];
            }
        }

        // Load payment method mappings
        $paymentMethods = DB::table('company_payment_method_mappings')
            ->where('company_id', $this->companyId)
            ->whereRaw('is_active = true')
            ->get();

        foreach ($paymentMethods as $pm) {
            $this->paymentMethods[strtolower($pm->payment_method)] = $pm->mapping_key;
        }

        // Add default payment methods if not configured
        foreach (CompanyAccountMapping::DEFAULT_PAYMENT_METHOD_MAPPINGS as $method => $key) {
            if (!isset($this->paymentMethods[$method])) {
                $this->paymentMethods[$method] = $key;
            }
        }
    }

    /**
     * Get account ID for a mapping key with optional context
     */
    public function getAccountId(string $mappingKey, array $context = []): ?string
    {
        // Check context-specific mapping first
        if (!empty($context['context_type']) && !empty($context['context_id'])) {
            $contextKey = "{$mappingKey}:{$context['context_type']}:{$context['context_id']}";
            if (isset($this->contextMappings[$contextKey])) {
                return $this->contextMappings[$contextKey]['account_id'];
            }
        }

        // Fall back to base mapping
        if (isset($this->mappings[$mappingKey])) {
            return $this->mappings[$mappingKey]['account_id'];
        }

        // Try fallback keys (e.g., if 'mpesa_float' not found, try 'main_bank')
        $fallbacks = $this->getFallbackKeys($mappingKey);
        foreach ($fallbacks as $fallbackKey) {
            if (isset($this->mappings[$fallbackKey])) {
                return $this->mappings[$fallbackKey]['account_id'];
            }
        }

        return null;
    }

    /**
     * Get account code for a mapping key
     */
    public function getAccountCode(string $mappingKey, array $context = []): ?string
    {
        if (!empty($context['context_type']) && !empty($context['context_id'])) {
            $contextKey = "{$mappingKey}:{$context['context_type']}:{$context['context_id']}";
            if (isset($this->contextMappings[$contextKey])) {
                return $this->contextMappings[$contextKey]['account_code'];
            }
        }

        return $this->mappings[$mappingKey]['account_code'] ?? null;
    }

    /**
     * Get account ID for a payment method
     */
    public function getAccountIdForPaymentMethod(string $paymentMethod): ?string
    {
        $method = strtolower($paymentMethod);
        $mappingKey = $this->paymentMethods[$method] ?? 'cash_on_hand';
        
        return $this->getAccountId($mappingKey);
    }

    /**
     * Get multiple account IDs at once
     */
    public function getMultipleAccountIds(array $keys): array
    {
        $results = [];
        
        foreach ($keys as $key => $value) {
            if (is_array($value)) {
                $mappingKey = $value['key'] ?? $value['mapping_key'] ?? $key;
                $context = $value['context'] ?? [];
                $results[$mappingKey] = $this->getAccountId($mappingKey, $context);
            } else {
                $results[$value] = $this->getAccountId($value);
            }
        }
        
        return $results;
    }

    /**
     * Get all configured mappings
     */
    public function getAllMappings(): array
    {
        return $this->mappings;
    }

    /**
     * Get all payment method mappings
     */
    public function getPaymentMethods(): array
    {
        return $this->paymentMethods;
    }

    /**
     * Define fallback keys for certain mapping types
     */
    protected function getFallbackKeys(string $mappingKey): array
    {
        $fallbacks = [
            'mpesa_float' => ['main_bank', 'cash_on_hand'],
            'trade_receivables' => ['accounts_receivable'],
            'trade_payables' => ['accounts_payable'],
            'finished_goods' => ['inventory'],
            'raw_materials' => ['inventory'],
            'petty_cash' => ['cash_on_hand'],
            'service_revenue' => ['sales_revenue'],
            'other_income' => ['sales_revenue'],
        ];

        return $fallbacks[$mappingKey] ?? [];
    }
}

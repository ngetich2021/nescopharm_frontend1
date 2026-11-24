<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A payment of one statutory deduction of one payroll month to its authority (PAYE to KRA, NSSF,
 * SHIF to SHA, Housing Levy, HELB, NITA). Posts DR the matching payable / CR the bank or cash
 * account it was paid from (LedgerPostingService::syncStatutoryPayment).
 */
class StatutoryPayment extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    /** item => [label, authority, due day of the following month, ledger payable key, fallback key] */
    public const ITEMS = [
        'paye' => ['PAYE', 'KRA - iTax (P10)', 9, 'paye_payable', null],
        'nssf' => ['NSSF', 'NSSF employer portal', 9, 'nssf_payable', null],
        'shif' => ['SHIF', 'Social Health Authority', 9, 'shif_payable', null],
        'housing_levy' => ['Affordable Housing Levy', 'KRA - iTax', 9, 'housing_levy_payable', null],
        'helb' => ['HELB', 'Higher Education Loans Board', 15, 'helb_payable', 'payroll_deductions_payable'],
        'nita' => ['NITA', 'National Industrial Training Authority', 9, 'nita_payable', 'payroll_deductions_payable'],
    ];

    protected $fillable = [
        'id', 'company_id', 'payroll_run_id', 'item', 'amount', 'payment_date', 'account_id',
        'payment_method', 'reference', 'attachment_path', 'notes', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date:Y-m-d',
    ];

    protected $appends = ['item_label', 'attachment_url'];

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getItemLabelAttribute(): string
    {
        return self::ITEMS[$this->item][0] ?? strtoupper((string) $this->item);
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }
        $disk = config('filesystems.default', 's3');
        if ($disk === 's3' || config("filesystems.disks.{$disk}.driver") === 's3') {
            try {
                return Storage::disk($disk)->temporaryUrl($this->attachment_path, now()->addHours(24));
            } catch (\Exception $e) {
                return Storage::disk($disk)->url($this->attachment_path);
            }
        }
        return Storage::disk($disk)->url($this->attachment_path);
    }
}

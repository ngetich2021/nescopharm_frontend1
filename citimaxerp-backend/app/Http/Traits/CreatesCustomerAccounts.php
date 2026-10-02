<?php

namespace App\Http\Traits;

use App\Models\AccountBankDetail;
use App\Models\AccountDirector;
use App\Models\AccountSupplier;
use App\Models\AuthorisedPurchasePerson;
use App\Models\Customer;
use App\Models\CustomerAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Shared account-creation logic, used by both CustomerAccountController::store()
 * (manual creation) and CustomerApprovalController (auto-created on Stage 1
 * approval of a rep-submitted customer application).
 */
trait CreatesCustomerAccounts
{
    /**
     * Generate a unique account number for a customer account.
     * Format: ACC-{companyId8}-{sequential 4 digits}
     */
    protected function generateAccountNumber($companyId)
    {
        $prefix = 'ACC-' . substr($companyId, 0, 8) . '-';
        $lastAccount = DB::table('customer_accounts')
            ->select('account_number')
            ->where('account_number', 'like', $prefix . '%')
            ->orderBy('account_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastAccount ? (int) substr($lastAccount->account_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * @param array $data Same shape CustomerAccountController::store() already
     *                     validates: certificate_of_incorporation_number, annual_turnover,
     *                     credit_required, credit_period_required, credit_period_pd_cheque_days,
     *                     credit_days, currently_defaulted, credit_terms, notes,
     *                     directors[], authorised_purchase_persons[], suppliers[], bank_details[]
     */
    protected function createAccountFromData(string $customerId, string $companyId, ?string $createdByUserId, array $data): CustomerAccount
    {
        $accountNumber = $this->generateAccountNumber($companyId);

        $account = CustomerAccount::create([
            'id' => (string) Str::uuid(),
            'customer_id' => $customerId,
            'company_id' => $companyId,
            'account_number' => $accountNumber,
            'certificate_of_incorporation_number' => $data['certificate_of_incorporation_number'] ?? null,
            'annual_turnover' => $data['annual_turnover'] ?? null,
            'credit_required' => $data['credit_required'] ?? null,
            'credit_period_required' => $data['credit_period_required'] ?? null,
            'credit_period_pd_cheque_days' => $data['credit_period_pd_cheque_days'] ?? null,
            'credit_days' => $data['credit_days'] ?? null,
            'currently_defaulted' => filter_var($data['currently_defaulted'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'credit_terms' => $data['credit_terms'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $createdByUserId,
        ]);

        $customer = Customer::find($customerId);
        if ($customer) {
            $customer->account_id = $account->id;
            $customer->save();
        }

        foreach (($data['directors'] ?? []) as $director) {
            if (empty($director['name'])) {
                continue;
            }
            AccountDirector::create([
                'id' => (string) Str::uuid(),
                'customer_account_id' => $account->id,
                'name' => $director['name'],
                'id_passport_number' => $director['id_passport_number'] ?? null,
                'pin' => $director['pin'] ?? null,
                'phone_number' => $director['phone_number'] ?? null,
            ]);
        }

        foreach (($data['authorised_purchase_persons'] ?? []) as $person) {
            if (empty($person['name'])) {
                continue;
            }
            AuthorisedPurchasePerson::create([
                'id' => (string) Str::uuid(),
                'customer_account_id' => $account->id,
                'name' => $person['name'],
                'phone_number' => $person['phone_number'] ?? null,
            ]);
        }

        foreach (($data['suppliers'] ?? []) as $supplier) {
            if (empty($supplier['name'])) {
                continue;
            }
            AccountSupplier::create([
                'id' => (string) Str::uuid(),
                'customer_account_id' => $account->id,
                'name' => $supplier['name'],
                'contact_person_name' => $supplier['contact_person_name'] ?? null,
                'phone_number' => $supplier['phone_number'] ?? null,
                'credit_limit' => $supplier['credit_limit'] ?? null,
            ]);
        }

        foreach (($data['bank_details'] ?? []) as $bank) {
            if (empty($bank['bank_name'])) {
                continue;
            }
            AccountBankDetail::create([
                'id' => (string) Str::uuid(),
                'customer_account_id' => $account->id,
                'account_name' => $bank['account_name'] ?? null,
                'bank_name' => $bank['bank_name'],
                'branch' => $bank['branch'] ?? null,
                'account_number' => $bank['account_number'] ?? null,
            ]);
        }

        return $account;
    }
}

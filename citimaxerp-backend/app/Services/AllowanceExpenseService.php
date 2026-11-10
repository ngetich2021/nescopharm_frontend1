<?php

namespace App\Services;

use App\Models\EmployeeAllowance;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Allowances paid outside payroll (frequency "disbursed": one-time ones on their date, monthly ones
 * once a month) are expenses: each payment is an Expense under "Salaries & Allowances", linked to its
 * allowance by a tag (allowance:<id>:<date>). They follow the allowance - added, changed or removed with
 * it - and, being paid expenses, post to the books (DR the category's expense account / CR cash).
 * Allowances paid through payroll are left alone: payroll carries them.
 */
class AllowanceExpenseService
{
    public const CATEGORY = 'Salaries & Allowances';

    public function categoryFor(string $companyId): ExpenseCategory
    {
        $existing = ExpenseCategory::where('company_id', $companyId)
            ->whereRaw("lower(replace(name, 'and', '&')) = lower(?)", [self::CATEGORY])
            ->first();

        return $existing ?? ExpenseCategory::create([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'name' => self::CATEGORY,
            'description' => 'Salaries and allowances, incl. allowances paid outside payroll',
            'color' => '#4F46E5',
            'is_active' => true,
        ]);
    }

    /** The days an allowance is paid on, up to today: its date (one-time) or once a month (monthly). */
    public function paymentDates(EmployeeAllowance $a): array
    {
        if ($a->type !== 'allowance' || $a->frequency !== 'disbursed' || !$a->is_active || (float) $a->amount <= 0) {
            return [];
        }
        $start = $a->effective_from ? Carbon::parse($a->effective_from) : Carbon::parse($a->created_at);
        $end = $a->effective_to ? Carbon::parse($a->effective_to) : now();
        if ($end->greaterThan(now())) {
            $end = now();
        }
        if ($start->toDateString() === ($a->effective_to ? Carbon::parse($a->effective_to)->toDateString() : null)) {
            return $start->lessThanOrEqualTo(now()) ? [$start->toDateString()] : []; // one-time
        }
        $dates = [];
        for ($m = $start->copy()->startOfMonth(); $m->lessThanOrEqualTo($end); $m->addMonth()) {
            // Monthly: on the 1st, or the start date in its first month.
            $dates[] = ($m->isSameMonth($start) ? $start : $m)->toDateString();
        }
        return $dates;
    }

    /** Make the allowance's expenses match its payments (create, update, remove). */
    public function sync(EmployeeAllowance $a): void
    {
        DB::transaction(function () use ($a) {
            $prefix = "allowance:{$a->id}:";
            $existing = Expense::where('company_id', $a->company_id)
                ->whereRaw("tags::jsonb::text like ?", ['%' . $prefix . '%'])->get()
                ->keyBy(fn (Expense $e) => collect($e->tags ?? [])->first(fn ($t) => str_starts_with((string) $t, $prefix)));

            $dates = $a->exists ? $this->paymentDates($a) : [];
            $employee = $a->employee;
            $who = $employee ? trim("{$employee->first_name} {$employee->last_name}") : 'Employee';
            $category = $dates ? $this->categoryFor($a->company_id) : null;

            foreach ($dates as $date) {
                $tag = $prefix . $date;
                $fields = [
                    'category_id' => $category->id,
                    'vendor_name' => $who,
                    'description' => "Allowance: {$a->name}" . ($employee?->employee_number ? " ({$employee->employee_number})" : ''),
                    'amount' => round((float) $a->amount, 2),
                    'expense_date' => $date,
                    'notes' => 'Paid outside payroll - recorded from HR > Allowances; changes there update this expense.',
                ];
                if ($e = $existing->get($tag)) {
                    $e->fill($fields);
                    if ($e->isDirty()) {
                        $e->save();
                    }
                } else {
                    Expense::create($fields + [
                        'id' => (string) Str::uuid(),
                        'company_id' => $a->company_id,
                        'payment_method' => 'cash',
                        'status' => 'approved', // as every expense here; approved expenses post to the books
                        'is_recurring' => false,
                        'tags' => ['allowance', $tag],
                        // Who recorded it: whoever saves the allowance, else the employee's user, else the company's first user.
                        'created_by' => auth()->id() ?? $employee?->user_id
                            ?? \App\Models\User::where('company_id', $a->company_id)->orderBy('created_at')->value('id'),
                    ]);
                }
            }
            // Payments no longer due (allowance removed, dates or frequency changed).
            foreach ($existing as $tag => $e) {
                if (!in_array(substr((string) $tag, strlen($prefix)), $dates, true)) {
                    $e->delete();
                }
            }
        });
    }

    /** Bring every disbursed allowance of a company up to date (a new month adds its payment). */
    public function syncCompany(string $companyId): void
    {
        EmployeeAllowance::where('company_id', $companyId)->where('type', 'allowance')->where('frequency', 'disbursed')
            ->get()->each(fn (EmployeeAllowance $a) => $this->sync($a));
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanySubscription;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class CompanyManagementController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }
    /**
     * Get all companies with their subscription status (System Admin only).
     */
    public function getAllCompanies(Request $request)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        try {
            $perPage = $request->input('per_page', 15);
            $search = $request->input('search');
            $status = $request->input('status'); // active, inactive, trial, expired
            $sortBy = $request->input('sort_by', 'created_at');
            $sortOrder = $request->input('sort_order', 'desc');

            $query = Company::with([
                'currentSubscription.subscriptionPlan',
                'users' => function ($query) {
                    $query->select('id', 'company_id', 'first_name', 'last_name', 'email', 'is_active');
                }
            ]);

            // Search filter
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ILIKE', "%{$search}%")
                        ->orWhere('email', 'ILIKE', "%{$search}%")
                        ->orWhere('phone', 'ILIKE', "%{$search}%");
                });
            }

            // Status filter
            if ($status) {
                switch ($status) {
                    case 'active':
                        $query->whereHas('currentSubscription', function ($q) {
                            $q->where('status', 'active')
                                ->where('end_date', '>', Carbon::now());
                        });
                        break;
                    case 'inactive':
                        $query->whereRaw('is_active = false');
                        break;
                    case 'trial':
                        $query->whereHas('currentSubscription', function ($q) {
                            $q->where('status', 'trial');
                        });
                        break;
                    case 'expired':
                        $query->whereHas('currentSubscription', function ($q) {
                            $q->where('end_date', '<', Carbon::now());
                        });
                        break;
                }
            }

            $companies = $query->orderBy($sortBy, $sortOrder)->paginate($perPage);

            // Add subscription status to each company
            $companies->getCollection()->transform(function ($company) {
                $company->subscription_status = $this->getCompanySubscriptionStatus($company);
                $company->users_count = $company->users->count();
                $company->total_users = $company->users->count();
                return $company;
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Companies retrieved successfully.',
                'data' => $companies,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve companies', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve companies: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get company details with subscription information.
     */
    public function getCompanyDetails(Request $request, $companyId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        try {
            $company = Company::with([
                'currentSubscription.subscriptionPlan',
                'subscriptions.subscriptionPlan',
                'subscriptionPayments' => function ($query) {
                    $query->orderBy('created_at', 'desc')->limit(10);
                },
                'users' => function ($query) {
                    $query->select('id', 'company_id', 'first_name', 'last_name', 'email', 'is_active', 'created_at');
                }
            ])->find($companyId);

            if (!$company) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Company not found.',
                ], 404);
            }

            $company->subscription_status = $this->getCompanySubscriptionStatus($company);
            $company->users_count = $company->users->count();

            return response()->json([
                'status' => 'success',
                'message' => 'Company details retrieved successfully.',
                'data' => $company,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve company details', ['error' => $e->getMessage(), 'company_id' => $companyId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve company details: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Activate or deactivate a company.
     */
    public function toggleCompanyStatus(Request $request, $companyId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'is_active' => 'required|boolean',
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $company = Company::find($companyId);
            if (!$company) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Company not found.',
                ], 404);
            }

            $isActive = $request->input('is_active');
            $reason = $request->input('reason');

            $company->update(['is_active' => $isActive]);

            // If deactivating, also suspend the subscription
            if (!$isActive && $company->currentSubscription) {
                $company->currentSubscription->suspend();
            } elseif ($isActive && $company->currentSubscription && $company->currentSubscription->status === 'suspended') {
                $company->currentSubscription->reactivate();
            }

            // Log the action
            Log::info('Company status changed', [
                'company_id' => $companyId,
                'company_name' => $company->name,
                'is_active' => $isActive,
                'reason' => $reason,
                'changed_by' => $request->user()->id,
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => $isActive ? 'Company activated successfully.' : 'Company deactivated successfully.',
                'data' => [
                    'company_id' => $company->id,
                    'name' => $company->name,
                    'is_active' => $company->is_active,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to toggle company status', ['error' => $e->getMessage(), 'company_id' => $companyId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update company status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create or update company subscription.
     */
    public function manageSubscription(Request $request, $companyId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'subscription_plan_id' => 'required|uuid|exists:subscription_plans,id',
            'start_date' => 'required|date',
            'billing_cycle' => 'required|in:monthly,quarterly,semi_annual,annual',
            'amount' => 'nullable|numeric|min:0',
            'auto_renew' => 'boolean',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $company = Company::find($companyId);
            if (!$company) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Company not found.',
                ], 404);
            }

            $subscriptionPlan = SubscriptionPlan::find($request->input('subscription_plan_id'));
            if (!$subscriptionPlan) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Subscription plan not found.',
                ], 404);
            }

            $startDate = Carbon::parse($request->input('start_date'));
            $billingCycle = $request->input('billing_cycle');
            $amount = $request->input('amount', $subscriptionPlan->price);

            // Calculate end date based on billing cycle
            $endDate = match ($billingCycle) {
                'monthly' => $startDate->copy()->addMonth(),
                'quarterly' => $startDate->copy()->addMonths(3),
                'semi_annual' => $startDate->copy()->addMonths(6),
                'annual' => $startDate->copy()->addYear(),
                default => $startDate->copy()->addMonth(),
            };

            // Cancel existing subscription if any
            if ($company->currentSubscription) {
                $company->currentSubscription->cancel(
                    'Replaced with new subscription plan',
                    $request->user()->id
                );
            }

            // Create new subscription
            $subscription = CompanySubscription::create([
                'id' => Str::uuid(),
                'company_id' => $companyId,
                'subscription_plan_id' => $subscriptionPlan->id,
                'status' => 'active',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'amount' => $amount,
                'currency' => $subscriptionPlan->currency,
                'billing_cycle' => $billingCycle,
                'next_billing_date' => $endDate,
                'auto_renew' => $request->input('auto_renew', true),
                'metadata' => [
                    'created_by_admin' => $request->user()->id,
                    'notes' => $request->input('notes'),
                    'created_at' => now()->toISOString(),
                ],
            ]);

            // Update company's current subscription
            $company->update(['current_subscription_id' => $subscription->id]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription created successfully.',
                'data' => $subscription->load('subscriptionPlan'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create subscription', ['error' => $e->getMessage(), 'company_id' => $companyId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create subscription: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel company subscription.
     */
    public function cancelSubscription(Request $request, $companyId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
            'immediate' => 'boolean', // Cancel immediately or at period end
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $company = Company::with('currentSubscription')->find($companyId);
            if (!$company) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Company not found.',
                ], 404);
            }

            if (!$company->currentSubscription) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'No active subscription found for this company.',
                ], 404);
            }

            $reason = $request->input('reason');
            $immediate = $request->input('immediate', false);

            if ($immediate) {
                // Cancel immediately
                $company->currentSubscription->cancel($reason, $request->user()->id);
                $company->update(['current_subscription_id' => null]);
                $message = 'Subscription cancelled immediately.';
            } else {
                // Cancel at period end
                $company->currentSubscription->update([
                    'auto_renew' => false,
                    'cancellation_reason' => $reason,
                    'cancelled_by' => $request->user()->id,
                ]);
                $message = 'Subscription will be cancelled at the end of the current billing period.';
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => $message,
                'data' => $company->currentSubscription,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to cancel subscription', ['error' => $e->getMessage(), 'company_id' => $companyId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to cancel subscription: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Record manual payment for subscription.
     */
    public function recordPayment(Request $request, $companyId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'required|in:mpesa,bank_transfer,card,cash,other',
            'payment_reference' => 'required|string|max:100|unique:subscription_payments,payment_reference',
            'payment_date' => 'required|date',
            'period_start' => 'required|date',
            'period_end' => 'required|date|after:period_start',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $company = Company::with('currentSubscription')->find($companyId);
            if (!$company) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Company not found.',
                ], 404);
            }

            if (!$company->currentSubscription) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'No active subscription found for this company.',
                ], 404);
            }

            $payment = SubscriptionPayment::create([
                'id' => Str::uuid(),
                'company_subscription_id' => $company->currentSubscription->id,
                'company_id' => $companyId,
                'payment_reference' => $request->input('payment_reference'),
                'amount' => $request->input('amount'),
                'currency' => $company->currentSubscription->currency,
                'payment_method' => $request->input('payment_method'),
                'status' => 'completed',
                'payment_date' => Carbon::parse($request->input('payment_date')),
                'period_start' => Carbon::parse($request->input('period_start')),
                'period_end' => Carbon::parse($request->input('period_end')),
                'payment_details' => json_encode([
                    'notes' => $request->input('notes'),
                    'recorded_by_admin' => $request->user()->id,
                    'recorded_at' => now()->toISOString(),
                ]),
                'processed_by' => $request->user()->id,
            ]);

            // Update subscription end date and next billing date
            $newEndDate = Carbon::parse($request->input('period_end'));
            $nextBillingDate = $company->currentSubscription->calculateNextBillingDate($newEndDate);

            $company->currentSubscription->update([
                'end_date' => $newEndDate,
                'next_billing_date' => $nextBillingDate,
                'status' => 'active',
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Payment recorded successfully.',
                'data' => $payment,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to record payment', ['error' => $e->getMessage(), 'company_id' => $companyId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to record payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get subscription statistics.
     */
    public function getSubscriptionStats(Request $request)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        try {
            $stats = [
                'total_companies' => Company::count(),
                'active_companies' => Company::whereRaw('is_active = true')->count(),
                'inactive_companies' => Company::whereRaw('is_active = false')->count(),
                'companies_with_active_subscriptions' => Company::whereHas('currentSubscription', function ($q) {
                    $q->where('status', 'active')->where('end_date', '>', Carbon::now());
                })->count(),
                'companies_in_trial' => Company::whereHas('currentSubscription', function ($q) {
                    $q->where('status', 'trial');
                })->count(),
                'expired_subscriptions' => Company::whereHas('currentSubscription', function ($q) {
                    $q->where('end_date', '<', Carbon::now());
                })->count(),
                'expiring_soon' => Company::whereHas('currentSubscription', function ($q) {
                    $futureDate = Carbon::today()->addDays(7);
                    $q->where('end_date', '<=', $futureDate)
                        ->where('end_date', '>=', Carbon::today());
                })->count(),
                'total_revenue_this_month' => SubscriptionPayment::where('status', 'completed')
                    ->whereMonth('payment_date', Carbon::now()->month)
                    ->whereYear('payment_date', Carbon::now()->year)
                    ->sum('amount'),
                'total_revenue_this_year' => SubscriptionPayment::where('status', 'completed')
                    ->whereYear('payment_date', Carbon::now()->year)
                    ->sum('amount'),
            ];

            // Get revenue by plan
            $revenueByPlan = SubscriptionPayment::join('company_subscriptions', 'subscription_payments.company_subscription_id', '=', 'company_subscriptions.id')
                ->join('subscription_plans', 'company_subscriptions.subscription_plan_id', '=', 'subscription_plans.id')
                ->where('subscription_payments.status', 'completed')
                ->whereYear('subscription_payments.payment_date', Carbon::now()->year)
                ->groupBy('subscription_plans.id', 'subscription_plans.name')
                ->selectRaw('subscription_plans.id, subscription_plans.name, SUM(subscription_payments.amount) as total_revenue, COUNT(*) as payment_count')
                ->get();

            $stats['revenue_by_plan'] = $revenueByPlan;

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription statistics retrieved successfully.',
                'data' => $stats,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve subscription stats', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve statistics: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get company subscription status helper.
     */
    private function getCompanySubscriptionStatus($company)
    {
        if (!$company->currentSubscription) {
            return [
                'status' => 'no_subscription',
                'display' => 'No Subscription',
                'days_remaining' => 0,
                'is_trial' => false,
                'is_expired' => true,
            ];
        }

        $subscription = $company->currentSubscription;

        return [
            'status' => $subscription->status,
            'display' => ucfirst(str_replace('_', ' ', $subscription->status)),
            'days_remaining' => $subscription->days_remaining,
            'trial_days_remaining' => $subscription->trial_days_remaining,
            'is_trial' => $subscription->isInTrial(),
            'is_active' => $subscription->isActive(),
            'is_expired' => $subscription->isExpired(),
            'end_date' => $subscription->end_date->toDateString(),
            'plan_name' => $subscription->subscriptionPlan->name ?? 'Unknown',
            'amount' => $subscription->amount,
            'billing_cycle' => $subscription->billing_cycle,
        ];
    }
}

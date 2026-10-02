<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    protected ReportService $reportService;

    public function __construct(ReportService $reportService)
    {
        $this->middleware('auth:sanctum');
        $this->reportService = $reportService;
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
     * INVENTORY REPORTS
     */
    public function inventoryReports(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id', $request->user()->company_id);

        if (!$this->hasPermission($request, 'can_view_reports', $companyId)
            && !$this->hasPermission($request, 'can_view_inventory_reports', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $type = $request->input('type', 'balance'); // balance, low_stock, movement, stock_management
        $filters = $request->all();

        try {
            $result = [];
            switch ($type) {
                case 'low_stock':
                    $result = $this->reportService->forCompany($companyId)->getLowStockReport($filters);
                    break;
                case 'movement':
                    $result = $this->reportService->forCompany($companyId)->getInventoryMovementLog($filters);
                    break;
                case 'stock_management':
                    $result = $this->reportService->forCompany($companyId)->getStockManagementReport($filters);
                    break;
                case 'balance':
                default:
                    $result = $this->reportService->forCompany($companyId)->getStockBalanceReport($filters);
                    break;
            }

            // If result is an array with data/summary (like from inventory), merge it.
            // Otherwise, wrap it in 'data'.
            $response = ['status' => 'success'];
            if (isset($result['data'])) {
                $response = array_merge($response, $result);
            } else {
                $response['data'] = $result;
            }

            return response()->json($response, 200);
        } catch (\Exception $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * SALES REPORTS
     */
    public function salesReports(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id', $request->user()->company_id);

        if (!$this->hasPermission($request, 'can_view_reports', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $type = $request->input('type', 'performance'); // performance, ranking, conversion
        $filters = $request->all();

        try {
            $result = [];
            switch ($type) {
                case 'ranking':
                    $result = $this->reportService->forCompany($companyId)->getProductSalesRanking($filters);
                    break;
                case 'conversion':
                    $result = $this->reportService->forCompany($companyId)->getQuoteConversionReport($filters);
                    break;
                case 'performance':
                default:
                    $result = $this->reportService->forCompany($companyId)->getSalesPerformanceSummary($filters);
                    break;
            }

            $response = ['status' => 'success'];
            if (isset($result['data'])) {
                $response = array_merge($response, $result);
            } else {
                $response['data'] = $result;
            }

            return response()->json($response, 200);
        } catch (\Exception $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * LOGISTICS REPORTS
     */
    public function logisticsReports(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id', $request->user()->company_id);

        if (!$this->hasPermission($request, 'can_view_reports', $companyId)
            && !$this->hasPermission($request, 'can_view_logistics_reports', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $type = $request->input('type', 'efficiency'); // efficiency, success_rate
        $filters = $request->all();

        try {
            $result = [];
            switch ($type) {
                case 'success_rate':
                    $result = $this->reportService->forCompany($companyId)->getDeliverySuccessRate($filters);
                    break;
                case 'efficiency':
                default:
                    $result = $this->reportService->forCompany($companyId)->getDispatchEfficiencyReport($filters);
                    break;
            }

            $response = ['status' => 'success'];
            if (isset($result['data'])) {
                $response = array_merge($response, $result);
            } else {
                $response['data'] = $result;
            }

            return response()->json($response, 200);
        } catch (\Exception $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * PROCUREMENT REPORTS
     */
    public function procurementReports(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id', $request->user()->company_id);

        if (!$this->hasPermission($request, 'can_view_reports', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $filters = $request->all();

        try {
            $data = $this->reportService->forCompany($companyId)->getPurchaseOrderStatusReport($filters);
            return response()->json(['status' => 'success', 'data' => $data], 200);
        } catch (\Exception $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * CUSTOMER REPORTS
     */
    public function customerReports(Request $request): JsonResponse
    {
        $companyId = $request->input('company_id', $request->user()->company_id);

        if (!$this->hasPermission($request, 'can_view_reports', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $filters = $request->all();

        try {
            $data = $this->reportService->forCompany($companyId)->getCustomerAcquisitionReport($filters);
            return response()->json(['status' => 'success', 'data' => $data], 200);
        } catch (\Exception $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }
}

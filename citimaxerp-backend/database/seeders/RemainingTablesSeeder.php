<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RemainingTablesSeeder extends Seeder
{
    public function run(): void
    {
        \Illuminate\Database\Eloquent\Model::unguard();

        $cid = DB::table('companies')->value('id');
        $aid = DB::table('users')->where('email', 'admin@cherrydist.com')->value('id');
        $sid = DB::table('stores')->where('company_id', $cid)->value('id');
        $userIds = DB::table('users')->where('company_id', $cid)->pluck('id')->toArray();
        $customerIds = DB::table('customers')->where('company_id', $cid)->pluck('id')->toArray();
        $productIds = DB::table('products')->where('company_id', $cid)->pluck('id')->toArray();
        $employeeIds = DB::table('employees')->where('company_id', $cid)->pluck('id')->toArray();
        $supplierIds = DB::table('suppliers')->where('company_id', $cid)->pluck('id')->toArray();
        $orderIds = DB::table('orders')->where('company_id', $cid)->pluck('id')->toArray();
        $invoiceIds = DB::table('invoices')->where('company_id', $cid)->pluck('id')->toArray();
        $poIds = DB::table('purchase_orders')->where('company_id', $cid)->pluck('id')->toArray();
        $deliveryLocationIds = DB::table('delivery_locations')->where('company_id', $cid)->pluck('id')->toArray();
        $deliveryPersonIds = DB::table('delivery_persons')->where('company_id', $cid)->pluck('id')->toArray();
        $accountIds = DB::table('chart_of_accounts')->where('company_id', $cid)->pluck('id')->toArray();
        $fixedAssetIds = DB::table('fixed_assets')->where('company_id', $cid)->pluck('id')->toArray();
        $bankAccountIds = DB::table('bank_accounts')->where('company_id', $cid)->pluck('id')->toArray();
        $now = Carbon::now();

        $r = fn() => Str::uuid()->toString();
        $rp = fn($arr) => $arr[array_rand($arr)];

        // ── Financial Periods ──
        $this->command->info('Creating financial periods...');
        $fpIds = [];
        for ($m = 1; $m <= 12; $m++) {
            $id = $r();
            DB::table('financial_periods')->insert([
                'id' => $id, 'company_id' => $cid,
                'name' => Carbon::create(2025, $m)->format('F Y'),
                'period_type' => 'monthly',
                'start_date' => Carbon::create(2025, $m, 1), 'end_date' => Carbon::create(2025, $m)->endOfMonth(),
                'status' => $m <= 10 ? 'closed' : 'open',
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $fpIds[] = $id;
        }

        // ── Customer Accounts ──
        $this->command->info('Creating customer accounts...');
        $caIds = [];
        foreach (array_slice($customerIds, 0, 45) as $i => $custId) {
            $id = $r();
            DB::table('customer_accounts')->insert([
                'id' => $id, 'customer_id' => $custId, 'company_id' => $cid,
                'account_number' => 'CA-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'annual_turnover' => rand(500000, 5000000), 'credit_required' => rand(50000, 500000),
                'current_balance' => rand(0, 200000),
                'approval_status' => ['approved', 'approved', 'approved', 'pending', 'draft'][$i % 5],
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $caIds[] = $id;
        }

        // ── Customer Activities ──
        $this->command->info('Creating customer activities...');
        $actTypes = ['call', 'email', 'meeting', 'other'];
        for ($i = 0; $i < 45; $i++) {
            DB::table('customer_activities')->insert([
                'id' => $r(), 'customer_id' => $rp($customerIds),
                'activity_type' => $rp($actTypes),
                'activity_date' => $now->copy()->subDays(rand(1, 90)),
                'outcome' => ['Positive', 'Follow-up needed', 'Order placed', 'No answer', 'Meeting scheduled'][$i % 5],
                'notes' => 'Activity note #' . ($i + 1),
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Delivery Details ──
        $this->command->info('Creating delivery details...');
        $deliveredOrders = DB::table('orders')->where('company_id', $cid)->where('status', 'delivered')->pluck('id', 'customer_id')->toArray();
        $ddCount = 0;
        foreach ($deliveredOrders as $custId => $ordId) {
            if ($ddCount >= 45) break;
            DB::table('delivery_details')->insert([
                'id' => $r(), 'customer_id' => $custId, 'order_id' => $ordId,
                'delivery_location_id' => $rp($deliveryLocationIds),
                'delivery_method' => ['truck', 'van', 'motorcycle'][$ddCount % 3],
                'tracking_number' => 'TRK-' . str_pad($ddCount + 1, 5, '0', STR_PAD_LEFT),
                'estimated_delivery_date' => $now->copy()->subDays(rand(1, 30)),
                'actual_delivery_date' => $now->copy()->subDays(rand(0, 25)),
                'delivery_status' => 'delivered', 'company_id' => $cid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $ddCount++;
        }

        // ── Order Dispatches + Items ──
        $this->command->info('Creating order dispatches...');
        $odIds = [];
        $orderItems = DB::table('order_items')->get()->groupBy('order_id');
        foreach (array_slice($orderIds, 0, 45) as $i => $ordId) {
            $id = $r();
            DB::table('order_dispatches')->insert([
                'id' => $id, 'dispatch_number' => 'OD-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'order_id' => $ordId, 'company_id' => $cid, 'from_store_id' => $sid,
                'delivery_location_id' => $rp($deliveryLocationIds),
                'approval_status' => $i < 35 ? 'approved' : 'pending',
                'status' => $i < 30 ? 'delivered' : ($i < 40 ? 'in_transit' : 'pending'),
                'dispatch_date' => $now->copy()->subDays(rand(1, 60)),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $odIds[] = $id;

            // Order dispatch items
            if (isset($orderItems[$ordId])) {
                foreach ($orderItems[$ordId] as $oi) {
                    DB::table('order_dispatch_items')->insert([
                        'id' => $r(), 'order_dispatch_id' => $id, 'order_item_id' => $oi->id,
                        'product_id' => $oi->product_id, 'quantity' => $oi->quantity,
                        'delivered_quantity' => $i < 30 ? $oi->quantity : 0,
                        'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }
        }

        // ── Dispatches + Items ──
        $this->command->info('Creating dispatches...');
        for ($i = 0; $i < 45; $i++) {
            $dId = $r();
            DB::table('dispatches')->insert([
                'id' => $dId, 'dispatch_number' => 'DSP-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'from_store_id' => $sid, 'to_entity' => 'Customer ' . ($i + 1),
                'type' => $i % 5 === 0 ? 'internal' : 'external',
                'approval_status' => $i < 35 ? 'approved' : 'pending',
                'created_at' => $now, 'updated_at' => $now,
            ]);
            for ($j = 0; $j < rand(1, 3); $j++) {
                DB::table('dispatch_items')->insert([
                    'id' => $r(), 'dispatch_id' => $dId, 'product_id' => $rp($productIds),
                    'quantity' => rand(5, 50), 'received_quantity' => $i < 35 ? rand(5, 50) : 0,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Journal Entries + Items ──
        $this->command->info('Creating journal entries...');
        for ($i = 0; $i < 45; $i++) {
            $jeId = $r();
            $amount = rand(5000, 100000);
            $accs = array_slice($accountIds, 0, min(count($accountIds), 10));
            $debitAcc = $accs[array_rand($accs)];
            $creditAcc = $accs[array_rand($accs)];
            DB::table('journal_entries')->insert([
                'id' => $jeId, 'company_id' => $cid,
                'entry_number' => 'JE-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'entry_date' => $now->copy()->subDays(rand(1, 90)),
                'description' => ['Sales revenue recording', 'Expense posting', 'Payroll entry', 'Asset purchase', 'Tax payment', 'Supplier payment', 'Customer receipt', 'Depreciation entry', 'Adjustment entry', 'Transfer posting'][$i % 10],
                'total_debit' => $amount, 'total_credit' => $amount,
                'status' => $i < 35 ? 'posted' : 'draft',
                'entry_type' => ['manual', 'automatic', 'adjusting'][$i % 3],
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('journal_entry_items')->insert([
                ['id' => $r(), 'journal_entry_id' => $jeId, 'account_id' => $debitAcc, 'company_id' => $cid, 'description' => 'Debit entry', 'debit_amount' => $amount, 'credit_amount' => 0, 'created_at' => $now, 'updated_at' => $now],
                ['id' => $r(), 'journal_entry_id' => $jeId, 'account_id' => $creditAcc, 'company_id' => $cid, 'description' => 'Credit entry', 'debit_amount' => 0, 'credit_amount' => $amount, 'created_at' => $now, 'updated_at' => $now],
            ]);
        }

        // ── Payroll Records + Items ──
        $this->command->info('Creating payroll records...');
        for ($m = 1; $m <= 6; $m++) {
            $prId = $r();
            $totalGross = 0; $totalDed = 0; $totalNet = 0;
            $items = [];
            foreach ($employeeIds as $empId) {
                $emp = DB::table('employees')->where('id', $empId)->first();
                $basic = $emp->basic_salary ?? 40000;
                $paye = $basic * 0.1; $nssf = min($basic * 0.06, 2160); $shif = $basic * 0.0275;
                $gross = $basic; $ded = $paye + $nssf + $shif; $net = $gross - $ded;
                $totalGross += $gross; $totalDed += $ded; $totalNet += $net;
                $items[] = [
                    'id' => $r(), 'payroll_record_id' => $prId, 'employee_id' => $empId, 'company_id' => $cid,
                    'basic_salary' => $basic, 'gross_pay' => $gross,
                    'paye_amount' => $paye, 'nssf_amount' => $nssf, 'shif_amount' => $shif,
                    'total_deductions' => $ded, 'net_pay' => $net,
                    'days_worked' => rand(20, 26), 'created_at' => $now, 'updated_at' => $now,
                ];
            }
            DB::table('payroll_records')->insert([
                'id' => $prId, 'company_id' => $cid,
                'payroll_number' => 'PR-' . str_pad($m, 4, '0', STR_PAD_LEFT),
                'pay_period_start' => Carbon::create(2025, $m, 1),
                'pay_period_end' => Carbon::create(2025, $m)->endOfMonth(),
                'pay_date' => Carbon::create(2025, $m)->endOfMonth(),
                'status' => $m <= 4 ? 'paid' : ($m === 5 ? 'approved' : 'draft'),
                'total_gross_pay' => $totalGross, 'total_deductions' => $totalDed, 'total_net_pay' => $totalNet,
                'total_paye' => $totalGross * 0.1, 'total_nssf' => count($employeeIds) * 2160, 'total_shif' => $totalGross * 0.0275,
                'employee_count' => count($employeeIds),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('payroll_items')->insert($items);
        }

        // ── Inventory Batches + Movements ──
        $this->command->info('Creating inventory batches and movements...');
        foreach (array_slice($productIds, 0, 45) as $i => $pid) {
            $batchId = $r();
            $qty = rand(50, 300);
            $prod = DB::table('products')->where('id', $pid)->first();
            DB::table('inventory_batches')->insert([
                'id' => $batchId, 'company_id' => $cid, 'store_id' => $sid, 'product_id' => $pid,
                'batch_number' => 'BAT-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'quantity_received' => $qty, 'quantity_available' => (int)($qty * 0.7),
                'quantity_sold' => (int)($qty * 0.3),
                'received_date' => $now->copy()->subDays(rand(10, 60)),
                'unit_cost' => $prod->unit_cost ?? 50, 'selling_price' => $prod->price ?? 80,
                'status' => 'active', 'supplier_id' => $rp($supplierIds),
                'created_at' => $now, 'updated_at' => $now,
            ]);
            // Receipt movement
            DB::table('inventory_movements')->insert([
                'id' => $r(), 'company_id' => $cid, 'store_id' => $sid, 'product_id' => $pid, 'batch_id' => $batchId,
                'type' => 'receipt', 'quantity' => $qty, 'quantity_before' => 0, 'quantity_after' => $qty,
                'unit_cost' => $prod->unit_cost ?? 50, 'movement_date' => $now->copy()->subDays(rand(10, 60)),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            // Sale movement
            $sold = (int)($qty * 0.3);
            DB::table('inventory_movements')->insert([
                'id' => $r(), 'company_id' => $cid, 'store_id' => $sid, 'product_id' => $pid, 'batch_id' => $batchId,
                'type' => 'sale', 'quantity' => $sold, 'quantity_before' => $qty, 'quantity_after' => $qty - $sold,
                'unit_price' => $prod->price ?? 80, 'movement_date' => $now->copy()->subDays(rand(1, 9)),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Stock Counts + Items ──
        $this->command->info('Creating stock counts...');
        for ($i = 0; $i < 10; $i++) {
            $scId = $r();
            DB::table('stock_counts')->insert([
                'id' => $scId, 'company_id' => $cid, 'store_id' => $sid,
                'count_number' => 'SC-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT),
                'name' => 'Stock Count ' . Carbon::now()->subMonths($i)->format('M Y'),
                'count_type' => $i % 3 === 0 ? 'full_count' : 'cycle_count',
                'status' => $i < 7 ? 'completed' : 'in_progress',
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            foreach (array_slice($productIds, 0, 5) as $pid) {
                $prod = DB::table('products')->where('id', $pid)->first();
                $expected = $prod->stock_quantity ?? 100;
                $counted = $expected + rand(-10, 10);
                DB::table('stock_count_items')->insert([
                    'id' => $r(), 'company_id' => $cid, 'store_id' => $sid, 'stock_count_id' => $scId,
                    'product_id' => $pid, 'product_name' => $prod->name ?? 'Product',
                    'expected_quantity' => $expected, 'counted_quantity' => $counted,
                    'unit_cost' => $prod->unit_cost ?? 50,
                    'is_counted' => 'true', 'counted_by' => $aid, 'counted_at' => $now,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Stock Adjustments + Items ──
        $this->command->info('Creating stock adjustments...');
        $adjTypes = ['increase', 'decrease'];
        $adjReasons = ['damage', 'correction', 'recount', 'loss', 'found'];
        for ($i = 0; $i < 45; $i++) {
            $saId = $r(); $pid = $rp($productIds);
            $prod = DB::table('products')->where('id', $pid)->first();
            $qtyBefore = $prod->stock_quantity ?? 100; $qtyAdj = rand(1, 20);
            $type = $rp($adjTypes);
            $qtyAfter = $type === 'increase' ? $qtyBefore + $qtyAdj : max(0, $qtyBefore - $qtyAdj);
            DB::table('stock_adjustments')->insert([
                'id' => $saId, 'company_id' => $cid, 'store_id' => $sid,
                'adjustment_number' => 'ADJ-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'product_id' => $pid, 'adjustment_type' => $type, 'reason_type' => $rp($adjReasons),
                'quantity_before' => $qtyBefore, 'quantity_adjusted' => $qtyAdj, 'quantity_after' => $qtyAfter,
                'unit_cost' => $prod->unit_cost ?? 50, 'total_cost' => $qtyAdj * ($prod->unit_cost ?? 50),
                'status' => $i < 35 ? 'completed' : 'pending', 'reason' => 'Adjustment reason #' . ($i + 1),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('stock_adjustment_items')->insert([
                'id' => $r(), 'stock_adjustment_id' => $saId, 'product_id' => $pid, 'store_id' => $sid,
                'adjustment_type' => $type, 'quantity_before' => $qtyBefore,
                'quantity_adjusted' => $qtyAdj, 'quantity_after' => $qtyAfter,
                'unit_cost' => $prod->unit_cost ?? 50, 'total_cost' => $qtyAdj * ($prod->unit_cost ?? 50),
                'item_status' => $i < 35 ? 'applied' : 'pending',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Breakages + Items ──
        $this->command->info('Creating breakages...');
        for ($i = 0; $i < 45; $i++) {
            $bId = $r();
            DB::table('breakages')->insert([
                'id' => $bId, 'company_id' => $cid, 'reported_by' => $rp($userIds),
                'breakage_number' => 'BRK-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'notes' => 'Breakage report #' . ($i + 1),
                'approval_status' => $i < 30 ? 'approved' : 'pending',
                'status' => $i < 30 ? 'approved' : 'pending',
                'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('breakage_items')->insert([
                'id' => $r(), 'breakage_id' => $bId, 'product_id' => $rp($productIds),
                'quantity' => rand(1, 10), 'cause' => ['transport', 'handling', 'storage', 'defective', 'other'][$i % 5],
                'company_id' => $cid, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Repairs + Items ──
        $this->command->info('Creating repairs...');
        for ($i = 0; $i < 45; $i++) {
            $rId = $r();
            DB::table('repairs')->insert([
                'id' => $rId, 'company_id' => $cid,
                'repair_number' => 'RPR-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'reported_by' => $rp($userIds), 'description' => 'Repair request #' . ($i + 1),
                'status' => ['pending', 'in_progress', 'completed', 'pending', 'completed'][$i % 5],
                'approval_status' => $i < 30 ? 'approved' : 'pending',
                'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('repair_items')->insert([
                'id' => $r(), 'company_id' => $cid, 'repair_id' => $rId,
                'product_id' => $rp($productIds), 'quantity' => rand(1, 5),
                'status' => ['pending', 'in_progress', 'completed'][$i % 3],
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Requisitions + Items ──
        $this->command->info('Creating requisitions...');
        for ($i = 0; $i < 45; $i++) {
            $reqId = $r();
            DB::table('requisitions')->insert([
                'id' => $reqId, 'requisition_number' => 'REQ-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'company_id' => $cid, 'requester_id' => $rp($userIds),
                'approval_status' => $i < 30 ? 'approved' : 'pending',
                'status' => $i < 25 ? 'dispatched' : ($i < 35 ? 'approved' : 'pending'),
                'notes' => 'Requisition #' . ($i + 1),
                'created_at' => $now, 'updated_at' => $now,
            ]);
            for ($j = 0; $j < rand(1, 3); $j++) {
                DB::table('requisition_items')->insert([
                    'id' => $r(), 'requisition_id' => $reqId, 'product_id' => $rp($productIds),
                    'quantity' => rand(5, 30), 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Credit Notes + Line Items ──
        $this->command->info('Creating credit notes...');
        foreach (array_slice($invoiceIds, 0, min(15, count($invoiceIds))) as $i => $invId) {
            $inv = DB::table('invoices')->where('id', $invId)->first();
            $cnId = $r();
            $amount = round($inv->total_amount * 0.1, 2);
            DB::table('credit_notes')->insert([
                'id' => $cnId, 'credit_note_number' => 'CN-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'company_id' => $cid, 'customer_id' => $inv->customer_id, 'invoice_id' => $invId,
                'created_by' => $aid, 'status' => $i < 10 ? 'issued' : 'draft',
                'credit_note_date' => $now->copy()->subDays(rand(1, 30)),
                'subtotal' => $amount, 'total_amount' => $amount, 'balance_amount' => $amount,
                'reason' => 'Partial return / damage', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $lineItem = DB::table('invoice_line_items')->where('invoice_id', $invId)->first();
            if ($lineItem) {
                DB::table('credit_note_line_items')->insert([
                    'id' => $r(), 'credit_note_id' => $cnId, 'product_id' => $lineItem->product_id,
                    'description' => 'Return: ' . $lineItem->description, 'quantity' => 1,
                    'unit' => 'pcs', 'unit_price' => $amount, 'line_total' => $amount,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Bank Transactions ──
        $this->command->info('Creating bank transactions...');
        for ($i = 0; $i < 45; $i++) {
            DB::table('bank_transactions')->insert([
                'id' => $r(), 'company_id' => $cid, 'bank_account_id' => $rp($bankAccountIds),
                'transaction_reference' => 'BTX-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'transaction_type' => $i % 3 === 0 ? 'debit' : 'credit',
                'amount' => rand(5000, 200000), 'description' => 'Bank transaction #' . ($i + 1),
                'payee_payer' => ['Kenya Power', 'Customer Payment', 'Supplier Payment', 'Salary Transfer', 'Tax Payment'][$i % 5],
                'transaction_date' => $now->copy()->subDays(rand(1, 90)),
                'status' => $i < 35 ? 'cleared' : 'pending',
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Asset Depreciation ──
        $this->command->info('Creating asset depreciation...');
        foreach ($fixedAssetIds as $faId) {
            $fa = DB::table('fixed_assets')->where('id', $faId)->first();
            $annualDep = ($fa->purchase_cost - $fa->residual_value) / $fa->useful_life_years;
            $monthlyDep = round($annualDep / 12, 2);
            $accDep = 0;
            for ($m = 1; $m <= 12; $m++) {
                $accDep += $monthlyDep;
                DB::table('asset_depreciation')->insert([
                    'id' => $r(), 'fixed_asset_id' => $faId, 'company_id' => $cid,
                    'depreciation_date' => Carbon::create(2025, $m)->endOfMonth(),
                    'depreciation_amount' => $monthlyDep,
                    'accumulated_depreciation' => round($accDep, 2),
                    'book_value' => round($fa->purchase_cost - $accDep, 2),
                    'depreciation_type' => 'monthly',
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Product Variants ──
        $this->command->info('Creating product variants...');
        foreach (array_slice($productIds, 0, 15) as $i => $pid) {
            $prod = DB::table('products')->where('id', $pid)->first();
            foreach (['Small', 'Medium', 'Large'] as $j => $size) {
                DB::table('product_variants')->insert([
                    'id' => $r(), 'product_id' => $pid, 'company_id' => $cid, 'store_id' => $sid,
                    'name' => $size, 'sku' => ($prod->product_code ?? 'SKU') . '-' . strtoupper(substr($size, 0, 1)),
                    'price' => ($prod->price ?? 50) * (0.8 + $j * 0.2),
                    'cost' => ($prod->unit_cost ?? 30) * (0.8 + $j * 0.2),
                    'stock_quantity' => rand(20, 100),
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Product Receipts + Items ──
        $this->command->info('Creating product receipts...');
        for ($i = 0; $i < 15; $i++) {
            $prId = $r();
            DB::table('product_receipts')->insert([
                'id' => $prId, 'company_id' => $cid, 'supplier_id' => $rp($supplierIds),
                'document_type' => 'receipt',
                'product_receipt_number' => 'GRN-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'received_by' => $aid, 'store_id' => $sid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            for ($j = 0; $j < rand(2, 4); $j++) {
                $pid = $rp($productIds);
                $prod = DB::table('products')->where('id', $pid)->first();
                DB::table('product_receipt_items')->insert([
                    'id' => $r(), 'company_id' => $cid, 'product_receipt_id' => $prId,
                    'product_id' => $pid, 'quantity' => rand(20, 100),
                    'unit_price' => $prod->unit_cost ?? 50,
                    'batch_number' => 'B-' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT),
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Budgets + Line Items ──
        $this->command->info('Creating budgets...');
        foreach (['Q1 Operating Budget', 'Q2 Operating Budget', 'Annual Capital Budget', 'Marketing Budget', 'IT Infrastructure Budget'] as $i => $bName) {
            $bId = $r(); $total = 0;
            DB::table('budgets')->insert([
                'id' => $bId, 'company_id' => $cid, 'financial_period_id' => $fpIds[$i % count($fpIds)],
                'name' => $bName, 'budget_type' => $i < 2 ? 'operating' : ($i === 2 ? 'capital' : 'project'),
                'status' => $i < 3 ? 'active' : 'draft', 'total_amount' => 0,
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
            foreach (array_slice($accountIds, 0, 5) as $accId) {
                $budgeted = rand(50000, 500000);
                $actual = (int)($budgeted * (rand(60, 110) / 100));
                $total += $budgeted;
                DB::table('budget_line_items')->insert([
                    'id' => $r(), 'budget_id' => $bId, 'chart_of_account_id' => $accId,
                    'budgeted_amount' => $budgeted, 'actual_amount' => $actual,
                    'variance' => $budgeted - $actual,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            DB::table('budgets')->where('id', $bId)->update(['total_amount' => $total]);
        }

        // ── Documents ──
        $this->command->info('Creating documents...');
        for ($i = 0; $i < 45; $i++) {
            DB::table('documents')->insert([
                'id' => $r(), 'document_name' => ['Business License', 'Tax Certificate', 'Insurance Policy', 'Contract Agreement', 'Delivery Note'][$i % 5],
                'document_number' => 'DOC-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'expiry_date' => $now->copy()->addMonths(rand(1, 24)),
                'documentable_type' => 'App\\Models\\Customer', 'documentable_id' => $rp($customerIds),
                'company_id' => $cid, 'created_by' => $aid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Debts ──
        $this->command->info('Creating debts...');
        $unpaidOrders = DB::table('orders')->where('company_id', $cid)->where('payment_status', '!=', 'paid')->limit(45)->get();
        foreach ($unpaidOrders as $i => $order) {
            DB::table('debts')->insert([
                'id' => $r(), 'customer_id' => $order->customer_id, 'order_id' => $order->id,
                'company_id' => $cid, 'amount' => $order->final_amount - $order->amount_paid,
                'status' => 'unpaid', 'due_date' => Carbon::parse($order->created_at)->addDays(30),
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Logistics ──
        $this->command->info('Creating logistics...');
        foreach (array_slice($odIds, 0, min(45, count($odIds))) as $i => $odId) {
            DB::table('logistics')->insert([
                'id' => $r(), 'order_dispatch_id' => $odId, 'company_id' => $cid,
                'delivery_person_id' => $rp($deliveryPersonIds),
                'driver_name' => ['Joseph Maina', 'Esther Nyambura', 'Tom Odhiambo'][$i % 3],
                'driver_contact' => '+2547' . rand(10000000, 99999999),
                'vehicle_registration' => ['KBZ 123A', 'KCA 456B', 'KDA 789C'][$i % 3],
                'vehicle_type' => ['truck', 'van', 'motorcycle'][$i % 3],
                'delivery_status' => $i < 30 ? 'delivered' : 'in_transit',
                'status' => $i < 30 ? 'delivered' : 'in_transit',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Leave Requests ──
        $this->command->info('Creating leave requests...');
        $leaveTypes = ['annual', 'sick', 'maternity', 'paternity', 'unpaid'];
        for ($i = 0; $i < 45; $i++) {
            $start = $now->copy()->subDays(rand(1, 90));
            DB::table('leave_requests')->insert([
                'id' => $r(), 'company_id' => $cid, 'employee_id' => $rp($employeeIds),
                'leave_type' => $rp($leaveTypes), 'start_date' => $start,
                'end_date' => $start->copy()->addDays(rand(1, 14)),
                'reason' => ['Family event', 'Medical appointment', 'Personal reasons', 'Vacation', 'Emergency'][$i % 5],
                'status' => ['approved', 'approved', 'pending', 'rejected', 'approved'][$i % 5],
                'approved_by' => $i % 5 !== 2 ? $aid : null, 'created_by' => $aid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Salary Advances ──
        $this->command->info('Creating salary advances...');
        for ($i = 0; $i < 45; $i++) {
            DB::table('salary_advances')->insert([
                'id' => $r(), 'company_id' => $cid, 'employee_id' => $rp($employeeIds),
                'amount' => rand(5000, 30000), 'request_date' => $now->copy()->subDays(rand(1, 60)),
                'reason' => ['School fees', 'Medical bills', 'Rent payment', 'Emergency', 'Personal needs'][$i % 5],
                'status' => ['approved', 'paid', 'pending', 'rejected', 'approved'][$i % 5],
                'approved_by' => $i % 5 !== 2 ? $aid : null, 'created_by' => $aid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Time Entries ──
        $this->command->info('Creating time entries...');
        $projects = ['Warehouse Operations', 'Delivery Routes', 'Sales Campaign', 'IT Maintenance', 'Admin Tasks'];
        for ($i = 0; $i < 45; $i++) {
            DB::table('time_entries')->insert([
                'id' => $r(), 'company_id' => $cid, 'employee_id' => $rp($employeeIds),
                'date' => $now->copy()->subDays(rand(1, 30)),
                'hours' => rand(4, 12), 'project' => $rp($projects),
                'description' => 'Work entry #' . ($i + 1),
                'status' => ['approved', 'submitted', 'draft', 'approved', 'submitted'][$i % 5],
                'approved_by' => $i % 5 === 0 || $i % 5 === 3 ? $aid : null, 'created_by' => $aid,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── SOPs ──
        $this->command->info('Creating SOPs...');
        $sopTitles = ['Warehouse Safety Procedures', 'Order Processing Guidelines', 'Customer Service Standards', 'Inventory Management', 'Delivery Protocols', 'Returns Processing', 'Quality Control', 'Employee Onboarding', 'Financial Reporting', 'IT Security Policy'];
        foreach ($sopTitles as $i => $title) {
            DB::table('sops')->insert([
                'id' => $r(), 'company_id' => $cid,
                'sop_number' => 'SOP-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT),
                'title' => $title, 'description' => 'Standard operating procedure for ' . strtolower($title),
                'year' => 2025, 'status' => 'active',
                'effective_date' => '2025-01-01', 'review_date' => '2025-12-31',
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Reports ──
        $this->command->info('Creating reports...');
        $reportData = [
            ['Sales Summary', 'summary', 'sales'], ['Revenue by Customer', 'detailed', 'sales'],
            ['Expense Report', 'summary', 'finance'], ['P&L Statement', 'detailed', 'finance'],
            ['Inventory Status', 'summary', 'inventory'], ['Stock Aging', 'detailed', 'inventory'],
            ['Employee Attendance', 'summary', 'hr'], ['Payroll Summary', 'detailed', 'hr'],
            ['Purchase Order Status', 'summary', 'procurement'], ['Supplier Performance', 'detailed', 'procurement'],
        ];
        foreach ($reportData as $i => [$name, $type, $module]) {
            DB::table('reports')->insert([
                'id' => $r(), 'company_id' => $cid, 'name' => $name, 'type' => $type, 'module' => $module,
                'status' => 'active', 'last_generated_at' => $now->copy()->subDays(rand(1, 30)),
                'created_by' => $aid, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Supplier Payments ──
        $this->command->info('Creating supplier payments...');
        $paidPOs = DB::table('purchase_orders')->where('company_id', $cid)->where('payment_status', 'paid')->get();
        foreach ($paidPOs as $i => $po) {
            DB::table('supplier_payments')->insert([
                'id' => $r(), 'company_id' => $cid, 'supplier_id' => $po->supplier_id,
                'purchase_order_id' => $po->id,
                'payment_number' => 'SP-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'amount' => $po->total_amount, 'payment_date' => $now->copy()->subDays(rand(1, 30)),
                'payment_method' => ['bank_transfer', 'cheque', 'cash'][$i % 3],
                'status' => 'completed', 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ═══ SUMMARY ═══
        $this->command->newLine();
        $this->command->info('Remaining tables seeded!');
        $tables = ['customer_accounts','customer_activities','delivery_details','dispatches','dispatch_items','order_dispatches','order_dispatch_items','journal_entries','journal_entry_items','payroll_records','payroll_items','stock_counts','stock_count_items','stock_adjustments','stock_adjustment_items','inventory_batches','inventory_movements','breakages','breakage_items','repairs','repair_items','requisitions','requisition_items','credit_notes','credit_note_line_items','budgets','budget_line_items','financial_periods','bank_transactions','asset_depreciation','product_variants','product_receipts','product_receipt_items','documents','debts','logistics','leave_requests','salary_advances','time_entries','sops','reports','supplier_payments'];
        $total = 0;
        foreach ($tables as $t) {
            $c = DB::table($t)->count(); $total += $c;
            $this->command->info("  {$t}: {$c}");
        }
        $this->command->info("  TOTAL NEW: {$total} records");
    }
}

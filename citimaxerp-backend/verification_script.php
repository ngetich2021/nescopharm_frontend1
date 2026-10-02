<?php

use App\Models\User;
use App\Models\Company;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\DeliveryLocation;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\OrderDispatchController;
use Illuminate\Http\Request;
use App\Services\AccountingWorkflowService;

// Setup
$userId = '59bcf12f-2275-4466-9e90-16004ddff423';
$companyId = 'ef6df756-29ac-4153-a4c4-cc702c7956bd';

$user = User::find($userId);
Auth::login($user);

$product = Product::where('company_id', $companyId)->whereRaw("track_inventory = true")->where('stock_quantity', '>', 5)->first();

if (!$product) {
    echo "No suitable product found.\n";
    exit(1);
}

$customer = \App\Models\Customer::where('company_id', $companyId)->first();
// Create needed dummy data
$deliveryLocation = DeliveryLocation::create([
    'company_id' => $companyId,
    'house_number' => '123',
    'city' => 'Nairobi',
    'country' => 'Kenya',
    'customer_id' => $customer->id,
    'name' => 'Test Location',
    'address' => '123 Test St',
]);

// 1. Create Order
$order = Order::create([
    'company_id' => $companyId,
    'customer_id' => \App\Models\Customer::where('company_id', $companyId)->first()->id,
    'order_number' => 'ORD-TEST-' . time(),
    'total_amount' => 100,
    'status' => 'pending',
    'delivery_location_id' => $deliveryLocation->id,
]);

OrderItem::create([
    'order_id' => $order->id,
    'product_id' => $product->id,
    'quantity' => 1,
    'unit_price' => 100,
    'total_price' => 100,
]);

$order->refresh();
echo "Order created: {$order->id}. Dispatch Status: " . ($order->dispatch_status ?? 'N/A') . "\n";

if ($order->dispatch_status !== 'pending') {
    echo "FAIL: Expected pending, got {$order->dispatch_status}\n";
}

// 2. Create Dispatch
$controller = app(OrderDispatchController::class);

$request = Request::create('/api/order-dispatches', 'POST', [
    'order_id' => $order->id,
    'approvers' => [$userId], // Self approve
    'notes' => 'Test dispatch',
]);
$request->setUserResolver(function () use ($user) {
    return $user;
});

$response = $controller->store($request);
$content = json_decode($response->getContent());

if (!$content->success) {
    echo "Failed to create dispatch: " . $content->message . "\n";
    if (isset($content->errors))
        print_r($content->errors);
    exit(1);
}

$dispatchId = $content->data->id;
$order->refresh();
echo "Dispatch created: {$dispatchId}. Order Dispatch Status: {$order->dispatch_status}\n";

if ($order->dispatch_status !== 'dispatch_created') {
    echo "FAIL: Expected dispatch_created, got {$order->dispatch_status}\n";
}

// 3. Approve Dispatch
$request = Request::create("/api/order-dispatches/{$dispatchId}/approve", 'POST', [
    'comments' => 'Approved',
]);
$request->setUserResolver(function () use ($user) {
    return $user;
});

// Note: Created dispatch status is 'draft', we need to submit it first or maybe the controller handles it?
// Looking at controller: needs to be 'pending' or 'in_progress'.
// store() sets it to 'draft'.
// submitForApproval() sets it to 'pending'.

// 2.5 Submit for approval
$submitRequest = Request::create("/api/order-dispatches/{$dispatchId}/submit", 'POST', []);
$submitRequest->setUserResolver(function () use ($user) {
    return $user;
});
$submitResponse = $controller->submitForApproval($submitRequest, $dispatchId);
$submitContent = json_decode($submitResponse->getContent());

if (!$submitContent->success) {
    echo "Failed to submit for approval: " . $submitContent->message . "\n";
    exit(1);
}

// Now approve
$approveResponse = $controller->approve($request, $dispatchId);
$approveContent = json_decode($approveResponse->getContent());

if (!$approveContent->success) {
    echo "Failed to approve: " . $approveContent->message . "\n";
    exit(1);
}

$order->refresh();
echo "Dispatch Approved. Order Dispatch Status: {$order->dispatch_status}\n";

if ($order->dispatch_status !== 'dispatch_approved') {
    echo "FAIL: Expected dispatch_approved, got {$order->dispatch_status}\n";
} else {
    echo "SUCCESS: All statuses updated correctly.\n";
}

// Cleanup
$order->delete();
$deliveryLocation->delete();


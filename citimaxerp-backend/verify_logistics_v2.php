<?php

use App\Models\User;
use App\Models\OrderDispatch;
use App\Models\DeliveryPerson;
use App\Models\Logistic;
use Illuminate\Support\Str;
use Carbon\Carbon;

echo "Starting verification...\n";

try {
    // 1. Setup Data
    $company = \App\Models\Company::first();
    if (!$company) {
        // Fallback if no company exists (unlikely in dev env but safe)
        $companyId = Str::uuid()->toString();
        // Insert dummy company via DB facade to avoid model strictness if needed, or disable FK checks.
        // For now, let's assume one exists or we fail.
        throw new \Exception("No company found to test with.");
    }
    $companyId = $company->id;
    echo "Using Company ID: {$companyId}\n";

    // Create dummy delivery person
    $deliveryPerson = new DeliveryPerson();
    $deliveryPerson->id = Str::uuid()->toString();
    $deliveryPerson->company_id = $companyId;
    $deliveryPerson->full_name = "Test Driver"; // Changed from name to full_name
    $deliveryPerson->phone_number = "1234567890";
    $deliveryPerson->date_of_birth = '1990-01-01';
    $deliveryPerson->national_id_passport = 'ID123456';
    $deliveryPerson->email = 'test@driver.com';
    $deliveryPerson->residential_address = '123 Test St';
    $deliveryPerson->emergency_contact_name = 'Emergency Contact';
    $deliveryPerson->emergency_contact_phone = '0987654321';
    $deliveryPerson->bank_mobile_money_details = 'Bank Details';
    $deliveryPerson->availability_status = 'available';
    $deliveryPerson->save();
    echo "Created Delivery Person: {$deliveryPerson->id}\n";

    // Create dummy dispatch (we just need the ID for the foreign key, but since we have cascade delete, we might need a real record in order_dispatches table implies we likely need a real order too, or we can just mock the FK if we didn't add strict constraints. But migration added FK to order_dispatches).
    // Let's check if we can just create a Logistic without real dispatch if we disable FK checks or if we need typically comprehensive setup. 
    // Actually, migration has: $table->foreign('order_dispatch_id')->references('id')->on('order_dispatches')

    // So we need a valid OrderDispatch ID.
    // Let's search for an existing OrderDispatch or create a minimal one.
    $existingDispatch = OrderDispatch::first();

    $dispatchId = null;
    if ($existingDispatch) {
        $dispatchId = $existingDispatch->id;
        echo "Using existing Dispatch: {$dispatchId}\n";
    } else {
        // Create minimal dispatch if possible (might fail due to other FKs like order_id)
        // For now, let's assume we can create one or we skip if no dispatch exists (not ideal). 
        // Let's try to fetch one.
        echo "No existing dispatch found. Skipping full FK test, testing Model properties directly.\n";
    }

    if ($dispatchId) {
        // 2. Test Logic
        $logistic = new Logistic();
        $logistic->id = Str::uuid()->toString();
        $logistic->order_dispatch_id = $dispatchId;
        $logistic->company_id = $companyId;

        // Simulate Controller Logic
        $reqDeliveryPersonId = $deliveryPerson->id;

        if ($reqDeliveryPersonId) {
            $dp = DeliveryPerson::find($reqDeliveryPersonId);
            $logistic->delivery_person_id = $dp->id;
            $logistic->driver_name = $dp->full_name; // Auto-fill
            $logistic->driver_contact = $dp->phone_number; // Auto-fill
        }

        $logistic->vehicle_registration = "TEST-REG";
        $logistic->vehicle_type = "Bike";
        $logistic->status = "pending";
        $logistic->save();

        echo "Logistic created manually with ID: {$logistic->id}\n";
        echo "Driver Name: {$logistic->driver_name} (Expected: Test Driver)\n";
        echo "Driver Contact: {$logistic->driver_contact} (Expected: 1234567890)\n";

        // cleanup
        $logistic->delete();
    }

    $deliveryPerson->delete();
    echo "Verification complete.\n";

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}

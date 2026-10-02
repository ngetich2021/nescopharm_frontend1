<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStockAdjustmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization is handled in controller
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'store_id' => 'nullable|exists:stores,id',
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'batch_id' => 'nullable|exists:inventory_batches,id',
            'unit_id' => 'nullable|exists:product_packaging_units,id',
            'adjustment_type' => 'required|in:increase,decrease,set',
            'reason_type' => 'required|in:damage,expiry,theft,loss,found,recount,correction,return,donation,sample,write_off,other',
            'quantity_adjusted' => 'required|integer|min:1',
            'reason' => 'required|string|max:500',
            'notes' => 'nullable|string|max:2000',
            'unit_cost' => 'nullable|numeric|min:0',
            'unit_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:draft,pending',
            'attachments' => 'nullable|array',
            'attachments.*' => 'string|url',
            'metadata' => 'nullable|array',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'product_id.required' => 'Product is required',
            'product_id.exists' => 'Selected product does not exist',
            'adjustment_type.required' => 'Adjustment type is required',
            'adjustment_type.in' => 'Adjustment type must be increase, decrease, or set',
            'reason_type.required' => 'Reason type is required',
            'reason_type.in' => 'Invalid reason type selected',
            'quantity_adjusted.required' => 'Adjustment quantity is required',
            'quantity_adjusted.integer' => 'Adjustment quantity must be a whole number',
            'quantity_adjusted.min' => 'Adjustment quantity must be at least 1',
            'reason.required' => 'Reason for adjustment is required',
            'reason.max' => 'Reason must not exceed 500 characters',
            'notes.max' => 'Notes must not exceed 2000 characters',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes(): array
    {
        return [
            'product_id' => 'product',
            'variant_id' => 'product variant',
            'batch_id' => 'inventory batch',
            'unit_id' => 'packaging unit',
            'adjustment_type' => 'adjustment type',
            'reason_type' => 'reason type',
            'quantity_adjusted' => 'quantity',
            'unit_cost' => 'unit cost',
            'unit_price' => 'unit price',
        ];
    }
}

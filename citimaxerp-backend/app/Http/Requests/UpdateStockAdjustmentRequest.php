<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStockAdjustmentRequest extends FormRequest
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
            'adjustment_type' => 'sometimes|in:increase,decrease,set',
            'reason_type' => 'sometimes|in:damage,expiry,theft,loss,found,recount,correction,return,donation,sample,write_off,other',
            'quantity_adjusted' => 'sometimes|integer|min:1',
            'reason' => 'sometimes|string|max:500',
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
            'adjustment_type.in' => 'Adjustment type must be increase, decrease, or set',
            'reason_type.in' => 'Invalid reason type selected',
            'quantity_adjusted.integer' => 'Adjustment quantity must be a whole number',
            'quantity_adjusted.min' => 'Adjustment quantity must be at least 1',
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
            'adjustment_type' => 'adjustment type',
            'reason_type' => 'reason type',
            'quantity_adjusted' => 'quantity',
            'unit_cost' => 'unit cost',
            'unit_price' => 'unit price',
        ];
    }
}

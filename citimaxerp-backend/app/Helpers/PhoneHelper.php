<?php

namespace App\Helpers;

class PhoneHelper
{
    /**
     * Format a phone number to Kenyan international format (+254XXXXXXXXX).
     *
     * Handles various input formats:
     * - 0712345678 -> +254712345678
     * - 254712345678 -> +254712345678
     * - +254712345678 -> +254712345678
     * - 712345678 -> +254712345678
     *
     * @param string|null $phone
     * @return string|null
     */
    public static function formatKenyanPhoneNumber(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }

        // Remove all non-digit characters except the plus sign
        $cleanPhone = preg_replace('/[^0-9+]/', '', $phone);

        // If phone is empty after cleaning, return null
        if (empty($cleanPhone)) {
            return null;
        }

        // If already starts with +254 and has 13 characters total, return as is
        if (str_starts_with($cleanPhone, '+254') && strlen($cleanPhone) === 13) {
            return $cleanPhone;
        }

        // Remove any existing + sign for easier processing
        $digitsOnly = preg_replace('/[^0-9]/', '', $cleanPhone);

        // If starts with 0, replace with 254
        if (str_starts_with($digitsOnly, '0')) {
            return '+254' . substr($digitsOnly, 1);
        }

        // If starts with 254 and has 12 digits, add plus
        if (str_starts_with($digitsOnly, '254') && strlen($digitsOnly) === 12) {
            return '+' . $digitsOnly;
        }

        // If it's 9 digits (local number without country code), add +254
        if (strlen($digitsOnly) === 9) {
            return '+254' . $digitsOnly;
        }

        // For other cases with 10+ digits that don't start with 254, assume international
        if (strlen($digitsOnly) >= 10 && !str_starts_with($digitsOnly, '254')) {
            return '+' . $digitsOnly;
        }

        // Default: add +254 prefix
        return '+254' . $digitsOnly;
    }

    /**
     * Validate a Kenyan phone number format.
     *
     * @param string|null $phone
     * @return bool
     */
    public static function isValidKenyanPhoneNumber(?string $phone): bool
    {
        if (!$phone) {
            return false;
        }

        $formatted = self::formatKenyanPhoneNumber($phone);

        // Kenyan numbers should be +254 followed by 9 digits (starting with 7, 1, or 2 for mobile)
        return preg_match('/^\+254[1-9][0-9]{8}$/', $formatted) === 1;
    }
}

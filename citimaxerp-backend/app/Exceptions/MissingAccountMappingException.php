<?php

namespace App\Exceptions;

use Exception;

/**
 * Exception thrown when required account mappings are missing
 * 
 * This exception is raised when attempting to record a financial transaction
 * (invoice, expense, payment, etc.) but the required account mappings have not
 * been configured for the company.
 * 
 * Example:
 * - Attempting to record a sales invoice without "accounts_receivable" mapping
 * - Attempting to record an expense without "expense_account" mapping
 * - Attempting to record a payment without a cash account for the payment method
 */
class MissingAccountMappingException extends Exception
{
    /**
     * Array of missing mapping keys
     * 
     * @var array
     */
    protected $missingMappings = [];

    /**
     * The context or transaction type that triggered this exception
     * 
     * @var string
     */
    protected $transactionType;

    /**
     * Initialize the exception with missing mappings
     * 
     * @param array $missingMappings Array of missing mapping keys/descriptions
     * @param string $transactionType The type of transaction being recorded
     * @param int $code
     * @param Exception|null $previous
     */
    public function __construct(
        array $missingMappings = [],
        string $transactionType = 'transaction',
        int $code = 0,
        Exception $previous = null
    ) {
        $this->missingMappings = $missingMappings;
        $this->transactionType = $transactionType;

        // Build descriptive message
        $mappingsList = $this->formatMappingsList($missingMappings);
        $message = "Cannot record {$transactionType}: Missing required account mappings. " .
                   "Missing: {$mappingsList}. " .
                   "Please configure these mappings in Finance > Account Mappings.";

        parent::__construct($message, $code, $previous);
    }

    /**
     * Format missing mappings as readable list
     * 
     * @param array $missing
     * @return string
     */
    private function formatMappingsList(array $missing): string
    {
        if (empty($missing)) {
            return 'unknown mappings';
        }

        // If each item has 'key' and 'description', use description
        if (isset($missing[0]['description'])) {
            $descriptions = array_column($missing, 'description');
            return implode(', ', $descriptions);
        }

        // Otherwise, just use the keys
        return implode(', ', $missing);
    }

    /**
     * Get the missing mappings
     * 
     * @return array
     */
    public function getMissingMappings(): array
    {
        return $this->missingMappings;
    }

    /**
     * Get the transaction type
     * 
     * @return string
     */
    public function getTransactionType(): string
    {
        return $this->transactionType;
    }

    /**
     * Get suggestions for fixing the missing mappings
     * 
     * @return array
     */
    public function getSuggestions(): array
    {
        return [
            'action' => 'Configure Account Mappings',
            'url' => '/finance/account-mappings',
            'steps' => [
                '1. Navigate to Finance > Account Mappings',
                '2. Select your company',
                '3. Configure the missing mappings: ' . implode(', ', $this->formatMappingsList($this->missingMappings)),
                '4. Click Save',
                '5. Try the transaction again',
            ],
        ];
    }
}

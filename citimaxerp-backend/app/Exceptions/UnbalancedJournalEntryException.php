<?php

namespace App\Exceptions;

use Exception;

/**
 * Exception thrown when a journal entry cannot be balanced
 * 
 * A journal entry is invalid if the sum of debits does not equal the sum of credits.
 * This exception is raised before attempting to save an unbalanced entry, preventing
 * data corruption in the general ledger.
 * 
 * Example:
 * - DR: Asset 100, CR: Revenue 90 (debits > credits by 10)
 * - DR: Cash 50 + 75 = 125, CR: Sales 100 (imbalance of 25)
 */
class UnbalancedJournalEntryException extends Exception
{
    /**
     * Total debit amount
     * 
     * @var float
     */
    protected $totalDebits;

    /**
     * Total credit amount
     * 
     * @var float
     */
    protected $totalCredits;

    /**
     * The variance (imbalance amount)
     * 
     * @var float
     */
    protected $variance;

    /**
     * Initialize the exception with debit/credit totals
     * 
     * @param float $totalDebits Sum of all debits
     * @param float $totalCredits Sum of all credits
     * @param int $code
     * @param Exception|null $previous
     */
    public function __construct(
        float $totalDebits,
        float $totalCredits,
        int $code = 0,
        Exception $previous = null
    ) {
        $this->totalDebits = $totalDebits;
        $this->totalCredits = $totalCredits;
        $this->variance = abs($totalDebits - $totalCredits);

        $message = sprintf(
            'Journal entry is unbalanced. Debits: %s, Credits: %s, Variance: %s',
            number_format($totalDebits, 2),
            number_format($totalCredits, 2),
            number_format($this->variance, 2)
        );

        parent::__construct($message, $code, $previous);
    }

    /**
     * Get total debits
     * 
     * @return float
     */
    public function getTotalDebits(): float
    {
        return $this->totalDebits;
    }

    /**
     * Get total credits
     * 
     * @return float
     */
    public function getTotalCredits(): float
    {
        return $this->totalCredits;
    }

    /**
     * Get the imbalance variance
     * 
     * @return float
     */
    public function getVariance(): float
    {
        return $this->variance;
    }

    /**
     * Check if debits exceed credits
     * 
     * @return bool
     */
    public function isDebitHeavy(): bool
    {
        return $this->totalDebits > $this->totalCredits;
    }
}

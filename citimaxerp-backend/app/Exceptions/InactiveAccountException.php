<?php

namespace App\Exceptions;

use Exception;

/**
 * Exception thrown when trying to use an inactive account in a transaction
 * 
 * Accounts can be marked as inactive when they are no longer used (e.g., deprecated
 * account codes, closed accounts, or accounts being phased out). This exception prevents
 * posting journal entries to inactive accounts.
 * 
 * Example:
 * - Trying to debit an account that has been marked as "inactive"
 * - Trying to credit an old bank account that is no longer used
 */
class InactiveAccountException extends Exception
{
    /**
     * The account code
     * 
     * @var string
     */
    protected $accountCode;

    /**
     * The account name
     * 
     * @var string
     */
    protected $accountName;

    /**
     * The reason the account was deactivated
     * 
     * @var string|null
     */
    protected $deactivationReason;

    /**
     * Initialize the exception with account details
     * 
     * @param string $accountCode The chart of accounts code
     * @param string $accountName The account name/description
     * @param string|null $reason Why the account was deactivated
     * @param int $code
     * @param Exception|null $previous
     */
    public function __construct(
        string $accountCode,
        string $accountName,
        ?string $reason = null,
        int $code = 0,
        Exception $previous = null
    ) {
        $this->accountCode = $accountCode;
        $this->accountName = $accountName;
        $this->deactivationReason = $reason;

        $message = "Cannot post to inactive account '{$accountCode} - {$accountName}'.";
        if ($reason) {
            $message .= " Reason: {$reason}";
        }
        $message .= " Please use an active account instead.";

        parent::__construct($message, $code, $previous);
    }

    /**
     * Get the account code
     * 
     * @return string
     */
    public function getAccountCode(): string
    {
        return $this->accountCode;
    }

    /**
     * Get the account name
     * 
     * @return string
     */
    public function getAccountName(): string
    {
        return $this->accountName;
    }

    /**
     * Get the deactivation reason
     * 
     * @return string|null
     */
    public function getDeactivationReason(): ?string
    {
        return $this->deactivationReason;
    }
}

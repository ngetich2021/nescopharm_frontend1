<?php

namespace App\Exceptions;

use Exception;

/**
 * Exception thrown when attempting to post to a locked financial period
 * 
 * Financial periods can be locked to prevent modifications to historical data.
 * This exception is raised when attempting to create or modify journal entries
 * in a locked period, ensuring audit trail integrity.
 * 
 * Example:
 * - Trying to record an invoice for December when the period is closed
 * - Trying to adjust entries in a prior month that's been locked
 */
class PeriodLockedException extends Exception
{
    /**
     * The financial period identifier
     * 
     * @var string|int
     */
    protected $periodId;

    /**
     * The period name (e.g., "January 2026")
     * 
     * @var string
     */
    protected $periodName;

    /**
     * The period status
     * 
     * @var string
     */
    protected $status;

    /**
     * Initialize the exception with period details
     * 
     * @param string|int $periodId The period ID
     * @param string $periodName The human-readable period name
     * @param string $status The period status (e.g., 'closed', 'locked')
     * @param int $code
     * @param Exception|null $previous
     */
    public function __construct(
        $periodId,
        string $periodName,
        string $status = 'locked',
        int $code = 0,
        Exception $previous = null
    ) {
        $this->periodId = $periodId;
        $this->periodName = $periodName;
        $this->status = $status;

        $message = "Cannot record transaction in {$status} period '{$periodName}'. " .
                   "Please record transactions in the current open period or contact your administrator.";

        parent::__construct($message, $code, $previous);
    }

    /**
     * Get the period ID
     * 
     * @return string|int
     */
    public function getPeriodId()
    {
        return $this->periodId;
    }

    /**
     * Get the period name
     * 
     * @return string
     */
    public function getPeriodName(): string
    {
        return $this->periodName;
    }

    /**
     * Get the period status
     * 
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
}

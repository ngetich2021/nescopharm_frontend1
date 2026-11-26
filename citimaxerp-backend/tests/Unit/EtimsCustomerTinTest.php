<?php

namespace Tests\Unit;

use App\Services\TaxCompliance\Providers\Kenya\EtimsProvider;
use PHPUnit\Framework\TestCase;

/** Live KRA refuses a sale over a bad buyer PIN, so only a valid one is sent (no database). */
class EtimsCustomerTinTest extends TestCase
{
    public function test_valid_pins_are_sent_cleaned(): void
    {
        $this->assertSame('P052406784Q', EtimsProvider::customerTin('P052406784Q'));
        $this->assertSame('A123456789B', EtimsProvider::customerTin('A123456789B'));
        $this->assertSame('P051652493X', EtimsProvider::customerTin(' p051 652 493x '));
    }

    public function test_invalid_pins_are_left_off_never_guessed(): void
    {
        foreach (['n/a', 'N/A', '0708497637', '123', 'PO51364180D', 'P05196429J', 'P0516524932', '', null] as $pin) {
            $this->assertNull(EtimsProvider::customerTin($pin), json_encode($pin));
        }
    }
}

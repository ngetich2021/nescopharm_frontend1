<?php

namespace App\Services\TaxCompliance\Exceptions;

class UnsupportedCountry extends \RuntimeException
{
    public static function for(string $iso2): self
    {
        return new self("No tax compliance provider registered for country: $iso2");
    }
}

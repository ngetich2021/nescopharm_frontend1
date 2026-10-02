<?php

namespace App\Http\Controllers\Etims\Concerns;

use App\Models\Company;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

trait ResolvesEtimsCompany
{
    protected function resolveEtimsCompany(Request $request): Company
    {
        $companyId = $this->resolveActiveCompanyId();
        $company = Company::findOrFail($companyId);

        $isKenyan = strtoupper((string) $company->primary_country_code) === 'KE';
        if (! $isKenyan && ! $company->isHolding()) {
            throw new HttpException(404, 'eTIMS is only available for Kenya companies.');
        }

        return $company;
    }
}

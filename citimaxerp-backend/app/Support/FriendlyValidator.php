<?php

namespace App\Support;

use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

/**
 * Validation messages people can act on. Field names on lines read as
 * "product on line 2", never "items.1.product_id". The wording itself
 * lives in lang/en/validation.php ("Fill in the description." etc.).
 */
class FriendlyValidator extends Validator
{
    public function getDisplayableAttribute($attribute)
    {
        $name = parent::getDisplayableAttribute($attribute);

        // Only rewrite when nothing (custom attribute or translation) named it.
        // (Line fields like items.0.x come back raw; plain ones snake-spaced.)
        if ($name !== $attribute && $name !== str_replace('_', ' ', Str::snake($attribute))) {
            return $name;
        }

        if (preg_match('/^[A-Za-z_]+\.(\d+)\.([A-Za-z_]+)$/', $attribute, $m)) {
            return $this->fieldLabel($m[2]) . ' on line ' . ((int) $m[1] + 1);
        }

        return $this->fieldLabel(Str::afterLast($attribute, '.'));
    }

    protected function fieldLabel(string $field): string
    {
        $field = preg_replace('/_id$/', '', $field);
        return str_replace('_', ' ', Str::snake($field));
    }
}

<?php

namespace App\Traits;

trait PostgresBooleanCast
{
    /**
     * Boot the trait and add a saving event listener
     */
    protected static function bootPostgresBooleanCast()
    {
        static::saving(function ($model) {
            // Get all boolean cast fields
            $casts = $model->getCasts();
            
            foreach ($casts as $field => $cast) {
                if ($cast === 'boolean' || $cast === 'bool') {
                    // Convert to string 'true' or 'false' for PostgreSQL
                    if (array_key_exists($field, $model->attributes)) {
                        $value = $model->attributes[$field];
                        
                        // Convert to boolean first to determine true/false
                        $boolValue = false;
                        if (is_bool($value)) {
                            $boolValue = $value;
                        } else if (is_string($value)) {
                            $lower = strtolower(trim($value));
                            $boolValue = in_array($lower, ['true', '1', 'yes', 'on', 't'], true);
                        } else if (is_numeric($value)) {
                            $boolValue = (bool)(int)$value;
                        }
                        
                        // Store as string 'true' or 'false' for PostgreSQL
                        $model->attributes[$field] = $boolValue ? 'true' : 'false';
                    }
                }
            }
        });
    }
    
    /**
     * Override setAttribute to immediately convert boolean cast fields to 'true'/'false' strings
     */
    public function setAttribute($key, $value)
    {
        // Check if this attribute has a boolean cast
        $casts = $this->getCasts();
        
        if (isset($casts[$key]) && ($casts[$key] === 'boolean' || $casts[$key] === 'bool')) {
            // Convert to boolean first
            $boolValue = false;
            if (is_bool($value)) {
                $boolValue = $value;
            } else if (is_string($value)) {
                $lower = strtolower(trim($value));
                $boolValue = in_array($lower, ['true', '1', 'yes', 'on', 't'], true);
            } else if (is_numeric($value)) {
                $boolValue = (bool)(int)$value;
            }
            
            // Store as string 'true' or 'false' for PostgreSQL
            $value = $boolValue ? 'true' : 'false';
        }
        
        return parent::setAttribute($key, $value);
    }
}

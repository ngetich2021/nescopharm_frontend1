<?php

use App\Support\KenyaLocations;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sales are reported by county and region, but customers mostly had a town or a variously-spelt
 * county in "state"/city ("Homabay", "Narok County", "Kitale") and an empty county/region.
 * Work both out for every customer; ones that can't be recognised are left as they are.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('customers')->select('id', 'county', 'state', 'city')->orderBy('id')
            ->chunk(500, function ($customers) {
                foreach ($customers as $c) {
                    $county = KenyaLocations::countyFrom($c->county, $c->state, $c->city);
                    if ($county) {
                        DB::table('customers')->where('id', $c->id)->update([
                            'county' => $county,
                            'region' => KenyaLocations::regionFor($county),
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // The previous values were mostly empty; nothing to restore.
    }
};

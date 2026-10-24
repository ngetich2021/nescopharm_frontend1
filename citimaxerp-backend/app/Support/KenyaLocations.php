<?php

namespace App\Support;

/**
 * Kenya's 47 counties grouped into the eight regions (former provinces) sales are reported by,
 * and a resolver that turns whatever was typed for a customer ("Homabay", "Narok County",
 * "NAIROBI", a town like "Kitale" or "Thika") into the county it belongs to.
 */
class KenyaLocations
{
    public const REGIONS = [
        'Nairobi' => ['Nairobi'],
        'Central' => ['Kiambu', 'Kirinyaga', "Murang'a", 'Nyandarua', 'Nyeri'],
        'Coast' => ['Kilifi', 'Kwale', 'Lamu', 'Mombasa', 'Taita Taveta', 'Tana River'],
        'Eastern' => ['Embu', 'Isiolo', 'Kitui', 'Machakos', 'Makueni', 'Marsabit', 'Meru', 'Tharaka Nithi'],
        'North Eastern' => ['Garissa', 'Mandera', 'Wajir'],
        'Nyanza' => ['Homa Bay', 'Kisii', 'Kisumu', 'Migori', 'Nyamira', 'Siaya'],
        'Rift Valley' => ['Baringo', 'Bomet', 'Elgeyo Marakwet', 'Kajiado', 'Kericho', 'Laikipia', 'Nakuru', 'Nandi', 'Narok',
            'Samburu', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'West Pokot'],
        'Western' => ['Bungoma', 'Busia', 'Kakamega', 'Vihiga'],
    ];

    // Towns and areas customers are often filed under, mapped to their county.
    private const TOWNS = [
        // Nairobi
        'westlands' => 'Nairobi', 'kasarani' => 'Nairobi', 'embakasi' => 'Nairobi', 'karen' => 'Nairobi', 'kawangware' => 'Nairobi',
        'kibera' => 'Nairobi', 'eastleigh' => 'Nairobi', 'langata' => 'Nairobi', 'donholm' => 'Nairobi', 'utawala' => 'Nairobi',
        'kahawa' => 'Nairobi', 'githurai' => 'Nairobi', 'industrial area' => 'Nairobi', 'cbd' => 'Nairobi', 'south b' => 'Nairobi',
        'south c' => 'Nairobi', 'kilimani' => 'Nairobi', 'parklands' => 'Nairobi', 'ruaraka' => 'Nairobi', 'dagoretti' => 'Nairobi',
        // Central
        'thika' => 'Kiambu', 'ruiru' => 'Kiambu', 'kikuyu' => 'Kiambu', 'limuru' => 'Kiambu', 'juja' => 'Kiambu', 'ruaka' => 'Kiambu',
        'banana' => 'Kiambu', 'wangige' => 'Kiambu', 'githunguri' => 'Kiambu', 'gatundu' => 'Kiambu', 'karuri' => 'Kiambu',
        'karatina' => 'Nyeri', 'othaya' => 'Nyeri', 'mukurweini' => 'Nyeri', 'kangema' => "Murang'a", 'kenol' => "Murang'a",
        'maragua' => "Murang'a", 'kandara' => "Murang'a", 'kerugoya' => 'Kirinyaga', 'sagana' => 'Kirinyaga', 'kutus' => 'Kirinyaga',
        'wanguru' => 'Kirinyaga', 'kagio' => 'Kirinyaga', 'ol kalou' => 'Nyandarua', 'engineer' => 'Nyandarua', 'njabini' => 'Nyandarua',
        // Coast
        'nyali' => 'Mombasa', 'likoni' => 'Mombasa', 'bamburi' => 'Mombasa', 'changamwe' => 'Mombasa', 'malindi' => 'Kilifi',
        'mtwapa' => 'Kilifi', 'watamu' => 'Kilifi', 'mariakani' => 'Kilifi', 'ukunda' => 'Kwale', 'diani' => 'Kwale',
        'msambweni' => 'Kwale', 'voi' => 'Taita Taveta', 'taveta' => 'Taita Taveta', 'wundanyi' => 'Taita Taveta',
        'mwatate' => 'Taita Taveta', 'mpeketoni' => 'Lamu', 'hola' => 'Tana River',
        // Eastern
        'runyenjes' => 'Embu', 'siakago' => 'Embu', 'chuka' => 'Tharaka Nithi', 'marimanti' => 'Tharaka Nithi', 'maua' => 'Meru',
        'nkubu' => 'Meru', 'timau' => 'Meru', 'moyale' => 'Marsabit', 'athi river' => 'Machakos', 'mlolongo' => 'Machakos',
        'kangundo' => 'Machakos', 'tala' => 'Machakos', 'matuu' => 'Machakos', 'syokimau' => 'Machakos', 'wote' => 'Makueni',
        'emali' => 'Makueni', 'kibwezi' => 'Makueni', 'mtito andei' => 'Makueni', 'mwingi' => 'Kitui',
        // Nyanza
        'homabay' => 'Homa Bay', 'mbita' => 'Homa Bay', 'oyugis' => 'Homa Bay', 'kendu bay' => 'Homa Bay', 'ndhiwa' => 'Homa Bay',
        'ogembo' => 'Kisii', 'keroka' => 'Nyamira', 'awendo' => 'Migori', 'rongo' => 'Migori', 'kehancha' => 'Migori',
        'isebania' => 'Migori', 'suna' => 'Migori','bondo' => 'Siaya', 'ugunja' => 'Siaya', 'yala' => 'Siaya', 'kondele' => 'Kisumu', 'ahero' => 'Kisumu',
        'maseno' => 'Kisumu',
        // Rift Valley
        'eldoret' => 'Uasin Gishu', 'burnt forest' => 'Uasin Gishu', 'kitale' => 'Trans Nzoia', 'endebess' => 'Trans Nzoia',
        'naivasha' => 'Nakuru', 'gilgil' => 'Nakuru', 'molo' => 'Nakuru', 'njoro' => 'Nakuru', 'litein' => 'Kericho',
        'londiani' => 'Kericho', 'sotik' => 'Bomet', 'kapsabet' => 'Nandi', 'nandi hills' => 'Nandi', 'iten' => 'Elgeyo Marakwet',
        'kabarnet' => 'Baringo', 'eldama ravine' => 'Baringo', 'marigat' => 'Baringo', 'nyahururu' => 'Laikipia', 'nanyuki' => 'Laikipia',
        'rumuruti' => 'Laikipia', 'kitengela' => 'Kajiado', 'ngong' => 'Kajiado', 'kiserian' => 'Kajiado', 'ongata rongai' => 'Kajiado',
        'rongai' => 'Kajiado', 'namanga' => 'Kajiado', 'loitokitok' => 'Kajiado', 'isinya' => 'Kajiado', 'lodwar' => 'Turkana',
        'kakuma' => 'Turkana', 'lokichogio' => 'Turkana', 'maralal' => 'Samburu', 'kapenguria' => 'West Pokot', 'makutano' => 'West Pokot',
        'kilgoris' => 'Narok',
        // Western
        'webuye' => 'Bungoma', 'kimilili' => 'Bungoma', 'chwele' => 'Bungoma', 'malaba' => 'Busia', 'mumias' => 'Kakamega',
        'malava' => 'Kakamega', 'butere' => 'Kakamega', 'mbale' => 'Vihiga', 'luanda' => 'Vihiga', 'majengo' => 'Vihiga',
    ];

    public static function counties(): array
    {
        $all = array_merge(...array_values(self::REGIONS));
        sort($all);
        return $all;
    }

    public static function regionFor(?string $county): ?string
    {
        foreach (self::REGIONS as $region => $counties) {
            if ($county && in_array($county, $counties, true)) {
                return $region;
            }
        }
        return null;
    }

    /** The county named or implied by any of the given texts (first that resolves wins). */
    public static function countyFrom(?string ...$texts): ?string
    {
        foreach ($texts as $text) {
            if ($county = self::resolve($text)) {
                return $county;
            }
        }
        return null;
    }

    private static function clean(string $text): string
    {
        $text = mb_strtolower($text);
        $text = str_replace(["'", '’', '`'], '', $text);                 // murang'a -> muranga
        $text = preg_replace('/[^a-z0-9]+/', ' ', $text);                 // punctuation, hyphens
        $text = preg_replace('/\b(sub\s*county|county|municipality|town|city|cbd area)\b/', ' ', $text);
        return trim(preg_replace('/\s+/', ' ', $text));
    }

    private static function resolve(?string $text): ?string
    {
        if ($text === null || trim($text) === '') {
            return null;
        }
        $clean = self::clean($text);
        $squashed = str_replace(' ', '', $clean);

        // Exact county name, with or without spaces ("homa bay", "homabay", "uasingishu").
        $names = [];
        foreach (self::counties() as $county) {
            $names[self::clean($county)] = $county;
        }
        foreach ($names as $key => $county) {
            if ($clean === $key || $squashed === str_replace(' ', '', $key)) {
                return $county;
            }
        }
        if (isset(self::TOWNS[$clean])) {
            return self::TOWNS[$clean];
        }

        // A county or town mentioned inside longer text ("Kisumu Kondele", "Nairobi CBD") - longest first.
        $candidates = $names + self::TOWNS;
        uksort($candidates, fn ($a, $b) => strlen($b) <=> strlen($a));
        foreach ($candidates as $key => $county) {
            if (preg_match('/\b' . preg_quote($key, '/') . '\b/', $clean)) {
                return $county;
            }
        }
        return null;
    }
}

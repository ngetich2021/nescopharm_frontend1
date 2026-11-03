<?php

namespace App\Services\TaxCompliance;

use Illuminate\Support\Facades\DB;

/**
 * Suggests a KRA item class code from a product's name, the way DigiTax's FAQ "Which item class
 * code should I use?" says: the item's UNSPSC prefix, matched to the closest code in KRA's table.
 * The same rules coded the client's 556 products for go-live. Only a suggestion - the person
 * adding the product keeps or changes it, or leaves it empty.
 */
class EtimsClassCodeSuggester
{
    // First match wins: specific before general.
    private const RULES = [
        // Services / non-medical
        ['/consignment clearance|clearing|freight|transport/', '78140000'],
        ['/printed items|letter ?heads|forms\b|stationery/', '14110000'],
        // Drugs (51)
        ['/amoxy|amoxi|\bclav|azithro|cefixime|ceftriax|cefurox|cephalex|clarithro|claxy|clindamy|levoflox|meropenem|bactized|bactoclav|cillin|mycin|floxacin|metronidazole/', '51280000'],
        ['/artemether|artesunate|quinine|lumefantrine/', '51100000'],
        ['/brufen|ibubrufen|ibuprofen|celecoxib|diclofenac|diclomol|naproxen|meloxicam/', '51380000'],
        ['/calamine/', '51241200'],
        ['/calcium gluconate|potassium chloride|sodium chloride|normal saline|ringer/', '51191600'],
        ['/cetrizine|cetirizine|loratadine|chlorphenamine|promethazine/', '51310000'],
        ['/cyclopam|hyoscine|buscopan/', '51151600'],
        ['/dexamethasone|hydro ?c[ao]rt|prednisolone|betamethasone/', '51420000'],
        ['/dextrose/', '51190000'],
        ['/gripe water|omeprazole|antacid|laxative/', '51170000'],
        ['/surgical spirit|alcohol pads|chlorhexidine|povidone|iodine/', '51470000'],
        // Dialysis
        ['/dialy|bloodlines|hemodialysis|haemodialysis|double lumen catheter|fistula needle/', '42160000'],
        // Laboratory / diagnostics (41)
        ['/chemistry analy[sz]er|haematology analy[sz]er|hematology analy[sz]er/', '41150000'],
        ['/test (cassette|strip|panel|kit)|test strips|glucose test|antigen cassette|rapid test/', '41110000'],
        ['/blue tips|yellow tips|pipette tips/', '41121600'],
        ['/cryovial|cry boxes|slides|measuring cylinder|beaker|test tube/', '41120000'],
        ['/blood collection|blood lancet|stool container|urine container|specimen|freezer|hot plate|centrifuge/', '41100000'],
        ['/hygrometer/', '41110000'],
        // Imaging / sterilisation / training
        ['/dry imager|x-?ray/', '42200000'],
        ['/autoclav|steriliz|sterilis/', '42280000'],
        ['/model|fgm type|simulator|training/', '42300000'],
        // Respiratory, anaesthesia, airway
        ['/anaesthe|anesthe|ambubag|resuscitator|breathing|bacterial filter|hme filter|bougie|catheter mount|endotracheal|et tubes|endobronchial|tracheostomy|laryngeal mask|\blma\b|laryngoscope|intubating stylet|vaporizer|oxygen|non-rebreathing|venturi|nebuli[sz]er|cpap|suction|yankauer|spinal needle|epidural/', '42270000'],
        // Enteral feeding
        ['/feeding (tube|pumb|pump)|gastrostomy/', '42230000'],
        // IV and arterial administration
        ['/iv cannula|cannula|giving set|measured volume set|stopcock|infusion pump|infusion set|cvc|blood warmer|huber needle|scalp vein|iv fixation/', '42220000'],
        // Monitoring and exam
        ['/defi|stretcher|immobi/', '42170000'],
        ['/blood pressure|bp machine|sphygmo/', '42181600'],
        ['/ecg|fetal|oximeter|pressure transducer|weighing scale|weight scale|examination lamp|ent diagnostic|speculum|stethoscope|thermometer|glucometer/', '42180000'],
        // Furniture, mobility, dental
        ['/\bbed\b|crank|mattress|bedside cabinet|baby cot|ward screen|drip stand|trolley/', '42190000'],
        ['/crutch|walking frame|wheelchair|walker/', '42210000'],
        ['/dental/', '42150000'],
        // Apparel and gloves
        ['/gown|caps\b|shoe cover|scrub/', '42131600'],
        ['/glove|face ?mask|medical mask|surgical drape|apron/', '42130000'],
        // Wound care and sutures
        ['/plaster of paris|\bpop\b/', '42240000'],
        ['/suture|catgut|polyglactin|polygactin|polyclactin|nylon monofilament|silk /', '42310000'],
        ['/bandage|dressing|gauze|guaze|cotton wool|zinc oxide|transpore|transparent tape|strapping/', '42310000'],
        // Surgical
        ['/surgical blade|surgery set|surgical items|curettage|retractor|electrosurgical|diathermy|cord clamp|circumcision|cirmcumcision|bone marrow|drilling machine|forceps|scissors/', '42290000'],
        // Patient care (syringes, needles, urology, ostomy, incontinence, drainage)
        ['/syringe|needle|foley|uridom|urine bag|colostomy|diaper|underpad|chest (drainage )?tube|catheter/', '42140000'],
        // Any other tablet, syrup or injection is a drug: the drugs segment.
        ['/\btab(let)?s?\b|syrup|suspension|capsule|injection|\binj\b|\bmg\b|cream|ointment/', '51000000'],
    ];

    /** @return array{code: string, name: string}|null */
    public function suggest(?string $productName): ?array
    {
        $text = mb_strtolower(trim((string) $productName));
        if ($text === '') {
            return null;
        }
        foreach (self::RULES as [$pattern, $code]) {
            if (preg_match($pattern, $text)) {
                $name = DB::table('etims_item_class_codes')->where('code', $code)->value('name');

                return $name ? ['code' => $code, 'name' => $name] : null;
            }
        }

        return null;
    }
}

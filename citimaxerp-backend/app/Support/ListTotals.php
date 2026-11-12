<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * Per-row totals that would otherwise cost one query per row (a list of 450 orders asking
 * "how many lines?" ran 450 queries). Models loaded together share one ListTotals; the
 * first row that needs its figure loads them for every row of that list in one query.
 */
class ListTotals
{
    /** @var array<string, array<string, mixed>>|null keyed by model key */
    private ?array $rows = null;

    /**
     * @param  Model[]  $models
     * @param  callable(array $ids): array<string, array<string, mixed>>  $loader
     */
    public function __construct(private array $models, private ?\Closure $loader)
    {
    }

    /** The figures for one model, or null when it is not part of this list (caller falls back). */
    public function for(Model $model): ?array
    {
        $key = $model->getKey();
        if ($key === null) {
            return null;
        }
        if ($this->rows === null) {
            if (! $this->loader) {
                return null;
            }
            $ids = array_values(array_unique(array_filter(array_map(fn ($m) => $m->getKey(), $this->models))));
            $this->rows = $ids ? ($this->loader)($ids) : [];
            $this->models = []; // done with them; avoid holding the list in memory
        }
        return $this->rows[(string) $key] ?? [];
    }

    // Models may be cached or queued: keep what was loaded, drop the closure.
    public function __serialize(): array
    {
        return ['rows' => $this->rows];
    }

    public function __unserialize(array $data): void
    {
        $this->rows = $data['rows'];
        $this->models = [];
        $this->loader = null;
    }
}

<?php

namespace IlBronza\PageBuilder\Models;

use IlBronza\PageBuilder\Documents\Validator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PageContent extends Model
{
    protected $table = 'pagebuilder_contents';
    protected $guarded = ['id'];
    protected $casts = ['document' => \IlBronza\PageBuilder\Documents\DocumentCast::class, 'revision' => 'integer'];

    public function template(): BelongsTo { return $this->belongsTo(PageTemplate::class, 'template_id'); }

    protected static function booted(): void
    {
        static::saving(function (self $model) {
            if ($model->mode === 'static' && $model->template_id === null && is_array($model->document)) {
                app(Validator::class)->validate($model->document, 'static', $model->kind);
            } elseif ($model->mode === 'template' && $model->document === null && $model->template_id !== null) {
                $template = PageTemplate::findOrFail($model->template_id);
                if ($template->kind !== $model->kind) throw new \LogicException('Template kind mismatch');
            } else throw new \LogicException('A content has exactly one layout source');
        });
    }
}

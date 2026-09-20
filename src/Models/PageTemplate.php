<?php

namespace IlBronza\PageBuilder\Models;

use IlBronza\PageBuilder\Documents\Validator;
use Illuminate\Database\Eloquent\Model;

class PageTemplate extends Model
{
    protected $table = 'pagebuilder_templates';
    protected $guarded = ['id'];
    protected $casts = ['document' => \IlBronza\PageBuilder\Documents\DocumentCast::class, 'revision' => 'integer'];

    protected static function booted(): void
    {
        static::saving(function (self $model) {
            app(Validator::class)->validate($model->document, 'template', $model->kind);
            if ($model->exists && ($model->isDirty('context') || $model->isDirty('kind'))) throw new \LogicException('Template context and kind are immutable');
        });
    }
}

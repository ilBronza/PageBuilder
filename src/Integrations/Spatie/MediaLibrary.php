<?php

namespace IlBronza\PageBuilder\Integrations\Spatie;

use Illuminate\Database\Eloquent\Model;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/** Only loaded when the host enables the optional Spatie integration. */
class MediaLibrary extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $table = 'pagebuilder_media_libraries';
    protected $guarded = ['id'];

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('pagebuilder-thumb')
            ->fit(Fit::Contain, 360, 240)->format('webp')->quality(80)
            ->nonOptimized()->nonQueued()->performOnCollections('pagebuilder-images');
    }
}

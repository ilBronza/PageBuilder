<?php

namespace IlBronza\PageBuilder\Http;

use IlBronza\PageBuilder\Integrations\Spatie\MediaLibrary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MediaController
{
    private const COLLECTION = 'pagebuilder-images';
    private const MIMES = ['image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp', 'image/gif'=>'gif'];

    private function authorize(Request $request, string $library, string $action): array
    {
        $definition = config('pagebuilder.media.libraries', [])[$library] ?? null;
        abort_unless($definition && interface_exists(\Spatie\MediaLibrary\HasMedia::class), 404);
        Gate::forUser($request->user())->authorize('pagebuilder.media', ['view', $library]);
        if ($action !== 'view') Gate::forUser($request->user())->authorize('pagebuilder.media', [$action, $library]);
        // A public presentation library must be explicitly configured by the host.
        abort_unless(isset($definition['disk']) && config('filesystems.disks.'.$definition['disk'].'.visibility') === 'public', 503, 'Configura un disco pubblico per le immagini del builder.');
        return $definition;
    }

    public function index(Request $request, string $library)
    {
        $this->authorize($request, $library, 'view');
        $input = $request->validate(['q'=>'nullable|string|max:120', 'folder'=>'nullable|string|max:120', 'page'=>'nullable|integer|min:1|max:100000']);
        $owner = MediaLibrary::where('key', $library)->first();
        if (!$owner) return response()->json(['data'=>[], 'folders'=>[], 'page'=>1, 'lastPage'=>1, 'total'=>0]);
        $query = $owner->media()->where('collection_name', self::COLLECTION)->whereIn('mime_type', array_keys(self::MIMES));
        $folders = (clone $query)->select('custom_properties->folder as folder')->distinct()->orderBy('folder')->pluck('folder')->filter()->values();
        if ($q = trim($input['q'] ?? '')) $query->where('name', 'like', '%'.str_replace(['\\','%','_'], ['\\\\','\\%','\\_'], $q).'%');
        if ($folder = trim($input['folder'] ?? '')) $query->where('custom_properties->folder', $folder);
        $page = $query->orderByDesc('id')->paginate(36);
        return response()->json(['data'=>$page->getCollection()->map(fn ($media) => $this->describe($media)), 'folders'=>$folders,
            'page'=>$page->currentPage(), 'lastPage'=>$page->lastPage(), 'total'=>$page->total()]);
    }

    private function metadataRules(): array
    {
        return ['name'=>'required|string|max:160', 'alt'=>'nullable|string|max:500', 'folder'=>'nullable|string|max:120'];
    }

    public function store(Request $request, string $library)
    {
        $definition = $this->authorize($request, $library, 'upload');
        $input = $request->validate($this->metadataRules() + ['file'=>['required', 'file', 'mimetypes:'.implode(',', array_keys(self::MIMES)), 'max:'.(int) config('pagebuilder.media.max_kb', 10240)]]);
        $file = $request->file('file');
        $size = @getimagesize($file->getPathname());
        $maxPixels = (int) config('pagebuilder.media.max_pixels', 40000000);
        if (!$size || $size[0] < 1 || $size[1] < 1 || $size[0] > 10000 || $size[1] > 10000 || $size[0]*$size[1] > $maxPixels) {
            throw ValidationException::withMessages(['file'=>'Immagine non valida o troppo grande: massimo 10.000 px per lato e '.($maxPixels/1000000).' megapixel.']);
        }
        $owner = MediaLibrary::firstOrCreate(['key'=>$library]);
        // Never persist the client filename as an executable extension or a path.
        $filename = Str::uuid().'.'.self::MIMES[$file->getMimeType()];
        try {
            $media = $owner->addMedia($file)->usingName(trim($input['name']))->usingFileName($filename)
                ->withCustomProperties(['alt'=>trim($input['alt'] ?? ''), 'folder'=>trim($input['folder'] ?? ''), 'width'=>$size[0], 'height'=>$size[1]])
                ->toMediaCollection(self::COLLECTION, $definition['disk']);
        } catch (\Throwable $error) {
            // Conversion failures can occur after the original was stored. Remove
            // only the newly allocated upload, never a pre-existing library item.
            $failed = $owner->media()->where('collection_name', self::COLLECTION)->where('file_name', $filename)->first();
            if ($failed) $failed->forceDelete();
            report($error);
            throw ValidationException::withMessages(['file'=>'Caricamento non riuscito. Il file non è stato aggiunto alla libreria.']);
        }
        return response()->json($this->describe($media), 201);
    }

    public function update(Request $request, string $library, string $media)
    {
        $this->authorize($request, $library, 'update');
        $input = $request->validate($this->metadataRules());
        $owner = MediaLibrary::where('key', $library)->firstOrFail();
        $item = $owner->media()->where('collection_name', self::COLLECTION)->whereIn('mime_type', array_keys(self::MIMES))->findOrFail($media);
        $item->name = trim($input['name']);
        $item->setCustomProperty('alt', trim($input['alt'] ?? ''));
        $item->setCustomProperty('folder', trim($input['folder'] ?? ''));
        $item->save();
        return response()->json($this->describe($item));
    }

    private function describe($media): array
    {
        return ['id'=>(string) $media->getKey(), 'name'=>$media->name, 'url'=>$media->getUrl(),
            'thumbnail'=>$media->hasGeneratedConversion('pagebuilder-thumb') ? $media->getUrl('pagebuilder-thumb') : $media->getUrl(),
            'alt'=>$media->getCustomProperty('alt', ''), 'folder'=>$media->getCustomProperty('folder', ''),
            'width'=>$media->getCustomProperty('width'), 'height'=>$media->getCustomProperty('height'), 'bytes'=>$media->size, 'mime'=>$media->mime_type];
    }
}

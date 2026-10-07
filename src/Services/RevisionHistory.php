<?php

namespace IlBronza\PageBuilder\Services;

use IlBronza\PageBuilder\Documents\Codec;
use IlBronza\PageBuilder\Models\{PageContent, PageTemplate};

class RevisionHistory
{
    private function query(PageContent|PageTemplate $entity)
    {
        return $entity->getConnection()->table('pagebuilder_revisions')
            ->where($entity instanceof PageContent ? 'content_id' : 'template_id', $entity->getKey());
    }

    /** Called inside the entity's save transaction, including its previous state on upgrade. */
    public function record(PageContent|PageTemplate $entity): void
    {
        if (!$entity->exists) return;
        $this->query($entity)->insertOrIgnore([
            $entity instanceof PageContent ? 'content_id' : 'template_id' => $entity->getKey(),
            'revision' => $entity->revision,
            'payload' => json_encode(Codec::wire($entity->only($entity instanceof PageContent
                ? ['mode', 'kind', 'document', 'template_id'] : ['name', 'context', 'kind', 'document'])), JSON_THROW_ON_ERROR),
            'created_at' => $entity->updated_at ?? now(),
        ]);
    }

    public function listing(PageContent|PageTemplate $entity): array
    {
        return $this->query($entity)->orderByDesc('revision')->limit(100)->get(['revision', 'created_at'])->all();
    }

    public function read(PageContent|PageTemplate $entity, int $revision): array
    {
        $row = $this->query($entity)->where('revision', $revision)->first();
        abort_unless($row, 404);
        return json_decode($row->payload, true, 512, JSON_THROW_ON_ERROR);
    }
}

<?php

namespace IlBronza\PageBuilder\Integrations;

use Closure;
use IlBronza\PageBuilder\Data\Source;

final class FileCabinetSource
{
    /** Names come exclusively from server configuration. No file URLs or model methods are exposed. */
    public static function field(string $id, string $label, string $form, string $field, string $type = 'text', ?Closure $authorize = null): Source
    {
        if (!in_array($type, ['text','number','date','boolean'], true)) throw new \InvalidArgumentException('FileCabinet presentation files require a separate authorized public-media adapter');
        return new Source($id, $label, $type, 'one', function ($record) use ($form, $field) {
            if (!method_exists($record, 'getDossierRowByNames')) return null;
            $row = $record->getDossierRowByNames($form, $field);
            if (!$row) return null;
            $formrow = $row->getFormrow();
            if ($formrow->isRepeatable() || $formrow->isMultiple($row)) return null;
            $reader = $row->getRowType();
            $allowed = ['FormrowText','FormrowTextarea','FormrowInteger','FormrowDecimal','FormrowBoolean','FormrowDate','FormrowDatetime'];
            if (!in_array(class_basename($reader), $allowed, true)) return null;
            // Bypass Dossierrow::getValue(): it can turn a TypeError into visible technical text.
            return $reader->getDossierrowValue($row);
        }, $authorize);
    }
}

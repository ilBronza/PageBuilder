<?php

namespace IlBronza\PageBuilder\Documents;

/** Plain text placeholders. Values are never evaluated as PHP, Blade or HTML. */
class InlineVariables
{
    public const PATTERN = '/\{\{(.*?)\}\}/s';

    public static function validate(string $text, ?array $sources): void
    {
        preg_match_all(self::PATTERN, $text, $matches);
        foreach ($matches[1] as $token) {
            $id = trim($token);
            if (!preg_match('/^[a-zA-Z0-9_.:-]{1,120}$/D', $id)
                || ($sources !== null && (!isset($sources[$id]) || !Validator::compatible('text', $sources[$id])))) {
                throw new InvalidDocument('Variabile non disponibile o incompatibile: '.$id);
            }
        }
    }

    public static function resolve(string $text, array $values): string
    {
        return preg_replace_callback(self::PATTERN, function ($match) use ($values) {
            $value = $values[trim($match[1])] ?? null;
            return is_scalar($value) ? Renderer::scalar($value) : '';
        }, $text);
    }
}

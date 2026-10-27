@once('pagebuilder-editor-assets')
@php($pageBuilderAssets = app(\IlBronza\PageBuilder\Services\ThemeAssets::class))
<script type="importmap">{!! json_encode($pageBuilderAssets->importMap(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) !!}</script>
<link rel="stylesheet" href="{{ $pageBuilderAssets->assetUrl('css/editor.css') }}">
<link rel="stylesheet" href="{{ $pageBuilderAssets->assetUrl('css/palette.css') }}">
<style>@import url("{{ $pageBuilderAssets->assetUrl('css/variables.css') }}") layer(pagebuilder-defaults);</style>
@endonce

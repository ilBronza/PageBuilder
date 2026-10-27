@once
@if($loadUikit ?? true)
<link rel="stylesheet" href="{{ asset('vendor/pagebuilder/vendor/uikit.min.css') }}">
@endif
<link rel="stylesheet" href="{{ app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->assetUrl('css/content.css') }}">
<link rel="stylesheet" href="{{ app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->assetUrl('css/palette.css') }}">
<style>@import url("{{ app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->assetUrl('css/variables.css') }}") layer(pagebuilder-defaults);</style>
@if($variablesUrl = app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->variablesUrl())
<link rel="stylesheet" href="{{ $variablesUrl }}">
@endif
@endonce
{!! $record->renderPageArea($area, $actor ?? auth()->user()) !!}

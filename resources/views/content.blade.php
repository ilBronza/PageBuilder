@once
@if($loadUikit ?? true)
<link rel="stylesheet" href="{{ asset('vendor/pagebuilder/vendor/uikit.min.css') }}">
@endif
<link rel="stylesheet" href="{{ asset('vendor/pagebuilder/css/content.css') }}">
@endonce
{!! $record->renderPageArea($area, $actor ?? auth()->user()) !!}

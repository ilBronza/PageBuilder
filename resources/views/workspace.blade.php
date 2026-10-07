{{-- $options from WorkspaceOptions::forRecords(); optional media: [{url, alt, label}]. --}}
@once
<link rel="stylesheet" href="{{ asset('vendor/pagebuilder/css/editor.css') }}">
@endonce
@php($workspaceId = 'pagebuilder-workspace-'.\Illuminate\Support\Str::uuid())
<div id="{{ $workspaceId }}"></div>
<script type="module">
    import {mountWorkspace} from '{{ asset('vendor/pagebuilder/js/workspace.js') }}';
    const options = {{ \Illuminate\Support\Js::from(\IlBronza\PageBuilder\Documents\Codec::wire($options)) }};
    const root = document.getElementById({{ \Illuminate\Support\Js::from($workspaceId) }});
    mountWorkspace(root, {...options, csrfToken: {{ \Illuminate\Support\Js::from(csrf_token()) }}})
        .catch(error => { root.textContent = 'PageBuilder non disponibile: ' + error.message; });
</script>

{{-- Include in an authorized host page. $options: url, previewUrl?, title?, mode?, kind?, sources?, areas?. --}}
@once
<link rel="stylesheet" href="{{ asset('vendor/pagebuilder/css/editor.css') }}">
@endonce
@php($editorId = 'pagebuilder-'.\Illuminate\Support\Str::uuid())
<div id="{{ $editorId }}"></div>
<script type="module">
    import {mountEditor} from '{{ asset('vendor/pagebuilder/js/editor.js') }}';
    import {httpAdapter} from '{{ asset('vendor/pagebuilder/js/adapters.js') }}';
    const options = {{ \Illuminate\Support\Js::from(\IlBronza\PageBuilder\Documents\Codec::wire($options)) }};
    const root = document.getElementById({{ \Illuminate\Support\Js::from($editorId) }});
    const adapter = httpAdapter({...options, csrfToken: {{ \Illuminate\Support\Js::from(csrf_token()) }}});
    mountEditor(root, {...options, adapter}).catch(error => { root.textContent = 'Editor non disponibile: ' + error.message; });
</script>

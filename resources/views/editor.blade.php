{{-- Include in an authorized host page. $options: url, previewUrl?, title?, mode?, kind?, sources?, areas?. --}}
@include('pagebuilder::assets')
@php($options += ['csrfToken' => csrf_token()])
@php($options += ['variablesUrl' => app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->variablesUrl(), 'defaultVariablesUrl' => app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->assetUrl('css/variables.css'), 'previewStyles' => app(\IlBronza\PageBuilder\Services\ThemeAssets::class)->previewStyles()])
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

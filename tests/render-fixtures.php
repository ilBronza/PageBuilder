<?php
require __DIR__.'/bootstrap.php';
$registry = new IlBronza\PageBuilder\Documents\Registry;
$validator = new IlBronza\PageBuilder\Documents\Validator($registry);
$renderer = new IlBronza\PageBuilder\Documents\Renderer($registry, $validator);
$fixtures = json_decode(file_get_contents(__DIR__.'/fixtures/parity.json'), true, 512, JSON_THROW_ON_ERROR);
$result = [];
foreach ($fixtures as $fixture) {
    try {
        $area = fn ($name) => isset($fixture['areas'][$name]) ? $renderer->render($fixture['areas'][$name], [], null, 'area') : '';
        $result[$fixture['name']] = ['valid'=>true, 'html'=>$renderer->render($fixture['document'], $fixture['values'] ?? [], $area, $fixture['mode'])];
    } catch (IlBronza\PageBuilder\Documents\InvalidDocument $error) { $result[$fixture['name']] = ['valid'=>false]; }
}
echo json_encode($result, JSON_THROW_ON_ERROR);

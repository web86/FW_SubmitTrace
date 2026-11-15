<?php
$path = parse_url(
    $_SERVER['REQUEST_URI'] ?? '',
    PHP_URL_PATH
);

if (!in_array($path, [
    '/ru/work-with-me',
    '/work-with-me',
], true)) {
    return;
}

$event = $modx->event->name;

$modx->log(
    modX::LOG_LEVEL_ERROR,
    '[FW LIFECYCLE] ' . json_encode([
        'event' => $event,
        'path' => $path,
        'q' => $_REQUEST['q'] ?? null,
        'context' => is_object($modx->context)
            ? $modx->context->get('key')
            : null,
        'resource_method' => $modx->resourceMethod,
        'resource_identifier' => $modx->resourceIdentifier,
        'resource_id' => is_object($modx->resource)
            ? $modx->resource->get('id')
            : null,
    ], JSON_UNESCAPED_SLASHES)
);

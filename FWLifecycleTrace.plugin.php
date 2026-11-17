<?php
/**
 * FWLifecycleTrace — portable temporary MODX 2 event log.
 * Attach to OnMODXInit, OnHandleRequest, OnPageNotFound,
 * OnWebPageInit, OnLoadWebDocument.
 * Requires fw_debug_enabled=1 and fw_debug_paths=/ru/contact,/contact.
 */
if (!filter_var($modx->getOption('fw_debug_enabled', null, '0'), FILTER_VALIDATE_BOOLEAN)) {
    return;
}
$normalizePath = static function ($raw) {
    $path = parse_url((string)$raw, PHP_URL_PATH);
    if (!is_string($path) || $path === '') return '';
    return $path === '/' ? '/' : rtrim($path, '/');
};
$rawPaths = trim((string)$modx->getOption('fw_debug_paths', null, ''));
if ($rawPaths === '') return; // No logging without an explicit route allowlist.
$paths = array_filter(array_map($normalizePath, explode(',', $rawPaths)));
$path = $normalizePath($_SERVER['REQUEST_URI'] ?? '');
if (!in_array($path, $paths, true)) return;
$event = $modx->event->name;
$modx->log(
    modX::LOG_LEVEL_ERROR,
    '[FW LIFECYCLE] ' . json_encode([
        'event' => $event,
        'path' => $path,
        'q' => isset($_REQUEST['q']) ? substr((string)$_REQUEST['q'], 0, 120) : null,
        'context' => is_object($modx->context)
            ? $modx->context->get('key') : null,
        'resource_method' => $modx->resourceMethod,
        'resource_identifier' => $modx->resourceIdentifier,
        'resource_id' => is_object($modx->resource)
            ? $modx->resource->get('id') : null,
    ], JSON_UNESCAPED_SLASHES)
);
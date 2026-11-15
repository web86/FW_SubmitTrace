<?php
/**
 * FWDebugCollector — MODX Revolution 2.8.x
 *
 * Event: OnMODXInit
 * Temporary diagnostic plugin.
 * Remove or disable after investigation.
 */

if (!isset($modx) || !($modx instanceof modX)) {
    return;
}

if (!isset($modx->event)
    || $modx->event->name !== 'OnMODXInit') {
    return;
}

$enabled = filter_var(
    $modx->getOption('fw_debug_enabled', null, '0'),
    FILTER_VALIDATE_BOOLEAN
);

if (!$enabled) {
    return;
}

$path = parse_url(
    $_SERVER['REQUEST_URI'] ?? '/',
    PHP_URL_PATH
) ?: '/';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$traceCookie = (string)($_COOKIE['fw_trace'] ?? '');
$validTrace = (bool)preg_match(
    '/^[a-f0-9]{32}$/i',
    $traceCookie
);

// Record correlated HTTP requests.
if ($path !== '/fw-debug/collect') {
    if ($validTrace && in_array($path, [
        '/ru/work-with-me',
        '/work-with-me',
        '/assets/components/sendit/action.php',
    ], true)) {
        $modx->log(
            modX::LOG_LEVEL_ERROR,
            '[FW TRACE HTTP] ' . json_encode([
                'trace' => $traceCookie,
                'method' => $method,
                'path' => $path,
                'envelope' => isset(
                    $_SERVER['HTTP_X_FORMWATCH_ENVELOPE']
                ),
            ], JSON_UNESCAPED_SLASHES)
        );
    }

    return;
}

// Collector endpoint.
header('Cache-Control: no-store');
header('Content-Type: text/plain; charset=utf-8');

if ($method !== 'POST') {
    http_response_code(405);
    exit;
}

$fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';

if ($fetchSite !== '' && $fetchSite !== 'same-origin') {
    http_response_code(403);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && $origin !== 'https://web86.site') {
    http_response_code(403);
    exit;
}

if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2048) {
    http_response_code(413);
    exit;
}

$raw = file_get_contents(
    'php://input',
    false,
    null,
    0,
    2049
);

if ($raw === false || strlen($raw) > 2048) {
    http_response_code(413);
    exit;
}

$payload = json_decode($raw, true);

$secret = (string)$modx->getOption(
    'fw_debug_token',
    null,
    ''
);

if (!is_array($payload)
    || !preg_match('/^[a-f0-9]{48}$/i', $secret)
    || !is_string($payload['token'] ?? null)
    || !hash_equals($secret, $payload['token'])) {
    http_response_code(403);
    exit;
}

$events = [
    'boot',
    'ready_state',
    'dom_ready',
    'window_load',
    'asset_probe',
    'module_probe',
    'navigation_probe',
    'sendit_ready',
    'si_init',
    'submit_capture',
    'submit_bubble',
    'submit_microtask',
    'si_send_before',
    'si_send_after',
    'si_send_success',
    'si_send_error',
    'si_send_finish',
    'script_error',
    'runtime_error',       // новое
    'promise_rejection',   // новое
    'pagehide',
];

$event = (string)($payload['event'] ?? '');
$traceId = (string)($payload['trace'] ?? '');

if (!in_array($event, $events, true)
    || !preg_match('/^[a-f0-9]{32}$/i', $traceId)) {
    http_response_code(400);
    exit;
}

// The JS tracer must set fw_trace with Path=/
// before sending diagnostic events.
if (!$validTrace
    || !hash_equals(
        strtolower($traceCookie),
        strtolower($traceId)
    )) {
    http_response_code(403);
    exit;
}

// Strict diagnostic field allowlist.
$safe = [
    'trace' => $traceId,
    'event' => $event,
];

$fields = [
    'ms',
    'page',
    'state',
    'method',
    'action',
    'preset',
    'sendit',
    'form',
    'scripts',
    'cancelled',
    'accepted',
    'script',
    'index_tag',
    'index_module',
    'index_resource',
    'index_status',
    'module',
    'observed',
    'http_status',
    'start_ms',
    'duration_ms',
    'request_ms',
    'response_ms',
    'end_ms',
    'queue_ms',
    'ttfb_ms',
    'download_ms',
    'transfer_bytes',
    'encoded_bytes',
    'initiator',
    'delivery',
    'ready_ms',
    'since_load_ms',
    'nav_type',
    'nav_total_ms',
    'nav_ttfb_ms',
    'nav_download_ms',
    'nav_transfer_bytes',
    'persisted',
];

foreach ($fields as $key) {
    $value = $payload[$key] ?? null;

    if (is_bool($value)) {
        $safe[$key] = $value;
    } elseif (is_int($value)
        && $value >= 0
        && $value <= 600000) {
        $safe[$key] = $value;
    } elseif (is_string($value)
        && strlen($value) <= 128
        && preg_match(
            '~^[a-zA-Z0-9_./:-]+$~',
            $value
        )) {
        // Only predefined diagnostic labels/paths
        // should be emitted by the JS tracer.
        $safe[$key] = $value;
    }
}

$modx->log(
    modX::LOG_LEVEL_ERROR,
    '[FW TRACE JS] ' . json_encode(
        $safe,
        JSON_UNESCAPED_SLASHES
    )
);

http_response_code(204);
exit;

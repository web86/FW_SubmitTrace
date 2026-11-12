<?php
/** Temporary MODX 3 plugin. Event: OnMODXInit. Delete after investigation. */
if (($modx->event->name ?? '') !== 'OnMODXInit') return;
if (!$modx->getOption('fw_debug_enabled', null, false)) return;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$trace = (string)($_COOKIE['fw_trace'] ?? '');
$validTrace = (bool)preg_match('/^[a-f0-9]{32}$/i', $trace);

if ($path !== '/fw-debug/collect') {
    if ($validTrace && in_array($path, [
        '/ru/work-with-me', '/work-with-me', '/assets/components/sendit/action.php'
    ], true)) {
        $modx->log(1, '[FW TRACE HTTP] ' . json_encode([
            'trace' => $trace, 'method' => $method, 'path' => $path,
            'envelope' => isset($_SERVER['HTTP_X_FORMWATCH_ENVELOPE']),
        ], JSON_UNESCAPED_SLASHES));
    }
    return;
}

header('Cache-Control: no-store');
header('Content-Type: text/plain; charset=utf-8');
if ($method !== 'POST') { http_response_code(405); exit; }
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin') !== 'same-origin') {
    http_response_code(403); exit;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && $origin !== 'https://web86.site') { http_response_code(403); exit; }
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2048) { http_response_code(413); exit; }
$raw = file_get_contents('php://input', false, null, 0, 2049);
if (strlen($raw) > 2048) { http_response_code(413); exit; }
$payload = json_decode($raw, true);
$secret = (string)$modx->getOption('fw_debug_token', null, '');
if (!is_array($payload) || !preg_match('/^[a-f0-9]{48}$/i', $secret) ||
    !is_string($payload['token'] ?? null) || !hash_equals($secret, $payload['token'])) {
    http_response_code(403); exit;
}
$events = ['boot', 'ready_state', 'dom_ready', 'window_load', 'si_init',
    'submit_capture', 'submit_bubble', 'submit_microtask',
    'si_send_before', 'si_send_after', 'si_send_success', 'si_send_error',
    'si_send_finish', 'script_error', 'pagehide'];
$event = (string)($payload['event'] ?? '');
$traceId = (string)($payload['trace'] ?? '');
if (!in_array($event, $events, true) || !preg_match('/^[a-f0-9]{32}$/i', $traceId)) {
    http_response_code(400); exit;
}
// Strict allowlist: never record tokens, form fields, query strings or request bodies.
$safe = ['trace' => $traceId, 'event' => $event];
foreach (['ms','page','state','method','action','preset','sendit','form',
    'scripts','cancelled','accepted','script','persisted'] as $key) {
    $v = $payload[$key] ?? null;
    if (is_bool($v) || (is_int($v) && $v >= 0 && $v <= 600000)) {
        $safe[$key] = $v;
    } elseif (is_string($v) && strlen($v) <= 128 &&
        preg_match('~^[a-zA-Z0-9_./:-]+$~', $v)) {
        $safe[$key] = $v;
    }
}
$modx->log(1, '[FW TRACE JS] ' . json_encode($safe, JSON_UNESCAPED_SLASHES));
http_response_code(204);
exit;

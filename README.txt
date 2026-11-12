FW Submit Trace — временная диагностика SendIt / FormWatch на MODX 3

Файлы:
  fw-submit-trace.js           — JS-наблюдатель; ставить первым в <head>
  FWDebugCollector.plugin.php  — содержимое плагина MODX, событие OnMODXInit

Установка:
1. Скопировать JS на web86.site в /assets/js/fw-submit-trace.js.
2. Создать плагин MODX FWDebugCollector, вставить содержимое PHP (если редактор MODX не требует <?php, убрать этот открывающий тег), подписать ТОЛЬКО на OnMODXInit.
3. В системных настройках MODX создать:
   fw_debug_enabled = 1
   fw_debug_token = <48 hex digits from php -r 'echo bin2hex(random_bytes(24)), PHP_EOL;'>
   Очистить кеш MODX.
4. Добавить в начало <head>, до GrandHeadChunk:
   <script src="/assets/js/fw-submit-trace.js?v=1"></script>
   Стандартный скрипт не делает ничего без явного fwdebug токена в URL.
5. Для теста использовать URL формата:
   https://web86.site/ru/work-with-me?fwdebug=<fw_debug_token>
   Такой же тест для EN. Для сравнения применять одинаковые шаги сценария.
6. Смотреть core/cache/logs/error.log:
   grep '\[FW TRACE' core/cache/logs/error.log | tail -n 100
   Сверить значения trace для всех событий. В скрипте сессия одна для цепочки навигаций в одной вкладке.
7. После проверки: убрать подключение JS, fw_debug_enabled=0, очистить fw_debug_token/сменить ключ, очистить кеш MODX. В диагностической вкладке открыть ?fwdebug=off или закрыть вкладку.

Что логируется:
 [FW TRACE JS] boot, si_init, ready_state, dom_ready, window_load, submit_capture,
 submit_bubble, submit_microtask (cancelled true/false), si_send_before/after/success/error/finish,
 script_error, pagehide.
 [FW TRACE HTTP] начало GET/POST в MODX на /ru/work-with-me,/work-with-me,SendIt action.php,
                  если запрос проходит через MODX и содержит fw_trace cookie.

БЕЗ значений полей, POST body, полного URL, query string, cookie, токенов и заголовков.
Ограничение: плагин OnMODXInit видит лишь запросы, которые инициализируют MODX;
серверные запросы, обходящие MODX, он не увидит. sendBeacon не гарантирует 100% доставку.
Если события отсутствуют, проверить network POST /fw-debug/collect (должен быть 204),
проверить подписку плагина на событие, системные настройки и обрабатывает ли MODX этот URL.

Безопасность: отладочный токен находится в URL теста; серверная статистика/история может сохранить его.
Использовать короткое окно, временный токен, затем сменить/отключить. Не публиковать ключ.
Новый debug-трафик может слегка изменить тайминг; это диагностический инструмент,
а не доказательство точной причины сам по себе.

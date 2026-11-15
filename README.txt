FW Submit Trace — временная диагностика SendIt / FormWatch на MODX 2.8.x

Назначение:
  Сравнивать успешные и неуспешные автопроверки формы SendIt 2.8.6
  на web86.site, не изменяя отправку и не повторяя submit.

Файлы:
  fw-submit-trace.js             — JS-наблюдатель (подключать синхронно ПЕРЕД SendIt)
  FWDebugCollector.plugin.php   — приёмник событий, MODX 2, OnMODXInit
  FWLifecycleTrace.plugin.php   — журнал MODX lifecycle для страниц формы

Установка:
1. Скопировать fw-submit-trace.js в /assets/js/fw-submit-trace.js.
2. В JS задать DEBUG_TOKEN (48 hex символов), равный системной настройке MODX
   fw_debug_token. Использовать временный токен и заменить его после диагностики.
   Он встроен в клиентский JS и доступен посетителям — это НЕ постоянный секрет.
3. В MODX 2 включить FWDebugCollector на OnMODXInit и FWLifecycleTrace на
   исследуемых событиях MODX; обновить их код содержимым репозитория.
   Если редактор плагинов не требует открывающего <?php, убрать его.
4. Настройки MODX: fw_debug_enabled = 1; fw_debug_token = 48 hex символов.
   Очистить кэш MODX.
5. Подключить до SendIt, без async/defer:
   <script src="/assets/js/fw-submit-trace.js?v=2"></script>
   Проверить, что в браузере загрузилась новая версия файла.

Трассировка автоматически включается ТОЛЬКО для /ru/work-with-me и
/work-with-me, включая свежие контексты автоматических проверок FormWatch.
Дополнительные query-параметры или sessionStorage не нужны.
Для каждой загрузки страницы создаётся новый trace (cookie fw_trace, Path=/).

События:
  boot, ready_state, dom_ready, window_load, si_init
  submit_capture, submit_bubble, submit_microtask
  si_send_before/after/success/error/finish
  script_error, runtime_error, promise_rejection, pagehide
  asset_probe — два наблюдения: state=load и state=submit

asset_probe:
  index_tag       true/false — есть ли <script src=".../sendit/js/web/index.js">
  index_module    true/false — type="module" у этого тега
  index_resource  true/false — есть запись Resource Timing для index.js
  index_status    число 0–600000 — ResourceTiming.responseStatus либо 0
  scripts         число записей Resource Timing для *.js внутри /sendit/
  sendit          true/false — доступен window.SendIt?.Sending

  index_status=0 и index_resource=false НЕ доказывают, что запроса не было.
  Resource Timing может не содержать responseStatus; статус 200 не
  подтверждает выполнение кода. index_module=false сам по себе не дефект.

Логи:
  grep '\[FW TRACE' core/cache/logs/error.log | tail -n 120
  grep '\[FW LIFECYCLE' core/cache/logs/error.log | tail -n 120

  Сопоставляйте события по trace и сортируйте JS по ms:
  sendBeacon может доставлять события не в порядке их генерации.
  [FW TRACE HTTP] появляется лишь на запросах, проходящих через MODX.
  /assets/components/sendit/action.php может обойти MODX.
  Collector принимает одно событие на POST /fw-debug/collect (ожидается 204).
  При отказе проверьте настройки, совпадение токена, cookie и доступность URL.

Наблюдатель не выполняет submit, не меняет listener/DOM, не читает поля,
капчу, токены SendIt, query string или тело ответа.
Beacon-запросы запускаются после завершения SendIt, по таймеру через
8 секунд после submit либо при pagehide; это уменьшает влияние измерений,
но не гарантирует доставку и может слегка менять тайминг.

Выключение после расследования:
  Убрать подключение JS, поставить fw_debug_enabled = 0,
  выключить оба диагностических плагина, заменить fw_debug_token
  и очистить кэш MODX.

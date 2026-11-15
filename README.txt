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
   <script src="/assets/js/fw-submit-trace.js?v=4"></script>
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
  navigation_probe — сетевые метрики HTML-документа при window.load
  sendit_ready — первый раз, когда SendIt.Sending стал доступен (опрос 250 мс)
  asset_probe — два наблюдения: state=load и state=submit
  module_probe — десять безопасных записей на каждом этапе (load/submit)
    о последовательности импортов SendIt, без запросов или чтения ответа

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

module_probe (два момента наблюдения, load и submit):
  state          load / submit
  module         core_main, di_container, modules_config, helpers, sessionlogger,
                 proofofwork, behaviorsign, sending, notify, saveformdata
  observed       есть ли завершённая Resource Timing запись для модуля
  http_status    ResourceTiming.responseStatus или 0 (0 = нет данных!)
  start_ms       начало запроса по Performance Timeline (ms), 0 если неизвестно
  duration_ms    длительность по Resource Timing (ms), 0 если неизвестно
  request_ms     время requestStart, отсчитывается от navigation start
  response_ms    время responseStart, отсчитывается от navigation start
  end_ms         время responseEnd, отсчитывается от navigation start
  queue_ms       разница requestStart - startTime (0 = неизвестно/мгновенно)
  ttfb_ms        разница responseStart - requestStart (0 = неизвестно/мгновенно)
  download_ms    разница responseEnd - responseStart (0 = неизвестно/мгновенно)
  transfer_bytes размер переданных данных или 0 (нет данных/кэш)
  encoded_bytes  размер сжатого содержимого или 0
  initiator      тип инициатора согласно Resource Timing
  delivery       тип доставки (если браузер предоставляет)

  Модуль определяется по точному pathname внутри /assets/components/
  sendit/js/web/; query-параметры версии игнорируются. Некоторые модули
  могут не загружаться в зависимости от конфигурации конкретного сайта.
  Отсутствующая запись НЕ доказывает, что файл не запрашивался:
  запрос может быть незавершён или Resource Timing недоступен.
  HTTP 200 означает только получение ответа, но не выполнение модуля.
  Подмена console.error запрещена как вмешательство в сайт. Ошибки,
  перехваченные SendIt внутри _initModule(), нужно смотреть в браузерной
  консоли или отдельном Worker console trace. Content-Type/MIME нельзя
  достоверно узнать из Resource Timing; проверить через Network headers.
  Сравнивать успешные и неуспешные прогоны по (trace, state, module).
  Поля request/response/end — абсолютные времена относительно navigationStart,
  а не миллисекунды друг от друга. "0" не подтверждает ошибку сети.
  Дополнительные load/submit наблюдения не делают новых сетевых запросов.

navigation_probe:
  nav_type, nav_total_ms, nav_ttfb_ms, nav_download_ms,
  nav_transfer_bytes — только доступные Network Timing метрики документа.

sendit_ready:
  ready_ms, since_load_ms — первая обнаруженная готовность SendIt.Sending.
  Проверяем раз в 250 мс, не дольше 30 секунд. Отсутствие события не
  доказывает, что инициализация никогда не завершится; это ограниченный замер.

Сравнение двух проверок (Node.js >= 18, без зависимостей):
  1. Сохранить core/cache/logs/error.log в локальный файл.
  2. Найти доступные trace ID:
     node tools/compare-traces.mjs error.log
  3. Сравнить одну успешную и одну неудачную проверку:
     node tools/compare-traces.mjs error.log TRACE_SUCCESS TRACE_FAILURE
  4. Посмотреть время завершения импорта (end), TTFB, загрузку,
     отсутствующие модульные записи, si:init и sendit_ready.
  5. Самотест:
     node tools/compare-traces.test.mjs

  Анализатор опирается только на логируемые события. Если в успешной
  проверке не было si_send_success, он НЕ объявит её подтверждённо
  успешной. Формальный результат проверки следует сверять с FormWatch.
  Скрипт не читает значения формы, cookie, токены и query string.

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

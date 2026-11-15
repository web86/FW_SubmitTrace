/*
 * TEMPORARY SendIt diagnostic tracer — web86.site, MODX 2 / SendIt 2.8.6.
 * Include synchronously in <head> BEFORE SendIt JavaScript.
 * Automatically active ONLY on /ru/work-with-me and /work-with-me.
 *
 * TEMPORARY AUTH CONTRACT:
 *   DEBUG_TOKEN must equal MODX system setting fw_debug_token (48 hex chars).
 *   MODX setting fw_debug_enabled must be 1.
 *   The existing FWDebugCollector is attached to OnMODXInit and handles
 *   POST /fw-debug/collect with a single event per request.
 * Remove this script and disable FWDebugCollector after investigation.
 *
 * Observational only: never preventDefault(), submit(), click(), edit
 * controls, patch listeners, or read field values / session tokens.
 */
(() => {
  'use strict';

  // Replace with the same temporary 48-character hex token as fw_debug_token.
  // This temporary key is visible to visitors in JavaScript: rotate it later.
  const DEBUG_TOKEN = 'de842ba1779ccc9ee5e9dfaca4d533d8a51e6a3192cc2255';
  const TARGET_SELECTOR = '[data-si-form="W86CooperationRu"][data-si-preset="w86_cooperation_ru"]';
  const PAGES = new Set(['/ru/work-with-me', '/work-with-me']);
  const COLLECTOR = '/fw-debug/collect';
  const MAX_EVENTS = 45;
  const MAX_AGE_MS = 20 * 60 * 1000;
  const STALL_FLUSH_MS = 8000;

  try {
    if (!PAGES.has(location.pathname) || location.protocol !== 'https:') return;
    if (!/^[a-f0-9]{48}$/i.test(DEBUG_TOKEN)) {
      console.warn('[FW TRACE] set temporary DEBUG_TOKEN (48 hex chars)');
      return;
    }

    // One independent page-load trace. The cookie follows a native GET/POST
    // navigation so server-side lifecycle logs can correlate the next request.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const trace = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
    document.cookie = `fw_trace=${trace}; Max-Age=1200; Path=/; Secure; SameSite=Lax`;
    const deadline = Date.now() + MAX_AGE_MS;

    const getForm = target => {
      let form = null;
      if (target instanceof HTMLFormElement) form = target;
      else if (target instanceof Element) form = target.form || target.closest('form');
      return form instanceof HTMLFormElement && form.matches(TARGET_SELECTOR) ? form : null;
    };
    const currentForm = () => document.querySelector(TARGET_SELECTOR);
    const hasSendIt = () => Boolean(window.SendIt?.Sending);
    const methodOf = form => {
      const button = form.querySelector('button[type="submit"],input[type="submit"]');
      return String(button?.getAttribute('formmethod') || form.getAttribute('method') || 'get').toLowerCase();
    };
    const actionKind = form => {
      const button = form.querySelector('button[type="submit"],input[type="submit"]');
      const value = button?.getAttribute('formaction') || form.getAttribute('action') || location.href;
      try {
        const url = new URL(value, location.href);
        if (url.origin !== location.origin) return 'external';
        if (url.pathname === '/assets/components/sendit/action.php') return 'sendit_action';
        return url.pathname === location.pathname ? 'same_page' : 'other_path';
      } catch { return 'invalid'; }
    };
    const scriptCount = () => performance.getEntriesByType('resource')
      .filter(entry => {
        try { return /\/sendit\/.*\.js$/i.test(new URL(entry.name).pathname); }
        catch { return false; }
      }).length;

    let count = 0;
    let pending = [];
    let stallTimer = null;

    const flush = () => {
      if (!pending.length) return;
      const items = pending;
      pending = [];
      // The current MODX collector accepts one JSON event per request.
      // Never send these diagnostic requests BEFORE the submit action.
      for (const item of items) {
        try {
          const blob = new Blob([JSON.stringify({ ...item, token: DEBUG_TOKEN })],
            { type: 'text/plain' });
          const queued = navigator.sendBeacon?.(COLLECTOR, blob);
          if (!queued) console.warn('[FW TRACE] beacon not queued', item.event);
        } catch {
          console.warn('[FW TRACE] failed to queue event', item.event);
        }
      }
    };
    const report = (event, details = {}) => {
      if (count >= MAX_EVENTS || Date.now() > deadline) return;
      count++;
      const item = {
        trace, event,
        ms: Math.min(600000, Math.max(0, Math.round(performance.now()))),
        page: location.pathname,
        ...details,
      };
      pending.push(item);
      console.info('[FW TRACE]', item);
      if (event === 'si_send_finish') {
        clearTimeout(stallTimer);
        setTimeout(flush, 0);
      }
    };
    const snapshot = event => report(event, {
      state: document.readyState,
      sendit: hasSendIt(),
      form: Boolean(currentForm()),
      scripts: Math.min(600000, scriptCount()),
    });
    const assetSnapshot = stage => {
      const indexPath = '/assets/components/sendit/js/web/index.js';
    
      const indexTag = [...document.scripts].find(el => {
        try {
          return new URL(el.src, location.href).pathname === indexPath;
        } catch {
          return false;
        }
      });
    
      const indexResource = performance.getEntriesByType('resource')
        .find(item => {
          try {
            return new URL(item.name).pathname === indexPath;
          } catch {
            return false;
          }
        });
    
      report('asset_probe', {
        state: stage,
        index_tag: Boolean(indexTag),
        index_module: indexTag?.type === 'module',
        index_resource: Boolean(indexResource),
        index_status: indexResource?.responseStatus || 0,
        scripts: scriptCount(),
        sendit: hasSendIt()
      });
    };
    const scheduleStallFlush = () => {
      clearTimeout(stallTimer);
      // If submit is intercepted but no si:send:finish ever fires, capture it.
      stallTimer = setTimeout(flush, STALL_FLUSH_MS);
    };

    document.addEventListener('readystatechange', () => snapshot('ready_state'));
    document.addEventListener('DOMContentLoaded', () => snapshot('dom_ready'), { once: true });
    window.addEventListener('load', () => snapshot('window_load'), { once: true });

    const observedInit = new WeakSet();
    const onInit = event => {
      if (observedInit.has(event)) return;
      observedInit.add(event);
      snapshot('si_init');
    };
    document.addEventListener('si:init', onInit, true);
    window.addEventListener('si:init', onInit, true);

    document.addEventListener('submit', event => {
      const form = getForm(event.target);
      if (!form) return;
      report('submit_capture', {
        method: methodOf(form),
        action: actionKind(form),
        preset: 'w86_cooperation_ru',
        sendit: hasSendIt(),
        cancelled: event.defaultPrevented,
      });
      scheduleStallFlush();
      queueMicrotask(() => report('submit_microtask', {
        cancelled: event.defaultPrevented,
        sendit: hasSendIt(),
        form: form.isConnected,
      }));
    }, true);
    document.addEventListener('submit', event => {
      if (!getForm(event.target)) return;
      report('submit_bubble', { cancelled: event.defaultPrevented });
    });

    for (const [eventName, label] of [
      ['si:send:before', 'si_send_before'],
      ['si:send:after', 'si_send_after'],
      ['si:send:success', 'si_send_success'],
      ['si:send:error', 'si_send_error'],
      ['si:send:finish', 'si_send_finish'],
    ]) {
      const seen = new WeakSet();
      const onSend = event => {
        if (seen.has(event)) return;
        seen.add(event);
        const detail = event.detail || {};
        const candidate = detail.target || detail.form || detail.element || event.target;
        const form = getForm(candidate);
        if (!form && candidate instanceof Element && candidate !== document) return;
        const success = detail.result?.success;
        report(label, {
          form: Boolean(form),
          accepted: success === undefined ? 'unknown'
            : success === true || success === 1 || success === '1',
        });
      };
      document.addEventListener(eventName, onSend, true);
      window.addEventListener(eventName, onSend, true);
    }

    
    // 1. Ошибки загрузки JS-файлов
    window.addEventListener('error', event => {
      if (!(event.target instanceof HTMLScriptElement)) return;
    
      let script = 'other';
      try {
        if (new URL(event.target.src).pathname.startsWith('/assets/components/sendit/')) {
          script = 'sendit';
        }
      } catch {}
    
      report('script_error', { script });
    }, true);
    
    // 2. Ошибки выполнения JavaScript
    window.addEventListener('error', event => {
      if (event.target instanceof HTMLScriptElement) return;
    
      let script = 'other';
      try {
        if (event.filename &&
            new URL(event.filename, location.href).pathname
              .startsWith('/assets/components/sendit/')) {
          script = 'sendit';
        }
      } catch {}
    
      report('runtime_error', {
        script,
        state: document.readyState
      });
    }, true);
    
    // 3. Необработанные ошибки Promise
    window.addEventListener('unhandledrejection', () => {
      report('promise_rejection', {
        state: document.readyState
      });
    });
    
    // 4. Уход со страницы — оставляем СТАРЫЙ обработчик
    window.addEventListener('pagehide', event => {
      report('pagehide', { persisted: Boolean(event.persisted) });
      clearTimeout(stallTimer);
      flush();
    });

    snapshot('boot');
  } catch {
    // Keep failures of the observer isolated from form behavior.
    console.warn('[FW TRACE] instrumentation unavailable');
  }
})();

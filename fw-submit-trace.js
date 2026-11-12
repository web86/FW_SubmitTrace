/* Temporary FormWatch / SendIt client trace. Load FIRST in <head>. */
(() => {
  'use strict';
  const store = '__fwTraceAuth';
  const runKey = '__fwTraceId';
  const query = new URLSearchParams(location.search);
  try {
    if (query.get('fwdebug') === 'off') {
      sessionStorage.removeItem(store);
      sessionStorage.removeItem(runKey);
      document.cookie = 'fw_trace=; Max-Age=0; Path=/; Secure; SameSite=Lax';
      return;
    }
    const provided = query.get('fwdebug');
    if (provided && /^[a-f0-9]{48}$/i.test(provided)) {
      const previous = JSON.parse(sessionStorage.getItem(store) || 'null');
      if (!previous || previous.token !== provided.toLowerCase() || Date.now() > previous.until) {
        sessionStorage.removeItem(runKey);
      }
      sessionStorage.setItem(store, JSON.stringify({
        token: provided.toLowerCase(), until: Date.now() + 20 * 60_000
      }));
    }
    const auth = JSON.parse(sessionStorage.getItem(store) || 'null');
    if (!auth || Date.now() > auth.until || !/^[a-f0-9]{48}$/i.test(auth.token)) return;

    const trace = sessionStorage.getItem(runKey) || crypto.randomUUID().replaceAll('-', '');
    sessionStorage.setItem(runKey, trace);
    document.cookie = `fw_trace=${trace}; Max-Age=1200; Path=/; Secure; SameSite=Lax`;

    let sent = 0;
    function report(event, details = {}) {
      if (sent++ >= 70) return;
      const safe = { trace, event, ms: Math.round(performance.now()),
        page: location.pathname, ...details };
      console.info('[FW TRACE]', safe);
      const body = JSON.stringify({ ...safe, token: auth.token });
      navigator.sendBeacon('/fw-debug/collect', new Blob([body], { type: 'text/plain' }));
    }
    const isInquiry = el => el instanceof HTMLFormElement && el.id === 'inquiry-form';
    const submitData = form => {
      const button = form.querySelector('button[type="submit"],input[type="submit"]');
      return {
        method: (button?.getAttribute('formmethod') || form.getAttribute('method') || 'get').toLowerCase(),
        action: new URL(button?.getAttribute('formaction') || form.getAttribute('action') || location.href, location.href).pathname,
        preset: form.dataset.siPreset || '',
        sendit: !!window.SendIt?.Sending
      };
    };
    const snapshot = event => {
      const form = document.getElementById('inquiry-form');
      report(event, {
        state: document.readyState,
        sendit: !!window.SendIt?.Sending,
        form: isInquiry(form),
        scripts: performance.getEntriesByType('resource')
          .filter(r => /\/sendit\/.*\.js/i.test(new URL(r.name).pathname)).length
      });
    };
    report('boot', { state: document.readyState });
    document.addEventListener('readystatechange', () => snapshot('ready_state'));
    document.addEventListener('DOMContentLoaded', () => snapshot('dom_ready'));
    window.addEventListener('load', () => snapshot('window_load'));
    document.addEventListener('si:init', () => snapshot('si_init'));

    // Capture runs early; document bubble and microtask run later.
    // Absence of bubble can indicate stopPropagation; microtask is post-dispatch evidence.
    document.addEventListener('submit', e => {
      if (!isInquiry(e.target)) return;
      report('submit_capture', { ...submitData(e.target), cancelled: e.defaultPrevented });
    }, true);
    document.addEventListener('submit', e => {
      if (!isInquiry(e.target)) return;
      const form = e.target;
      report('submit_bubble', { cancelled: e.defaultPrevented });
      queueMicrotask(() => report('submit_microtask', { cancelled: e.defaultPrevented,
        sendit: !!window.SendIt?.Sending, form: isInquiry(form) }));
    });

    for (const name of ['si:send:before', 'si:send:after', 'si:send:success',
      'si:send:error', 'si:send:finish']) {
      document.addEventListener(name, e => {
        const target = e.detail?.target;
        if (!isInquiry(target)) return;
        const accepted = e.detail?.result?.success;
        report(name.replaceAll(':', '_'), {
          accepted: accepted === undefined ? 'unknown' : String(accepted === true || accepted === 1 || accepted === '1')
        });
      }, true);
    }
    window.addEventListener('error', e => {
      if (e.target instanceof HTMLScriptElement) report('script_error', {
        script: new URL(e.target.src || location.href).pathname
      });
    }, true);
    window.addEventListener('pagehide', e => report('pagehide', { persisted: e.persisted }));
  } catch (e) {
    // Diagnostic code must never alter the form's normal behavior.
    console.warn('[FW TRACE] instrumentation unavailable');
  }
})();

#!/usr/bin/env node
/*
 * Compare two FW TRACE runs using only MODX error.log.
 * Usage:
 *   node tools/compare-traces.mjs error.log TRACE_SUCCESS TRACE_FAILURE
 * If trace IDs are omitted, prints a compact list of available traces.
 * Read-only, offline, Node.js >=18, no dependencies.
 */
import { readFileSync } from 'node:fs';

const [, , filePath, successId, failedId] = process.argv;
if (!filePath) {
  console.error('Usage: node tools/compare-traces.mjs error.log [SUCCESS_TRACE FAILURE_TRACE]');
  process.exitCode = 2;
} else {
  try {
    const source = readFileSync(filePath, 'utf8');
    const traces = new Map();
    for (const line of source.split(/\r?\n/)) {
      const marker = '[FW TRACE JS] ';
      const index = line.indexOf(marker);
      if (index < 0) continue;
      let event;
      try { event = JSON.parse(line.slice(index + marker.length)); }
      catch { continue; }
      if (typeof event.trace !== 'string' || !/^[a-f0-9]{32}$/i.test(event.trace)) continue;
      if (!traces.has(event.trace)) traces.set(event.trace, []);
      traces.get(event.trace).push(event);
    }
    const number = x => Number.isFinite(x) ? String(x) : '—';
    const summarize = (id) => {
      const events = (traces.get(id) || []).sort((a, b) => (a.ms || 0) - (b.ms || 0));
      const first = name => events.find(x => x.event === name);
      const stages = ['load', 'submit'];
      const modules = new Map();
      for (const e of events) if (e.event === 'module_probe' && e.module) {
        if (!modules.has(e.module)) modules.set(e.module, {});
        modules.get(e.module)[e.state] = e;
      }
      const submit = first('submit_capture');
      const microtask = first('submit_microtask');
      const init = first('si_init');
      const ready = first('sendit_ready');
      const success = first('si_send_success');
      const failure = first('si_send_error');
      const classification = success ? 'SI_SUCCESS_OBSERVED'
        : failure ? 'SI_ERROR_OBSERVED'
        : (submit && microtask?.cancelled === false && !submit.sendit)
          ? 'NATIVE_SUBMIT_LIKELY'
          : (submit && (submit.sendit || microtask?.cancelled)) ? 'SUBMIT_INTERCEPTED_OR_READY'
          : 'INCONCLUSIVE';
      return {id, events, first, modules, stages, classification, submit, init, ready};
    };
    const print = summary => {
      console.log('\nTRACE ' + summary.id + ' — ' + summary.classification);
      console.log('  window.load:  ' + number(summary.first('window_load')?.ms) + ' ms');
      console.log('  si:init:      ' + number(summary.init?.ms) + ' ms');
      console.log('  first ready:  ' + number(summary.ready?.ready_ms) + ' ms');
      console.log('  submit:       ' + number(summary.submit?.ms) + ' ms');
      console.log('  sendit at submit: ' + String(summary.submit?.sendit ?? 'unknown'));
      console.log('  module             stage   present status start  end    queue ttfb dl    transfer');
      for (const [name, stages] of summary.modules) {
        for (const stage of summary.stages) {
          const e = stages[stage];
          if (!e) continue;
          const end = e.end_ms ?? (Number.isFinite(e.start_ms) && Number.isFinite(e.duration_ms) ? e.start_ms + e.duration_ms : undefined);
          console.log('  ' + name.padEnd(19) + ' ' + stage.padEnd(7)
            + String(e.observed).padEnd(7)
            + String(e.http_status ?? 0).padEnd(6)
            + number(e.start_ms).padEnd(6)
            + number(end).padEnd(6)
            + number(e.queue_ms).padEnd(6)
            + number(e.ttfb_ms).padEnd(5)
            + number(e.download_ms).padEnd(5)
            + number(e.transfer_bytes));
        }
      }
    };
    if (!successId || !failedId) {
      console.log('Found ' + traces.size + ' trace(s). Choose one successful and one failed ID:');
      for (const [id, evs] of traces) {
        const submit = evs.find(x => x.event === 'submit_capture');
        const ok = evs.some(x => x.event === 'si_send_success');
        console.log('  ' + id + ' events=' + evs.length +
          ' submit=' + (submit?.ms ?? '—') + 'ms successEvent=' + ok);
      }
    } else if (!traces.has(successId) || !traces.has(failedId)) {
      console.error('Trace not found. Available:', [...traces.keys()].join(', '));
      process.exitCode = 1;
    } else {
      const left = summarize(successId), right = summarize(failedId);
      print(left);
      print(right);
      console.log('\nDELTA (failure minus success; ms):');
      for (const key of new Set([...left.modules.keys(), ...right.modules.keys()])) {
        const a = left.modules.get(key)?.submit, b = right.modules.get(key)?.submit;
        if (!a?.observed || !b?.observed) {
          console.log('  ' + key + ': not comparable (a module timing entry is absent)');
          continue;
        }
        const aEnd = a.end_ms ?? a.start_ms + a.duration_ms;
        const bEnd = b.end_ms ?? b.start_ms + b.duration_ms;
        console.log('  ' + key + ' end: ' + (bEnd - aEnd) +
          ', ttfb: ' + ((b.ttfb_ms ?? 0) - (a.ttfb_ms ?? 0)) +
          ', download: ' + ((b.download_ms ?? 0) - (a.download_ms ?? 0)));
      }
      console.log('\nInterpretation: 0 status/timing can mean unavailable metrics;');
      console.log('missing resource entries are NOT proof of failed fetches. No actual network');
      console.log('in-flight requests are visible here. Outcome is an observation, not a verdict.');
    }
  } catch (err) {
    console.error('Unable to process log:', err.message);
    process.exitCode = 1;
  }
}
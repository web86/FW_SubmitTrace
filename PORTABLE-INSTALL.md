# Portable installation (MODX 2 / SendIt 2.8.x)

Use this temporary debug toolkit on any MODX site, not only web86.site.

1. Install `FWDebugCollector.plugin.php` on **OnMODXInit**.
2. Optionally install `FWLifecycleTrace.plugin.php` on **OnMODXInit, OnHandleRequest, OnPageNotFound, OnWebPageInit, OnLoadWebDocument**.
3. Create these MODX settings:
   - `fw_debug_enabled = 1`
   - `fw_debug_token = <random 48 hex chars>`
   - `fw_debug_origin = https://kranghanddesign.com` (optional if site_url is correct; recommended)
   - `fw_debug_paths = /ru/contact,/contact` (comma-separated; required for lifecycle and HTTP tracing)
4. Load the JS **synchronously before SendIt**, for example:

```html
<script>
window.FW_TRACE_CONFIG = {
  token: 'YOUR_TEMPORARY_48_CHARACTER_HEX_TOKEN',
  // selector: 'form[data-si-form],form[data-si-preset]',
  // paths: ['/ru/contact'], // optional restriction
};
</script>
<script src="/assets/js/fw-submit-trace.js?v=5"></script>
```

The default selector traces every form with `data-si-form` or `data-si-preset`. Preset is detected per submitted form, including forms inside modals. No form controls are modified and no synthetic submits/clicks are performed.

The collector endpoint remains `/fw-debug/collect`. Collector payloads and event names remain compatible with `tools/compare-traces.mjs`. On successful POST it returns 204. Check logs for `[FW TRACE JS]`, `[FW TRACE HTTP]`, and `[FW LIFECYCLE]`.

**Security / cleanup:** Client debug token is public, not a secret protecting real users; set a temporary random token, use HTTPS, restrict the plugin to a short investigation, disable it, rotate the token and remove the JS afterward. Keep HTTP and lifecycle logging scoped to explicitly configured paths. Avoid simultaneous tracing in multiple tabs of the same site because the `fw_trace` cookie is overwritten on each page load.

**Interpretation:** `si_msg_token_err` plus skipped `OnWebPageInit` but executed `OnLoadWebDocument` may indicate the previously documented Localizator internal-forward lifecycle issue. An absent form in FormWatch is not itself proof of the SendIt token problem.

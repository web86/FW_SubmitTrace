import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir = mkdtempSync(join(tmpdir(), 'fwtrace-'));
const file = join(dir, 'error.log');
const a = 'a'.repeat(32), b='b'.repeat(32);
const line = o => '[2026-11-15] (ERROR) [FW TRACE JS] ' + JSON.stringify(o);
writeFileSync(file, [
 line({trace:a,event:'module_probe',state:'submit',module:'core_main',ms:4000,observed:true,http_status:200,start_ms:2000,duration_ms:100,ttfb_ms:50,download_ms:50}),
 line({trace:a,event:'submit_capture',ms:5000,sendit:true}),
 line({trace:a,event:'si_send_success',ms:7000}),
 line({trace:b,event:'submit_capture',ms:6500,sendit:false}),
 line({trace:b,event:'submit_microtask',ms:6501,cancelled:false}),
 line({trace:b,event:'module_probe',state:'submit',module:'core_main',ms:6500,observed:true,http_status:200,start_ms:3000,duration_ms:120,ttfb_ms:65,download_ms:55}),
 'noise'
].join('\n'));
try {
 const result = spawnSync(process.execPath,[new URL('./compare-traces.mjs', import.meta.url).pathname,file,a,b],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/SI_SUCCESS_OBSERVED/);
 assert.match(result.stdout,/NATIVE_SUBMIT_LIKELY/);
 assert.match(result.stdout,/core_main end: 1020/);
 console.log('PASS: compare-traces success and native-submit comparison');
} finally {
 rmSync(dir,{recursive:true,force:true});
}
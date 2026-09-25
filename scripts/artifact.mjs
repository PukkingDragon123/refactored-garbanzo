// Turn dist-single/index.html into a body-only page (dist-single/zealandia.html) for hosts that
// provide their own <!doctype>/<head>/<body> skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
const pick = (re) => [...src.matchAll(re)].map(m => m[0]);
const head = src.slice(src.indexOf('<head>') + 6, src.indexOf('</head>'));
const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>'));
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Project Zealandia</title>';
const links = pick(/<link[^>]+fonts\.googleapis\.com[^>]*>/g).concat(pick(/<link[^>]+rel="preconnect"[^>]*>/g));
const styles = pick(/<style[\s\S]*?<\/style>/g).filter(s => head.includes(s));
const scripts = pick(/<script[\s\S]*?<\/script>/g).filter(s => head.includes(s));
const out = [title, ...links, ...styles, body.trim(), ...scripts].join('\n');
writeFileSync('dist-single/zealandia.html', out);
console.log('wrote dist-single/zealandia.html', (out.length / 1024).toFixed(1) + ' KB');

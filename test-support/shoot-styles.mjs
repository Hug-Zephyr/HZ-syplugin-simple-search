// 截取三种树样式 × 两种列表样式的渲染对照图
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9447;
const SERVE = 'http://127.0.0.1:62777';
const OUT = process.argv[2] || '.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'sy-shot-'));
const edge = spawn(EDGE, ['--headless=new', '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`,
    '--window-size=1500,950', '--no-first-run', SERVE + '/'], { stdio: 'ignore' });

let ws;
try {
    for (let i = 0; i < 80; i++) {
        try { if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) break; } catch {}
        await sleep(500);
    }
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.addEventListener('open', res, { once: true });
        ws.addEventListener('error', rej, { once: true });
    });
    let id = 0; const pending = new Map();
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
        }
    });
    const send = (method, params = {}) => {
        const i = ++id;
        ws.send(JSON.stringify({ id: i, method, params }));
        return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
    };
    await send('Page.enable'); await send('Runtime.enable');
    const ev = async (e) => {
        const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || '').slice(0, 400));
        return r.result.value;
    };

    for (let i = 0; i < 60; i++) {
        const r = await ev(`({ r: !!window.siyuan?.isReady, u: location.href })`).catch(() => ({}));
        if (r.r && r.u.includes('/stage/')) break;
        await sleep(500);
    }

    // 打开搜索页并搜索
    await ev(`document.querySelector('#barSearch')?.click()`);
    await sleep(2000);
    await ev(`(() => {
        const i = document.querySelector('#searchInput');
        if (!i) return false;
        i.value = '三级';
        i.dispatchEvent(new InputEvent('input', {bubbles: true}));
        return true;
    })()`);
    await sleep(2500);

    // 截图区域: 结果列表 + 搜索框
    const rect = await ev(`(() => {
        const page = document.querySelector('.HZ-simple-search-page');
        if (!page) return null;
        const list = document.querySelector('#HZsimpleSearchList');
        const box = (list || page).getBoundingClientRect();
        return { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 70),
                 width: Math.min(900, box.width + 40), height: Math.min(520, box.height + 90) };
    })()`);

    const cases = [
        ['native_tree', 'bar',     true],
        ['colorful',    'bar',     true],
        ['ediary',      'bar',     true],
        ['ediary',      'classic', false],
        ['native_tree', 'classic', false],
    ];
    for (const [tree, sel, icon] of cases) {
        await ev(`(() => {
            const page = document.querySelector('.HZ-simple-search-page');
            ['HZ-sp-tree-native','HZ-sp-tree-colorful','HZ-sp-tree-ediary'].forEach(c => page.classList.remove(c));
            page.classList.add(${JSON.stringify('HZ-sp-tree-' + tree)});
            page.classList.toggle('HZ-sp-list-classic', ${sel === 'classic'});
            page.classList.toggle('HZ-sp-list-no-icon', ${!icon});
        })()`);
        await sleep(500);
        const name = `${tree}_${sel}_${icon ? 'icon' : 'noicon'}.png`;
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { ...rect, scale: 2 },
            captureBeyondViewport: false,
        });
        writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
        console.log('saved', name);
    }
} finally {
    try { ws?.close(); } catch {}
    edge.kill();
    await sleep(400);
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

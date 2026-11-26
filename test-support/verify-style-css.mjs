// 验证 CSS 拆分后的实际渲染效果。不依赖插件实例，只走 DOM + 计算样式。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9446;
const SERVE = 'http://127.0.0.1:62777';
const OUT_DIR = process.argv[2] || '.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'sy-css-'));
const edge = spawn(EDGE, ['--headless=new', '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`,
    '--window-size=1500,950', '--no-first-run', '--no-default-browser-check',
    SERVE + '/'], { stdio: 'ignore' });

let ws;
try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
        try { if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) { ready = true; break; } } catch {}
        await sleep(500);
    }
    if (!ready) throw new Error('CDP 未就绪');

    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find(t => t.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
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
    await send('Page.enable');
    await send('Runtime.enable');

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) {
            throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 500) + '\n@@ ' + expr.slice(0, 120));
        }
        return r.result.value;
    };

    // 等思源就绪
    for (let i = 0; i < 60; i++) {
        const r = await ev(`({ ready: !!window.siyuan?.isReady, url: location.href })`).catch(() => ({}));
        if (r.ready && r.url.includes('/stage/')) break;
        await sleep(500);
    }

    const report = {};

    // 1) index.css 是否包含新 class
    report.cssLoaded = await ev(`(() => {
        const el = document.getElementById('pluginsStyleHZ-syplugin-simple-search');
        if (!el) return { exists: false };
        const t = el.textContent;
        return {
            exists: true, len: t.length,
            treeNative: t.includes('.HZ-sp-tree-native'),
            treeColorful: t.includes('.HZ-sp-tree-colorful'),
            treeEdiary: t.includes('.HZ-sp-tree-ediary'),
            listNoIcon: t.includes('.HZ-sp-list-no-icon'),
            listClassic: t.includes('.HZ-sp-list-classic'),
            layoutFix: t.includes('.HZ-simple-search-page > .search__layout'),
            rootLeak: /:root\\s*\\{[^}]*HZ-sp/.test(t),
        };
    })()`);

    // 2) body 里不该再有旧版注入的 style
    report.bodyInjectedStyles = await ev(`(() => {
        const all = [...document.body.querySelectorAll('style')];
        return { count: all.length, withHz: all.filter(s => s.textContent.includes('HZ-sp-tree')).length };
    })()`);

    // 3) 打开搜索面板: 直接走思源内部 API, 不依赖快捷键
    report.openAttempt = await ev(`(async () => {
        const tries = [];
        // a) 工具栏搜索按钮
        const btn = document.querySelector('#barSearch') || document.querySelector('[data-type="search"]');
        if (btn) { btn.click(); tries.push('barSearch.click'); }
        await new Promise(r => setTimeout(r, 1500));
        if (document.querySelector('.HZ-simple-search-page')) return { ok: true, via: tries };
        // b) 全局快捷键 Ctrl+P 打开搜索页
        const ev = new KeyboardEvent('keydown', {key:'p', code:'KeyP', ctrlKey:true, shiftKey:true, altKey:true, bubbles:true});
        document.dispatchEvent(ev);
        await new Promise(r => setTimeout(r, 1500));
        if (document.querySelector('.HZ-simple-search-page')) return { ok: true, via: tries.concat('ctrlshiftaltp') };
        // c) 直接用思源的 openSearch
        return { ok: false, tries, mod: Object.keys(window).filter(k=>/open|search/i.test(k)) };
    })()`);
    if (!report.openAttempt.ok) {
        // 兜底: 用内核 API 造一个搜索页
        report.openAttemptFallback = await ev(`(async () => {
            const menu = document.querySelector('#barWorkspace') || document.querySelector('.toolbar__item--space');
            return { note: '未能自动打开, 依赖兜底注入', hasMenu: !!menu };
        })()`);
    }
    await sleep(1500);

    report.searchPage = await ev(`(() => {
        const pages = [...document.querySelectorAll('.HZ-simple-search-page')];
        const p = pages[0];
        return {
            count: pages.length,
            classes: p ? [...p.classList] : null,
            styleClasses: p ? [...p.classList].filter(c => c.startsWith('HZ-sp-')) : null,
        };
    })()`);

    // 4) 三个树样式: 手工加 class 量计算样式
    report.treeStyles = await ev(`(() => {
        const page = document.querySelector('.HZ-simple-search-page');
        const body = document.querySelector('#HZsimpleSearchList .simpleSearchListBody');
        if (!page || !body) return { skip: '搜索页或结果树未出现' };
        const out = {};
        const all = ['HZ-sp-tree-native','HZ-sp-tree-colorful','HZ-sp-tree-ediary'];
        for (const cls of all) {
            all.forEach(c => page.classList.remove(c));
            page.classList.add(cls);
            const cs = getComputedStyle(body);
            const rootVar = getComputedStyle(page).getPropertyValue('--HZ-sp-vertical-line-interval').trim();
            out[cls] = {
                marginLeft: cs.marginLeft,
                borderLeftWidth: cs.borderLeftWidth,
                borderLeftStyle: cs.borderLeftStyle,
                borderLeftColor: cs.borderLeftColor,
                intervalVar: rootVar,
            };
        }
        all.forEach(c => page.classList.remove(c));
        page.classList.add('HZ-sp-tree-native');
        return out;
    })()`);

    // 5) 列表样式两档
    report.listStyles = await ev(`(() => {
        const page = document.querySelector('.HZ-simple-search-page');
        const ul = document.querySelector('#simpleSearchHistoryList');
        if (!page) return { skip: '搜索页未出现' };
        const out = {};
        for (const icon of [true, false]) {
            for (const sel of ['bar','classic']) {
                page.classList.toggle('HZ-sp-list-no-icon', !icon);
                page.classList.toggle('HZ-sp-list-classic', sel === 'classic');
                const offset = getComputedStyle(page).getPropertyValue('--HZ-sp-list-text-offset').trim();
                let pad = null, margin = null, radius = null, shadow = null;
                if (ul) {
                    const li = document.createElement('li');
                    li.className = 'b3-list-item';
                    ul.appendChild(li);
                    const cs = getComputedStyle(li);
                    pad = cs.paddingLeft; margin = cs.marginLeft; radius = cs.borderTopLeftRadius; shadow = cs.boxShadow;
                    li.remove();
                }
                out['icon'+(icon?'On':'Off')+'_'+sel] = { offset, paddingLeft: pad, marginLeft: margin, radius, boxShadow: shadow };
            }
        }
        page.classList.remove('HZ-sp-list-no-icon','HZ-sp-list-classic');
        return out;
    })()`);

    // 6) 搜索框在 no-icon 下的 margin
    report.searchInputNoIcon = await ev(`(() => {
        const page = document.querySelector('.HZ-simple-search-page');
        const input = document.querySelector('#searchInput');
        if (!page || !input) return { skip: '未找到' };
        page.classList.remove('HZ-sp-list-no-icon');
        const a = getComputedStyle(input).marginLeft;
        page.classList.add('HZ-sp-list-no-icon');
        input.classList.add('HZ-search-suggestion-open');
        const b = { marginLeft: getComputedStyle(input).marginLeft, width: getComputedStyle(input).width };
        input.classList.remove('HZ-search-suggestion-open');
        page.classList.remove('HZ-sp-list-no-icon');
        return { withIcon: a, noIcon: b };
    })()`);

    // 7) 布局修复
    report.layoutFix = await ev(`(() => {
        const page = document.querySelector('.HZ-simple-search-page');
        if (!page) return { skip: '未找到' };
        const layout = page.querySelector(':scope > .search__layout');
        if (!layout) return { skip: '无 .search__layout 直接子元素' };
        return { overflow: getComputedStyle(layout).overflow };
    })()`);

    // 截图
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT_DIR, 'verify-search.png'), Buffer.from(shot.data, 'base64'));

    console.log(JSON.stringify(report, null, 2));
} finally {
    try { ws?.close(); } catch {}
    edge.kill();
    await sleep(400);
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

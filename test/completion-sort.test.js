'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api } = load_plugin();
const {
    get_command_complete,
    get_completion_custom_groups,
    get_completion_custom_order,
    get_completion_entries,
    get_completion_usage_keys,
    get_default_command_config,
} = api;

const CFG = get_default_command_config();

function labels(result) {
    if (!result) return null;
    return JSON.parse(JSON.stringify(result.candidates.map(c => c.label)));
}

function make_ctx(mode = 'config', usage = {}, hidden = null) {
    const entries = get_completion_entries(CFG);
    const rank = new Map(entries.map((e, i) => [e.key, i]));
    return { mode, rank, usage, hidden };
}

function key_of(label, entries = get_completion_entries(CFG)) {
    const e = entries.find(item => item.label === label);
    return e ? e.key : null;
}

test('补全排序: 自定义列表按单字符/多字符与 kv key/各 key 的值分组', () => {
    const entries = get_completion_entries(CFG);
    const groups = get_completion_custom_groups(entries, []);
    assert.deepEqual(JSON.parse(JSON.stringify(groups.map(g => g.id))), [
        'single',
        'base',
        'kv:--group=',
        'kv:--sort=',
    ]);
    // - 开头的只出现在单字符组
    assert.ok(groups[0].entries.every(e => e.label.startsWith('-')));
    assert.ok(groups[0].entries.some(e => e.label === '-d'));
    // 多字符和 kv key、固定值的完整 kv 形式在同一个基础组
    const base_labels = JSON.parse(JSON.stringify(groups[1].entries.map(e => e.label)));
    assert.ok(base_labels.includes('--callout'));
    assert.ok(base_labels.includes('--type=callout'));
    assert.ok(base_labels.includes('--time='));
    assert.ok(base_labels.includes('--group='));
    assert.ok(base_labels.includes('--sort='));
    // 值单独按 key 分组, 不包含 key 行
    const sort_labels = JSON.parse(JSON.stringify(
        groups.find(g => g.id === 'kv:--sort=').entries.map(e => e.label)
    ));
    assert.equal(sort_labels.includes('--sort='), false);
    assert.ok(sort_labels.includes('--sort=content'));
    assert.equal(sort_labels.includes('--time=ct'), false);
    // --time= 没有值组, --type= 只有固定值, 也不生成值组
    assert.equal(groups.some(g => g.id === 'kv:--time='), false);
    assert.equal(groups.some(g => g.id === 'kv:--type='), false);

    // 扁平化后包含全部形式且不重复
    const flat = get_completion_custom_order(entries, []);
    assert.equal(flat.length, entries.length);
    assert.equal(new Set(flat).size, entries.length);
});

test('补全排序: 自定义分组内排序, 跨组顺序不会打乱分组', () => {
    const entries = get_completion_entries(CFG);
    const content = entries.find(e => e.label === '--sort=content');
    const type = entries.find(e => e.label === '--sort=type');
    // 故意把 kv 值排在数组最前面, 分组后仍应保留在它所属的 --sort= 组内
    const order = [
        content.key,
        type.key,
        ...entries.filter(e => e.key !== content.key && e.key !== type.key).map(e => e.key),
    ];
    const groups = get_completion_custom_groups(entries, order);
    assert.deepEqual(JSON.parse(JSON.stringify(groups.map(g => g.id))), [
        'single',
        'base',
        'kv:--group=',
        'kv:--sort=',
    ]);
    const sort_labels = JSON.parse(JSON.stringify(
        groups.find(g => g.id === 'kv:--sort=').entries.map(e => e.label)
    ));
    assert.ok(sort_labels.indexOf('--sort=content') < sort_labels.indexOf('--sort=type'));

    // kv key 和多字符在同一组, 可以互相调整顺序
    const sort_key = entries.find(e => e.label === '--sort=');
    const callout = entries.find(e => e.label === '--callout');
    const base_order = [
        sort_key.key,
        callout.key,
        ...entries.filter(e => e.key !== sort_key.key && e.key !== callout.key).map(e => e.key),
    ];
    const base_labels = JSON.parse(JSON.stringify(
        get_completion_custom_groups(entries, base_order).find(g => g.id === 'base').entries.map(e => e.label)
    ));
    assert.ok(base_labels.indexOf('--sort=') < base_labels.indexOf('--callout'));
});

test('补全排序: 默认列表包含基础形式和各 key 的值', () => {
    const entries = get_completion_entries(CFG);
    const l = entries.map(e => e.label);
    assert.ok(l.includes('-d'));
    assert.ok(l.includes('--callout'));
    assert.ok(l.includes('--type=callout'));
    assert.ok(l.includes('--sort='));
    assert.ok(l.includes('--sort=ct:asc'));
    assert.ok(l.includes('--time='));
    // 时间值不进入自定义列表
    assert.equal(l.includes('--time=ct'), false);
    assert.equal(l.includes('--time=ut'), false);
    // --type= 默认只有 callout 一个值, 不生成 key 行
    assert.equal(l.includes('--type='), false);
});

test('补全排序: 从输入提取使用形式', () => {
    const entries = get_completion_entries(CFG);
    const map = new Map(entries.map(e => [e.key, e.label]));
    const to_labels = (query) => JSON.parse(JSON.stringify(
        get_completion_usage_keys(CFG, query).map(k => map.get(k) || k)
    ));

    assert.deepEqual(to_labels('-dhcp 中国'), ['-d', '-h', '-c', '-p']);
    assert.deepEqual(to_labels('--callout 中国'), ['--callout']);
    assert.deepEqual(to_labels('--sort=type,ct:asc 中国'), [
        '--sort=', '--sort=type', '--sort=ct:asc',
    ]);
    assert.deepEqual(to_labels('--time=ct<2020&ut=2020 中国'), ['--time=']);

    const cfg = get_default_command_config();
    const type_cat = cfg.categories.find(c => c.id === 'type');
    type_cat.items.find(i => i.id === 'tabs').enabled = true;
    type_cat.items.find(i => i.id === 'tab').enabled = true;
    const entries2 = get_completion_entries(cfg);
    const map2 = new Map(entries2.map(e => [e.key, e.label]));
    const type_labels = JSON.parse(JSON.stringify(
        get_completion_usage_keys(cfg, '--type=tabs,tab').map(k => map2.get(k) || k).sort()
    ));
    assert.deepEqual(type_labels, ['--type=', '--type=tab', '--type=tabs'].sort());
});

test('补全排序: 使用次数与同次数回退', () => {
    const p = key_of('-p');
    const d = key_of('-d');
    const ctx = make_ctx('usage', { [p]: 10, [d]: 3 });
    const r = get_command_complete(CFG, '-', 1, false, ctx);
    assert.equal(labels(r)[0], 'p');
    // d 次数高于 h, 排在 h 前
    assert.ok(labels(r).indexOf('d') < labels(r).indexOf('h'));
});

test('补全排序: 自定义顺序和隐藏', () => {
    const entries = get_completion_entries(CFG);
    const p = key_of('-p', entries);
    const d = key_of('-d', entries);
    const order = [p, ...entries.filter(e => e.key !== p).map(e => e.key)];
    const rank = new Map(order.map((key, i) => [key, i]));
    const ctx = { mode: 'custom', rank, usage: {}, hidden: new Set([d]) };
    const r = get_command_complete(CFG, '-', 1, false, ctx);
    assert.equal(labels(r)[0], 'p');
    assert.equal(labels(r).includes('d'), false);

    const callout = key_of('--callout', entries);
    const ctx2 = { mode: 'custom', rank, usage: {}, hidden: new Set([callout]) };
    const r2 = get_command_complete(CFG, '--', 2, false, ctx2);
    assert.equal(labels(r2).includes('--callout'), false);
});

test('补全排序: kv 值和 kv key 菜单也生效', () => {
    const content = key_of('--sort=content');
    const sort_key = key_of('--sort=');
    const ctx = make_ctx('usage', { [content]: 9, [sort_key]: 8 });
    const values = get_command_complete(CFG, '--sort=', 8, false, ctx);
    assert.equal(labels(values)[0], '--sort=content');
    const keys = get_command_complete(CFG, '--', 2, false, ctx);
    assert.equal(labels(keys)[0], '--sort=');
});

test('补全排序: 隐藏只在自定义模式生效', () => {
    const d = key_of('-d');
    const ctx = make_ctx('config', {}, new Set([d]));
    const r = get_command_complete(CFG, '-', 1, false, ctx);
    assert.equal(labels(r).includes('d'), true);
});

test('补全排序: 自定义多字符形式进入自定义顺序和次数统计', () => {
    const cfg = get_default_command_config();
    const callout = cfg.categories.find(c => c.id === 'type').items.find(i => i.id === 'callout');
    callout.comms.push({ form: 'multi', content: 'xxcallout' });

    const entries = get_completion_entries(cfg);
    const entry = entries.find(e => e.label === 'xxcallout');
    assert.ok(entry);
    assert.equal(entry.scope, 'base');
    // 进入多字符与 kv key 所在分组
    const groups = get_completion_custom_groups(entries, []);
    assert.ok(groups.find(g => g.id === 'base').entries.some(e => e.label === 'xxcallout'));
    // 搜索时计入使用次数
    assert.ok(get_completion_usage_keys(cfg, 'xxcallout 中国').includes(entry.key));
    // 内置特殊多字符(ct/g</!)不会因为这次改动进入补全列表
    const labels = entries.map(e => e.label);
    assert.equal(labels.includes('ct'), false);
    assert.equal(labels.includes('g<'), false);
    assert.equal(labels.includes('!'), false);
});

test('补全排序: 自定义 kv key 进入自定义顺序和次数统计', () => {
    const cfg = get_default_command_config();
    const doc = cfg.categories.find(c => c.id === 'type').items.find(i => i.id === 'd');
    doc.comms.push(
        { form: 'kv', key: '@@type=', value: 'doc' },
        { form: 'kv', key: '@@type=', value: 'docx' },
    );

    const entries = get_completion_entries(cfg);
    const key_entry = entries.find(e => e.label === '@@type=');
    assert.ok(key_entry);
    assert.equal(key_entry.scope, 'base');
    const groups = get_completion_custom_groups(entries, []);
    assert.ok(groups.find(g => g.id === 'base').entries.some(e => e.label === '@@type='));
    const value_labels = JSON.parse(JSON.stringify(
        groups.find(g => g.id === 'kv:@@type=').entries.map(e => e.label)
    ));
    assert.deepEqual(value_labels, ['@@type=doc', '@@type=docx']);

    const usage = get_completion_usage_keys(cfg, '@@type=doc 中国');
    assert.ok(usage.includes(key_entry.key));
    const value_entry = entries.find(e => e.label === '@@type=doc');
    assert.ok(usage.includes(value_entry.key));
});

test('补全排序: 默认高亮仍按连选逻辑', () => {
    const entries = get_completion_entries(CFG);
    const p = key_of('-p', entries);
    const order = [p, ...entries.filter(e => e.key !== p).map(e => e.key)];
    const rank = new Map(order.map((key, i) => [key, i]));
    const ctx = { mode: 'custom', rank, usage: {}, hidden: null };
    const r = get_command_complete(CFG, '-d', 2, false, ctx);
    // 排序改变了显示顺序, 但默认仍高亮下一个可组合类型 h
    assert.equal(r.candidates[r.default_index].label, 'h');
    assert.equal(r.candidates[1].label, 'p');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api, plugin_class } = load_plugin();
const { get_command_complete, get_all_command_candidates, get_default_command_config, get_completion_display_order } = api;

const CFG = get_default_command_config();

function complete(input, caret = input.length, cfg = CFG, manual = false) {
    return get_command_complete(cfg, input, caret, manual);
}

function labels(result) {
    // 结果来自 vm 沙箱, 转成当前 realm 的数组再比较
    return JSON.parse(JSON.stringify(result.candidates.map(c => c.label)));
}

test('指令补全: 输入 - 列出单字符指令', () => {
    const r = complete('-');
    assert.equal(r.mode, 'single');
    assert.equal(r.candidates[0].label, 'd');
    assert.equal(r.candidates[0].kind, 'single');
    assert.equal(r.candidates[0].trailing_space, false);
    assert.deepEqual(labels(r).slice(-4), ['w', 'q', 's', 'r']);
    assert.equal(r.candidates.find(c => c.label === 'w').kind, 'terminal');
    assert.equal(r.candidates.find(c => c.label === 'w').close, true);
    // 初始状态没有空格项
    assert.equal(r.candidates.some(c => c.kind === 'space'), false);
});

test('指令补全: 选过字符后出现空格并高亮下一项', () => {
    const r = complete('-d');
    assert.equal(r.candidates[0].kind, 'space');
    assert.equal(r.candidates.some(c => c.label === 'd'), false);
    assert.equal(r.candidates[r.default_index].label, 'h');

    const chain = complete('-dhcpak');
    assert.equal(chain.candidates[0].kind, 'space');
    assert.equal(chain.candidates[chain.default_index].label, 'K');
    assert.equal(chain.candidates.some(c => ['d', 'h', 'c', 'p', 'a', 'k'].includes(c.label)), false);
});

test('指令补全: 标题级别和路径字符可以组合', () => {
    const h2 = complete('-h2');
    assert.equal(h2.mode, 'single');
    assert.equal(h2.candidates.some(c => c.label === 'h'), false);
    assert.equal(h2.candidates[h2.default_index].label, 'p');

    const path = complete('-d');
    assert.equal(path.candidates.some(c => c.label === 'a'), true);
    assert.equal(path.candidates.some(c => c.label === 'k'), true);
    assert.equal(path.candidates.some(c => c.label === 'K'), true);
});

test('指令补全: 模式指令内不补全', () => {
    assert.equal(complete('-w'), null);
    assert.equal(complete('-s'), null);
    assert.equal(complete('-s select * from blocks --'), null);
    assert.equal(complete('关键词 -q foo --'), null);
});

test('指令补全: 光标不在 token 末尾时不补全', () => {
    assert.equal(complete('-d', 1), null);
    assert.equal(complete('-d 关键词', 4), null);
    assert.equal(complete('abc'), null);
});

test('指令补全: -- 列出多字符和 kv key', () => {
    const r = complete('--');
    assert.equal(r.mode, 'key');
    const l = labels(r);
    assert.ok(l.includes('--callout'));
    assert.ok(l.includes('--type=callout'));
    assert.ok(l.includes('--time='));
    assert.ok(l.includes('--group='));
    assert.ok(l.includes('--sort='));
    // 单值固定值直接展开, 不再出现裸 key
    assert.equal(l.includes('--type='), false);
    // 多值/模板 key 保留两步
    const sort = r.candidates.find(c => c.label === '--sort=');
    assert.equal(sort.kind, 'key');
    assert.equal(sort.close, false);
    // 前缀过滤
    assert.deepEqual(labels(complete('--typ')), ['--type=callout']);
});

test('指令补全: kv 值菜单', () => {
    const sort = complete('--sort=');
    assert.equal(sort.mode, 'value');
    assert.equal(sort.chain, true);
    assert.deepEqual(labels(sort), [
        '--sort=type', '--sort=content',
        '--sort=ct:asc', '--sort=ct:desc',
        '--sort=ut:asc', '--sort=ut:desc',
    ]);
    assert.equal(sort.candidates[0].trailing_space, false);
    assert.equal(sort.candidates[0].close, false);

    const ct = complete('--sort=ct');
    assert.deepEqual(labels(ct).filter(l => l !== '␣'), ['--sort=ct:asc', '--sort=ct:desc']);

    const time = complete('--time=');
    assert.equal(time.chain, undefined);
    assert.deepEqual(labels(time), ['ct', 'ut']);
    assert.equal(time.candidates[0].trailing_space, false);

    const type = complete('--type=');
    assert.equal(type.chain, true);
    assert.deepEqual(labels(type), ['--type=callout']);
    assert.equal(type.candidates[0].trailing_space, false);
});

test('指令补全: 时间表达式逐步引导', () => {
    const field = complete('--time=c');
    assert.deepEqual(labels(field), ['ct']);
    assert.equal(field.candidates[0].insert, '--time=ct');

    const op = complete('--time=ct');
    assert.deepEqual(labels(op), ['<', '>', '=']);
    assert.equal(op.candidates[0].insert, '--time=ct<');
    assert.equal(op.candidates[0].hint, '后接日期');

    const date = complete('--time=ct<');
    assert.equal(labels(date)[0], '日期');
    assert.equal(date.candidates[0].kind, 'hint');

    // 日期输入期间不自动显示
    assert.equal(complete('--time=ct<2020'), null);

    // 手动(Tab)显示连接符和结束项
    const after = complete('--time=ct<2020', '--time=ct<2020'.length, CFG, true);
    assert.deepEqual(labels(after), ['&', '|', '␣']);
    assert.equal(after.candidates[0].insert, '--time=ct<2020&');
    assert.equal(after.candidates[1].insert, '--time=ct<2020|');
    assert.equal(after.candidates[2].kind, 'space');

    // 连接符之后回到字段
    const next_field = complete('--time=ct<2020&');
    assert.deepEqual(labels(next_field), ['ct', 'ut']);
    assert.equal(next_field.candidates[1].insert, '--time=ct<2020&ut');

    // 第二个条件完成后同样可以继续
    const done = complete('--time=ct<2020&ut=2020', '--time=ct<2020&ut=2020'.length, CFG, true);
    assert.deepEqual(labels(done), ['&', '|', '␣']);
});

test('指令补全: 时间 kv 值改名后按新名称引导', () => {
    const cfg = get_default_command_config();
    const ct = cfg.categories.find(c => c.id === 'time').items.find(i => i.id === 'ct');
    ct.comms = [{ form: 'multi', content: 'ct' }, { form: 'kv', key: '--time=', value: 'created' }];

    const field = complete('--time=', '--time='.length, cfg);
    assert.deepEqual(labels(field), ['created', 'ut']);
    assert.equal(field.candidates[0].name, '创建时间');

    const op = complete('--time=created', '--time=created'.length, cfg);
    assert.deepEqual(labels(op), ['<', '>', '=']);
    assert.equal(op.candidates[0].insert, '--time=created<');
});

test('多值链: 可逗号多值的 kv key 跟随配置', () => {
    const cfg = {
        categories: [
            { id: 'type', name: '类型', items: [{ id: 'd', name: '文档', kind: 'type', code: 'd', comms: [{ form: 'kv', key: '--t=', value: 'd' }] }] },
            { id: 'sort', name: '排序', items: [{ id: 'type', name: '按类型', kind: 'sort', value: 0, comms: [{ form: 'kv', key: '--s=', value: 'type' }] }] },
            { id: 'other', name: '其他', items: [{ id: 'x', name: 'X', kind: 'ext', comms: [{ form: 'kv', key: '--x=', value: '1' }] }] },
        ],
    };
    const keys = JSON.parse(JSON.stringify(api._get_chain_kv_keys(cfg))).sort();
    assert.deepEqual(keys, ['--s=', '--t=']);
});

test('指令补全: kv 多值链(块类型/排序)', () => {
    // 排序: 选过的值隐藏, 末尾提供空格结束项
    const sort_chain = complete('--sort=type,');
    assert.equal(sort_chain.chain, true);
    const sort_labels = labels(sort_chain);
    assert.ok(sort_labels.includes('--sort=type,content'));
    assert.ok(sort_labels.includes('--sort=type,ct:asc'));
    assert.equal(sort_labels.includes('--sort=type,type'), false);
    const sort_space = sort_chain.candidates[sort_chain.candidates.length - 1];
    assert.equal(sort_space.kind, 'space');
    assert.equal(sort_space.name, '空格（结束）');

    const sort_partial = complete('--sort=type,ct');
    assert.deepEqual(labels(sort_partial).filter(l => l !== '␣'), [
        '--sort=type,ct:asc',
        '--sort=type,ct:desc',
    ]);

    // 块类型: 开启 tabs/tab 后可以连续选择
    const cfg = get_default_command_config();
    const type_cat = cfg.categories.find(c => c.id === 'type');
    type_cat.items.find(i => i.id === 'tabs').enabled = true;
    type_cat.items.find(i => i.id === 'tab').enabled = true;
    const input = '--type=tabs,';
    const type_chain = complete(input, input.length, cfg);
    const type_labels = labels(type_chain);
    assert.ok(type_labels.includes('--type=tabs,tab'));
    assert.ok(type_labels.includes('--type=tabs,callout'));
    assert.equal(type_labels.includes('--type=tabs,tabs'), false);
    const type_space = type_chain.candidates[type_chain.candidates.length - 1];
    assert.equal(type_space.kind, 'space');
});

test('指令补全: 跟随指令配置', () => {
    const cfg = get_default_command_config();
    const type_cat = cfg.categories.find(c => c.id === 'type');
    type_cat.items.find(i => i.id === 'd').enabled = false;
    // 关闭的项不出现
    assert.equal(complete('-', 1, cfg).candidates.some(c => c.label === 'd'), false);

    const callout = type_cat.items.find(i => i.id === 'callout');
    callout.enabled = false;
    assert.equal(complete('--', 2, cfg).candidates.some(c => c.label.startsWith('--type=')), false);
});

test('指令补全: Tab 无候选时列出全部指令', () => {
    const r = get_all_command_candidates(CFG, '关键词', 3);
    assert.equal(r.mode, 'all');
    assert.equal(r.insert_at_caret, true);
    assert.equal(r.token_start, 3);
    assert.equal(r.token_end, 3);
    const l = labels(r);
    assert.ok(l.includes('-d'));
    assert.ok(l.includes('-h'));
    assert.ok(l.includes('--callout'));
    assert.ok(l.includes('--type=callout'));
    assert.ok(l.includes('--sort='));
    // 单字符插入时自带 "-" 前缀和空格, 适合直接接着输入关键词
    const d = r.candidates.find(c => c.label === '-d');
    assert.equal(d.insert, '-d');
    assert.equal(d.trailing_space, true);

    const cfg = get_default_command_config();
    cfg.categories.find(c => c.id === 'type').items.find(i => i.id === 'd').enabled = false;
    assert.equal(labels(get_all_command_candidates(cfg, '', 0)).includes('-d'), false);
});

test('指令补全: 自定义多字符形式(不以 -- 开头)也进入补全', () => {
    const cfg = get_default_command_config();
    const callout = cfg.categories.find(c => c.id === 'type').items.find(i => i.id === 'callout');
    callout.comms.push({ form: 'multi', content: 'xxcallout' });

    // -- 菜单能看到; --xx 可以继续过滤
    const all_multi = complete('--', 2, cfg);
    assert.ok(labels(all_multi).includes('xxcallout'));
    const filtered = complete('--xx', 4, cfg);
    assert.deepEqual(labels(filtered), ['xxcallout']);
    // 选中后插入的是原始形式, 不带 --
    assert.equal(filtered.candidates[0].insert, 'xxcallout');
    assert.equal(filtered.candidates[0].trailing_space, true);

    // Tab 全部指令也能看到
    const all = get_all_command_candidates(cfg, '', 0);
    assert.ok(labels(all).includes('xxcallout'));

    // 内置的特殊前缀指令(ct/g</! 等)仍然不进入补全
    const l = labels(all_multi);
    assert.equal(l.includes('ct'), false);
    assert.equal(l.includes('g<'), false);
    assert.equal(l.includes('!'), false);
});

test('指令补全: 自定义 kv key(不以 -- 开头)支持 key/值补全', () => {
    const cfg = get_default_command_config();
    const doc = cfg.categories.find(c => c.id === 'type').items.find(i => i.id === 'd');
    doc.comms.push(
        { form: 'kv', key: '@@type=', value: 'doc' },
        { form: 'kv', key: '@@type=', value: 'docx' },
        { form: 'multi', content: '@@docx' },
    );

    // 输入 @ 就按自定义前缀列出候选
    const at = complete('@', 1, cfg);
    assert.ok(labels(at).includes('@@type='));
    assert.ok(labels(at).includes('@@docx'));
    assert.ok(labels(complete('@@t', 3, cfg)).includes('@@type='));
    assert.equal(labels(complete('@@t', 3, cfg)).includes('@@docx'), false);

    // 直接输入 key 后显示值菜单
    const at_key = complete('@@type=', '@@type='.length, cfg);
    assert.equal(at_key.mode, 'value');
    assert.deepEqual(labels(at_key), ['@@type=doc', '@@type=docx']);
    // 继续输入可以过滤
    const filtered = complete('@@type=d', '@@type=d'.length, cfg);
    assert.deepEqual(labels(filtered), ['@@type=doc', '@@type=docx']);

    // -- 菜单和 Tab 全部指令能看到这个自定义 key
    assert.ok(labels(complete('--', 2, cfg)).includes('@@type='));
    const all = get_all_command_candidates(cfg, '', 0);
    const key_candidate = all.candidates.find(c => c.label === '@@type=');
    assert.ok(key_candidate);
    assert.equal(key_candidate.kind, 'key');
});

test('补全顺序预览: 设置顺序/使用次数/自定义', () => {
    const entries = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    const plain = (value) => JSON.parse(JSON.stringify(value));

    // 设置顺序: 用 entries 自身的配置顺序, 不额外指定 order
    assert.deepEqual(plain(get_completion_display_order(entries, 'config')), []);
    // 使用次数: 次数高的在前, 次数相同按配置顺序
    assert.deepEqual(plain(get_completion_display_order(entries, 'usage', [], { a: 1, b: 5, c: 3 })), ['b', 'c', 'a']);
    assert.deepEqual(plain(get_completion_display_order(entries, 'usage', [], {})), ['a', 'b', 'c']);
    // 自定义: 沿用保存的顺序
    assert.deepEqual(plain(get_completion_display_order(entries, 'custom', ['c', 'a', 'b'])), ['c', 'a', 'b']);
});

test('使用次数: 搜索页会话记录, 关闭时每个指令 +1', () => {
    const record = plugin_class.prototype.record_completion_usage;
    const flush = plugin_class.prototype.flush_usage_session;
    const plain = (value) => JSON.parse(JSON.stringify(value));
    const page = { isConnected: true };
    const ctx = {
        g_setting: { command_config: get_default_command_config() },
        completion_usage: {},
        _usage_session: new Map(),
        _completion_usage_dirty: false,
        schedule_completion_usage_save() {},
        start_usage_session_observer() {},
    };

    // 会话内多次搜索, 同一个指令只记录一次
    record.call(ctx, page, '-dh 中国');
    record.call(ctx, page, '-d 历史');
    assert.equal(ctx._usage_session.get(page).size, 2);
    assert.deepEqual(plain(ctx.completion_usage), {});

    // 页面关闭才结算, 每个用到的指令 +1
    flush.call(ctx, page);
    assert.equal(ctx._usage_session.has(page), false);
    const counts = Object.values(plain(ctx.completion_usage)).sort();
    assert.deepEqual(counts, [1, 1]);
    assert.equal(ctx._completion_usage_dirty, true);
});

test('全部指令: 包含内置多字符与路径前缀, -- 菜单不受影响', () => {
    const all = get_all_command_candidates(CFG, '', 0);
    const all_labels = labels(all);
    for (const label of [
        'ct>2025', 'ut>2025',
        'g<', 'g>', 'nog<', 'nog>',
        'type<', 'type>', 'cont<', 'cont>',
        'ct<', 'ct>', 'ut<', 'ut>',
        '!关键词', '||',
        '/路径', '//路径', '-/路径',
    ]) {
        assert.ok(all_labels.includes(label), `缺少 ${label}`);
    }

    // 示例标签只用于展示, 实际插入前缀本体
    const item = (label) => all.candidates.find(c => c.label === label);
    assert.equal(item('ct>2025').insert, 'ct');
    assert.equal(item('!关键词').insert, '!');
    assert.equal(item('/路径').insert, '/');
    assert.equal(item('//路径').insert, '//');
    assert.equal(item('g<').insert, 'g<');
    // 需要后接内容的项不加空格
    assert.equal(item('ct>2025').trailing_space, false);
    assert.equal(item('!关键词').trailing_space, false);
    assert.equal(item('/路径').trailing_space, false);
    assert.equal(item('g<').trailing_space, true);

    // -- 菜单只列 -- 形式的指令
    const dash_labels = labels(complete('--'));
    for (const label of ['ct', 'ct>2025', 'g<', '!', '/路径']) {
        assert.equal(dash_labels.includes(label), false, `-- 菜单不应出现 ${label}`);
    }
});

test('全部指令: 输入前缀后按 Tab 过滤并替换该 token', () => {
    const nog = get_all_command_candidates(CFG, 'nog', 3);
    assert.deepEqual(labels(nog), ['nog<', 'nog>']);
    assert.equal(nog.insert_at_caret, false);
    assert.equal(nog.token_start, 0);
    assert.equal(nog.token_end, 3);

    const ct = get_all_command_candidates(CFG, 'ct', 2);
    assert.deepEqual(labels(ct), ['ct>2025', 'ct<', 'ct>']);

    // 没有匹配时回退为在光标处插入全部指令
    const none = get_all_command_candidates(CFG, 'xyz', 3);
    assert.equal(none.insert_at_caret, true);
    assert.ok(labels(none).includes('nog<'));
});

test('自动补全: 特殊多字符指令输入 2 个字符后按前缀弹出', () => {
    assert.deepEqual(labels(complete('no')), ['nog<', 'nog>']);
    assert.deepEqual(labels(complete('ty')), ['type<', 'type>']);
    assert.deepEqual(labels(complete('ct')), ['ct>2025', 'ct<', 'ct>']);
    assert.deepEqual(labels(complete('!')), ['!关键词']);
    assert.deepEqual(labels(complete('/')), ['/路径', '//路径']);

    // 普通词、单字母、输入已完整且只剩自身时不弹
    assert.equal(complete('g'), null);
    assert.equal(complete('xyz'), null);
    assert.equal(complete('ct<'), null);
});

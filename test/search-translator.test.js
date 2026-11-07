'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api } = load_plugin();
const {
    search_translator,
    get_default_command_config,
    build_command_registry,
    validate_command_config,
    get_item_display_forms,
    get_command_editor_html,
    get_command_editor_form_html,
} = api;

const BASE_ARG = {
    idPath: [],
    types: {},
    hPath: '/页面/路径',
    group: 0,
    sort: 0,
    ignoredInputs: ['/', '//', '-', '--'],
};

function parse(query, overrides = {}) {
    // 插件源码运行在 vm 沙箱里, 返回值是另一个 realm 的对象;
    // 转成当前 realm 的普通对象后再做 deepEqual
    return JSON.parse(JSON.stringify(search_translator({ ...BASE_ARG, ...overrides, query })));
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function block_types(result) {
    return Object.keys(result.help.block_type).sort();
}

// 复制默认配置并临时启用指定的类型项(默认配置里部分新类型是关闭的)
function config_with_enabled(ids) {
    const cfg = get_default_command_config();
    const type_cat = cfg.categories.find(cat => cat.id === 'type');
    for (const item of type_cat.items) {
        if (ids.includes(item.id)) item.enabled = true;
    }
    return cfg;
}

test('普通关键词: 默认走关键词搜索', () => {
    const r = parse('关键词');
    assert.equal(r.type, '-w');
    assert.deepEqual(r.keywords, ['关键词']);
    assert.equal(r.val, '关键词');
    assert.deepEqual(r.help.errors, []);
});

test('搜索方式: -w / -q / -s / -r', () => {
    assert.equal(parse('-w 关键词').type, '-w');
    assert.equal(parse('-q a b').type, '-q');
    assert.equal(parse('-q a b').val, 'a b');
    assert.equal(parse('-r abc').type, '-r');
    assert.equal(parse('-r abc').val, 'abc');
});

test('搜索方式: 显式 -w 多词按空白拆分关键词', () => {
    const multi = parse('-w 中国 历史');
    assert.equal(multi.type, '-w');
    // 实际搜索内容不变, 只拆 keywords 供解析展示/光标定位使用
    assert.equal(multi.val, '中国 历史');
    assert.deepEqual(multi.keywords, ['中国', '历史']);

    const spaces = parse('-w   中国   历史  ');
    assert.equal(spaces.val, '中国   历史');
    assert.deepEqual(spaces.keywords, ['中国', '历史']);

    const dup = parse('-w 123 123 456');
    assert.equal(dup.val, '123 123 456');
    assert.deepEqual(dup.keywords, ['123', '456']);
});

test('关键词: 重复关键词去重(与思源一致)', () => {
    assert.deepEqual(parse('123 123').keywords, ['123']);
    assert.deepEqual(parse('b a b').keywords, ['b', 'a']);
    assert.deepEqual(parse('-d 中国 中国').keywords, ['中国']);
});

test('预览高亮: 显式模式提取高亮词, 不影响光标定位关键词', () => {
    const w = parse('-w 中国 历史');
    assert.equal(w.help.mode_explicit, true);
    assert.deepEqual(w.help.preview_keywords, ['中国', '历史']);

    const q = parse('-q中国 AND 历史 NOT 苏联');
    assert.equal(q.help.mode_explicit, true);
    assert.deepEqual(q.help.preview_keywords, ['中国', '历史']);
    // 光标定位仍用 keywords, 显式模式保持为空
    assert.deepEqual(q.keywords, []);

    const q_field = parse('-q(content:中国) OR -苏联');
    assert.deepEqual(q_field.help.preview_keywords, ['中国']);

    const q_phrase = parse('-q"中国 历史" OR 文化');
    assert.deepEqual(q_phrase.help.preview_keywords, ['中国 历史', '文化']);

    // 正则走正则高亮, 不提取字面量
    const r = parse('-r中国.*历史');
    assert.equal(r.help.mode_explicit, true);
    assert.deepEqual(r.help.preview_keywords, []);

    // 插件生成的 SQL 用结构化关键词
    const sql = parse('-p 123');
    assert.equal(sql.help.mode_explicit, false);
    assert.deepEqual(sql.help.preview_keywords, ['123']);

    // 普通关键词不是显式模式
    assert.equal(parse('中国 历史').help.mode_explicit, false);
});

test('SQL: 只清理插件生成 SQL 的 and true 占位', () => {
    // 用户手写的 -s SQL 原样保留, 包括字符串字面量里的 and true
    const user_sql = "select * from blocks where content like '%and true %'";
    const explicit = parse('-s' + user_sql);
    assert.equal(explicit.val, user_sql);

    // 普通关键词里的 and true 也不能被删
    const plain = parse('and true story');
    assert.equal(plain.val, 'and true story');
    assert.deepEqual(plain.keywords, ['and', 'true', 'story']);
    assert.equal(parse('sand true story').val, 'sand true story');

    // 插件拼出的 SQL 仍按原逻辑清理占位
    const generated = parse('-d 中国');
    assert.equal(generated.type, '-s');
    assert.equal(generated.val.includes('and true'), false);
});

test('搜索方式: SQL 紧贴写法和任意位置', () => {
    const glued = parse('-sselect * from blocks');
    assert.equal(glued.type, '-s');
    assert.equal(glued.val, 'select * from blocks');

    const anywhere = parse('关键词 -q');
    assert.equal(anywhere.type, '-q');
    assert.equal(anywhere.val, '关键词');

    const word_glued = parse('-w关键词');
    assert.equal(word_glued.type, '-w');
    assert.equal(word_glued.val, '关键词');
});

test('类型过滤: 单字符和组合', () => {
    const single = parse('-d');
    assert.equal(single.type, '-s');
    assert.deepEqual(block_types(single), ['d']);
    assert.match(single.val, /type regexp '\^\[d\]\$'/);

    const combo = parse('-dp');
    assert.deepEqual(block_types(combo), ['d', 'p']);
    assert.match(combo.val, /type regexp '\^\[dp\]\$'/);
    assert.equal(combo.help.sort, '类型排序(文档块 → 段落块)');
});

test('类型过滤: 标题级别', () => {
    const r = parse('-h13');
    assert.deepEqual(block_types(r), ['h13']);
    assert.match(r.val, /subtype regexp '\^h\[13\]\$'/);
});

test('类型过滤: 待办和链接块', () => {
    const todo = parse('-o');
    assert.deepEqual(block_types(todo), ['o']);
    assert.match(todo.val, /markdown like '%\[ \] %'/);

    const done = parse('-O');
    assert.deepEqual(block_types(done), ['O']);
    assert.match(done.val, /markdown like '%\[x\] %'/);

    const link = parse('-L');
    assert.deepEqual(block_types(link), ['L']);
    assert.match(link.val, /markdown like '%\[%\]\(%\)%'/);
});

test('类型过滤: 多字符类型和 kv 类型', () => {
    const multi = parse('--callout');
    assert.deepEqual(block_types(multi), ['callout']);
    assert.match(multi.val, /type in \('callout'\)/);

    const kv = parse('--type=callout');
    assert.deepEqual(block_types(kv), ['callout']);
    assert.match(kv.val, /type in \('callout'\)/);
});

test('类型过滤: kv 逗号多值和类型排序顺序', () => {
    const cfg = config_with_enabled(['audio', 'video']);
    const r = parse('--type=audio,video', { command_config: cfg });
    assert.deepEqual(block_types(r), ['audio', 'video']);
    assert.match(r.val, /type in \('audio','video'\)/);
    assert.match(r.val, /when 'audio' then 0 when 'video' then 1/);
});

test('类型过滤: 输入顺序决定类型排序', () => {
    const r = parse('--callout -m');
    assert.deepEqual(block_types(r), ['callout', 'm']);
    assert.match(r.val, /when 'callout' then 0 when 'm' then 1/);
});

test('类型过滤: 关闭的项按关键词搜索并提示', () => {
    const r = parse('--audio');
    assert.equal(r.type, '-w');
    assert.deepEqual(r.keywords, ['--audio']);
    assert.deepEqual(r.help.errors, ['指令已关闭, 已按关键词搜索: --audio（音频块）']);
});

test('类型过滤: 组合里含关闭项时整个 token 退化为关键词', () => {
    const r = parse('-dS');
    assert.equal(r.type, '-w');
    assert.deepEqual(r.keywords, ['-dS']);
    assert.deepEqual(block_types(r), []);
    assert.deepEqual(r.help.errors, ['指令已关闭, 已按关键词搜索: -dS（超级块）']);
});

test('未知指令按关键词搜索并提示', () => {
    const r = parse('--Callout');
    assert.equal(r.type, '-w');
    assert.deepEqual(r.keywords, ['--Callout']);
    assert.deepEqual(r.help.errors, ['未识别的指令, 已按关键词搜索: --Callout']);
});

test('路径过滤: 路径最后一段作为文档名关键词', () => {
    const r = parse('/笔记/项目');
    assert.deepEqual(r.help.custom_path, ['*笔记*/*项目*']);
    assert.deepEqual(r.keywords, ['项目']);
    assert.deepEqual(block_types(r), ['d']);
    assert.match(r.val, /hpath like '%笔记%\/%项目%' escape '!'/);
});

test('路径过滤: 全文档开关与路径一起使用', () => {
    const r = parse('//笔记/项目');
    assert.deepEqual(r.help.custom_path, ['*笔记*/*项目*']);
    assert.deepEqual(r.keywords, ['项目']);
});

test('路径过滤: 显式块类型时路径不再强制仅文档', () => {
    // 无显式类型: 最后一段仍作为文档名, 只搜文档
    const pure = parse('/笔记/项目');
    assert.deepEqual(pure.keywords, ['项目']);
    assert.match(pure.val, /type regexp '\^\[d\]\$' and content like '%项目%'/);

    // 显式类型: 路径按普通路径过滤, 不再附加文档名条件
    for (const query of ['/笔记/项目 -p', '/笔记/项目 -d', '/笔记/项目 -dhp']) {
        const r = parse(query);
        assert.deepEqual(r.keywords, []);
        assert.deepEqual(r.help.custom_path, ['*笔记*/*项目*']);
        assert.match(r.val, /hpath like '%笔记%\/%项目%' escape '!'/);
        assert.doesNotMatch(r.val, /content like '%项目%'/);
    }
    assert.match(parse('/笔记/项目 -p').val, /type regexp '\^\[p\]\$'/);
});

test('路径过滤: 排除路径', () => {
    const r = parse('-/笔记');
    assert.deepEqual(r.help.excludedPath, ['*笔记*']);
    assert.match(r.val, /not \(\(hpath like '%笔记%' escape '!'\)/);
});

test('路径过滤: 当前文档和当前文档及子文档', () => {
    const current = parse('-k');
    assert.match(current.val, /path like '%doc123\.sy' escape '!'/);

    const tree = parse('-K');
    assert.match(tree.val, /path regexp 'doc123'/);
});

test('路径过滤: 找不到当前文档时提示并忽略 -k', () => {
    const { api: api_no_doc } = load_plugin({ focus_doc: null });
    const r = api_no_doc.search_translator({ ...BASE_ARG, query: '-k' });
    assert.match(r.help.errors.join('\n'), /未找到当前文档/);
    assert.doesNotMatch(r.val, /path like/);
});

test('路径过滤: 笔记本名匹配', () => {
    const r = parse('/笔记');
    assert.match(r.val, /box in \('box_note'\)/);
});

test('时间过滤: 单条件和 and/or', () => {
    const single = parse('ct>2025');
    assert.equal(single.help.custom_time.length, 1);
    assert.match(single.val, /created>'20250000000000'/);

    const combo = parse('--time=ct>2025&ut<2026');
    assert.equal(combo.help.custom_time.length, 1);
    assert.match(combo.val, /created>'20250000000000' and updated<'20260000000000'/);
});

test('时间过滤: 不是合法时间表达式时退化为关键词', () => {
    for (const word of ['ctrl', 'utf-8', 'utter', 'ctf', 'ct', 'ct>abc', 'ct=abc', 'ut=']) {
        const r = parse(word);
        assert.equal(r.type, '-w');
        assert.deepEqual(r.keywords, [word]);
        assert.deepEqual(r.help.errors, []);
        assert.equal(r.val, word);
    }
    // 有关键词时, 普通单词也不会被吞掉
    const combo = parse('ctrl 历史');
    assert.deepEqual(combo.keywords, ['ctrl', '历史']);
    assert.deepEqual(combo.help.errors, []);
    // 合法表达式仍然按时间过滤; ct< 单独出现仍是排序指令
    assert.equal(parse('ct>2025').help.custom_time.length, 1);
    assert.equal(parse('ct<').help.sort, '创建时间升序(指定)');
});

test('识别摘要: 只记录被消费的指令 token', () => {
    // 没有识别到指令时不记录
    assert.deepEqual(parse('历史').help.recognized, []);
    assert.deepEqual(parse('ctrl').help.recognized, []);

    // 原样展示, 保持输入顺序, 并提供悬浮说明
    const r = parse('历史 -dhcp !草稿');
    assert.deepEqual(r.help.recognized, [
        { token: '-dhcp', desc: '文档块、标题块、代码块、段落块' },
        { token: '!草稿', desc: '排除关键词' },
    ]);

    // 重复 token 只保留第一次
    const dedupe = parse('-d -d /a ct>2025');
    assert.deepEqual(dedupe.help.recognized.map(item => item.token), ['-d', '/a', 'ct>2025']);
    assert.equal(dedupe.help.recognized[2].desc, '创建时间 >2025');

    // 粘连模式只显示被识别的模式部分
    const mode = parse('-sselect * from blocks');
    assert.deepEqual(mode.help.recognized, [{ token: '-s', desc: 'SQL' }]);

    // 标题级别、kv 形式
    assert.equal(parse('-h13 历史').help.recognized[0].desc, '标题块（1,3级）');
    assert.equal(parse('--sort=ct:asc').help.recognized[0].desc, '创建时间升序');
});

test('分组: g< / nog<', () => {
    const grouped = parse('g<');
    assert.equal(grouped.help.group_desc, '按文档分组(指定)');
    assert.match(grouped.val, /order by box ASC, hpath ASC/);

    const none = parse('nog<');
    assert.equal(none.help.group_desc, '不分组(指定)');
});

test('排序: 单字符和 kv 多值', () => {
    const by_ct = parse('ct<');
    assert.equal(by_ct.help.sort, '创建时间升序(指定)');
    assert.match(by_ct.val, /order by created ASC/);

    const kv = parse('--sort=ct:asc,ut:desc');
    assert.equal(kv.help.sort, '创建时间升序 → 更新时间降序(指定)');
    assert.match(kv.val, /order by created ASC, updated DESC/);
});

test('排除关键词和文档模式', () => {
    // 只有排除词: 思源查询语法不支持 NOT 开头, 改走 SQL
    const excluded = parse('!草稿', { types: { paragraph: true } });
    assert.equal(excluded.type, '-s');
    assert.deepEqual(excluded.help.excluded, ['草稿']);
    assert.match(excluded.val, /content not like '%草稿%'/);
    assert.equal(excluded.val.includes('NOT 草稿'), false);
    // 沿用页面类型过滤
    assert.match(excluded.val, /type in \('p'\)/);

    // 有关键词 + 排除词: 仍走查询语法
    const both = parse('!草稿 关键词');
    assert.equal(both.type, '-q');
    assert.deepEqual(both.keywords, ['关键词']);
    assert.deepEqual(both.help.excluded, ['草稿']);
    assert.match(both.val, /关键词 NOT 草稿/);

    const doc_mode = parse('||');
    assert.equal(doc_mode.help.group_file, true);
});

test('类型过滤: 未指定时使用页面配置的类型', () => {
    const r = parse('-w 关键词', { types: { document: true, paragraph: true } });
    assert.deepEqual(block_types(r), ['d', 'p']);
});

test('配置: 自定义单字符后按新指令解析', () => {
    const cfg = get_default_command_config();
    const doc_item = cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'd');
    doc_item.comms = [{ form: 'single', content: 'x' }];

    const custom = parse('-x', { command_config: cfg });
    assert.deepEqual(block_types(custom), ['d']);

    const old = parse('-d', { command_config: cfg });
    assert.deepEqual(old.help.errors, ['未识别的指令, 已按关键词搜索: -d']);
});

test('配置: 新增 kv 形式后可以解析', () => {
    const cfg = get_default_command_config();
    const current = cfg.categories.find(cat => cat.id === 'path')
        .items.find(item => item.id === 'current');
    current.comms.push({ form: 'kv', key: '--current=', value: 'doc' });

    const r = parse('--current=doc', { command_config: cfg });
    assert.equal(r.help.path, '当前文档');
});

test('配置: 默认配置合法且重复项会被拒绝', () => {
    const cfg = get_default_command_config();
    assert.equal(validate_command_config(cfg), '');

    cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p')
        .comms.push({ form: 'single', content: 'd' });
    assert.equal(validate_command_config(cfg), '单字符重复: d');
});

test('配置: 关闭的项不参与注册和重复校验', () => {
    const cfg = get_default_command_config();
    assert.equal(build_command_registry(cfg).multi_exact.has('--audio'), false);
    assert.equal(build_command_registry(cfg).multi_exact.has('--callout'), true);

    // 默认关闭的 p 加上与 d 重复的单字符, 不应报错
    const paragraph = cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p');
    paragraph.enabled = false;
    paragraph.comms.push({ form: 'single', content: 'd' });
    assert.equal(validate_command_config(cfg), '');
});

test('展示形式: 超块和路径前缀', () => {
    const cfg = get_default_command_config();
    const super_item = cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 's');
    assert.deepEqual(plain(get_item_display_forms(super_item)), ['-S']);

    const path_item = cfg.categories.find(cat => cat.id === 'path')
        .items.find(item => item.id === 'path');
    assert.deepEqual(plain(get_item_display_forms(path_item)), ['/路径']);
});

test('忽略的输入: 单独 - / -- 不参与解析', () => {
    for (const query of ['-', '--', '/', '//']) {
        const r = parse(query);
        assert.deepEqual(r.keywords, []);
        assert.deepEqual(r.help.errors, []);
    }
});

// ===== 组合查询 =====
const PAGE_TYPES = {
    document: true, paragraph: true, heading: true, codeBlock: true,
    list: true, listItem: true, table: true, blockquote: true, mathBlock: true,
};

test('组合: 类型 + 关键词', () => {
    const r = parse('-dp 关键词');
    assert.equal(r.type, '-s');
    assert.deepEqual(block_types(r), ['d', 'p']);
    assert.deepEqual(r.keywords, ['关键词']);
    assert.match(r.val, /content like '%关键词%' escape '!'/);
    assert.match(r.val, /type regexp '\^\[dp\]\$'/);
});

test('组合: 类型 + 路径 + 时间 + 分组 + 排序 + 关键词', () => {
    const r = parse('-dp /笔记 ct>2025 g< ct< 关键词');
    assert.equal(r.type, '-s');
    assert.deepEqual(block_types(r), ['d', 'p']);
    assert.deepEqual(r.help.custom_path, ['*笔记*']);
    assert.equal(r.help.custom_time.length, 1);
    assert.equal(r.help.group_desc, '按文档分组(指定)');
    assert.equal(r.help.sort, '文档路径升序 → 文档内按创建时间升序(指定)');
    assert.deepEqual(r.keywords, ['关键词']);
    assert.match(r.val, /created>'20250000000000'/);
});

test('组合: 多个路径条件同时生效', () => {
    const r = parse('/a /b');
    assert.deepEqual(r.help.custom_path, ['*a*', '*b*']);
    assert.deepEqual(r.keywords, ['a', 'b']);
    assert.deepEqual(block_types(r), ['d']);
});

test('组合: 多个排除路径同时生效', () => {
    const r = parse('-/a -/b');
    assert.deepEqual(r.help.excludedPath, ['*a*', '*b*']);
    assert.match(r.val, /not \(\(hpath like '%a%' escape '!'\)\)/);
    assert.match(r.val, /not \(\(hpath like '%b%' escape '!'\)\)/);
});

test('组合: 文档模式 + 类型 + 关键词', () => {
    const r = parse('|| -dp 关键词');
    assert.equal(r.help.group_file, true);
    assert.deepEqual(block_types(r), ['d', 'p']);
    assert.deepEqual(r.keywords, ['关键词']);
    assert.match(r.val, /root_id in \(select root_id from blocks/);
});

test('组合: 全文档开关 + 关键词', () => {
    const r = parse('-a 关键词', { types: PAGE_TYPES });
    assert.equal(r.help.path, '全部');
    assert.deepEqual(r.keywords, ['关键词']);
    assert.doesNotMatch(r.val, /hpath like/);
    assert.match(r.val, /content like '%关键词%' escape '!'/);
});

test('组合: 当前文档 + 关键词', () => {
    const r = parse('-k 关键词', { types: PAGE_TYPES });
    assert.equal(r.help.path, '当前文档');
    assert.match(r.val, /path like '%doc123\.sy' escape '!'/);
    assert.match(r.val, /content like '%关键词%' escape '!'/);
});

test('组合: 当前文档及子文档 + 关键词', () => {
    const r = parse('-K 关键词', { types: PAGE_TYPES });
    assert.equal(r.help.path, '当前文档及子文档');
    assert.match(r.val, /path regexp 'doc123'/);
});

// ===== 时间边界 =====
test('时间: = 表示前缀匹配', () => {
    const r = parse('ct=20251001');
    assert.match(r.help.custom_time[0], /\*\*:\*\*:\*\*/);
    assert.match(r.val, /created like '20251001%'/);
});

test('时间: 裸前缀非法格式退化为关键词, kv 形式仍提示', () => {
    const bad = parse('ct>abc');
    assert.equal(bad.type, '-w');
    assert.deepEqual(bad.keywords, ['ct>abc']);
    assert.deepEqual(bad.help.errors, []);

    const bad_kv = parse('--time=xx>2025');
    assert.deepEqual(bad_kv.help.errors, ['未识别的值: xx>2025']);
});

test('时间: | 表示或者', () => {
    const r = parse('ct>2025|ut<2026');
    assert.match(r.val, /created>'20250000000000' or updated<'20260000000000'/);
});

test('时间: kv 精确到秒', () => {
    const r = parse('--time=ut=20251001123456');
    assert.match(r.val, /updated like '20251001123456%'/);
});

// ===== 分组与排序 =====
test('分组: kv 写法', () => {
    const doc = parse('--group=doc');
    assert.equal(doc.help.group_desc, '按文档分组(指定)');
    assert.match(doc.val, /order by box ASC, hpath ASC/);

    const none = parse('--group=none');
    assert.equal(none.help.group_desc, '不分组(指定)');
});

test('分组: 多次指定时最后一次生效', () => {
    const r = parse('--group=doc --group=none');
    assert.equal(r.help.group_desc, '不分组(指定)');
});

test('排序: 多个排序条件累加', () => {
    const r = parse('ct< ut>');
    assert.equal(r.help.sort, '创建时间升序 → 更新时间降序(指定)');
    assert.match(r.val, /order by created ASC, updated DESC/);
});

test('排序: 重复的排序条件去重', () => {
    const r = parse('ct< ct<');
    assert.equal(r.help.sort, '创建时间升序(指定)');
    assert.match(r.val, /order by created ASC$/);
});

test('排序: 分组与排序组合', () => {
    const r = parse('g< ct>');
    assert.equal(r.help.group_desc, '按文档分组(指定)');
    assert.equal(r.help.sort, '文档路径升序 → 文档内按创建时间降序(指定)');
    assert.match(r.val, /order by box ASC, hpath ASC\s*,\s*created DESC/);
});

test('排序: kv 写法可以混合类型和时间', () => {
    const r = parse('--sort=type,ct:desc');
    assert.equal(r.help.sort, '类型排序 → 创建时间降序(指定)');
    assert.match(r.val, /order by case type/);
    assert.match(r.val, /created DESC/);
});

test('排序: 未识别的值给出提示', () => {
    const r = parse('--sort=unknown');
    assert.deepEqual(r.help.errors, ['未识别的值: unknown']);
});

// ===== 类型细节 =====
test('类型: 重复指定只生效一次', () => {
    const r = parse('--callout --callout');
    assert.deepEqual(block_types(r), ['callout']);
    // 只有一种类型时, 类型排序没有意义, 不生成 CASE
    assert.doesNotMatch(r.val, /order by case type/);

    const r2 = parse('--callout --callout -d');
    assert.equal((r2.val.match(/when 'callout' then/g) || []).length, 1);
    assert.equal((r2.val.match(/when 'd' then/g) || []).length, 1);
});

test('类型排序: 只列出实际会出现的类型', () => {
    // 单类型不生成类型排序
    assert.doesNotMatch(parse('/sql').val, /order by case type/);

    // 多种类型时只列出相关类型, 顺序与默认一致
    const multi = parse('关键词 ct>2025', { types: { document: true, heading: true, paragraph: true } });
    assert.match(multi.val, /order by case type when 'd' then 1 when 'h' then 2 when 'p' then 4 end/);
    assert.doesNotMatch(multi.val, /when 'i' then/);

    // 未知类型回退全量默认顺序
    const unknown = parse('关键词 ct>2025', { types: { xyz: true } });
    assert.match(unknown.val, /when 'tb' then 24/);
});

test('页面子类型过滤: 标题级别和列表类型', () => {
    const h2 = parse('关键词 ct>2025', {
        types: { heading: true },
        subTypes: { heading: { h2: true } },
    });
    assert.match(h2.val, /type = 'h' and subtype in \('h2'\)/);
    assert.deepEqual(block_types(h2), ['h2']);

    const multi = parse('关键词 ct>2025', {
        types: { heading: true },
        subTypes: { heading: { h2: true, h4: true } },
    });
    assert.match(multi.val, /subtype in \('h2','h4'\)/);

    // 全选等同于不限制子类型
    const all = parse('关键词 ct>2025', {
        types: { heading: true },
        subTypes: { heading: { h1: true, h2: true, h3: true, h4: true, h5: true, h6: true } },
    });
    assert.match(all.val, /type in \('h'\)/);
    assert.doesNotMatch(all.val, /subtype in/);

    // 旧版本没有 subTypes
    const legacy = parse('关键词 ct>2025', { types: { heading: true } });
    assert.match(legacy.val, /type in \('h'\)/);

    // 列表子类型
    const list = parse('关键词 ct>2025', {
        types: { list: true },
        subTypes: { list: { o: true } },
    });
    assert.match(list.val, /type = 'l' and subtype in \('o'\)/);

    // 非 SQL 模式由原生过滤, 辅助信息也应显示具体级别
    const plainQuery = parse('-w 关键词', {
        types: { heading: true },
        subTypes: { heading: { h3: true } },
    });
    assert.deepEqual(block_types(plainQuery), ['h3']);
});

test('类型: 单独 -h 和全部标题级别', () => {
    const all = parse('-h');
    assert.deepEqual(block_types(all), ['h']);
    assert.match(all.val, /type regexp '\^\[h\]\$'/);

    const levels = parse('-h123456');
    assert.deepEqual(block_types(levels), ['h123456']);
    assert.match(levels.val, /subtype regexp '\^h\[123456\]\$'/);
});

test('类型: 标题级别与其他类型组合', () => {
    const r = parse('-dh2p');
    assert.deepEqual(block_types(r), ['d', 'h2', 'p']);
    assert.match(r.val, /subtype regexp '\^h\[2\]\$'/);
});

test('类型: kv 中有效值和无效值混合', () => {
    const r = parse('--type=callout,unknown');
    assert.deepEqual(block_types(r), ['callout']);
    assert.deepEqual(r.help.errors, ['未识别的值: unknown']);
});

test('类型: kv 缺少值', () => {
    assert.deepEqual(parse('--type=').help.errors, ['kv 指令缺少值: ']);
    assert.deepEqual(parse('--group=').help.errors, ['kv 指令缺少值: ']);
    assert.deepEqual(parse('--sort=').help.errors, ['kv 指令缺少值: ']);
});

test('类型: kv 中出现关闭项时整个 token 退化为关键词', () => {
    const r = parse('--type=audio,callout');
    assert.equal(r.type, '-w');
    assert.deepEqual(r.keywords, ['--type=audio,callout']);
    assert.deepEqual(block_types(r), []);
    assert.deepEqual(r.help.errors, ['指令已关闭, 已按关键词搜索: --type=audio,callout（音频块）']);
});

test('类型: 大小写敏感', () => {
    assert.deepEqual(parse('-D').keywords, ['-D']);
    assert.deepEqual(parse('-e').keywords, ['-e']);
    assert.match(parse('-D').help.errors[0], /未识别的指令/);
});

test('类型: 启用超级块后 -S 生效, -s 仍是 SQL 模式', () => {
    const cfg = get_default_command_config();
    cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 's').enabled = true;

    const super_block = parse('-S', { command_config: cfg });
    assert.deepEqual(block_types(super_block), ['s']);

    const sql_mode = parse('-sselect * from blocks', { command_config: cfg });
    assert.equal(sql_mode.type, '-s');
    assert.equal(sql_mode.val, 'select * from blocks');
});

// ===== 模式边界与空输入 =====
test('模式: 出现在关键词后面时, 前面的内容作为查询', () => {
    const r = parse('关键词 -s');
    assert.equal(r.type, '-s');
    assert.equal(r.val, '关键词');
});

test('模式: 出现后不再解析其他指令', () => {
    const r = parse('-dp -s select * from blocks');
    assert.equal(r.type, '-s');
    assert.equal(r.val, '-dp select * from blocks');
    assert.deepEqual(block_types(r), []);
});

test('模式: 单独输入时搜索内容为空', () => {
    for (const [query, type] of [['-s', '-s'], ['-w', '-w'], ['-q', '-q'], ['-r', '-r']]) {
        const r = parse(query);
        assert.equal(r.type, type);
        assert.equal(r.val, '');
    }
});

test('空输入和纯空白不产生搜索内容', () => {
    for (const query of ['', '   ', '  ']) {
        const r = parse(query);
        assert.equal(r.type, '-w');
        assert.equal(r.val, '');
        assert.deepEqual(r.keywords, []);
    }
});

test('单字符 ! 按普通关键词处理', () => {
    const r = parse('!');
    assert.deepEqual(r.keywords, ['!']);
});

// ===== SQL 转义 =====
test('转义: LIKE 通配符 % _ !', () => {
    assert.match(parse('-d 50%').val, /'%50!%%'/);
    assert.match(parse('-d a_b').val, /'%a!_b%'/);
    assert.match(parse('-d a!b').val, /'%a!!b%'/);
});

test('转义: 单引号', () => {
    assert.match(parse("-d a'b").val, /'%a''b%'/);
});

test('转义: 路径中的通配符', () => {
    const r = parse('/50%');
    assert.deepEqual(r.help.custom_path, ['*50%*']);
    assert.match(r.val, /hpath like '%50!%%' escape '!'/);
});

// ===== 环境相关 =====
test('环境: 关闭的笔记本不参与笔记本名匹配', () => {
    const closed = load_plugin({
        notebooks: [{ id: 'closed_box', name: '笔记', closed: true }],
    });
    const r = JSON.parse(JSON.stringify(closed.api.search_translator({
        ...BASE_ARG, query: '/笔记',
    })));
    assert.doesNotMatch(r.val, /box in/);
});

test('环境: 找不到当前文档时 -k 不加路径条件', () => {
    const no_focus = load_plugin({ focus_doc: null });
    const r = JSON.parse(JSON.stringify(no_focus.api.search_translator({
        ...BASE_ARG, query: '-k',
    })));
    assert.doesNotMatch(r.val, /path like/);
});

test('环境: 自定义忽略输入会阻止搜索', () => {
    const r = parse('abc', { ignoredInputs: ['abc'] });
    assert.equal(r.blocked, true);
    assert.deepEqual(r.keywords, []);
    assert.equal(r.val, '');
});

test('环境: 页面配置里未知的类型 key 原样显示', () => {
    const r = parse('-w x', { types: { fooBlock: true } });
    assert.deepEqual(plain(r.help.block_type), { fooBlock: '' });
});

test('环境: 页面配置的新块类型映射正确', () => {
    const r = parse('-w x', { types: { audioBlock: true } });
    assert.deepEqual(plain(r.help.block_type), { audio: '音频块' });
});

// ===== 配置与注册表 =====
test('配置: 给旧类型增加多字符别名', () => {
    const cfg = get_default_command_config();
    cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'd')
        .comms.push({ form: 'multi', content: '--doc' });

    assert.deepEqual(block_types(parse('--doc', { command_config: cfg })), ['d']);
    assert.deepEqual(block_types(parse('-d', { command_config: cfg })), ['d']);
});

test('配置: 移除所有形式后该指令不再生效', () => {
    const cfg = get_default_command_config();
    cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p').comms = [];

    const r = parse('-p', { command_config: cfg });
    assert.deepEqual(block_types(r), []);
    assert.deepEqual(r.help.errors, ['未识别的指令, 已按关键词搜索: -p']);
});

test('配置: 关闭模式指令后不再按该模式解析', () => {
    const cfg = get_default_command_config();
    cfg.categories.find(cat => cat.id === 'mode')
        .items.find(item => item.id === 'sql').enabled = false;

    const r = parse('-sselect * from blocks', { command_config: cfg });
    assert.equal(r.type, '-w');
    assert.deepEqual(r.help.errors, ['未识别的指令, 已按关键词搜索: -sselect']);
});

test('配置: 重复的多字符和 kv 也会被拒绝', () => {
    const cfg = get_default_command_config();
    const paragraph = cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p');
    paragraph.comms.push({ form: 'multi', content: '--callout' });
    assert.equal(validate_command_config(cfg), '多字符重复: --callout');

    const cfg2 = get_default_command_config();
    const paragraph2 = cfg2.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p');
    paragraph2.comms.push({ form: 'kv', key: '--type=', value: 'callout' });
    assert.equal(validate_command_config(cfg2), 'kv 重复: --type=callout');
});

test('配置: 空多字符、超长单字符、未知形式会被拒绝', () => {
    const empty_multi = get_default_command_config();
    empty_multi.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p')
        .comms.push({ form: 'multi', content: '' });
    assert.equal(validate_command_config(empty_multi), '多字符不能为空: p');

    const long_single = get_default_command_config();
    long_single.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p')
        .comms.push({ form: 'single', content: 'xy' });
    assert.equal(validate_command_config(long_single), '单字符必须是 1 个字符: xy');

    const bad_form = get_default_command_config();
    bad_form.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'p')
        .comms.push({ form: 'foo' });
    assert.equal(validate_command_config(bad_form), '未知的指令形式: foo');
});

test('注册表: 前缀、kv 和关闭项', () => {
    const reg = build_command_registry(get_default_command_config());
    const prefixes = reg.multi_prefix.map(item => item.token);
    for (const token of ['/', '//', '-/', 'ct', 'ut', '!']) {
        assert.ok(prefixes.includes(token), `缺少前缀 ${token}`);
    }
    assert.ok(reg.kv_groups.has('--type='));
    assert.ok(reg.kv_groups.has('--sort='));
    assert.equal(reg.multi_exact.has('--audio'), false);
    assert.ok(reg.disabled_single.has('S'));
});

test('展示形式: 多种形式按配置顺序展示', () => {
    const cfg = get_default_command_config();
    const audio = cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'audio');
    assert.deepEqual(plain(get_item_display_forms(audio)), ['--audio', '--type=audio']);

    const ct_asc = cfg.categories.find(cat => cat.id === 'sort')
        .items.find(item => item.id === 'ct_asc');
    assert.deepEqual(plain(get_item_display_forms(ct_asc)), ['ct<', '--sort=ct:asc']);
});

// 复制默认配置并给标题项追加形式
function config_with_heading_forms(forms) {
    const cfg = get_default_command_config();
    cfg.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'h')
        .comms.push(...forms);
    return cfg;
}

test('标题: 多次指定级别取并集', () => {
    const r = parse('-h1 -h3');
    assert.deepEqual(block_types(r), ['h1', 'h3']);
    assert.match(r.val, /subtype regexp '\^h\[13\]\$'/);

    // 指定了不带级别的 -h 时表示所有标题
    const all = parse('-h -h3');
    assert.doesNotMatch(all.val, /subtype regexp/);
});

test('标题: 多字符形式可以带级别', () => {
    const cfg = config_with_heading_forms([{ form: 'multi', content: '--heading' }]);

    const ok = parse('--heading13', { command_config: cfg });
    assert.deepEqual(block_types(ok), ['h13']);
    assert.match(ok.val, /subtype regexp '\^h\[13\]\$'/);

    const all = parse('--heading', { command_config: cfg });
    assert.deepEqual(block_types(all), ['h']);
    assert.deepEqual(all.help.errors, []);

    const bad = parse('--heading7', { command_config: cfg });
    assert.deepEqual(bad.keywords, ['--heading7']);
    assert.deepEqual(bad.help.errors, ['未识别的指令, 已按关键词搜索: --heading7']);
});

test('标题: kv 形式可以带级别', () => {
    const cfg = config_with_heading_forms([
        { form: 'kv', key: '--hl=', value: '' },
        { form: 'kv', key: '--type=', value: 'heading' },
    ]);

    const dynamic = parse('--hl=1,3', { command_config: cfg });
    assert.deepEqual(block_types(dynamic), ['h1', 'h3']);
    assert.match(dynamic.val, /subtype regexp '\^h\[13\]\$'/);

    const fixed = parse('--type=heading13', { command_config: cfg });
    assert.deepEqual(block_types(fixed), ['h13']);
    assert.match(fixed.val, /subtype regexp '\^h\[13\]\$'/);

    const fixed_multi = parse('--type=heading1,heading3', { command_config: cfg });
    assert.deepEqual(block_types(fixed_multi), ['h1', 'h3']);

    const bad = parse('--hl=abc', { command_config: cfg });
    assert.deepEqual(bad.keywords, ['--hl=abc']);
    assert.deepEqual(bad.help.errors, ['未识别的指令, 已按关键词搜索: --hl=abc']);

    const missing = parse('--hl=', { command_config: cfg });
    assert.deepEqual(missing.keywords, []);
    assert.deepEqual(missing.help.errors, ['kv 指令缺少值: ']);
});

test('标题: 关闭后各形式都提示已关闭', () => {
    const cfg = config_with_heading_forms([
        { form: 'multi', content: '--heading' },
        { form: 'kv', key: '--hl=', value: '' },
        { form: 'kv', key: '--type=', value: 'heading' },
    ]);
    cfg.categories.find(cat => cat.id === 'type').items.find(item => item.id === 'h').enabled = false;

    for (const q of ['-h13', '--heading13', '--hl=13', '--type=heading13']) {
        const r = parse(q, { command_config: cfg });
        assert.deepEqual(r.keywords, [q]);
        assert.equal(r.help.errors.length, 1);
        assert.match(r.help.errors[0], /指令已关闭/);
    }
});

test('展示形式: 标题级别后缀按第一种形式拼接', () => {
    const multi = get_default_command_config();
    const multi_heading = multi.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'h');
    multi_heading.comms = [{ form: 'multi', content: '--heading' }];
    assert.deepEqual(plain(get_item_display_forms(multi_heading)), ['--heading']);
    assert.equal(parse('--heading13', { command_config: multi }).help.type_cmd.h13, '--heading13');

    const kv = get_default_command_config();
    const kv_heading = kv.categories.find(cat => cat.id === 'type')
        .items.find(item => item.id === 'h');
    kv_heading.comms = [{ form: 'kv', key: '--hl=', value: '' }];
    assert.deepEqual(plain(get_item_display_forms(kv_heading)), ['--hl=']);
    assert.equal(parse('--hl=13', { command_config: kv }).help.type_cmd.h13, '--hl=13');
});

test('路径: 三个路径类指令不支持 kv', () => {
    const cfg = get_default_command_config();
    const path_cat = cfg.categories.find(cat => cat.id === 'path');
    for (const id of ['path', 'all', 'not_path']) {
        path_cat.items.find(item => item.id === id)
            .comms.push({ form: 'kv', key: '--x=', value: '' });
    }

    // 校验时忽略, 注册表也不收录
    assert.equal(validate_command_config(cfg), '');
    assert.equal(build_command_registry(cfg).kv_groups.has('--x='), false);

    // 不会解析成路径, 按未识别指令处理
    const r = parse('--x=笔记', { command_config: cfg });
    assert.deepEqual(r.keywords, ['--x=笔记']);
    assert.deepEqual(r.help.custom_path, []);
    assert.deepEqual(r.help.errors, ['未识别的指令, 已按关键词搜索: --x=笔记']);

    // 展示形式里不出现 kv
    for (const id of ['path', 'all', 'not_path']) {
        const forms = plain(get_item_display_forms(path_cat.items.find(item => item.id === id)));
        assert.ok(forms.every(form => !form.includes('--x=')));
    }

    // 编辑控件按项限制可选形式
    assert.doesNotMatch(get_command_editor_form_html({ form: 'multi', content: '' }, ['multi']), /value="(single|kv)"/);
    assert.match(get_command_editor_form_html({ form: 'multi', content: '' }, ['single', 'multi']), /value="single"/);
    assert.doesNotMatch(get_command_editor_form_html({ form: 'multi', content: '' }, ['single', 'multi']), /value="kv"/);
    assert.match(get_command_editor_form_html({ form: 'multi', content: '' }), /value="kv"/);

    const html = get_command_editor_html(cfg);
    assert.match(html, /data-item-id="path"[^>]*data-allowed-forms="multi"/);
    assert.match(html, /data-item-id="not_path"[^>]*data-allowed-forms="multi"/);
    assert.match(html, /data-item-id="all"[^>]*data-allowed-forms="single,multi"/);
    assert.match(html, /data-item-id="current"[^>]*data-allowed-forms="single,multi,kv"/);
});

test('路径: 路径过滤和排除路径不支持单字符', () => {
    const cfg = get_default_command_config();
    const path_cat = cfg.categories.find(cat => cat.id === 'path');
    path_cat.items.find(item => item.id === 'path')
        .comms.push({ form: 'single', content: 'x' });
    path_cat.items.find(item => item.id === 'not_path')
        .comms.push({ form: 'single', content: 'y' });
    path_cat.items.find(item => item.id === 'all')
        .comms.push({ form: 'single', content: 'z' });

    assert.equal(validate_command_config(cfg), '');
    const reg = build_command_registry(cfg);
    assert.equal(reg.single.has('x'), false);
    assert.equal(reg.single.has('y'), false);
    assert.equal(reg.single.has('z'), true);

    // 路径过滤/排除路径的单字符不生效
    const bad_x = parse('-x', { command_config: cfg });
    assert.deepEqual(bad_x.keywords, ['-x']);
    assert.deepEqual(bad_x.help.errors, ['未识别的指令, 已按关键词搜索: -x']);
    const bad_y = parse('-y', { command_config: cfg });
    assert.deepEqual(bad_y.keywords, ['-y']);

    // 全文档的单字符仍然有效
    assert.equal(parse('-z', { command_config: cfg }).help.path, '全部');

    // 展示形式里也不出现被限制的单字符
    const path_forms = plain(get_item_display_forms(path_cat.items.find(item => item.id === 'path')));
    assert.deepEqual(path_forms, ['/路径']);
    const all_forms = plain(get_item_display_forms(path_cat.items.find(item => item.id === 'all')));
    assert.deepEqual(all_forms, ['-a', '//路径', '-z']);
});

test('设置: 特殊指令项显示说明图标', () => {
    const html = get_command_editor_html(get_default_command_config());
    const info_ids = ['h', 'path', 'all', 'not_path', 'ct', 'ut', 'not', 'docmode',
        'keyword', 'query', 'sql', 'regex', 'doc', 'none'];
    for (const id of info_ids) {
        assert.match(html, new RegExp(`data-item-id="${id}"[^>]*data-info="true"`), `${id} 应该有说明`);
    }
    // 排序项不加说明
    for (const id of ['type', 'content', 'ct_asc', 'ct_desc', 'ut_asc', 'ut_desc']) {
        assert.doesNotMatch(html, new RegExp(`data-item-id="${id}"[^>]*data-info="true"`));
    }
    assert.equal((html.match(/class="ss-cmd-info"/g) || []).length, info_ids.length);
    assert.match(html, /<use xlink:href="#iconInfo"><\/use>/);
    assert.match(html, /aria-label="标题块\n· 在命令末尾加级别 1-6/);
    assert.match(html, /· 多字符：如填 --heading → 输入 --heading13/);
    assert.match(html, /· kv：如 --type= \+ heading → 输入 --type=heading13/);
    assert.match(html, /aria-label="路径过滤\n· 只能配多字符/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api, plugin_class } = load_plugin();

const BASE_ARG = {
    idPath: [],
    types: {},
    hPath: '/页面/路径',
    group: 0,
    sort: 0,
    ignoredInputs: ['/', '//', '-', '--'],
};

function parse(query, overrides = {}) {
    return JSON.parse(JSON.stringify(api.search_translator({
        ...BASE_ARG, ...overrides, query,
    })));
}

// 给默认配置里的 SQL 模式增加多字符形式 --sql
function config_with_sql_alias() {
    const cfg = JSON.parse(JSON.stringify(api.get_default_command_config()));
    const mode_cat = cfg.categories.find(cat => cat.id === 'mode');
    const sql = mode_cat.items.find(item => item.id === 'sql');
    sql.comms.push({ form: 'multi', content: '--sql' });
    return cfg;
}

const is_implicit = plugin_class.prototype.is_implicit_sql_query;

test('隐式 SQL: 插件翻译出的 SQL 视为隐式', () => {
    assert.equal(is_implicit.call({ query: parse('-p 123') }), true);
    assert.equal(is_implicit.call({ query: parse('123') }), false);
});

test('隐式 SQL: 显式 -s 不视为隐式', () => {
    const q = parse('-s select * from blocks');
    assert.equal(q.type, '-s');
    assert.equal(q.help.mode_explicit, true);
    assert.equal(is_implicit.call({ query: q }), false);
});

test('隐式 SQL: 自定义多字符模式与 -s 一致', () => {
    const q = parse('--sql select * from blocks', { command_config: config_with_sql_alias() });
    assert.equal(q.type, '-s');
    assert.equal(q.help.mode_explicit, true);
    assert.deepEqual(q.help.recognized.map(item => item.token), ['--sql']);
    // 显式多字符模式不能被当成插件翻译的 SQL
    assert.equal(is_implicit.call({ query: q }), false);
});

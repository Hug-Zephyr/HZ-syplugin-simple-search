'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api, plugin_class, sandbox } = load_plugin();

const apply_setting = plugin_class.prototype.apply_setting_from_dialog;

function make_dialog(value) {
    return {
        querySelector(selector) {
            if (selector === '[data-key="command_config_json"]') return { value };
            return null;
        },
    };
}

function make_context() {
    sandbox.__show_messages.length = 0;
    sandbox.__alert_calls.length = 0;
    return { g_setting: {} };
}

test('指令配置 JSON 解析失败: 用非阻塞提示, 不再调用 alert', () => {
    const ret = apply_setting.call(make_context(), make_dialog('{bad'), false);
    assert.equal(ret, false);
    assert.equal(sandbox.__alert_calls.length, 0);
    assert.equal(sandbox.__show_messages.length, 1);
    assert.equal(sandbox.__show_messages[0].type, 'error');
    assert.match(sandbox.__show_messages[0].message, /指令配置 JSON 解析失败/);
});

test('指令配置 JSON 解析失败: 解析错误里的 HTML 片段被转义', () => {
    const ret = apply_setting.call(make_context(), make_dialog('<script>'), false);
    assert.equal(ret, false);
    const message = sandbox.__show_messages[sandbox.__show_messages.length - 1].message;
    assert.equal(message.includes('<script>'), false);
    assert.match(message, /&lt;script&gt;/);
});

test('指令配置校验失败: 用非阻塞提示, 不再调用 alert', () => {
    const cfg = api.get_default_command_config();
    const type_cat = cfg.categories.find(c => c.id === 'type');
    type_cat.items.push({
        id: 'dup_d',
        name: '重复的 d',
        enabled: true,
        comms: [{ form: 'single', content: 'd' }],
    });
    const ret = apply_setting.call(make_context(), make_dialog(JSON.stringify(cfg)), false);
    assert.equal(ret, false);
    assert.equal(sandbox.__alert_calls.length, 0);
    const message = sandbox.__show_messages[sandbox.__show_messages.length - 1].message;
    assert.match(message, /指令配置校验失败/);
    assert.match(message, /单字符重复: d/);
});

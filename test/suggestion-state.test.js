'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { plugin_class } = load_plugin();

const is_show_history = plugin_class.prototype.is_show_history_list;
const is_show_command = plugin_class.prototype.is_show_command_list;

test('建议列表状态: 元素不存在时视为未显示', () => {
    const context = {
        suggestion_mode: 'history',
        get_suggestion_box: () => null,
    };
    assert.equal(is_show_history.call(context), false);

    context.suggestion_mode = 'command';
    assert.equal(is_show_command.call(context), false);
});

test('建议列表状态: 按 suggestion_mode 和 fn__none 判断', () => {
    const hidden_box = { classList: { contains: (cls) => cls === 'fn__none' } };
    const visible_box = { classList: { contains: () => false } };
    const context = {
        suggestion_mode: 'history',
        get_suggestion_box: () => hidden_box,
    };
    assert.equal(is_show_history.call(context), false);

    context.get_suggestion_box = () => visible_box;
    assert.equal(is_show_history.call(context), true);
    // 模式不匹配时仍为 false
    assert.equal(is_show_command.call(context), false);
});

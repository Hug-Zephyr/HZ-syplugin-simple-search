'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { plugin_class } = load_plugin();

const is_show_history = plugin_class.prototype.is_show_history_list;
const is_show_command = plugin_class.prototype.is_show_command_list;
const get_assist_sw_style = plugin_class.prototype.get_assist_sw_style;
const update_assist_btn_visibility = plugin_class.prototype.update_assist_btn_visibility;

const plain = (value) => JSON.parse(JSON.stringify(value));

function make_visibility_ctx(setting) {
    const elements = new Map();
    const get = (selector) => {
        if (!elements.has(selector)) {
            elements.set(selector, {
                classList: {
                    toggles: [],
                    toggle(cls, value) { this.toggles.push([cls, value]); },
                },
            });
        }
        return elements.get(selector);
    };
    return { g_setting: setting, get_ele: get, elements };
}

test('顶部按钮: 默认不跟随辅助区域, 辅助区域隐藏时按钮仍显示', () => {
    const ctx = make_visibility_ctx({
        assist_sw: false, btn_follow_assist: false, btn_show_help: true, btn_show_setting: true,
    });
    update_assist_btn_visibility.call(ctx);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchHelp').classList.toggles), [['fn__none', false]]);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchDisplayTreeSetting').classList.toggles), [['fn__none', false]]);
});

test('顶部按钮: 开启跟随后, 辅助区域隐藏时按钮一起隐藏', () => {
    const ctx = make_visibility_ctx({
        assist_sw: false, btn_follow_assist: true, btn_show_help: true, btn_show_setting: true,
    });
    update_assist_btn_visibility.call(ctx);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchHelp').classList.toggles), [['fn__none', true]]);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchDisplayTreeSetting').classList.toggles), [['fn__none', true]]);
});

test('顶部按钮: 各自的显示开关仍然有效', () => {
    const ctx = make_visibility_ctx({
        assist_sw: true, btn_follow_assist: false, btn_show_help: false, btn_show_setting: true,
    });
    update_assist_btn_visibility.call(ctx);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchHelp').classList.toggles), [['fn__none', true]]);
    assert.deepEqual(plain(ctx.elements.get('#simpleSearchDisplayTreeSetting').classList.toggles), [['fn__none', false]]);
});

test('辅助区域开关: 图标/文案/display 与状态一致', () => {    assert.deepEqual(plain(get_assist_sw_style.call({}, true)), {
        icon: '#iconEyeoff',
        label: '简搜: 点击隐藏辅助信息框',
        display: 'contents',
    });
    assert.deepEqual(plain(get_assist_sw_style.call({}, false)), {
        icon: '#iconEye',
        label: '简搜: 点击显示辅助信息框',
        display: 'none',
    });
});

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

test('页面切换: reset_page_state 清理跨页状态', () => {
    const reset = plugin_class.prototype.reset_page_state;
    const context = {
        history_timer_id: 0,
        history_previewing: true,
        history_input_flag: true,
        history_typed_value: '旧输入',
        suggestion_mode: 'history',
        command_completion: {},
        command_index: 2,
        _history_suppressed_value: '旧输入',
        is_searching: true,
        _search_config: {},
        _pending_render: null,
        _page_resize_observer: null,
        _page_resize_observer_page: {},
        _search_wait_id: 5,
        last_sort: 1,
        last_group: 0,
        click_res_flag: true,
        _preview_highlight_token: 3,
    };
    reset.call(context);
    assert.equal(context.suggestion_mode, null);
    assert.equal(context.is_searching, false);
    assert.equal(context._search_wait_id, 6);
    assert.equal(context.last_sort, -1);
    assert.equal(context.last_group, -1);
    assert.equal(context.click_res_flag, false);
    assert.equal(context._preview_highlight_token, 4);
});

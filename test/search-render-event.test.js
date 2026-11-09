'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { plugin_class } = load_plugin();

const on_before_render = plugin_class.prototype.on_before_search_results_render;
const fake_page = { isConnected: true };

function make_context(wait_id, process) {
    return {
        _search_wait_id: wait_id,
        _pending_render: { wait_id, page: fake_page, process },
    };
}

function emit(page) {
    return { detail: { searchElement: { closest: () => page } } };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('搜索结果渲染事件: 不属于本次搜索页时忽略', async () => {
    let called = 0;
    const ctx = make_context(1, () => called++);
    on_before_render.call(ctx, emit({ isConnected: true }));
    await tick();
    assert.equal(called, 0);
});

test('搜索结果渲染事件: 代际已过期时忽略', async () => {
    let called = 0;
    const ctx = make_context(2, () => called++);
    ctx._search_wait_id = 3;
    on_before_render.call(ctx, emit(fake_page));
    await tick();
    assert.equal(called, 0);
});

test('搜索结果渲染事件: 没有等待中的搜索时忽略', async () => {
    let called = 0;
    const ctx = { _search_wait_id: 4, _pending_render: null };
    on_before_render.call(ctx, emit(fake_page));
    await tick();
    assert.equal(called, 0);
});

test('搜索结果渲染事件: 匹配时延后一拍再处理, 保证 DOM 已更新', async () => {
    let called = 0;
    const ctx = make_context(5, () => called++);
    on_before_render.call(ctx, emit(fake_page));
    // 事件先于 DOM 更新触发, 同步阶段不能处理
    assert.equal(called, 0);
    await tick();
    assert.equal(called, 1);
});
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api, sandbox } = load_plugin();
const { SYT } = api;

test('删除搜索历史后立即写回内核存储', () => {
    sandbox.window.siyuan.storage['local-searchkeys'] = { keys: ['甲', '乙', '丙'], replaceKeys: [] };
    sandbox.__fetch_calls.length = 0;

    SYT.delete_search_history('乙');

    // 内存先更新
    assert.deepEqual(sandbox.window.siyuan.storage['local-searchkeys'].keys, ['甲', '丙']);
    // 立即调用存储接口, 不依赖输入框失焦
    assert.equal(sandbox.__fetch_calls.length, 1);
    const call = sandbox.__fetch_calls[0];
    assert.equal(call.url, '/api/storage/setLocalStorageVal');
    const body = JSON.parse(call.init.body);
    assert.equal(body.key, 'local-searchkeys');
    assert.deepEqual(JSON.parse(body.val), { keys: ['甲', '丙'], replaceKeys: [] });
});

test('发布模式下删除历史不写存储', () => {
    const loaded = load_plugin();
    loaded.sandbox.window.siyuan.isPublish = true;
    loaded.sandbox.window.siyuan.storage['local-searchkeys'] = { keys: ['甲', '乙'] };
    loaded.sandbox.__fetch_calls.length = 0;

    loaded.api.SYT.delete_search_history('甲');

    assert.deepEqual(loaded.sandbox.window.siyuan.storage['local-searchkeys'].keys, ['乙']);
    assert.equal(loaded.sandbox.__fetch_calls.length, 0);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api } = load_plugin();
const { matchHistory } = api;

function plain(value) {
    return value
        .replace(/<span class="HZ-search-history-highlight">/g, '')
        .replace(/<\/span>/g, '');
}

function labels(result) {
    return Array.from(result, plain);
}

const HISTORY = [
    '中国',
    '中国历史',
    '历史中国',
    '中X国',
    '中国 美国',
    '美国中国',
];

test('历史匹配: 默认保留包含和模糊匹配', () => {
    const labels_all = labels(matchHistory('中国', HISTORY));
    assert.ok(labels_all.includes('中国'));
    assert.ok(labels_all.includes('中国历史'));
    assert.ok(labels_all.includes('中国 美国'));
    assert.ok(labels_all.includes('历史中国'));
    assert.ok(labels_all.includes('中X国'));
});

test('历史匹配: 仅前缀时过滤包含和模糊匹配', () => {
    const labels_prefix = labels(matchHistory('中国', HISTORY, false, true));
    // 精确和前缀保留
    assert.ok(labels_prefix.includes('中国'));
    assert.ok(labels_prefix.includes('中国历史'));
    assert.ok(labels_prefix.includes('中国 美国'));
    // 包含和模糊匹配被过滤
    assert.equal(labels_prefix.includes('历史中国'), false);
    assert.equal(labels_prefix.includes('中X国'), false);
    assert.equal(labels_prefix.includes('美国中国'), false);
});

test('历史匹配: 仅前缀匹配忽略大小写', () => {
    const labels_prefix = labels(matchHistory('abc', ['ABCDEF', 'xxabc', 'abXc'], false, true));
    assert.ok(labels_prefix.includes('ABCDEF'));
    assert.equal(labels_prefix.includes('xxabc'), false);
    assert.equal(labels_prefix.includes('abXc'), false);
});

test('历史匹配: 手动全部模式不受前缀过滤影响', () => {
    const labels_all = labels(matchHistory('中国', HISTORY, true, false));
    assert.ok(labels_all.includes('历史中国'));
    assert.ok(labels_all.includes('中X国'));
    assert.ok(labels_all.includes('美国中国'));
});

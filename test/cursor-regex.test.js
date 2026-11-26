'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api } = load_plugin();
const { firstRegexMatchInText } = api;

// 结果来自 vm 沙箱, 转成本 realm 的对象再比较
const plain = (v) => JSON.parse(JSON.stringify(v));

test('正则定位: 返回第一个非空匹配的位置和文本', () => {
    assert.deepEqual(plain(firstRegexMatchInText('abc 123 def 456', '\\d+')), {
        index: 4,
        text: '123',
    });
    // 开头内联标志
    assert.deepEqual(plain(firstRegexMatchInText('Hello HELLO', '(?i)hello')), {
        index: 0,
        text: 'Hello',
    });
    // 多行模式下 ^ 匹配行首
    assert.deepEqual(plain(firstRegexMatchInText('a\nb', '(?m)^b')), {
        index: 2,
        text: 'b',
    });
});

test('正则定位: 无效正则和空匹配不返回位置', () => {
    assert.equal(firstRegexMatchInText('abc', '(?'), null);
    assert.equal(firstRegexMatchInText('bbb', 'a*'), null);
    assert.equal(firstRegexMatchInText('abc', '^$'), null);
    assert.equal(firstRegexMatchInText('abc', ''), null);
});

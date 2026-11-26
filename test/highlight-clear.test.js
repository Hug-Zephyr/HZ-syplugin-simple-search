'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { plugin_class, sandbox } = load_plugin();

// 插件运行在 vm 沙箱里, CSS.highlights 用的是沙箱里的同一个 Map
const highlights = sandbox.CSS.highlights;

function seed_highlights() {
    highlights.clear();
    highlights.set('highlight-keywords-search-list', 'list');
    highlights.set('highlight-keywords-search-preview', 'preview');
    highlights.set('search-mark-other', 'native');
}

test('高亮清理: 打开结果只清预览, 保留结果列表', () => {
    seed_highlights();
    plugin_class.prototype.clear_preview_highlight.call({});
    assert.equal(highlights.has('highlight-keywords-search-list'), true);
    assert.equal(highlights.has('highlight-keywords-search-preview'), false);
    // 思源原生高亮不受影响
    assert.equal(highlights.has('search-mark-other'), true);
});

test('高亮清理: 关闭页面时列表和预览都清, 原生高亮不动', () => {
    seed_highlights();
    const ctx = {
        clear_list_highlight: plugin_class.prototype.clear_list_highlight,
        clear_preview_highlight: plugin_class.prototype.clear_preview_highlight,
    };
    plugin_class.prototype.clear_highlight.call(ctx);
    assert.equal(highlights.has('highlight-keywords-search-list'), false);
    assert.equal(highlights.has('highlight-keywords-search-preview'), false);
    assert.equal(highlights.has('search-mark-other'), true);
});

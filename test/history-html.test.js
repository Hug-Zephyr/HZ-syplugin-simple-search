'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { api } = load_plugin();
const { escapeHtml, unescapeHtml } = api;

test('历史记录: HTML 实体可以还原为原始文本', () => {
    const samples = [
        '--time=ct<',
        'a & b > c',
        '双引号 "a" 和单引号 \'b\'',
        '&lt;',
        '&amp;',
        '&#039;',
    ];
    for (const raw of samples) {
        assert.equal(unescapeHtml(escapeHtml(raw)), raw);
    }
});

test('历史记录: 高亮 HTML 去掉 span 后可以还原', () => {
    const raw = '--time=ct<2025 & 历史';
    const highlighted = raw
        .split('')
        .map(ch => `<span class="HZ-search-history-highlight">${escapeHtml(ch)}</span>`)
        .join('');
    const stripped = unescapeHtml(highlighted.replace(/<span class="HZ-search-history-highlight">/g, "").replace(/<\/span>/g, ""));
    assert.equal(stripped, raw);
});

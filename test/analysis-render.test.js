'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');

const { plugin_class } = load_plugin();

// get_analysis_result_html 只依赖 this.code / this.strong
const fake_context = {
    code: (s) => `<span class="fn__code">${s}</span>`,
    strong: (s) => `<span style="font-weight:bold">${s}</span>`,
};

function render(help) {
    return plugin_class.prototype.get_analysis_result_html.call(fake_context, help);
}

test('解析结果面板: 用户输入与路径按纯文本转义', () => {
    const html = render({
        type: '-w',
        group_file: false,
        keywords: ['<img src=x onerror=1>'],
        excluded: ['<b>排除</b>'],
        custom_time: [],
        custom_path: ['<i>路径</i>'],
        excludedPath: ['<u>排除路径</u>'],
        path: '<s>页面路径</s>',
        block_type: { p: '<em>段落</em>' },
        type_cmd: {},
        sort: '<b>排序</b>',
        group_desc: '<b>分组</b>',
        val: '<img src=x onerror=1>',
        errors: [],
    });
    // 输出中不能出现任何由用户输入拼出的标签
    for (const raw of ['<img src=x', '<b>排除', '<i>路径', '<u>排除路径', '<s>页面路径', '<em>段落', '<b>排序', '<b>分组']) {
        assert.equal(html.includes(raw), false, `未转义: ${raw}`);
    }
    // 应显示为字面文本
    assert.ok(html.includes('&lt;img src=x onerror=1&gt;'));
    assert.ok(html.includes('&lt;s&gt;页面路径&lt;/s&gt;'));
});

test('解析结果面板: 空/缺省字段不报错', () => {
    const html = render({
        type: '',
        group_file: false,
        keywords: [],
        excluded: [],
        custom_time: [],
        custom_path: [],
        excludedPath: [],
        path: '',
        block_type: {},
        type_cmd: {},
        errors: [],
    });
    assert.ok(html.includes('识别错误'));
});

test('解析结果面板: 搜索方式显示配置后的指令', () => {
    const html = render({
        type: '-w',
        mode_cmd: '-z',
        mode_name: '关键字搜索',
        group_file: false,
        keywords: [],
        excluded: [],
        custom_time: [],
        custom_path: [],
        excludedPath: [],
        path: '',
        block_type: {},
        type_cmd: {},
        errors: [],
    });
    assert.ok(html.includes('-z'));
    assert.ok(html.includes('关键字搜索'));
});

test('解析结果面板: 转换结果只显示查询正文, 不带模式前缀', () => {
    const html = render({
        type: '-s',
        mode_cmd: '-z',
        group_file: false,
        keywords: [],
        excluded: [],
        custom_time: [],
        custom_path: [],
        excludedPath: [],
        path: '',
        block_type: {},
        type_cmd: {},
        errors: [],
        val: 'select * from blocks where true',
    });
    assert.ok(html.includes('select * from blocks where true'));
    assert.equal(html.includes('-sselect'), false);
});

test('解析结果面板: 重复渲染不改动 help.custom_path', () => {
    const help = {
        type: '-w',
        group_file: false,
        keywords: [],
        excluded: [],
        custom_time: [],
        custom_path: ['/自定义'],
        excludedPath: [],
        path: '当前文档',
        block_type: {},
        type_cmd: {},
        errors: [],
    };
    const before = JSON.stringify(help.custom_path);
    const first = render(help);
    const second = render(help);
    assert.equal(JSON.stringify(help.custom_path), before);
    assert.equal(first, second);
    assert.ok(first.includes('当前文档'));
    assert.ok(first.includes('/自定义'));
});

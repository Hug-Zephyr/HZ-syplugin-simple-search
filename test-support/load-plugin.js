'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX_PATH = path.resolve(__dirname, '..', 'index.js');

// 在 Node 里加载插件源码。
// 思源本身只加载单个 index.js, 所以测试不引入构建步骤,
// 而是用 vm 模拟浏览器/思源环境, 并在源码末尾临时追加测试导出。
function load_plugin(options = {}) {
    let source = fs.readFileSync(INDEX_PATH, 'utf8');
    source += `\nmodule.exports.__test = {
        search_translator,
        escapeHtml,
        unescapeHtml,
        matchHistory,
        get_default_command_config,
        build_command_registry,
        validate_command_config,
        migrate_command_config,
        compare_version,
        get_item_display_forms,
        get_command_complete,
        get_all_command_candidates,
        get_completion_entries,
        get_completion_custom_groups,
        get_completion_custom_order,
        get_completion_display_order,
        get_completion_usage_keys,
        _get_chain_kv_keys,
        get_command_editor_html,
        get_command_editor_form_html,
        read_command_config_from_editor,
        SYT,
    };`;

    const focus_doc = options.focus_doc === undefined ? 'doc123' : options.focus_doc;
    const notebooks = options.notebooks || [
        { id: 'box_note', name: '笔记', closed: false },
        { id: 'box_data', name: '资料', closed: false },
    ];

    const sandbox = {
        console,
        module: { exports: {} },
        exports: {},
        require(name) {
            if (name === 'siyuan') {
                return {
                    Plugin: class {}, Dialog: class {}, Setting: class {},
                    showMessage(message, timeout, type) {
                        sandbox.__show_messages.push({ message, timeout, type });
                    },
                };
            }
            throw new Error(`unexpected require: ${name}`);
        },
        window: {
            siyuan: {
                isPublish: false,
                notebooks,
                storage: {
                    'local-searchdata': { k: '' },
                    'local-searchkeys': { keys: [] },
                },
            },
        },
        document: {
            querySelector(selector) {
                if (selector === '.sy__file .b3-list-item--focus') {
                    return focus_doc ? { getAttribute: () => focus_doc } : null;
                }
                return null;
            },
            getElementById: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
            body: { appendChild() {} },
        },
        CSS: { highlights: new Map() },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        requestAnimationFrame: (callback) => callback && callback(),
        alert: (...args) => { sandbox.__alert_calls.push(args); },
        fetch(url, init) {
            sandbox.__fetch_calls.push({ url, init });
            return Promise.resolve({ code: 0 });
        },
        __fetch_calls: [],
        __show_messages: [],
        __alert_calls: [],
    };

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: INDEX_PATH });

    return {
        api: sandbox.module.exports.__test,
        plugin_class: sandbox.module.exports.default,
        sandbox,
    };
}

module.exports = { load_plugin, INDEX_PATH };

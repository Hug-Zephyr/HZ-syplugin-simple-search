const siyuan = require("siyuan");

// 日志等级: off < error < warn < info < debug
const LOG_LEVELS = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
let LOG_LEVEL = LOG_LEVELS.info;
function set_log_level(level) {
    LOG_LEVEL = Object.prototype.hasOwnProperty.call(LOG_LEVELS, level)
        ? LOG_LEVELS[level] : LOG_LEVELS.info;
}
function mylog_at(level, ...args) {
    if (LOG_LEVEL < LOG_LEVELS[level]) return;
    const err = new Error();
    // 获取堆栈信息, 跳过日志函数自身的栈帧
    const stack = err.stack.split('\n');
    const location = stack.slice(1).find(line => !line.includes('mylog_at') && !line.includes('mylog')) || "unknown location";

    // 解析函数名、文件名和行号
    const parts = location.trim().split(' ');
    const functionName = parts[1] || "unknown function";
    const fileInfo = decodeURIComponent(parts[2]?.replace(/\s*\(\s*|\s*:\d+\)\s*/g, '')); // 去掉小括号中的内容

    // 构造日志前缀
    const logPrefix = `[${level.toUpperCase()}][${functionName} ${fileInfo}]`;
    const console_fn = level === 'error' ? console.error
        : level === 'warn' ? console.warn
        : console.log;
    console_fn(`${logPrefix} `, ...args);
}
// 默认按 debug 输出, 老代码里的 mylog 调用都属于调试信息
function mylog(...args) { mylog_at('debug', ...args); }
function mylog_info(...args) { mylog_at('info', ...args); }
function mylog_warn(...args) { mylog_at('warn', ...args); }
function mylog_error(...args) { mylog_at('error', ...args); }
// 功能: 监听直到元素存在
// 找到 selector 时，执行 func_cb，监听超时时间默认为 4s
// selector: string | #id | function
function whenExist(selector, func_cb, time_out = 4000) {
    mylog("whenExist begin", selector);

    return new Promise((resolve) => {
        const startTime = Date.now(); // 记录开始时间

        const checkForElement = () => {
            let element = null;

            // 根据selector类型进行查找
            if (typeof selector === 'string') {
                if (selector.startsWith('#')) {
                    element = document.getElementById(selector.slice(1));
                } else {
                    element = document.querySelector(selector);
                }
            } else if (typeof selector === 'function') {
                element = selector();
            } else {
                // 若 selector 不合法，直接退出
                mylog_warn("Invalid selector type");
                resolve(false);
                return;
            }

            if (element) {
                // 元素存在时，执行回调并解析Promise
                if (func_cb) func_cb(element);
                resolve(true);
            } else if (Date.now() - startTime >= time_out) {
                // 超时处理
                mylog_warn(selector, "whenExist timeout");
                resolve(false);
            } else {
                // 元素不存在且未超时，继续检查
                requestAnimationFrame(checkForElement);
            }
        };

        // 开始检查元素是否存在
        checkForElement();
    });
}

// js插入css
function js_insert_css(css) {
    // 创建一个新的 <style> 元素
    const style = document.createElement('style');
    style.type = 'text/css';

    // 添加 CSS 规则
    style.innerHTML = css;

    // 将 <style> 元素插入到 <body> 中
    document.body.appendChild(style);
    return style;
    // 删除
    // style.remove();
}
// 获取光标所在的元素
function getElementAtCursor() {
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;

        // 如果是文本节点，获取其父元素
        const element = startContainer.nodeType === 3 ? startContainer.parentNode : startContainer;
        return element;
    }

    return null; // 如果没有选中内容或光标位置无效
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;") // 转义&符号
        .replace(/</g, "&lt;")  // 转义<符号
        .replace(/>/g, "&gt;")  // 转义>符号
        .replace(/"/g, "&quot;") // 转义双引号
        .replace(/'/g, "&#039;") // 转义单引号
}

// 反转义 escapeHtml 产生的实体, 用于从展示 HTML 还原历史记录的原始文本
function unescapeHtml(str) {
    return String(str)
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&amp;/g, "&");
}

// 转义 SQL 字符串字面量中的单引号
function escapeSqlString(str) {
    return String(str).replace(/'/g, "''");
}

// 转义 LIKE 模式中的通配符, 使用时需配合 escape '!'
function escapeSqlLike(str) {
    return escapeSqlString(str).replace(/[!%_]/g, m => '!' + m);
}

const SYT = {
    // 插件生成的sql的标记
    // SQL_FLAG: '("simple_search_flag"="simple_search_flag")',
    SQL_FLAG: 'true',
    // 获取当前文档id
    // todo 不能通过聚焦来找
    get_data_id() {
        // 在文档树那里找到选中的文档, 当做当前文档
        let data_id = document.querySelector('.sy__file .b3-list-item--focus')?.getAttribute("data-node-id");
        if (data_id) return data_id;
        return null;
        // 一般来说, 鼠标聚焦的文档就是当前文档
        data_id = document.querySelector(`.layout__wnd--active[data-type="wnd"] .protyle-top>.protyle-title`)?.getAttribute("data-node-id");
        if (data_id) return data_id;
        // 如果没有鼠标聚焦的文档, 就找所有的页签, 然后匹配最上方文档名
        const file_name = document.getElementById('drag')?.textContent;
        document.querySelectorAll(`[data-type="wnd"] .layout-tab-bar>[data-type="tab-header"]>.item__text`).forEach( (ele) => {
                if (ele.textContent == file_name) {
                    data_id = ele.closest('[data-type="wnd"]')?.querySelector(`.protyle-top>.protyle-title`)?.getAttribute("data-node-id");
                    if (!data_id) return data_id;
                }
            }
        )
        // 如果文档树那里也没有聚焦, 就真的找不到了
        return null;
    },
    get_book_map() {
        const bookmap = {};
        window.siyuan.notebooks.forEach(book => { if(!book.closed) bookmap[book.id] = book; });
        return bookmap;
    },
    get_book_arr() {
        const bookarr = [];
        window.siyuan.notebooks.forEach(book => { if(!book.closed) bookarr.push(book); });
        return bookarr;
    },
    get_book_arr_from_name(name) {
        let book_id = [];
        // 用字符串包含判断, 不能把路径段当正则: 名字里的 ( [ . + 等字符会误匹配或抛 SyntaxError
        window.siyuan.notebooks.forEach(book => { if(!book.closed && book.name.includes(name)) book_id.push(book.id); });
        return book_id;
    },
    get_search_k() { // 获取当前默认搜索内容
        return window.siyuan.storage['local-searchdata'].k;
    },
    set_search_k(val) { // 设置默认搜索内容
        window.siyuan.storage['local-searchdata'].k = val;
    },
    get_search_history() { // 获取搜索历史
        return window.siyuan.storage['local-searchkeys'].keys;
    },
    delete_search_history(del_item) { // 删除某个搜索历史
        window.siyuan.storage['local-searchkeys'].keys = window.siyuan.storage['local-searchkeys'].keys.filter(item => item != del_item);
    },
    get_last_search_k() { // 获取上个搜索历史
        for (const item of window.siyuan.storage['local-searchkeys'].keys) {
            if (item) return item;
        }
        return "";
    },
    set_last_search_k() {
        if (!SYT.get_search_k()) {
            SYT.set_search_k(SYT.get_last_search_k());
        }
    },
}

// 指令配置默认值
// key = 分类; 每个项可以配 单字符/多字符/kv 三种形式
// single: content 是单个字符, 解析时自动补 '-'
// multi:  content 是完整 token, 原样使用
// kv:     key 是前缀, value 是拼在后面的值(可为空, 表示由用户输入)
function get_default_command_config() {
    const type_item = (id, name, code, comms) => ({ id, name, kind: 'type', code, comms });
    const new_type = (code, name) => ({
        id: code,
        name,
        kind: 'type',
        code,
        comms: [
            { form: 'multi', content: '--' + code },
            { form: 'kv', key: '--type=', value: code },
        ],
    });
    // 默认关闭的类型(单项开关)
    const off_type = (code, name) => {
        const item = new_type(code, name);
        item.enabled = false;
        return item;
    };
    return {
        version: 1,
        categories: [
            {
                id: 'mode', name: '搜索方式', icon: '🔍',
                items: [
                    { id: 'keyword', name: '关键字搜索', kind: 'mode', mode: '-w', comms: [{ form: 'single', content: 'w' }] },
                    { id: 'query',   name: '查询语法',   kind: 'mode', mode: '-q', comms: [{ form: 'single', content: 'q' }] },
                    { id: 'sql',     name: 'SQL',        kind: 'mode', mode: '-s', comms: [{ form: 'single', content: 's' }] },
                    { id: 'regex',   name: '正则表达式', kind: 'mode', mode: '-r', comms: [{ form: 'single', content: 'r' }] },
                ],
            },
            {
                id: 'type', name: '块类型过滤', icon: '🧩',
                items: [
                    type_item('d', '文档块', 'd', [{ form: 'single', content: 'd' }]),
                    { id: 'h', name: '标题块', kind: 'heading', comms: [{ form: 'single', content: 'h' }] },
                    type_item('p', '段落块', 'p', [{ form: 'single', content: 'p' }]),
                    type_item('c', '代码块', 'c', [{ form: 'single', content: 'c' }]),
                    type_item('l', '列表块', 'l', [{ form: 'single', content: 'l' }]),
                    type_item('i', '列表项块', 'i', [{ form: 'single', content: 'i' }]),
                    type_item('b', '引述块', 'b', [{ form: 'single', content: 'b' }]),
                    new_type('callout', '提示块'),
                    type_item('t', '表格块', 't', [{ form: 'single', content: 't' }]),
                    type_item('m', '公式块', 'm', [{ form: 'single', content: 'm' }]),
                    { id: 's', name: '超级块', kind: 'type', code: 's', enabled: false, comms: [{ form: 'single', content: 'S' }] },
                    { id: 'o', name: '未完成待办', kind: 'todo', done: false, comms: [{ form: 'single', content: 'o' }] },
                    { id: 'O', name: '已完成待办', kind: 'todo', done: true,  comms: [{ form: 'single', content: 'O' }] },
                    { id: 'L', name: '带链接的块',   kind: 'link', comms: [{ form: 'single', content: 'L' }] },
                    off_type('tabs', '页签块'),
                    off_type('tab', '页签项块'),
                    off_type('mindmap', '思维导图块'),
                    off_type('mindmap_item', '思维导图项块'),
                    off_type('query_embed', '嵌入块'),
                    off_type('widget', '挂件块'),
                    off_type('av', '数据库块'),
                    off_type('html', 'HTML 块'),
                    off_type('custom', '自定义块'),
                    off_type('tb', '分割线'),
                    off_type('audio', '音频块'),
                    off_type('video', '视频块'),
                    off_type('iframe', 'IFrame 块'),
                ],
            },
            {
                id: 'path', name: '路径', icon: '📁',
                items: [
                    { id: 'path', name: '路径过滤', kind: 'path', action: 'path', comms: [{ form: 'multi', content: '/' }] },
                    { id: 'all', name: '全文档', kind: 'path', action: 'all', comms: [{ form: 'single', content: 'a' }, { form: 'multi', content: '//' }] },
                    { id: 'not_path', name: '排除路径', kind: 'path', action: 'exclude', comms: [{ form: 'multi', content: '-/' }] },
                    { id: 'current', name: '当前文档', kind: 'current', tree: false, comms: [{ form: 'single', content: 'k' }] },
                    { id: 'current_tree', name: '当前文档及子文档', kind: 'current', tree: true, comms: [{ form: 'single', content: 'K' }] },
                ],
            },
            {
                id: 'time', name: '时间', icon: '🕒',
                items: [
                    { id: 'ct', name: '创建时间', kind: 'time', field: 'ct', comms: [{ form: 'multi', content: 'ct' }, { form: 'kv', key: '--time=', value: 'ct' }] },
                    { id: 'ut', name: '更新时间', kind: 'time', field: 'ut', comms: [{ form: 'multi', content: 'ut' }, { form: 'kv', key: '--time=', value: 'ut' }] },
                ],
            },
            {
                id: 'group', name: '分组', icon: '🗂️',
                items: [
                    { id: 'doc', name: '按文档分组', kind: 'group', value: 1, comms: [{ form: 'multi', content: 'g<' }, { form: 'multi', content: 'g>' }, { form: 'kv', key: '--group=', value: 'doc' }] },
                    { id: 'none', name: '不分组', kind: 'group', value: 0, comms: [{ form: 'multi', content: 'nog<' }, { form: 'multi', content: 'nog>' }, { form: 'kv', key: '--group=', value: 'none' }] },
                ],
            },
            {
                id: 'sort', name: '排序', icon: '🔀',
                items: [
                    { id: 'type', name: '按类型', kind: 'sort', value: 0, comms: [{ form: 'multi', content: 'type<' }, { form: 'multi', content: 'type>' }, { form: 'kv', key: '--sort=', value: 'type' }] },
                    { id: 'content', name: '原文顺序', kind: 'sort', value: 5, comms: [{ form: 'multi', content: 'cont<' }, { form: 'multi', content: 'cont>' }, { form: 'kv', key: '--sort=', value: 'content' }] },
                    { id: 'ct_asc', name: '创建时间升序', kind: 'sort', value: 1, comms: [{ form: 'multi', content: 'ct<' }, { form: 'kv', key: '--sort=', value: 'ct:asc' }] },
                    { id: 'ct_desc', name: '创建时间降序', kind: 'sort', value: 2, comms: [{ form: 'multi', content: 'ct>' }, { form: 'kv', key: '--sort=', value: 'ct:desc' }] },
                    { id: 'ut_asc', name: '更新时间升序', kind: 'sort', value: 3, comms: [{ form: 'multi', content: 'ut<' }, { form: 'kv', key: '--sort=', value: 'ut:asc' }] },
                    { id: 'ut_desc', name: '更新时间降序', kind: 'sort', value: 4, comms: [{ form: 'multi', content: 'ut>' }, { form: 'kv', key: '--sort=', value: 'ut:desc' }] },
                ],
            },
            {
                id: 'ext', name: '扩展', icon: '🧰',
                items: [
                    { id: 'not', name: '排除关键词', kind: 'ext', action: 'not', comms: [{ form: 'multi', content: '!' }] },
                    { id: 'docmode', name: '文档模式', kind: 'ext', action: 'docmode', comms: [{ form: 'multi', content: '||' }] },
                ],
            },
        ],
    };
}

// 多字符形式是否需要把后面的内容当作参数
function is_prefix_item(item) {
    if (item.kind === 'path') return true;                        // /、//、-/ 后面接路径
    if (item.kind === 'time') return true;                        // ct、ut 后面接比较符
    if (item.kind === 'ext' && item.action === 'not') return true; // ! 后面接关键词
    return false;
}

// 各类指令项允许的形式:
// 路径过滤、排除路径: 指令后面必须直接跟路径, 只允许多字符
// 全文档: 支持单字符和多字符, 路径内容由输入决定, 不支持 kv
// 其他项: 三种形式都可以
function get_allowed_command_forms(item) {
    if (item && item.kind === 'path') {
        if (item.action === 'all') return ['single', 'multi'];
        return ['multi'];
    }
    return ['single', 'multi', 'kv'];
}

function is_command_form_allowed(item, form) {
    return get_allowed_command_forms(item).includes(form);
}

// 一个指令项在帮助/解析面板中的展示形式
// 路径、时间、排除关键词这类前缀指令, 多字符形式后面还要接内容
function get_item_display_forms(item) {
    const forms = [];
    const add = (s) => { if (s && !forms.includes(s)) forms.push(s); };
    for (const c of (item.comms || [])) {
        if (!is_command_form_allowed(item, c.form)) continue;
        if (c.form === 'single') {
            add('-' + c.content);
        } else if (c.form === 'multi') {
            let token = c.content;
            if (item.kind === 'path') token += '路径';
            else if (item.kind === 'time') token += '>2025';
            else if (item.kind === 'ext' && item.action === 'not') token += '关键词';
            add(token);
        } else if (c.form === 'kv') {
            let val = c.value;
            if (item.kind === 'path') val = '路径';
            else if (item.kind === 'time') val = (val || '') + '>2025';
            else if (item.kind === 'ext' && item.action === 'not') val = '关键词';
            else if (item.kind === 'heading' && !val) val = ''; // 标题级别直接接在 = 后面
            else if (!val) val = '值';
            add(c.key + val);
        }
    }
    return forms;
}

// [指令补全] 根据输入和光标位置生成候选
// 返回 null 表示不在补全场景; 返回对象的 candidates 按展示顺序排列
function get_command_complete(cfg, input, caret, manual = false, sort_ctx = null) {
    if (!cfg || !Array.isArray(cfg.categories)) cfg = get_default_command_config();
    if (typeof input !== 'string') return null;
    if (caret == null || caret < 0 || caret > input.length) caret = input.length;
    const token_info = _get_completion_token(input, caret);
    // 只在光标位于 token 末尾时补全
    if (!token_info || !token_info.at_end) return null;
    const token = token_info.token;
    const model = _build_completion_model(cfg);
    // 模式指令出现后, 后面的内容原样作为查询, 不做补全
    if (_input_has_mode_command(model, input)) return null;
    // 自定义 kv key 可能不以 -- 开头(如 @@type=); 输入到 key 后继续显示值菜单
    if (!token.startsWith('-')) {
        const custom_kv = [...model.kv_groups.keys()].some(k => !k.startsWith('--') && token.startsWith(k));
        if (custom_kv) return _get_kv_value_candidates(model, token_info, manual, sort_ctx);
        // 自定义指令前缀: 以非字母数字开头时(如 @、@@)按前缀列出多字符形式和 kv key
        if (token && !/^[A-Za-z0-9_]/.test(token)) {
            const has_custom = model.forms.some(f => {
                if (f.type === 'multi') return !f.token.startsWith('--') && f.token.startsWith(token);
                return !f.key.startsWith('--') && f.key.startsWith(token);
            });
            if (has_custom) return _get_key_candidates(model, token_info, sort_ctx);
        }
        return null;
    }
    if (token.startsWith('--')) {
        return _get_kv_value_candidates(model, token_info, manual, sort_ctx) || _get_key_candidates(model, token_info, sort_ctx);
    }
    return _get_single_candidates(model, token_info, sort_ctx);
}

// [指令补全] Tab 在当前光标处没有常规候选时, 列出所有可用指令
// 回车时在光标位置插入选中的指令
function get_all_command_candidates(cfg, input, caret, sort_ctx = null) {
    if (!cfg || !Array.isArray(cfg.categories)) cfg = get_default_command_config();
    if (typeof input !== 'string') input = '';
    if (caret == null || caret < 0 || caret > input.length) caret = input.length;
    const model = _build_completion_model(cfg);
    const candidates = [];
    const seen = new Set();
    // 单字符指令补上 "-" 前缀, 作为完整指令插入
    for (const e of model.initial_singles) {
        const token = '-' + e.ch;
        if (seen.has(token)) continue;
        seen.add(token);
        candidates.push({
            kind: 'multi',
            insert: token,
            label: token,
            name: e.item.name || e.ch,
            hint: e.cat.name || '',
            close: true,
            trailing_space: true,
            sort_key: e.sort_key,
        });
    }
    // 多字符 / kv: 复用 -- 菜单的构建逻辑, 前缀为空即列出全部
    const rest = _get_key_candidates(model, {
        start: caret,
        end: caret,
        token: '',
        at_end: true,
    });
    if (rest) {
        for (const c of rest.candidates) {
            if (seen.has(c.label)) continue;
            seen.add(c.label);
            candidates.push(c);
        }
    }
    if (!candidates.length) return null;
    const sorted = _sort_completion_list(candidates, sort_ctx);
    if (!sorted.length) return null;
    return {
        mode: 'all',
        candidates: sorted,
        default_index: 0,
        token_start: caret,
        token_end: caret,
        insert_at_caret: true,
    };
}

// 光标所在的、以空白分隔的 token
function _get_completion_token(input, caret) {
    let start = caret;
    while (start > 0 && !/\s/.test(input[start - 1])) start--;
    let end = caret;
    while (end < input.length && !/\s/.test(input[end])) end++;
    return {
        start,
        end,
        token: input.slice(start, end),
        at_end: caret === end,
    };
}

// 默认配置里的多字符形式。用于区分“内置特殊前缀指令”(如 ct、g<、/)
// 和用户新增的自定义多字符指令(如 xxcallout)。
// 内置特殊前缀不进补全; 自定义多字符形式即使不以 -- 开头也进入补全。
let _default_multi_tokens_cache = null;
function _get_default_multi_tokens() {
    if (_default_multi_tokens_cache) return _default_multi_tokens_cache;
    const tokens = new Set();
    for (const cat of (get_default_command_config().categories || [])) {
        for (const item of (cat.items || [])) {
            for (const c of (item.comms || [])) {
                if (c.form === 'multi' && c.content) tokens.add(c.content);
            }
        }
    }
    _default_multi_tokens_cache = tokens;
    return tokens;
}

// 默认配置里的 kv key, 用于识别用户新增的自定义 kv key(可不用 -- 开头)
let _default_kv_keys_cache = null;
function _get_default_kv_keys() {
    if (_default_kv_keys_cache) return _default_kv_keys_cache;
    const keys = new Set();
    for (const cat of (get_default_command_config().categories || [])) {
        for (const item of (cat.items || [])) {
            for (const c of (item.comms || [])) {
                if (c.form === 'kv' && c.key) keys.add(c.key);
            }
        }
    }
    _default_kv_keys_cache = keys;
    return keys;
}

// 从指令配置构建补全所需的索引
function _build_completion_model(cfg) {
    const model = {
        singles: [],        // 非模式分类的单字符
        mode_singles: [],   // 模式分类的单字符
        modes: [],          // 模式指令, 用于判断是否已进入模式查询
        forms: [],          // 按配置顺序的多字符/kv 形式
        kv_groups: new Map(), // key -> [{key,value,item,cat}]
        single_map: new Map(), // 可组合单字符 -> entry
        initial_singles: [],
    };
    let idx = 0;
    for (const cat of (cfg.categories || [])) {
        for (const item of (cat.items || [])) {
            if (item.enabled === false) continue;
            const item_key = item.id || item.code || item.name || '';
            for (const c of (item.comms || [])) {
                if (!is_command_form_allowed(item, c.form)) continue;
                if (c.form === 'single') {
                    const entry = {ch: c.content, item, cat, idx: idx++, sort_key: `single:${cat.id}:${item_key}:${c.content}`};
                    if (cat.id === 'mode') {
                        model.mode_singles.push(entry);
                        model.modes.push({kind: 'single', value: c.content});
                    } else {
                        entry.combinable = cat.id === 'type' || cat.id === 'path';
                        model.singles.push(entry);
                    }
                } else if (c.form === 'multi') {
                    if (cat.id === 'mode') {
                        model.modes.push({kind: 'token', value: c.content});
                    } else if (c.content.startsWith('--') || !_get_default_multi_tokens().has(c.content)) {
                        model.forms.push({type: 'multi', token: c.content, item, cat, idx: idx++, sort_key: `multi:${cat.id}:${item_key}:${c.content}`});
                    }
                } else if (c.form === 'kv') {
                    const entry = {key: c.key, value: c.value || '', item, cat, idx: idx++};
                    entry.sort_key = `kv:${cat.id}:${item_key}:${entry.key}:${entry.value}`;
                    if (cat.id === 'mode') {
                        model.modes.push({kind: 'kv', key: c.key, value: entry.value});
                    } else if (c.key.startsWith('--') || !_get_default_kv_keys().has(c.key)) {
                        model.forms.push({type: 'kv', ...entry});
                        if (!model.kv_groups.has(c.key)) model.kv_groups.set(c.key, []);
                        model.kv_groups.get(c.key).push(entry);
                    }
                }
            }
        }
    }
    // 单字符展示顺序: 类型 -> 路径 -> 其他(模式)
    const rank = (e) => e.combinable ? (e.cat.id === 'type' ? 0 : 1) : 2;
    model.singles.sort((a, b) => rank(a) - rank(b) || a.idx - b.idx);
    model.initial_singles = [...model.singles, ...model.mode_singles];
    let order = 0;
    for (const e of model.initial_singles) {
        if (e.combinable) {
            e.order = order++;
            model.single_map.set(e.ch, e);
        }
    }
    return model;
}

// 一个 kv key 下的值信息, 用于判断 -- 菜单里显示 key 还是直接显示完整值
function _get_kv_group_info(entries) {
    const values = [];
    let has_empty = false;
    let is_template = false;
    for (const e of entries) {
        if (!e.value) has_empty = true;
        else if (!values.includes(e.value)) values.push(e.value);
        if (e.item.kind === 'time' || e.item.kind === 'heading') is_template = true;
    }
    return {
        values,
        has_empty,
        is_template,
        key_candidate: !(values.length === 1 && !has_empty && !is_template),
    };
}

// 补全形式的默认顺序列表(设置里自定义排序使用)
function get_completion_entries(cfg) {
    if (!cfg || !Array.isArray(cfg.categories)) cfg = get_default_command_config();
    const model = _build_completion_model(cfg);
    const entries = [];
    const seen = new Set();
    const add = (row) => {
        if (!row.key || seen.has(row.key)) return;
        seen.add(row.key);
        entries.push(row);
    };
    // 单字符
    for (const e of model.initial_singles) {
        add({
            key: e.sort_key,
            kind: 'single',
            label: '-' + e.ch,
            name: e.item.name || e.ch,
            group: e.cat.name || '',
            tag: e.cat.name || '',
            scope: 'single',
        });
    }
    // 多字符 / kv key / kv 值: 按指令配置里的形式顺序, 同一个 key 的值跟在 key 后面
    const seen_keys = new Set();
    for (const form of model.forms) {
        if (form.type === 'multi') {
            add({
                key: form.sort_key,
                kind: 'multi',
                label: form.token,
                name: form.item.name || '',
                group: form.cat.name || '',
                tag: form.cat.name || '',
                scope: 'base',
            });
            continue;
        }
        if (seen_keys.has(form.key)) continue;
        seen_keys.add(form.key);
        const group = model.kv_groups.get(form.key) || [];
        const info = _get_kv_group_info(group);
        if (!info.key_candidate) {
            const value = info.values[0];
            const entry = group.find(e => e.value === value);
            if (entry) {
                add({
                    key: entry.sort_key,
                    kind: 'value',
                    label: entry.key + entry.value,
                    name: entry.item.name || '',
                    group: entry.key + ' 值',
                    tag: entry.key,
                    scope: 'base',
                });
            }
            continue;
        }
        add({
            key: `key:${form.key}`,
            kind: 'key',
            label: form.key,
            name: form.cat.name || '',
            group: form.cat.name || '',
            tag: 'kv key',
            scope: 'base',
        });
        // 时间值不参与排序, 只保留 key
        if (group.some(e => e.item.kind === 'time')) continue;
        for (const e of group) {
            if (!e.value) continue;
            add({
                key: e.sort_key,
                kind: 'value',
                label: e.key + e.value,
                name: e.item.name || '',
                group: e.key + ' 值',
                tag: e.key,
                scope: 'kv',
                scope_key: e.key,
            });
        }
    }
    return entries;
}

// 自定义顺序按补全形式分组: 单字符(-)一组; 多字符(--)、kv key 和 kv 完整形式一组;
// 各 kv key 的值再按 key 单独分组
// order 为各形式的 key 数组, 每个分组内部按 order 排序, 组与组之间的顺序固定
function get_completion_custom_groups(entries, order = []) {
    const groups = [
        { id: 'single', title: '单字符指令', tag: '-', entries: [] },
        { id: 'base',   title: '多字符与 kv key', tag: '', entries: [] },
    ];
    const kv_groups = new Map();
    for (const e of (entries || [])) {
        if (e.scope === 'single') {
            groups[0].entries.push(e);
        } else if (e.scope === 'base') {
            groups[1].entries.push(e);
        } else if (e.scope === 'kv') {
            const id = 'kv:' + (e.scope_key || '');
            let group = kv_groups.get(id);
            if (!group) {
                group = { id, title: e.scope_key || '', tag: 'kv 值', entries: [] };
                kv_groups.set(id, group);
                groups.push(group);
            }
            group.entries.push(e);
        }
    }
    const order_index = new Map();
    (order || []).forEach((key, i) => {
        if (!order_index.has(key)) order_index.set(key, i);
    });
    return groups.map(group => {
        const saved = [];
        const rest = [];
        for (const e of group.entries) {
            if (order_index.has(e.key)) saved.push(e);
            else rest.push(e);
        }
        saved.sort((a, b) => order_index.get(a.key) - order_index.get(b.key));
        return { ...group, entries: [...saved, ...rest] };
    }).filter(group => group.entries.length);
}

// 自定义顺序的扁平结果, 用于排序 rank
function get_completion_custom_order(entries, order = []) {
    return get_completion_custom_groups(entries, order)
        .flatMap(group => group.entries.map(e => e.key));
}

// 从一次搜索输入里提取实际用到的补全形式 key(用于使用次数排序)
function get_completion_usage_keys(cfg, query) {
    if (!cfg || !Array.isArray(cfg.categories)) cfg = get_default_command_config();
    const model = _build_completion_model(cfg);
    const keys = new Set();
    const single_by_ch = new Map();
    for (const e of model.initial_singles) {
        if (!single_by_ch.has(e.ch)) single_by_ch.set(e.ch, e);
    }
    const multi_forms = model.forms.filter(f => f.type === 'multi');
    const kv_keys = [...model.kv_groups.keys()].sort((a, b) => b.length - a.length);
    const tokens = String(query || '').split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        if (token.startsWith('--')) {
            const kv_key = kv_keys.find(k => token.startsWith(k));
            if (kv_key) {
                keys.add('key:' + kv_key);
                const group = model.kv_groups.get(kv_key) || [];
                // 时间值不参与排序/计数, 只计 key
                if (!group.some(e => e.item.kind === 'time')) {
                    const payload = token.slice(kv_key.length);
                    const parts = payload.split(',').map(s => s.trim()).filter(Boolean);
                    for (const part of parts) {
                        const entry = group.find(e => e.value === part);
                        if (entry && entry.sort_key) keys.add(entry.sort_key);
                    }
                }
                continue;
            }
            let matched = multi_forms.find(f => f.token === token);
            if (!matched) {
                matched = multi_forms
                    .filter(f => f.item.kind === 'path' && token.startsWith(f.token))
                    .sort((a, b) => b.token.length - a.token.length)[0];
            }
            if (matched && matched.sort_key) keys.add(matched.sort_key);
            continue;
        }
        if (!token.startsWith('-')) {
            // 自定义 kv key 可能不以 -- 开头(如 @@type=doc), 先按 kv 解析
            const custom_kv_key = kv_keys.find(k => !k.startsWith('--') && token.startsWith(k));
            if (custom_kv_key) {
                keys.add('key:' + custom_kv_key);
                const group = model.kv_groups.get(custom_kv_key) || [];
                if (!group.some(e => e.item.kind === 'time')) {
                    const payload = token.slice(custom_kv_key.length);
                    const parts = payload.split(',').map(s => s.trim()).filter(Boolean);
                    for (const part of parts) {
                        const entry = group.find(e => e.value === part);
                        if (entry && entry.sort_key) keys.add(entry.sort_key);
                    }
                }
                continue;
            }
            // 自定义多字符形式可能不以 -- 开头(如 xxcallout), 直接按完整 token 匹配
            let matched = multi_forms.find(f => f.token === token);
            if (!matched) {
                matched = multi_forms
                    .filter(f => is_prefix_item(f.item) && token.startsWith(f.token))
                    .sort((a, b) => b.token.length - a.token.length)[0];
            }
            if (matched && matched.sort_key) keys.add(matched.sort_key);
            continue;
        }
        const chars = token.slice(1);
        for (let i = 0; i < chars.length; i++) {
            const entry = single_by_ch.get(chars[i]);
            if (!entry) break;
            keys.add(entry.sort_key);
            if (entry.cat.id === 'mode') break;
            if (entry.item.kind === 'heading') {
                while (i + 1 < chars.length && /[1-6]/.test(chars[i + 1])) i++;
            }
        }
    }
    return [...keys];
}

function _completion_usage_count(usage, key) {
    if (!key || !usage) return 0;
    if (usage instanceof Map) return usage.get(key) || 0;
    return usage[key] || 0;
}

// 按配置/使用次数/自定义顺序排序候选人
function _sort_completion_list(list, sort_ctx) {
    if (!sort_ctx || !sort_ctx.rank) return list;
    const mode = sort_ctx.mode || 'config';
    let result = list;
    if (mode === 'custom' && sort_ctx.hidden && sort_ctx.hidden.size) {
        result = result.filter(c => !c.sort_key || !sort_ctx.hidden.has(c.sort_key));
    }
    const rank = sort_ctx.rank;
    result.sort((a, b) => {
        if (mode === 'usage') {
            const ca = _completion_usage_count(sort_ctx.usage, a.sort_key);
            const cb = _completion_usage_count(sort_ctx.usage, b.sort_key);
            if (ca !== cb) return cb - ca;
        }
        const ra = a.sort_key && rank.has(a.sort_key) ? rank.get(a.sort_key) : Number.MAX_SAFE_INTEGER;
        const rb = b.sort_key && rank.has(b.sort_key) ? rank.get(b.sort_key) : Number.MAX_SAFE_INTEGER;
        return ra - rb;
    });
    return result;
}

// 单字符列表: 空格项固定在最前面, 其余按排序方式排列
function _sort_single_candidates(candidates, sort_ctx) {
    const spaces = candidates.filter(c => c.kind === 'space');
    const rest = candidates.filter(c => c.kind !== 'space');
    return [...spaces, ..._sort_completion_list(rest, sort_ctx)];
}

// 输入中是否已出现模式指令(-w/-q/-s/-r 等)
function _input_has_mode_command(model, input) {
    const tokens = input.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
        for (const m of model.modes) {
            if (m.kind === 'single' && t === '-' + m.value) return true;
            if (m.kind === 'token' && t === m.value) return true;
            if (m.kind === 'kv' && t.startsWith(m.key)) {
                const val = t.slice(m.key.length);
                if (!m.value || val === m.value) return true;
            }
        }
    }
    // 开头的粘连写法 -sselect
    const first = tokens[0] || '';
    if (first.startsWith('-') && first.length > 2) {
        for (const m of model.modes) {
            if (m.kind === 'single' && first.startsWith('-' + m.value)) return true;
        }
    }
    return false;
}

// 单字符组合: 空格 + 剩余可组合字符
function _get_single_candidates(model, token_info, sort_ctx = null) {
    const chars = token_info.token.slice(1);
    const used = [];
    let i = 0;
    while (i < chars.length) {
        const ch = chars[i];
        const entry = model.single_map.get(ch);
        if (!entry) return null;
        used.push(ch);
        i++;
        // 标题后面可以跟 1-6 级别
        if (entry.item.kind === 'heading') {
            while (i < chars.length && /[1-6]/.test(chars[i])) i++;
        }
    }
    const candidates = [];
    if (chars.length > 0) {
        candidates.push({
            kind: 'space',
            insert: ' ',
            label: '␣',
            name: '空格（结束）',
            hint: '',
            close: true,
            trailing_space: false,
            order: -1,
        });
    }
    const source = chars.length > 0
        ? model.initial_singles.filter(e => e.combinable && !used.includes(e.ch))
        : model.initial_singles;
    source.forEach(e => {
        candidates.push({
            kind: e.combinable ? 'single' : 'terminal',
            insert: e.ch,
            label: e.ch,
            name: e.item.name || e.ch,
            hint: e.cat.name || '',
            combinable: !!e.combinable,
            close: !e.combinable,
            trailing_space: false,
            order: e.combinable ? e.order : -1,
            sort_key: e.sort_key,
        });
    });
    if (!candidates.length) return null;
    const sorted = _sort_single_candidates(candidates, sort_ctx);
    if (!sorted.length) return null;
    let default_index = 0;
    if (chars.length > 0) {
        const max_order = Math.max(...used.map(ch => model.single_map.get(ch).order));
        // 排序后显示顺序可能变了, 默认高亮仍取"顺序上紧接着"的那一项
        let next_index = -1;
        let next_order = Infinity;
        sorted.forEach((c, i) => {
            if (c.kind === 'single' && c.order > max_order && c.order < next_order) {
                next_index = i;
                next_order = c.order;
            }
        });
        if (next_index !== -1) {
            default_index = next_index;
        } else {
            const space = sorted.findIndex(c => c.kind === 'space');
            default_index = space === -1 ? 0 : space;
        }
    }
    return {
        mode: 'single',
        candidates: sorted,
        default_index,
        token_start: token_info.start,
        token_end: token_info.end,
    };
}

// -- 菜单: 多字符形式 + kv key(单值固定值直接展开)
function _get_key_candidates(model, token_info, sort_ctx = null) {
    const prefix = token_info.token;
    const candidates = [];
    const seen = new Set();
    for (const form of model.forms) {
        if (form.type === 'multi') {
            // 以 -- 开头的形式和 kv key 按输入前缀匹配;
            // 自定义的多字符形式(如 xxcallout)不以 -- 开头, 在 -- 菜单里按去掉 -- 后的内容匹配
            let matched = form.token.startsWith(prefix);
            if (!matched && !form.token.startsWith('--') && prefix.startsWith('--')) {
                matched = form.token.startsWith(prefix.slice(2));
            }
            if (!matched || seen.has('t:' + form.token)) continue;
            seen.add('t:' + form.token);
            candidates.push({
                kind: 'multi',
                insert: form.token,
                label: form.token,
                name: form.item.name || '',
                hint: form.cat.name || '',
                close: true,
                trailing_space: true,
                sort_key: form.sort_key,
            });
            continue;
        }
        const prefix_matched = form.key.startsWith(prefix);
        // 自定义 kv key 不以 -- 开头时, 在 -- 菜单里按去掉 -- 后的内容匹配
        const custom_key_matched = !form.key.startsWith('--') && prefix.startsWith('--') &&
            form.key.startsWith(prefix.slice(2));
        if ((!prefix_matched && !custom_key_matched) || seen.has('k:' + form.key)) continue;
        seen.add('k:' + form.key);
        const entries = model.kv_groups.get(form.key) || [];
        const info = _get_kv_group_info(entries);
        if (!info.key_candidate) {
            const value = info.values[0];
            const entry = entries.find(e => e.value === value);
            candidates.push({
                kind: 'complete',
                insert: form.key + value,
                label: form.key + value,
                name: entries[0].item.name || '',
                hint: entries[0].cat.name || '',
                close: true,
                trailing_space: true,
                sort_key: entry ? entry.sort_key : '',
            });
        } else {
            candidates.push({
                kind: 'key',
                insert: form.key,
                label: form.key,
                name: form.cat.name || '',
                hint: '选择值',
                close: false,
                trailing_space: false,
                sort_key: `key:${form.key}`,
            });
        }
    }
    if (!candidates.length) return null;
    const sorted = _sort_completion_list(candidates, sort_ctx);
    if (!sorted.length) return null;
    return {
        mode: 'key',
        candidates: sorted,
        default_index: 0,
        token_start: token_info.start,
        token_end: token_info.end,
    };
}

// 时间 kv 值补全: 字段 -> 比较符 -> 日期 -> 连接符
// 日期输入阶段不自动弹出; manual=true 时(Tab/选中后刷新)才显示后续步骤
function _get_time_candidates(model, best, suffix, token_info, manual) {
    let head = '';
    let current = suffix;
    const sep = Math.max(suffix.lastIndexOf('&'), suffix.lastIndexOf('|'));
    if (sep !== -1) {
        head = suffix.slice(0, sep + 1);
        current = suffix.slice(sep + 1);
    }
    const base = best + head;
    const field_names = { ct: '创建时间', ut: '更新时间' };
    const op_names = { '<': '早于', '>': '晚于', '=': '等于' };
    const candidates = [];
    let state = '';
    let insert_prefix = base;
    if (current === '' || current === 'c' || current === 'u') {
        state = 'field';
    } else if (current === 'ct' || current === 'ut') {
        state = 'op';
        insert_prefix = base + current;
    } else {
        const m = current.match(/^(ct|ut)([<>=])(\d{0,14})$/);
        if (!m) return null;
        const [, , , date] = m;
        insert_prefix = base + current;
        if (!date) state = 'date';
        else {
            state = 'after_date';
            insert_prefix = base + current;
        }
    }
    if (state === 'field') {
        const fields = ['ct', 'ut'].filter(f => f.startsWith(current));
        fields.forEach(f => candidates.push({
            kind: 'value',
            insert: base + f,
            label: f,
            name: field_names[f],
            hint: '',
            close: false,
            trailing_space: false,
        }));
    } else if (state === 'op') {
        ['<', '>', '='].forEach(op => candidates.push({
            kind: 'value',
            insert: insert_prefix + op,
            label: op,
            name: op_names[op],
            hint: '后接日期',
            close: false,
            trailing_space: false,
        }));
    } else if (state === 'date') {
        candidates.push({
            kind: 'hint',
            insert: '',
            label: '日期',
            name: 'YYYY / YYYYMM / YYYYMMDD / 14位',
            hint: '',
            close: true,
            trailing_space: false,
        });
    } else if (state === 'after_date') {
        // 日期输入期间不自动弹出, Tab/手动刷新时才列出下一步
        if (!manual) return null;
        candidates.push(
            { kind: 'value', insert: insert_prefix + '&', label: '&', name: '并且', hint: '继续添加条件', close: false, trailing_space: false },
            { kind: 'value', insert: insert_prefix + '|', label: '|', name: '或者', hint: '继续添加条件', close: false, trailing_space: false },
            { kind: 'space', insert: ' ', label: '␣', name: '空格（结束）', hint: '', close: true, trailing_space: false },
        );
    }
    if (!candidates.length) return null;
    return {
        mode: 'time',
        time: true,
        candidates,
        default_index: 0,
        token_start: token_info.start,
        token_end: token_info.end,
    };
}

// kv 值菜单
function _get_kv_value_candidates(model, token_info, manual = false, sort_ctx = null) {
    const token = token_info.token;
    let best = '';
    for (const key of model.kv_groups.keys()) {
        if (token.startsWith(key) && key.length > best.length) best = key;
    }
    if (!best) return null;
    const suffix = token.slice(best.length);
    const entries = model.kv_groups.get(best) || [];
    // 时间过滤: 单独的表达式引导
    if (entries.some(e => e.item.kind === 'time')) {
        return _get_time_candidates(model, best, suffix, token_info, manual);
    }
    // 块类型和排序支持逗号多值: 连续选择, 已选值隐藏, 空格结束
    const chain = entries.some(e => e.cat.id === 'type' || e.cat.id === 'sort');
    let selected = [];
    let active = suffix;
    if (chain) {
        const parts = suffix.split(',');
        active = parts.pop() || '';
        selected = parts.map(s => s.trim()).filter(Boolean);
    }
    const candidates = [];
    const seen = new Set();
    for (const e of entries) {
        if (!e.value || seen.has(e.value) || !e.value.startsWith(active)) continue;
        if (chain && selected.includes(e.value)) continue;
        seen.add(e.value);
        const full_token = chain
            ? best + (selected.length ? selected.join(',') + ',' : '') + e.value
            : best + e.value;
        candidates.push({
            kind: 'value',
            insert: full_token,
            label: full_token,
            name: e.item.name || '',
            hint: e.item.kind === 'time' ? '后接 >日期' : (e.cat.name || ''),
            close: !chain,
            trailing_space: !chain && e.item.kind !== 'time',
            chain,
            sort_key: e.sort_key,
        });
    }
    if (chain && selected.length) {
        candidates.push({
            kind: 'space',
            insert: ' ',
            label: '␣',
            name: '空格（结束）',
            hint: '',
            close: true,
            trailing_space: false,
            chain: true,
        });
    }
    if (!candidates.length) return null;
    const sorted = _sort_completion_list(candidates.filter(c => c.kind !== 'space'), sort_ctx);
    const spaces = candidates.filter(c => c.kind === 'space');
    const ordered = [...sorted, ...spaces];
    if (!ordered.length) return null;
    return {
        mode: 'value',
        chain,
        candidates: ordered,
        default_index: 0,
        token_start: token_info.start,
        token_end: token_info.end,
    };
}

// 从配置构建解析索引
function build_command_registry(cfg) {
    if (!cfg || !Array.isArray(cfg.categories)) cfg = get_default_command_config();
    const reg = {
        single: new Map(),       // 字符 -> {cat, item}
        multi_exact: new Map(),  // 完整 token -> {cat, item}
        multi_prefix: [],        // {token, cat, item}
        heading_multi: [],       // 标题多字符形式, 后面可接级别数字 1-6
        kv_groups: new Map(),    // key -> [{cat, item, value}]
        modes: [],               // {single|token|key, value, item}
        type_cmd_map: new Map(), // 类型码 -> 展示用指令(取配置中的第一种形式)
        // 被单项开关关闭的指令, 只用于给出"已关闭"的提示
        disabled_single: new Map(),
        disabled_exact: new Map(),
        disabled_prefix: [],
        disabled_kv: [],
    };
    for (const cat of cfg.categories) {
        for (const item of (cat.items || [])) {
            // 被单项开关关闭的项不参与解析
            if (item.enabled === false) {
                for (const c of (item.comms || [])) {
                    if (c.form === 'single') {
                        reg.disabled_single.set(c.content, { cat: cat.id, item });
                    } else if (c.form === 'multi') {
                        if (is_prefix_item(item)) {
                            reg.disabled_prefix.push({ token: c.content, cat: cat.id, item });
                        } else {
                            reg.disabled_exact.set(c.content, { cat: cat.id, item });
                        }
                        // 标题多字符形式还可以带级别数字
                        if (item.kind === 'heading') {
                            reg.disabled_prefix.push({ token: c.content, cat: cat.id, item, heading: true });
                        }
                    } else if (c.form === 'kv' && c.key) {
                        reg.disabled_kv.push({ key: c.key, value: c.value || '', cat: cat.id, item });
                    }
                }
                continue;
            }
            // 类型项的首选展示形式, 供解析面板使用
            if (cat.id === 'type') {
                const cmd = get_item_display_forms(item)[0] || '';
                if (item.kind === 'type') reg.type_cmd_map.set(item.code, cmd);
                else if (item.kind === 'heading') reg.type_cmd_map.set('h', cmd);
                else if (item.kind === 'todo') reg.type_cmd_map.set(item.done ? 'O' : 'o', cmd);
                else if (item.kind === 'link') reg.type_cmd_map.set('L', cmd);
            }
            for (const c of (item.comms || [])) {
                if (!is_command_form_allowed(item, c.form)) continue;
                if (c.form === 'single') {
                    if (cat.id === 'mode') reg.modes.push({ single: c.content, item });
                    else reg.single.set(c.content, { cat: cat.id, item });
                } else if (c.form === 'multi') {
                    if (cat.id === 'mode') reg.modes.push({ token: c.content, item });
                    else if (is_prefix_item(item)) reg.multi_prefix.push({ token: c.content, cat: cat.id, item });
                    else reg.multi_exact.set(c.content, { cat: cat.id, item });
                    // 标题多字符形式允许在末尾追加级别数字
                    if (cat.id !== 'mode' && item.kind === 'heading') {
                        reg.heading_multi.push({ token: c.content, cat: cat.id, item });
                    }
                } else if (c.form === 'kv') {
                    if (cat.id === 'mode') reg.modes.push({ key: c.key, value: c.value || '', item });
                    else {
                        if (!reg.kv_groups.has(c.key)) reg.kv_groups.set(c.key, []);
                        reg.kv_groups.get(c.key).push({ cat: cat.id, item, value: c.value || '' });
                    }
                }
            }
        }
    }
    reg.multi_prefix.sort((a, b) => b.token.length - a.token.length);
    reg.heading_multi.sort((a, b) => b.token.length - a.token.length);
    return reg;
}

// 校验指令配置, 返回错误信息; 没有错误返回空字符串
function validate_command_config(cfg) {
    if (!cfg || !Array.isArray(cfg.categories)) return '缺少 categories 数组';
    const singles = new Set();
    const multis = new Set();
    const kvs = new Set();
    for (const cat of cfg.categories) {
        if (!Array.isArray(cat.items)) return `分类 ${cat.id} 缺少 items`;
        for (const item of cat.items) {
            if (item.enabled === false) continue;  // 关闭的项不参与解析, 也不参与重复校验
            if (!Array.isArray(item.comms)) return `项 ${item.id} 缺少 comms`;
            for (const c of item.comms) {
                if (c.form === 'single') {
                    if (!is_command_form_allowed(item, 'single')) continue;
                    if (typeof c.content !== 'string' || [...c.content].length !== 1) return `单字符必须是 1 个字符: ${c.content}`;
                    if (singles.has(c.content)) return `单字符重复: ${c.content}`;
                    singles.add(c.content);
                } else if (c.form === 'multi') {
                    if (!c.content) return `多字符不能为空: ${item.id}`;
                    if (multis.has(c.content)) return `多字符重复: ${c.content}`;
                    multis.add(c.content);
                } else if (c.form === 'kv') {
                    if (!is_command_form_allowed(item, 'kv')) continue;
                    if (!c.key) return `kv 缺少 key: ${item.id}`;
                    const sig = JSON.stringify([c.key, c.value || '']);
                    if (kvs.has(sig)) return `kv 重复: ${c.key}${c.value || ''}`;
                    kvs.add(sig);
                } else {
                    return `未知的指令形式: ${c.form}`;
                }
            }
        }
    }
    return '';
}

// ===== 指令配置可视化编辑器 =====
const COMMAND_FORM_LABELS = { single: '单字符', multi: '多字符', kv: 'kv' };

// 需要额外说明的指令项
const COMMAND_ITEM_INFOS = {
    h: `标题块
· 在命令末尾加级别 1-6
· 13 表示 1 级和 3 级
· 单字符：如填 h → 输入 -h13
· 多字符：如填 --heading → 输入 --heading13
· kv：如 --type= + heading → 输入 --type=heading13
· kv：如 --hl= 不填值 → 输入 --hl=13
· 级别写错时，整段按关键词搜索`,
    path: `路径过滤
· 只能配多字符，后面直接接路径
· /笔记/项目：路径依次包含“笔记”和“项目”
· 只写路径时，最后一段当文档名；如 /笔记/项目 只搜文档名含“项目”的文档
· 路径里不能有空格
· 不要只填字母（如 bb），否则 bbq 会被当成路径 q
· 建议用 / 这类符号开头`,
    all: `全文档
· 作用：忽略页面路径，搜索所有笔记本
· 支持单字符和多字符，不支持 kv
· -a：搜索全部
· //笔记：在所有笔记本中搜索路径含“笔记”的结果
· 不要只填字母（如 bb），否则 bbq 会被当成“全文档 + 路径 q”
· 建议用 // 这类符号
· 和 -k/-K 同时输入时，以当前文档为准`,
    not_path: `排除路径
· 只能配多字符，后面直接接路径
· -/草稿：排除路径中含“草稿”的结果
· 不要只填字母（如 not），否则 notebook 会被当成排除 ebook 路径
· 建议用 -/ 这类符号
· 只写排除路径时，搜索范围会很大`,
    ct: `创建时间
· 比较符：> < =
· = 表示以该时间开头
· 时间写 1-14 位数字
· & 并且，| 或者
· 示例：ct>2025、ct=20251001`,
    ut: `更新时间
· 比较符：> < =
· = 表示以该时间开头
· 时间写 1-14 位数字
· & 并且，| 或者
· 示例：ut>2025、ut=20251001`,
    not: `排除关键词
· 写在要排除的词前面，如 !广告
· 普通模式下按块排除
· 文档模式下会排除整篇文档
· 不要只填字母（如 not），否则 notebook 会被当成排除 ebook 这个词
· 建议用 ! 这类符号`,
    docmode: `文档模式
· 关键词按整篇文档判断
· 文档里包含所有关键词就算匹配
· 命中的块只需包含其中任意一个
· 普通模式要求同一个块包含所有关键词
· !排除词会排除整篇文档
· 类型、时间、路径仍按块过滤
· 结果仍显示块，不是文档列表`,
    keyword: `关键字搜索
· 模式指令可写在任意位置
· 其余内容原样作为关键词
· 示例：-w 关键词
· 也可连写：-w关键词`,
    query: `查询语法
· 模式指令可写在任意位置
· 其余内容原样作为查询语法
· 示例：-q 中国 OR 历史
· 也可连写：-q查询`,
    sql: `SQL
· 模式指令可写在任意位置
· 其余内容原样作为 SQL
· 示例：-s select ...
· 也可连写：-sselect ...`,
    regex: `正则表达式
· 模式指令可写在任意位置
· 其余内容原样作为正则
· 示例：-r 正则
· 也可连写：-r正则`,
    doc: `按文档分组
· g< 或 g> 都可以，不表示方向
· 同时写多个时，最后一个生效`,
    none: `不分组
· nog< 或 nog> 都可以，不表示方向
· 同时写多个时，最后一个生效`,
};

function has_command_item_info(item) {
    return !!(item && COMMAND_ITEM_INFOS[item.id]);
}

function get_command_info_html(text) {
    if (!text) return "";
    return `<span class="ss-cmd-info" tabindex="0" aria-label="${escapeHtml(text)}"><svg><use xlink:href="#iconInfo"></use></svg></span>`;
}

function get_command_item_info_html(item) {
    return get_command_info_html(item && COMMAND_ITEM_INFOS[item.id]);
}

// 一行指令形式的编辑控件; allowed_forms 指定可选的形式
function get_command_editor_form_html(comm, allowed_forms) {
    const c = comm || { form: 'multi', content: '' };
    let form = c.form || 'multi';
    const labels = {};
    for (const v of (allowed_forms || Object.keys(COMMAND_FORM_LABELS))) labels[v] = COMMAND_FORM_LABELS[v];
    if (!labels[form]) form = 'multi';
    const opts = Object.keys(labels).map(v =>
        `<option value="${v}"${v === form ? ' selected' : ''}>${labels[v]}</option>`).join("");
    return `<div class="ss-cmd-form" data-form="${form}">
        <select class="b3-select ss-cmd-form-type">${opts}</select>
        <input class="b3-text-field ss-cmd-single" maxlength="1"
            value="${escapeHtml(c.form === 'single' ? (c.content || '') : '')}" placeholder="字符, 不含 -">
        <input class="b3-text-field ss-cmd-multi"
            value="${escapeHtml(c.form === 'multi' ? (c.content || '') : '')}" placeholder="完整指令, 如 --audio">
        <input class="b3-text-field ss-cmd-kv-key"
            value="${escapeHtml(c.form === 'kv' ? (c.key || '') : '')}" placeholder="key, 如 --type=">
        <input class="b3-text-field ss-cmd-kv-value"
            value="${escapeHtml(c.form === 'kv' ? (c.value || '') : '')}" placeholder="值, 如 callout">
        <button type="button" class="ss-cmd-del-form" data-action="del-form" title="删除该形式" aria-label="删除该形式">×</button>
    </div>`;
}

// 整个指令配置的编辑界面
function get_command_editor_html(cfg) {
    return (cfg.categories || []).map(cat => `
        <div class="ss-cmd-cat" data-cat="${escapeHtml(cat.id)}">
            <div class="ss-cmd-cat-title">
                <span class="ss-cmd-cat-icon">${escapeHtml(cat.icon || '')}</span>
                <span>${escapeHtml(cat.name || cat.id)}</span>
                <span class="ss-cmd-cat-count">${(cat.items || []).length}</span>
                <button type="button" class="ss-cmd-cat-reset" data-action="reset-cat" title="恢复该分类的默认指令">恢复默认</button>
            </div>
            <div class="ss-cmd-items">
                ${(cat.items || []).map(item => `
                    <div class="ss-cmd-item" data-item-id="${escapeHtml(item.id)}" data-enabled="${item.enabled === false ? 'false' : 'true'}" data-allowed-forms="${get_allowed_command_forms(item).join(',')}" data-info="${has_command_item_info(item) ? 'true' : 'false'}">
                        <span class="ss-cmd-drag" title="拖动调整顺序">⠿</span>
                        <input class="b3-switch ss-cmd-enabled" type="checkbox" ${item.enabled === false ? "" : "checked"} title="启用/禁用该项">
                        <div class="ss-cmd-item-info">
                            <span class="ss-cmd-item-name">${escapeHtml(item.name || item.id)}</span>
                            <span class="ss-cmd-item-hint">${escapeHtml(item.kind === 'heading' ? item.id + ' · 级别后缀 1-6' : item.id)}</span>
                            ${get_command_item_info_html(item)}
                        </div>
                        <div class="ss-cmd-forms">${(item.comms || [])
                            .filter(c => get_allowed_command_forms(item).includes(c.form))
                            .map(c => get_command_editor_form_html(c, get_allowed_command_forms(item))).join("")}</div>
                        <div class="ss-cmd-item-actions">
                            <button type="button" class="ss-cmd-reset-item" data-action="reset-item" title="恢复该项默认" aria-label="恢复该项默认">↺</button>
                            <button type="button" class="ss-cmd-add-form" data-action="add-form" title="添加形式" aria-label="添加形式">+</button>
                        </div>
                    </div>`).join("")}
            </div>
        </div>`).join("");
}

// 从编辑界面读回配置; base_cfg 保留项的类型码、排序值等语义字段
// 项的顺序以界面为准(支持拖动), 开关状态也一并读回
function read_command_config_from_editor(container, base_cfg) {
    const cfg = JSON.parse(JSON.stringify(base_cfg));
    for (const cat of (cfg.categories || [])) {
        const cat_node = container.querySelector(`.ss-cmd-cat[data-cat="${cat.id}"]`);
        if (!cat_node) continue;
        const base_items = new Map((cat.items || []).map(i => [i.id, i]));
        const items = [];
        cat_node.querySelectorAll('.ss-cmd-item').forEach(item_node => {
            const base = base_items.get(item_node.dataset.itemId);
            if (!base) return;
            const item = JSON.parse(JSON.stringify(base));
            const switch_ele = item_node.querySelector('.ss-cmd-enabled');
            item.enabled = switch_ele ? switch_ele.checked : true;
            const comms = [];
            item_node.querySelectorAll('.ss-cmd-form').forEach(row => {
                const form = row.querySelector('.ss-cmd-form-type').value;
                if (!is_command_form_allowed(item, form)) return;
                if (form === 'single') {
                    const content = row.querySelector('.ss-cmd-single').value.trim();
                    if (content) comms.push({ form: 'single', content });
                } else if (form === 'multi') {
                    const content = row.querySelector('.ss-cmd-multi').value.trim();
                    if (content) comms.push({ form: 'multi', content });
                } else if (form === 'kv') {
                    const key = row.querySelector('.ss-cmd-kv-key').value.trim();
                    const value = row.querySelector('.ss-cmd-kv-value').value.trim();
                    if (key) comms.push({ form: 'kv', key, value });
                }
            });
            item.comms = comms;
            items.push(item);
        });
        cat.items = items;
    }
    return cfg;
}

// 对外接口: 解析输入内容
// in: arg: input-search事件的 data.detail.config
// out: {type:搜索类型, val:搜索内容, keywords:关键词, help:帮助信息}
function search_translator(arg) {
    // 搜索结果排序方式
    const TYPE_SORT      = 0; //类型
    const CT_ASC         = 1; //创建时间升序
    const CT_DESC        = 2; //创建时间降序
    const UT_ASC         = 3; //更新时间升序
    const UT_DESC        = 4; //更新时间降序
    const RELEVANCE_ASC  = 6; //相关度升序
    const RELEVANCE_DESC = 7; //相关度降序
    const FILE_CONTENT   = 5; //原文内容顺序
    const GROUP_FLAG     = -1; //指定按文档分组标记
    const NOGROUP_FLAG   = -2; //指定不分组标记
    const groupSortHelpMap = {
        [TYPE_SORT]     : '类型排序',
        [CT_ASC]        : '创建时间升序',
        [CT_DESC]       : '创建时间降序',
        [UT_ASC]        : '更新时间升序',
        [UT_DESC]       : '更新时间降序',
        [RELEVANCE_ASC] : '相关度升序(实际还是类型)',
        [RELEVANCE_DESC]: '相关度降序(实际还是类型)',
        [FILE_CONTENT]  : '原文内容顺序',
    }
    const nonGroupSortHelpMap = {
        [TYPE_SORT]     : '类型排序',
        [CT_ASC]        : '创建时间升序',
        [CT_DESC]       : '创建时间降序',
        [UT_ASC]        : '更新时间升序',
        [UT_DESC]       : '更新时间降序',
        [RELEVANCE_ASC] : '相关度升序(不支持)',
        [RELEVANCE_DESC]: '相关度降序(不支持)',
        [FILE_CONTENT]  : '原文内容顺序(不支持)',
    }
    const sortHelpMap = {
        [TYPE_SORT]     : '类型排序',
        [CT_ASC]        : '创建时间升序',
        [CT_DESC]       : '创建时间降序',
        [UT_ASC]        : '更新时间升序',
        [UT_DESC]       : '更新时间降序',
        [RELEVANCE_ASC] : '相关度升序',
        [RELEVANCE_DESC]: '相关度降序',
        [FILE_CONTENT]  : '原文内容顺序',
    }
    // 块 默认排序方式
    const defaultOrderBy = `order by box ASC, hpath ASC `;
    // 块类型的默认展示顺序(用于生成类型排序的 CASE)
    const default_type_order = ['d', 'h', 'i', 'p', 't', 'b', 'c', 'm', 'l', 's',
        'html', 'widget', 'query_embed', 'iframe', 'audio', 'video', 'av',
        'custom', 'callout', 'tabs', 'tab', 'mindmap', 'mindmap_item', 'tb'];
    const type_order_rank = new Map(default_type_order.map((code, i) => [code, i + 1]));
    // 只列出实际会出现的类型, 避免 SQL 里出现大量永远不命中的 when
    const _buildTypeOrderCase = function(codes) {
        let ret = "case type";
        codes.forEach((code) => {
            ret += ` when '${escapeSqlString(code)}' then ${type_order_rank.get(code)}`;
        });
        return ret + ' end';
    };
    const defaultTypeOrderBy = _buildTypeOrderCase(default_type_order);
    // 块排序
    const typeOrderMapping = {
        "d": " when 'd' then ",
        "h": " when 'h' then ",
        "i": " when 'i' then ",
        "p": " when 'p' then ",
        "t": " when 't' then ",
        "b": " when 'b' then ",
        "c": " when 'c' then ",
        "m": " when 'm' then ",
        "l": " when 'l' then ",
        "s": " when 's' then ",
    };
    // 块映射: 搜索面板的类型 key -> blocks.type 里的类型码
    const blockTypeMapping = {
        audioBlock: 'audio',
        blockquote: 'b',
        callout: 'callout',
        codeBlock: 'c',
        customBlock: 'custom',
        databaseBlock: 'av',
        document: 'd',
        embedBlock: 'query_embed',
        heading: 'h',
        htmlBlock: 'html',
        iframeBlock: 'iframe',
        list: 'l',
        listItem: 'i',
        mathBlock: 'm',
        mindmap: 'mindmap',
        mindmapItem: 'mindmap_item',
        paragraph: 'p',
        superBlock: 's',
        tabItem: 'tab',
        table: 't',
        tabs: 'tabs',
        videoBlock: 'video',
        widgetBlock: 'widget'
    };
    const blockHelpMap = {
        'd': "文档块",
        'l': "列表块",
        'p': "段落块",
        't': "表格块",
        'b': "引述块",
        's': "超级块",
        'i': "列表项块",
        'c': "代码块",
        'm': "公式块",
        'h': "标题块",
        'audio': "音频块",
        'video': "视频块",
        'iframe': "IFrame 块",
        'widget': "挂件块",
        'html': "HTML 块",
        'av': "数据库块",
        'query_embed': "嵌入块",
        'custom': "自定义块",
        'callout': "提示块",
        'tabs': "页签块",
        'tab': "页签项块",
        'mindmap': "思维导图块",
        'mindmap_item': "思维导图项块",
        'tb': "分割线",
    }
    // 需要阻止搜索的特殊输入 - 从配置中读取
    const IGNORED_INPUTS = arg.ignoredInputs || [
        '/',
        '//',
        '-',
        '--',
    ];

    const input           = arg.query;  // 输入的源内容
    const pageSearchPath  = arg.idPath; // 页面配置的搜索路径
    const pageSearchTypes = arg.types;  // 页面配置的搜索类型
    const pageSearchSubTypes = arg.subTypes || {}; // 页面配置的子类型(标题级别/列表类型)

    let   options          = ""; // 解析出来的搜索类型
    let   keywords         = []; // 解析出来的搜索关键词
    const excludedKeywords = []; // 解析出来的排除的关键词
    let   custom_path      = []; // 解析出来的自定义的搜索路径
    let   excludedPath     = []; // 解析出来的排除的搜索路径
    let   custom_path_all  = 0;  // 是否忽略页面的路径
    let   custom_time      = []; // 解析出来的过滤的时间
    let   custom_sort      = []; // 解析出来的自定义的排序方式
    let   custom_group     = -1; // 解析出来的自定义的分组方式

    const help             = {   // 帮助信息存储
        ret_str     : "",
        type        : "",
        group_file  : false,
        keywords    : [],
        excluded    : [],
        block_type  : {},
        type_cmd    : {},   // 类型码 -> 展示用指令
        path        : arg.hPath,
        custom_path : [],
        excludedPath: [],
        custom_time : [],
        sort        : "默认",
        group_desc  : "",
        errors      : [],
    }

    // 指令配置与解析索引
    const reg = build_command_registry(arg.command_config);
    let   extra_types = [];     // 多字符/kv 指定的新类型码
    let   type_order  = [];     // 类型排序优先级, 按输入顺序
    let   effective_types = []; // 本次查询实际可能出现的块类型码(用于生成类型排序)
    let   doc_mode    = false;  // || 文档模式

    // 原生搜索类型 -> 块类型码; 标题级别/列表子类型只勾选部分时保留子类型限制
    const _get_page_type_entries = function() {
        const subtype_groups = {
            heading: {code: 'h', keys: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']},
            list: {code: 'l', keys: ['o', 'u', 't']},
            listItem: {code: 'i', keys: ['o', 'u', 't']},
        };
        const entries = [];
        for (const key in pageSearchTypes) {
            if (!pageSearchTypes[key]) continue;
            const type_code = blockTypeMapping[key];
            if (type_code === undefined) {
                // 思源新增、插件还没映射的类型: 原样使用 key
                entries.push({key, unknown: true});
                continue;
            }
            if (type_code === "") continue;
            const group = subtype_groups[key];
            const selected = group
                ? group.keys.filter(sub => pageSearchSubTypes?.[key]?.[sub])
                : [];
            // 全选或未选都表示不限制子类型; 只勾选部分时保留子类型条件
            if (group && selected.length && selected.length < group.keys.length) {
                entries.push({key, code: type_code, subtypes: selected});
            } else {
                entries.push({key, code: type_code});
            }
        }
        return entries;
    };
    // 把页面类型(含子类型)写入辅助信息
    const _add_page_type_help = function(entries) {
        entries.forEach(entry => {
            if (entry.unknown) {
                help.block_type[entry.key] = "";
            } else if (entry.subtypes) {
                if (entry.key === 'heading') {
                    entry.subtypes.forEach(level => help.block_type[level] = `${level.slice(1)}级标题`);
                } else {
                    help.block_type[entry.code] = blockHelpMap[entry.code];
                }
            } else {
                help.block_type[entry.code] = blockHelpMap[entry.code];
            }
        });
    };

    const _handle_ret = function(ret) {
        ret = ret.replace(/and true /g, '');
        mylog(ret, keywords);
        const type = ret.slice(0, 2);
        const val = ret.slice(2);
        if (keywords.length == 0 && type == '-w' && val.length > 0) {
            keywords.push(val);
        }
        help.ret_str  = ret;
        if (help.type.length == 0) help.type = type;
        help.group_file = doc_mode;
        help.keywords = keywords;
        help.excluded = excludedKeywords;
        if (Object.keys(help.block_type).length == 0 && type != '-s') {
            // 填充辅助信息的类型(包含标题级别/列表子类型)
            _add_page_type_help(_get_page_type_entries());
        }
        if (help.sort == '默认') {
            help.group_desc = arg.group ? "按文档分组" : "不分组";
            help.sort = sortHelpMap[arg.sort];
        }
        // 补齐类型的展示指令: 以当前配置为准, 改名后解析面板也能同步
        for (const key in help.block_type) {
            if (help.type_cmd[key]) continue;
            if (/^h[1-6]*$/.test(key)) {
                help.type_cmd[key] = (reg.type_cmd_map.get('h') || '-h') + key.slice(1);
            } else {
                help.type_cmd[key] = reg.type_cmd_map.get(key)
                    || (key.length > 1 ? '--' + key : '-' + key);
            }
        }
        return {type, val, keywords, help};
    }
    const _parse_time = function(str) {
        if (!str.match(/^[cu]t[>=<][0-9]{1,14}([&|][cu]t[>=<][0-9]{1,14})*$/g)) return false;
        let time_sql = str.replace(/&/g, ' and ').replace(/\|/g, ' or ')
            .replace(/ct/g, 'created').replace(/ut/g, 'updated')
            .replace(/([<>])(\d+)/g, (t, p1, p2) => `${p1}'${p2.padEnd(14, '0')}'`)
            .replace(/=(\d+)/g, " like '$1%'");
        custom_time.push(time_sql);
        let time_help = str.replace(/&/g, ' & ').replace(/\|/g, ' or ')
            .replace(/ct/g, '(创建时间').replace(/ut/g, '(更新时间')
            .replace(/([<>])(\d+)/g, (t, p1, p2) => {
                p2 = p2.padEnd(14, '0');
                return `${p1}${p2.slice(0, 4)}/${p2.slice(4, 6)}/${p2.slice(6, 8)} ${p2.slice(8, 10)}:${p2.slice(10, 12)}:${p2.slice(12, 14)})`;
            })
            .replace(/=(\d+)/g, (t, p1) => {
                p1 = p1.padEnd(14, '*');
                return `=${p1.slice(0, 4)}/${p1.slice(4, 6)}/${p1.slice(6, 8)} ${p1.slice(8, 10)}:${p1.slice(10, 12)}:${p1.slice(12, 14)})`;
            });
        help.custom_time.push(time_help);
        return true;
    }
    const _parse_sort = function(str) {
        if (str.at(-1) != '>' && str.at(-1) != '<') return false;
        const patternMap = {
            'type<' : TYPE_SORT,
            'type>' : TYPE_SORT,
            'ct<'   : CT_ASC,
            'ct>'   : CT_DESC,
            'ut<'   : UT_ASC,
            'ut>'   : UT_DESC,
            'cont<' : FILE_CONTENT,
            'cont>' : FILE_CONTENT,
            'g<'    : GROUP_FLAG,
            'g>'    : GROUP_FLAG,
            'nog<'  : NOGROUP_FLAG,
            'nog>'  : NOGROUP_FLAG,
        };

        let index = 0;
        const keys = Object.keys(patternMap);
        while (index < str.length) {
            let matched = false;
            for (const key of keys) {
                if (str.startsWith(key, index)) {
                    switch(patternMap[key]) {
                    case GROUP_FLAG:
                        custom_group = 1;
                        break;
                    case NOGROUP_FLAG:
                        custom_group = 0;
                        break;
                    default:
                        custom_sort.push(patternMap[key]);
                        break;
                    }
                    index += key.length;
                    matched = true;
                    break;
                }
            }
            // 没有匹配到任何排序
            if (!matched) {
                return false; 
            }
        }
        custom_sort = [...new Set(custom_sort)];
        if (custom_group != -1) {
            arg.group = custom_group;
        }
        // 成功匹配完整个字符串
        return true;
    }
    // 记录一个类型项
    const _add_type = function(item, payload) {
        if (item.kind === 'type') {
            const code = item.code;
            if (code.length === 1) options += code;
            else if (!extra_types.includes(code)) extra_types.push(code);
            if (!type_order.includes(code)) type_order.push(code);
            help.block_type[code] = blockHelpMap[code] || "";
        } else if (item.kind === 'heading') {
            const levels = (payload || '').replace(/[^1-6]/g, '');
            const token = levels ? 'h' + levels : 'h';
            options += token;
            if (!type_order.includes('h')) type_order.push('h');
            help.block_type[token] = levels ? `${[...new Set(levels.split(''))].join(',')}级标题` : '标题';
        } else if (item.kind === 'todo') {
            options += item.done ? 'O' : 'o';
            help.block_type[item.done ? 'O' : 'o'] = blockHelpMap[item.done ? 'O' : 'o'];
        } else if (item.kind === 'link') {
            options += 'L';
            help.block_type['L'] = blockHelpMap['L'];
        }
    };
    // 应用一个解析出来的指令项
    const _apply_item = function(hit, payload) {
        const item = hit.item;
        switch (item.kind) {
        case 'type':
        case 'heading':
        case 'todo':
        case 'link':
            _add_type(item, payload);
            break;
        case 'path': {
            // 统一成以 / 开头的路径: 多字符前缀后面不带 /, kv 形式可能已经带了
            const p = payload.startsWith('/') ? payload : '/' + payload;
            if (item.action === 'path') custom_path.push(p);
            else if (item.action === 'all') { custom_path_all = 1; custom_path.push('/' + p); }
            else if (item.action === 'exclude') excludedPath.push(p);
            break;
        }
        case 'current':
            options += item.tree ? 'K' : 'k';
            break;
        case 'time': {
            const expr = item.field + payload;
            if (!_parse_time(expr)) help.errors.push(`时间格式错误: ${expr}`);
            break;
        }
        case 'group':
            custom_group = item.value;
            arg.group = item.value;
            break;
        case 'sort':
            if (!custom_sort.includes(item.value)) custom_sort.push(item.value);
            break;
        case 'ext':
            if (item.action === 'not') {
                if (payload) excludedKeywords.push(payload);
            } else if (item.action === 'docmode') {
                doc_mode = true;
            }
            break;
        }
    };
    // 处理 kv: 同一个 key 下的值, 逗号分隔可以写多个
    // 标题的 kv 值后面可以接级别数字(1-6), 级别非法时整个 token 退化为关键词
    const _apply_kv = function(group, payload, key) {
        const parts = payload.split(',').map(s => s.trim()).filter(s => s);
        if (!parts.length) { help.errors.push(`kv 指令缺少值: ${payload}`); return; }
        // 只要有一个值对应被单项开关关闭的项, 整个 token 退化为关键词
        const disabled_names = [];
        for (const part of parts) {
            const disabled = (reg.disabled_kv || []).find(g => {
                if (g.key !== key) return false;
                if (g.item.kind === 'time') return g.value && part.startsWith(g.value);
                if (g.item.kind === 'heading' && g.value) {
                    return part === g.value ||
                        (part.startsWith(g.value) && /^[1-6]+$/.test(part.slice(g.value.length)));
                }
                return g.value === '' || part === g.value;
            });
            if (disabled) {
                const name = disabled.item.name || disabled.item.id;
                if (!disabled_names.includes(name)) disabled_names.push(name);
            }
        }
        if (disabled_names.length) {
            const token = key + payload;
            help.errors.push(`指令已关闭, 已按关键词搜索: ${token}（${disabled_names.join("、")}）`);
            keywords.push(token);
            return;
        }
        // 先全部匹配, 避免部分值生效后才发现标题级别非法
        const actions = [];
        for (const part of parts) {
            let matched = null;
            for (const g of group) {
                if (g.item.kind === 'time') {
                    // 时间的值是指段前缀, 后面还可以接比较符
                    if (g.value && part.startsWith(g.value)) { matched = g; break; }
                } else if (g.item.kind === 'heading') {
                    if (g.value === '') {
                        // value 为空: 由输入内容决定级别
                        if (/^[1-6]+$/.test(part)) { matched = g; break; }
                    } else if (part === g.value) {
                        matched = g; break;
                    } else if (part.startsWith(g.value) && /^[1-6]+$/.test(part.slice(g.value.length))) {
                        matched = g; break;
                    }
                } else if (g.value === '' || part === g.value) {
                    matched = g; break;
                }
            }
            if (!matched) {
                // 看起来是给标题指定级别, 但级别不合法
                const heading_attempt = group.some(g => g.item.kind === 'heading' &&
                    (g.value === '' || part.startsWith(g.value)));
                if (heading_attempt) {
                    const token = key + payload;
                    help.errors.push(`未识别的指令, 已按关键词搜索: ${token}`);
                    keywords.push(token);
                    return;
                }
                help.errors.push(`未识别的值: ${part}`);
                continue;
            }
            let item_payload = '';
            if (matched.item.kind === 'time') {
                item_payload = part;
            } else if (matched.item.kind === 'heading' && matched.value !== '') {
                // 固定值后面直接接级别数字
                item_payload = part === matched.value ? '' : part.slice(matched.value.length);
            } else if (matched.value === '') {
                // value 为空表示由用户输入(路径/排除词这类动态值)
                item_payload = part;
            }
            actions.push({ matched, payload: item_payload });
        }
        for (const action of actions) {
            if (action.matched.item.kind === 'time') {
                if (!_parse_time(action.payload)) help.errors.push(`时间格式错误: ${action.payload}`);
            } else {
                _apply_item(action.matched, action.payload);
            }
        }
    };
    // 解析单字符组合, 返回 null 表示不是有效指令
    const _parse_single_combo = function(token) {
        if (!token.startsWith('-') || token.length <= 1) return null;
        const chars = token.slice(1);
        const actions = [];
        let i = 0;
        while (i < chars.length) {
            const hit = reg.single.get(chars[i]);
            if (!hit) return null;
            if (hit.item.kind === 'heading') {
                let j = i + 1;
                while (j < chars.length && /[1-6]/.test(chars[j])) j++;
                actions.push({ hit, payload: chars.slice(i + 1, j) });
                i = j;
            } else {
                actions.push({ hit, payload: '' });
                i++;
            }
        }
        return actions;
    };
    // 判断 token 是否是已注册的指令(不产生副作用)
    const _is_registered_token = function(token) {
        if (reg.multi_exact.has(token)) return true;
        for (const p of reg.heading_multi) {
            if (token.startsWith(p.token) && /^[1-6]*$/.test(token.slice(p.token.length))) return true;
        }
        for (const [key] of reg.kv_groups) if (token.startsWith(key)) return true;
        for (const p of reg.multi_prefix) if (token.startsWith(p.token)) return true;
        return !!_parse_single_combo(token);
    };
    // 判断 token 是否命中了被单项开关关闭的指令
    const _match_disabled_command = function(token) {
        const name_of = (item) => item.name || item.id;
        if (reg.disabled_exact.has(token)) {
            return { names: [name_of(reg.disabled_exact.get(token).item)] };
        }
        for (const p of reg.disabled_prefix) {
            if (!token.startsWith(p.token)) continue;
            const rest = token.slice(p.token.length);
            if (!rest) continue;
            // 时间要带比较符, 避免把 ctf 这类普通词误判成关闭的 ct
            if (p.item.kind === 'time' && !/^[>=<]/.test(rest)) continue;
            // 标题多字符形式后面只允许级别数字
            if (p.heading && !/^[1-6]+$/.test(rest)) continue;
            return { names: [name_of(p.item)] };
        }
        for (const g of reg.disabled_kv) {
            if (!token.startsWith(g.key)) continue;
            const rest = token.slice(g.key.length);
            if (g.value && !rest.startsWith(g.value)) continue;
            return { names: [name_of(g.item)] };
        }
        // 单字符组合: 只要有一个字符对应的项被关闭, 整个 token 都退化为关键词
        if (token.startsWith('-') && token.length > 1) {
            const chars = token.slice(1);
            const names = [];
            let i = 0;
            while (i < chars.length) {
                const enabled = reg.single.get(chars[i]);
                const disabled = reg.disabled_single.get(chars[i]);
                const hit = enabled || disabled;
                if (!hit) return null;
                if (!enabled) {
                    const name = name_of(disabled.item);
                    if (!names.includes(name)) names.push(name);
                }
                if (hit.item.kind === 'heading') {
                    let j = i + 1;
                    while (j < chars.length && /[1-6]/.test(chars[j])) j++;
                    i = j;
                } else {
                    i++;
                }
            }
            if (names.length) return { names };
        }
        return null;
    };
    // 解析单个 token
    const _parse_command_token = function(token) {
        // 1. 完整多字符指令
        if (reg.multi_exact.has(token)) {
            _apply_item(reg.multi_exact.get(token), '');
            return true;
        }
        // 2. 标题的多字符形式: 末尾可以带级别数字 1-6
        for (const p of reg.heading_multi) {
            if (!token.startsWith(p.token)) continue;
            const rest = token.slice(p.token.length);
            if (!/^[1-6]*$/.test(rest)) continue;
            _apply_item({ cat: p.cat, item: p.item }, rest);
            return true;
        }
        // 3. kv / 多字符前缀, 取最长匹配
        let best = null;
        for (const [key, group] of reg.kv_groups) {
            if (token.startsWith(key) && (!best || key.length > best.len)) {
                best = { kind: 'kv', group, payload: token.slice(key.length), key, len: key.length };
            }
        }
        for (const p of reg.multi_prefix) {
            if (token.startsWith(p.token) && (!best || p.token.length > best.len)) {
                best = { kind: 'prefix', hit: { cat: p.cat, item: p.item }, payload: token.slice(p.token.length), len: p.token.length };
            }
        }
        if (best) {
            if (best.kind === 'kv') _apply_kv(best.group, best.payload, best.key);
            else _apply_item(best.hit, best.payload);
            return true;
        }
        // 3. 单字符组合
        const actions = _parse_single_combo(token);
        if (actions) {
            actions.forEach(a => _apply_item(a.hit, a.payload));
            return true;
        }
        return false;
    };
    // 模式指令: 可以在任意位置; 出现后其余内容原样作为查询
    const _scan_mode = function() {
        const tokens = input.split(' ');
        const first = tokens[0] || '';
        // 首 token 是完整的模式指令(多字符/kv)时优先匹配, 避免被粘连单字符误判
        for (const md of reg.modes) {
            if (md.token && first === md.token) {
                const rest = tokens.slice(1).join(' ');
                return { mode: md.item.mode, query: rest.trim() };
            }
            if (md.key && first.startsWith(md.key)) {
                const val = first.slice(md.key.length);
                if (!md.value || val === md.value) {
                    const rest = tokens.slice(1).join(' ');
                    return { mode: md.item.mode, query: rest.trim() };
                }
            }
        }
        // 开头的粘连写法 -sselect, 首 token 不能是其他已注册指令
        if (first.startsWith('-') && !_is_registered_token(first)) {
            for (const md of reg.modes) {
                if (md.single && first.startsWith('-' + md.single)) {
                    const query = first.slice(md.single.length + 1) +
                        (tokens.length > 1 ? ' ' + tokens.slice(1).join(' ') : '');
                    return { mode: md.item.mode, query: query.trim() };
                }
            }
        }
        // 其他位置: 独立的单字符模式, 或多字符/kv 模式
        let hit = null, idx = -1;
        for (let i = 0; i < tokens.length; i++) {
            for (const md of reg.modes) {
                if (md.single && tokens[i] === '-' + md.single) { hit = md; idx = i; }
                else if (md.token && tokens[i] === md.token) { hit = md; idx = i; }
                else if (md.key && tokens[i].startsWith(md.key)) {
                    const val = tokens[i].slice(md.key.length);
                    if (!md.value || val === md.value) { hit = md; idx = i; }
                }
            }
        }
        if (hit) {
            const rest = tokens.slice(0, idx).concat(tokens.slice(idx + 1)).join(' ');
            return { mode: hit.item.mode, query: rest.trim() };
        }
        return null;
    };
    // 解析输入内容
    const _parseInput = function() {
        const inputItems = input.split(" ");
        for (let item of inputItems) {
            if (item === "" || item === "-" || item === "--") {
                continue;
            }
            if (_parse_command_token(item)) continue;
            const disabled_hit = _match_disabled_command(item);
            if (disabled_hit) {
                help.errors.push(`指令已关闭, 已按关键词搜索: ${item}（${disabled_hit.names.join("、")}）`);
                keywords.push(item);
                continue;
            }
            if (item.startsWith('-') && item.length > 1) {
                help.errors.push(`未识别的指令, 已按关键词搜索: ${item}`);
            }
            keywords.push(item);
        }
    }

    // [构造搜索语句] 查询语法
    const _buildExcludeQuery = function() {
        let querySyntax = "-q";
        for (let word of keywords) {
            querySyntax += " " + word;
        }
        for (let word of excludedKeywords) {
            querySyntax += " NOT " + word;
        }
        return querySyntax;
    }
    const _buildSqlKeyWordsOnce = function(word, is_exclude = false) {
        const word_like = escapeSqlLike(word);
        const like = `like '%${word_like}%' escape '!'`;
        const not_like = `not ${like}`;
        if (is_exclude) {
            return `(content ${not_like} and name ${not_like} and alias ${not_like} and memo ${not_like})`;
        }
        else {
            return `(content ${like} or name ${like} or alias ${like} or memo ${like})`;
        }
    }

    // [拼接sql] 过滤关键词
    const _buildSqlKeyWords = function(is_group_file) {
        let sqlKeyWords = "";
        if (is_group_file) {
            // 文档模式
            for (let word of keywords) {
                sqlKeyWords += ` or ${_buildSqlKeyWordsOnce(word)}`;
            }
            // 排除关键词, 文档模式不需要处理
            return sqlKeyWords ? `(${sqlKeyWords.slice(4)})` : "true";
        }
        else {
            // 块模式
            // 匹配关键词
            for (let word of keywords) {
                sqlKeyWords += ` and ${_buildSqlKeyWordsOnce(word)}`;
            }
    
            // 排除关键词
            for (let word of excludedKeywords) {
                sqlKeyWords += ` and ${_buildSqlKeyWordsOnce(word, true)}`;
            }
            return sqlKeyWords ? `(${sqlKeyWords.slice(5)})` : "true";
        }
    }

    // [拼接sql] 过滤块类型
    const _buildSqlTypeRlike = function() {
        // 去掉指定路径相关的选项
        let sqlTypes = options.replace(/[kKe]/g, "");
        let sqlTypeRlike = "";
        if (!sqlTypes && !extra_types.length && !keywords.length && !excludedKeywords.length && custom_path.some(s => /[^/]/.test(s))) {
            // 没有指定类型, 没有关键字/排除字, 路径有效的情况下, 只搜文档
            effective_types.push('d');
            return "true";
        }

        const typeHandlers = {
            // 搜索标准块类型的sql语句
            "[dlptbsicms]": (types) => {
                const basic_type = types.replace(/[^dlptbsicms]/g, "");
                Array.from(basic_type).forEach((type_once) => {
                    help.block_type[type_once] = blockHelpMap[type_once];
                    effective_types.push(type_once);
                });
                return `type regexp '^[${basic_type}]$'`
            },
            // 搜索子标题的sql语句: 多次指定标题级别时取并集
            "h[1-6]*": (types) => {
                effective_types.push('h');
                const matches = types.match(/h[1-6]*/g) || [];
                const headType = `type regexp '^[h]$'`;
                // 单独的 h 表示所有标题
                if (matches.includes('h')) {
                    help.block_type['h'] = "标题";
                    return headType;
                }
                const subType = [...new Set(matches.join("").replace(/[^\d]/g, "").split(""))]
                    .sort().join("");
                if (subType == '') {
                    help.block_type['h'] = "标题";
                    return headType;
                }
                return `(${headType} and subtype regexp '^h[${subType}]$')`;
            },
            // 搜索待办的sql语句
            "[oO]": (types) => {
                effective_types.push('t');
                let todoCondition = "";
                if (types.includes('o')) {
                    help.block_type['o'] = "未完成的待办项";
                    todoCondition = "markdown like '%[ ] %'";
                }
                if (types.includes('O')) {
                    help.block_type['O'] = "已完成的待办项";
                    if(todoCondition) todoCondition += ' or ';
                    todoCondition += "markdown like '%[x] %'";
                }
                return `(subtype like 't' and type not like 'l' and (${todoCondition}))`;
            },
            // 搜索带链接的块的sql语句
            "[L]": () => {
                effective_types.push('h', 'p', 't');
                help.block_type['L'] = "表示带有链接的块";
                return `(type regexp '^[htp]$' and markdown like '%[%](%)%')`
            },
        };
        // 解析选项, 拼接sql语句
        for (let key in typeHandlers) {
            if (sqlTypes.match(key)) {
                if (sqlTypeRlike !== "") sqlTypeRlike += " or ";
                sqlTypeRlike += typeHandlers[key](sqlTypes);
            }
        }

        // 多字符/kv 指令指定的新块类型
        if (extra_types.length) {
            effective_types.push(...extra_types);
            const codes = [...new Set(extra_types)].map(escapeSqlString);
            const extra_sql = `type in ('${codes.join("','")}')`;
            sqlTypeRlike = sqlTypeRlike ? `(${sqlTypeRlike}) or ${extra_sql}` : extra_sql;
        }

        // 未指定搜索块类型时，选择“搜索类型”中开启的块类型
        if (sqlTypeRlike === "") {
            const entries = _get_page_type_entries();
            const types = [];           // 不受子类型限制的父类型
            const subtype_filters = []; // 只保留部分子类型的父类型
            entries.forEach(entry => {
                if (entry.unknown) {
                    types.push(entry.key);
                    effective_types.push(entry.key);
                } else if (entry.subtypes) {
                    effective_types.push(entry.code);
                    subtype_filters.push(`(type = '${entry.code}' and subtype in ('${entry.subtypes.join("','")}'))`);
                } else {
                    types.push(entry.code);
                    effective_types.push(entry.code);
                }
            });
            _add_page_type_help(entries);
            // 类型码不再是单字符(callout/mindmap 等), 不能用字符类
            const clauses = [];
            if (types.length) clauses.push(`type in ('${types.join("','")}')`);
            clauses.push(...subtype_filters);
            if (clauses.length > 1) {
                sqlTypeRlike = `(${clauses.join(' or ')})`;
            } else {
                sqlTypeRlike = clauses[0] || "false";
            }
        }
        return sqlTypeRlike ? `(${sqlTypeRlike})` : "true";
    }
    // [拼接sql] 以文档维度,过滤关键词
    const _buildSqlGroupByFile = function() {
        let sqlGroupByFile = "";
        if (doc_mode) {
            // 文档模式才处理
            // 暂时先不处理块类型
            // let sqlTypeRlike = 'and ' + _buildSqlTypeRlike(options);
            // if (sqlTypeRlike == 'and true') sqlTypeRlike = '';
            for (let word of keywords) {
                sqlGroupByFile += ` and root_id in (select root_id from blocks where ${_buildSqlKeyWordsOnce(word)})`;
            }
            // 排除关键词
            for (let word of excludedKeywords) {
                sqlGroupByFile += ` and root_id not in (select root_id from blocks where ${_buildSqlKeyWordsOnce(word)})`;
            }
        }
        return sqlGroupByFile ? `(${sqlGroupByFile.slice(5)})` : "true";
    }
    // [拼接sql] 过滤时间
    const _buildSqlFilterTime = function() {
        let sqlFilterTime = ""
        custom_time.forEach(time => {
            sqlFilterTime += ` and (${time})`
        })
        return sqlFilterTime ? `(${sqlFilterTime.slice(5)})` : "true";
    }
    // [拼接sql] 自定义路径
    const _buildSqlCustomPath = function() {
        let sqlCustomPath = "";
        if (!custom_path.length && !excludedPath.length) return "true";
        // 逐段转义后用 %/% 连接: 段与段之间必须有一个 /, 避免 "文档1文档2" 这类名字被误命中
        const _pathLike = (arr) => arr.map(escapeSqlLike).join('%/%');
        // 用户是否输入了关键词, 必须在循环前判断: 循环里会把路径推导出的文档名 push 进 keywords
        const no_keywords = keywords.length == 0;
        // 指定搜索路径名称
        // 1. 只有搜索路径 /笔记本1/文档1
        // 2. 指定搜索路径 加其他 /笔记本1 -h 序列号
        custom_path.forEach((path) => {
            const path_arr = path.split('/').filter(part => part !== '');
            if (path_arr.length == 0) return;

            let file_sql = ""
            if (no_keywords) {
                // 没有关键词时, 转成搜索文档
                const file_name = path_arr.at(-1);
                file_sql = `type regexp '^[d]$' and content like '%${escapeSqlLike(file_name)}%' escape '!'`
                help.block_type['d'] = blockHelpMap['d'];
                keywords.push(file_name);
            }
            help.custom_path.push(`*${path_arr.join('*/*')}*`);
            file_sql = file_sql ? ` and (${file_sql})` : "";
            // 拼接剩余路径的sql语句
            // 1. 只搜索笔记本下面的路径
            let sql_once = `(hpath like '%${_pathLike(path_arr)}%' escape '!'${file_sql})`;
            // 2. 将第一个路径当做笔记本, 剩余的当做笔记本下面的路径
            const book_arr = SYT.get_book_arr_from_name(path_arr[0]);
            path_arr.shift();
            // 有对应的笔记本id && 还有其他路径, 才搜笔记本
            // 而且笔记本可能是有多个, 都要搜出来
            if (book_arr.length) {
                const path_sql = path_arr.length ? ` and hpath like '%${_pathLike(path_arr)}%' escape '!'` : '';
                sql_once += ` or (box in ('${book_arr.map(escapeSqlString).join("','")}')${path_sql}${file_sql})`
            }
            sqlCustomPath += ` and (${sql_once})`;
        });
        excludedPath.forEach((path) => {
            const path_arr = path.split('/').filter(part => part !== '');
            if (path_arr.length == 0) return;
            help.excludedPath.push(`*${path_arr.join('*/*')}*`);
            // 1. 只搜索笔记本下面的路径
            let sql_once = `(hpath like '%${_pathLike(path_arr)}%' escape '!')`;
            // 2. 将第一个路径当做笔记本, 剩余的当做笔记本下面的路径
            const book_arr = SYT.get_book_arr_from_name(path_arr[0]);
            path_arr.shift();
            // 有对应的笔记本id && 还有其他路径, 才搜笔记本
            // 而且笔记本可能是有多个, 都要搜出来
            if (book_arr.length) {
                const path_sql = path_arr.length ? ` and hpath like '%${_pathLike(path_arr)}%' escape '!'` : '';
                sql_once += ` or (box in ('${book_arr.map(escapeSqlString).join("','")}')${path_sql})`
            }
            sqlCustomPath += ` and not (${sql_once})`;
        });

        return sqlCustomPath ? `(${sqlCustomPath.slice(5)})` : "true";
    }
    // [拼接sql] 限制文档路径
    const _buildSqlCurrentDoc = function() {
        let sqlCurrentDoc = "";
        if (options.match(/[kK]/)) {
            // 指定搜索路径为: 当前文档或子文档
            const currentDocId = SYT.get_data_id();
            if (currentDocId) {
                sqlCurrentDoc = options.match(/K/)
                    ? `path regexp '${escapeSqlString(currentDocId)}'`
                    : `path like '%${escapeSqlLike(currentDocId)}.sy' escape '!'`;
                help.path = options.match(/K/) ? "当前文档及子文档" : "当前文档";
            }
        } else if (custom_path_all) {
            // 指定搜索路径为全部
            help.path = "全部";
        } else if (pageSearchPath.length) {
            // 使用搜索页面上的搜索路径
            let filterPath = "";
            for (let path of pageSearchPath) {
                let boxPath = "";
                let filePath = "";
                const idx = path.indexOf('/');
                if (idx === -1) {
                    boxPath = path;
                    filterPath += ` or (box='${escapeSqlString(boxPath)}')`;
                } else {
                    boxPath = path.slice(0, idx);
                    filePath = path.slice(idx);
                    filterPath += ` or (box='${escapeSqlString(boxPath)}' and path like '${escapeSqlLike(filePath)}%' escape '!')`;
                }
            };
            if (filterPath.length) {
                sqlCurrentDoc = `${filterPath.slice(4)}`;
            }
        }
        return sqlCurrentDoc ? `(${sqlCurrentDoc})` : "true";
    }
    const _buildOrderByFromType = function(sort_e, sort_help=[]) {
        if (sort_e != TYPE_SORT) {
            sort_help.push(nonGroupSortHelpMap[sort_e]);
        }
        switch(sort_e) {
        case TYPE_SORT: {
            // 类型排序: 只列出本次查询实际会出现的类型
            if (type_order.length) {
                // 显式指定类型: 按输入顺序排序, 保持原有行为
                const codes = [...new Set(type_order)];
                let ret_sql = "case type";
                const help_tmp = [];
                codes.forEach((code, i) => {
                    ret_sql += ` when '${escapeSqlString(code)}' then ${i}`;
                    help_tmp.push(blockHelpMap[code] || code);
                });
                sort_help.push(`类型排序(${help_tmp.join(' → ')})`);
                // 只有一种类型时, 类型排序没有意义
                return codes.length > 1 ? ret_sql + ' end' : "";
            }
            const codes = [...new Set(effective_types)];
            // 无法确定有效类型, 或含思源新增的未知类型时, 回退全量默认顺序
            if (!codes.length || codes.some(code => !type_order_rank.has(code))) {
                sort_help.push(nonGroupSortHelpMap[TYPE_SORT]);
                return defaultTypeOrderBy;
            }
            sort_help.push(nonGroupSortHelpMap[TYPE_SORT]);
            // 只有一种类型时, 类型排序没有意义, 不生成 ORDER BY
            return codes.length > 1 ? _buildTypeOrderCase(codes) : "";
        }
        case CT_ASC:
            return "created ASC";
        case CT_DESC:
            return "created DESC";
        case UT_ASC:
            return "updated ASC";
        case UT_DESC:
            return "updated DESC";
        case RELEVANCE_ASC:
            return "sort ASC";
        case RELEVANCE_DESC:
            return "sort DESC";
        // 相关度用到了blocks_fts表, 但是搜索框不支持, 所以无法支持
        }
        return "true";
    }
    // [拼接sql] 搜索结果排序方式
    const _buildOrderByQuery = function() {
        let sqlOrderBy = "order by ";
        const group_src = custom_group == -1 ? "" : "(指定)";
        const sort_src = custom_sort.length ? "(指定)" : "";
        help.group_desc = `${arg.group ? "按文档分组" : "不分组"}${group_src}`;
        if (arg.group) {
            // 按照文档分组, 只支持指定的第一个方式或页面
            sqlOrderBy = defaultOrderBy;
            arg.sort = custom_sort.length ? custom_sort[0] : arg.sort;
            switch(arg.sort) {
            case TYPE_SORT:
            case FILE_CONTENT:
            case RELEVANCE_ASC:
            case RELEVANCE_DESC:
                // 这四种排序方式, 会被思源内置逻辑修改掉, 无法通过sql进行干预
                // 按文档分组的相关度排序, 看起来思源本身也不支持这种排序方式, 会被修改成按照类型排序
                // 所以这里修改页面配置即可, 不需要
                break;
            default:
                // 其他排序方式, 拼接sql
                sqlOrderBy += ', ' + _buildOrderByFromType(arg.sort);
            }
            let detail = groupSortHelpMap[arg.sort];
            if (arg.sort == TYPE_SORT && type_order.length) {
                detail = `类型排序(${type_order.map(code => blockHelpMap[code] || code).join(' → ')})`;
            }
            help.sort = `文档路径升序 → 文档内按${detail}${sort_src}`;
        }
        else {
            // 不按照文档分组的排序, 思源不会处理, 所以都可以通过sql干预
            const help_tmp = [];
            const sort_arr = [];
            if (custom_sort.length) {
                // 指定了排序, 按照指定的拼接sql
                custom_sort.forEach(sort_e => {
                    const part = _buildOrderByFromType(sort_e, help_tmp);
                    if (part) sort_arr.push(part);
                });
            }
            else {
                // 没有指定排序, 按照页面配置
                const part = _buildOrderByFromType(arg.sort, help_tmp);
                if (part) sort_arr.push(part);
            }
            // 类型排序在只有一种类型时没有意义, 此时不生成 ORDER BY
            sqlOrderBy = sort_arr.length ? `order by ${sort_arr.join(", ")}` : "";
            help.sort = `${help_tmp.join(' → ')}${sort_src}`;
        }
        if (sqlOrderBy == "order by ") {
            sqlOrderBy = defaultOrderBy;
            help.sort = `默认`;
        }
        return sqlOrderBy;
    }
    // [构造搜索语句] sql搜索
    const _buildSqlSearchQuery = function() {
        let sqlPrefix = 'select * from blocks where ' + SYT.SQL_FLAG;
        // 过滤关键词
        let sqlKeyWords = _buildSqlKeyWords(doc_mode);
        // 过滤块类型
        let sqlTypeRlike = _buildSqlTypeRlike(options);
        // 以文档维度,过滤关键词
        let sqlGroupByFile = _buildSqlGroupByFile();
        // 过滤时间
        let sqlFilterTime = _buildSqlFilterTime();
        // 自定义文档路径
        let sqlCustomPath = _buildSqlCustomPath();
        // 限制文档路径
        let sqlCurrentDoc = _buildSqlCurrentDoc(options, pageSearchPath);
        // 搜索结果排序方式
        let sqlOrderBy = _buildOrderByQuery(options);

        return `-s${sqlPrefix} and ${sqlKeyWords} and ${sqlTypeRlike} and ${sqlGroupByFile} and ${sqlFilterTime} and ${sqlCustomPath} and ${sqlCurrentDoc} ${sqlOrderBy}`;
    }

    // 区分场景 构造搜索语句
    const _buildQuery = function() {
        if (options.length || extra_types.length || doc_mode ||
            custom_path.length || excludedPath.length || custom_path_all ||
            custom_time.length || custom_sort.length || custom_group != -1) {
            // 指定选项/路径/时间/排序/分组
            mylog('type: sql语句');
            return _buildSqlSearchQuery(options, keywords, excludedKeywords, pageSearchPath);
        }
        else if (excludedKeywords.length) {
            // 只有排除词, 使用思源提供的查询语法
            mylog('type: 查询语法');
            return _buildExcludeQuery(keywords, excludedKeywords);
        }
        else {
            // 没有选项, 排除词, 自定义路径, 用解析出的关键词拼接;
            // 无效指令已被忽略, 不能把原始输入再当关键词搜索
            mylog('type: 关键词');
            return "-w" + (keywords.length ? keywords.join(" ") : "");
        }
    }

    //-------------------------- 主流程
    // 处理忽略列表，禁止思源本身处理 (去掉首尾空白后再比较)
    if (IGNORED_INPUTS.includes(input.trim())) {
        mylog('输入在忽略列表里面，阻止搜索', input);
        const res = _handle_ret("-w");
        res.blocked = true; // 标记被拦截, 调用方据此跳过等待搜索结束
        return res;
    }
    const mode_hit = _scan_mode();
    if (mode_hit) {
        return _handle_ret(mode_hit.mode + mode_hit.query);
    }
    if (input.length < 2) {
        return _handle_ret("-w"+input);
    }

    // 初步解析
    _parseInput();
    // 构造搜索语句
    const ret = _buildQuery();
    
    return _handle_ret(ret, keywords);
}

/**
 * 智能匹配历史记录（未匹配的按原顺序放在后面），匹配部分高亮
 * @param {string} input - 待匹配的输入字符串
 * @param {string[]} history - 历史记录数组（最多64个元素）
 * @param {boolean} is_all - 没有匹配的是否拼接在后面
 * @param {boolean} prefix_only - 是否只保留精确/前缀匹配(过滤包含和模糊匹配)
 * @returns {string[]} 排序后的历史记录，匹配的在前（高亮），未匹配的按原顺序在后
 */
function matchHistory(input, history, is_all=false, prefix_only=false) {
    /**
     * 计算模糊匹配分数
     * @param {string} input - 输入字符串（小写）
     * @param {string} record - 历史记录（小写）
     * @returns {number} 匹配分数（0表示不匹配）
     */
    function _calculateFuzzyMatchScore(input, record) {
        let inputIndex = 0;
        let recordIndex = 0;
        let consecutiveMatches = 0;
        let totalMatches = 0;
        let currentConsecutive = 0;
        
        while (inputIndex < input.length && recordIndex < record.length) {
            if (input[inputIndex] === record[recordIndex]) {
                totalMatches++;
                currentConsecutive++;
                consecutiveMatches = Math.max(consecutiveMatches, currentConsecutive);
                inputIndex++;
            } else {
                currentConsecutive = 0;
            }
            recordIndex++;
        }
        
        // 如果没有匹配到所有字符，返回0
        if (inputIndex < input.length) {
            return 0;
        }
        
        // 计算模糊匹配分数
        const matchRatio = totalMatches / input.length;
        const consecutiveBonus = consecutiveMatches / input.length * 10;
        const baseScore = 40; // 模糊匹配的基础分数
        
        return baseScore + (matchRatio * 20) + consecutiveBonus;
    }
    /**
     * 计算匹配分数
     * @param {string} input - 输入字符串（小写）
     * @param {string} record - 历史记录（小写）
     * @returns {number} 匹配分数（0表示不匹配）
     */
    function _calculateMatchScore(input, record) {
        // 完全匹配（最高优先级）
        if (record === input) {
            return 100;
        }
        
        // 前缀匹配（高优先级）
        if (record.startsWith(input)) {
            return 80 + Math.min(20, record.length - input.length);
        }
        
        // 包含匹配（中优先级）
        if (record.includes(input)) {
            const position = record.indexOf(input);
            // 位置越靠前，分数越高
            const positionScore = Math.max(0, 20 - position);
            return 60 + positionScore;
        }
        
        // 模糊匹配：检查输入的所有字符是否按顺序出现在记录中
        return _calculateFuzzyMatchScore(input, record);
    }

    /**
     * 高亮 record 中与 input 模糊匹配的部分（按顺序出现的字符）
     * @param {string} record - 原始字符串
     * @param {string} input - 输入关键词
     * @returns {string} HTML 字符串，模糊匹配的字符被 <span> 包裹
     */
    function _highlightMatch(record, input) {
        if (!input || !input.trim()) return record;

        const inputClean = input.trim();
        const inputLower = inputClean.toLowerCase();
        const recordLower = record.toLowerCase();

        const result = [];
        let inputIndex = 0;
        let lastMatchedIndex = -1;
        const matchedIndices = new Set(); // 记录哪些位置需要高亮

        // 第一步：找出模糊匹配的所有字符位置（贪心匹配）
        for (let i = 0; i < record.length && inputIndex < inputLower.length; i++) {
            if (recordLower[i] === inputLower[inputIndex]) {
                matchedIndices.add(i);
                inputIndex++;
                lastMatchedIndex = i;
            }
        }

        // 如果不是完整匹配 input，就不高亮
        if (inputIndex < inputLower.length) {
            return record; // 没有完整模糊匹配，不加高亮
        }

        // 第二步：构建带高亮的结果
        let i = 0;
        while (i < record.length) {
            if (matchedIndices.has(i)) {
                let j = i;
                // 合并连续的匹配字符
                while (j < record.length && matchedIndices.has(j)) {
                    j++;
                }
                const matchedText = record.substring(i, j);
                result.push(`<span class="HZ-search-history-highlight">${escapeHtml(matchedText)}</span>`);
                i = j;
            } else {
                result.push(escapeHtml(record[i]));
                i++;
            }
        }

        return result.join('');
    }

    // 预处理：去重、过滤空值
    const cleanHistory = [...new Set(history)].filter(record => record && record.trim());

    if (!input || !input.trim()) {
        if (is_all) return cleanHistory;
        else return [];
    }
    if (!history || history.length === 0) {
        return [];
    }
    
    const inputTrimmed = input.trim();
    const inputLower = inputTrimmed.toLowerCase();

    
    const matchedResults = [];
    const unmatchedResults = [];
    
    for (const record of cleanHistory) {
        const recordLower = record.toLowerCase();
        const is_prefix_match = recordLower === inputLower || recordLower.startsWith(inputLower);
        const matchScore = _calculateMatchScore(inputLower, recordLower);

        if (matchScore > 0 && (!prefix_only || is_prefix_match)) {
            // 高亮匹配项
            const highlighted = _highlightMatch(record, inputTrimmed);
            matchedResults.push({ record: highlighted, score: matchScore, original: record });
        } else if (is_all){
            unmatchedResults.push(escapeHtml(record));
        }
    }

    // 排序：按分数降序，分数相同按原始顺序
    matchedResults.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return cleanHistory.indexOf(a.original) - cleanHistory.indexOf(b.original);
    });

    // 返回：匹配的（按分数排序, 已高亮） + 未匹配的（原顺序）
    return [
        ...matchedResults.map(item => item.record),
        ...unmatchedResults
    ];
}

// 插件设置默认值(设置面板的“重置所有”也使用这里)
function get_default_plugin_settings() {
    return {
        plugin_enabled    : true,           // 插件总开关
        log_level         : 'info',         // 日志等级: off/error/warn/info/debug
        assist_sw         : true,           // 辅助信息显示框 是否显示
        btn_show_help     : true,           // 搜索页顶部是否显示指令手册按钮
        btn_show_setting  : true,           // 搜索页顶部是否显示简搜设置按钮
        history_auto      : 'smart',        // 自动显示历史记录: close-关闭, smart-智能显示, always-总是显示
        history_auto_prefix_only: false,    // 自动显示历史时是否只保留前缀匹配(过滤包含/模糊匹配)
        intercept_search  : true,           // 历史列表显示期间是否拦截(暂停)原生搜索
        replace_history   : true,           // 历史列表快捷键(Alt+↓)是否启用
        command_shortcut  : true,           // 指令补全快捷键(Tab)是否启用
        completion_sort   : 'config',       // 补全排序方式: config-设置顺序, usage-使用次数, custom-自定义
        completion_order  : [],             // 自定义补全顺序(补全形式 key 数组)
        completion_hidden : [],             // 自定义排序下隐藏的补全形式 key
        replace_search_res: true,           // 是否接管搜索结果
        forbid_enter_create: true,          // 搜索结果为空时, 禁用回车创建新文档, 改为点击创建
        restree_style     : "native_tree",  // 文档树样式: 原生列表:native_list, 原生树:native_tree, 多彩:colorful, ediary
        sync_file         : true,           // 搜索结果的样式是否同步到文档树那里
        search_res_top    : true,           // 文档下的结果是否置顶
        restree_all_path  : true,           // 显示全路径
        is_highlight_open : true,           // 通过 双击/回车 跳转到对应位置后, 高亮搜索的关键词
        is_blink_open     : false,          // 通过 双击/回车 跳转到对应位置后, 闪烁当前的块
        cursor_position   : "after",        // 通过 双击/回车 跳转到对应位置后, 光标效果: 不处理:none, 之前:before, 选中:select, 之后:after
        ignored_inputs    : ["/", "//", "-", "--"], // 需要阻止搜索的特殊输入
        command_complete  : true,           // 输入 -/-- 时是否显示指令补全(默认开启)
        command_rows      : 15,             // 指令补全菜单最多显示的行数, 0=只按窗口高度限制
        history_rows_intercept: 15,         // 拦截搜索开启时历史列表最多显示的行数, 0=不限制
        history_rows_normal   : 4,          // 拦截搜索关闭时历史列表最多显示的行数, 0=不限制
        command_config    : get_default_command_config(), // 指令配置(分类/key/三种形式)
    };
}

class SimpleSearchHZ extends siyuan.Plugin {
    get_ele(selector) {
        if (!document.body.contains(this.page)) {
            this.page = null;
            return null;
        }
        return this.page.querySelector(selector);
    }
    get_search_input() {
        return this.get_ele('#searchInput');
    }
    dispatch_input() {
        // console.log('手动触发input事件');
        this.get_search_input()?.dispatchEvent(new InputEvent("input"));
    }
    get_search_history_ul() {
        return this.get_ele('#simpleSearchHistoryList');
    }
    get_suggestion_box() {
        return this.get_ele('#simpleSearchSuggestionBox');
    }
    // 输入框与建议列表合并时, 给输入框加上外壳样式; 关闭后恢复原生透明输入框
    set_suggestion_open(open) {
        const input = this.get_search_input();
        if (input) input.classList.toggle('HZ-search-suggestion-open', !!open);
    }
    is_show_history_list() {
        return this.suggestion_mode === 'history' && !this.get_suggestion_box()?.classList.contains('fn__none');
    }
    is_show_command_list() {
        return this.suggestion_mode === 'command' && !this.get_suggestion_box()?.classList.contains('fn__none');
    }
    // 当前搜索页的建议列表手动状态: history/command 分别为 null|'show'|'hide'
    get_page_suggestion_state(input = this.get_search_input()) {
        const page = input?.closest('.fn__flex-column') || this.page;
        if (!page) return null;
        if (!this.page_suggestion_states) this.page_suggestion_states = new WeakMap();
        let state = this.page_suggestion_states.get(page);
        if (!state) {
            state = { history: null, command: null };
            this.page_suggestion_states.set(page, state);
        }
        return state;
    }
    // 当前搜索页的历史显示模式(手动状态优先)
    get_history_auto_mode(input = this.get_search_input()) {
        const state = this.get_page_suggestion_state(input);
        if (state?.history === 'hide') return 'close';
        if (state?.history === 'show') return 'always';
        return this.g_setting.history_auto;
    }
    // 补全候选的排序上下文: 默认顺序/使用次数/自定义
    get_completion_sort_ctx() {
        const cfg = this.g_setting.command_config;
        if (!this._completion_entries_cache || this._completion_entries_cache.cfg !== cfg) {
            const entries = get_completion_entries(cfg);
            const rank = new Map(entries.map((e, i) => [e.key, i]));
            this._completion_entries_cache = { cfg, entries, rank };
        }
        const mode = this.g_setting.completion_sort || 'config';
        let rank = this._completion_entries_cache.rank;
        let hidden = null;
        if (mode === 'custom') {
            const order = Array.isArray(this.g_setting.completion_order) ? this.g_setting.completion_order : [];
            const custom = new Map();
            let i = 0;
            for (const key of get_completion_custom_order(this._completion_entries_cache.entries, order)) {
                if (rank.has(key) && !custom.has(key)) custom.set(key, i++);
            }
            for (const key of rank.keys()) {
                if (!custom.has(key)) custom.set(key, i++);
            }
            rank = custom;
            hidden = new Set(Array.isArray(this.g_setting.completion_hidden) ? this.g_setting.completion_hidden : []);
        }
        return { mode, rank, usage: this.completion_usage || {}, hidden };
    }
    // 补全形式使用次数: 只在实际搜索/点击结果时计数
    load_completion_usage() {
        this.loadData("completion_usage.json").then((raw) => {
            let data = raw;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { data = null; }
            }
            const merged = (!this._completion_usage_ignore_load && data && typeof data === 'object' && !Array.isArray(data)) ? { ...data } : {};
            // 加载完成前如果已经计数, 合并进来而不是覆盖
            for (const [key, count] of Object.entries(this.completion_usage || {})) {
                merged[key] = (merged[key] || 0) + count;
            }
            this.completion_usage = merged;
            this._completion_usage_loaded = true;
            if (this._completion_usage_dirty) this.schedule_completion_usage_save();
        }, () => {
            this._completion_usage_loaded = true;
            if (this._completion_usage_dirty) this.schedule_completion_usage_save();
        });
    }
    schedule_completion_usage_save() {
        if (!this._completion_usage_loaded) return;
        clearTimeout(this._completion_usage_save_timer);
        this._completion_usage_save_timer = setTimeout(() => {
            this._completion_usage_dirty = false;
            const ret = this.saveData("completion_usage.json", JSON.stringify(this.completion_usage));
            if (ret && ret.catch) ret.catch(e => mylog_error("保存补全使用次数失败", e));
        }, 500);
    }
    count_completion_usage(query, input = this.get_search_input()) {
        const value = String(query || '');
        const page = input?.closest?.('.fn__flex-column') || this.page;
        if (!value || !page) return;
        if (!this._last_counted_queries) this._last_counted_queries = new WeakMap();
        if (this._last_counted_queries.get(page) === value) return;
        this._last_counted_queries.set(page, value);
        const keys = get_completion_usage_keys(this.g_setting.command_config, value);
        if (!keys.length) return;
        for (const key of keys) {
            this.completion_usage[key] = (this.completion_usage[key] || 0) + 1;
        }
        this._completion_usage_dirty = true;
        this.schedule_completion_usage_save();
    }
    clear_completion_usage() {
        this.completion_usage = {};
        this._completion_usage_loaded = true;
        this._completion_usage_dirty = false;
        this._completion_usage_ignore_load = true;
        this._last_counted_queries = new WeakMap();
        clearTimeout(this._completion_usage_save_timer);
        const ret = this.saveData("completion_usage.json", "{}");
        if (ret && ret.catch) ret.catch(e => mylog_error("清空补全使用次数失败", e));
    }
    get_search_list() {
        return this.get_ele('#searchList');
    }
    get_new_search_list() {
        return this.get_ele('#HZsimpleSearchList');
    }
    uninit_css_style() {
        if (!this.css) return
        this.css.remove();
        this.css = null;
    }
    init_css_style() {
        this.uninit_css_style();
        let css = "";
        // 竖线风格
        const tree_style = this.g_setting.restree_style;
        if (tree_style == 'native_tree') {
            css = `
                /* 新增的文档树 */
                :root {
                    /* 竖线与父级竖线的距离 */
                    --HZ-sp-vertical-line-interval: 18px;
                    /* 结果与左边竖线的距离 */
                    --HZ-sp-search-res-pad-left: 22px;
                }
                #HZsimpleSearchList .simpleSearchListBody {
                    margin-left: var(--HZ-sp-vertical-line-interval);
                    &>.b3-list-item>.b3-list-item__graphic  {
                        margin-right: 0px;
                    }
                    &>div>[data-type="search-item"] {
                        padding-left: var(--HZ-sp-search-res-pad-left)!important;
                        &>.b3-list-item__graphic {
                            margin-right: 2px;
                        }
                    }
                }
            `
        }
        else if (tree_style == 'colorful') {
            css = `
                /* 新增的文档树 */
                :root {
                    /* 竖线颜色 */
                    --HZ-sp-vertical-line-color-1: var(--b3-font-color7);
                    --HZ-sp-vertical-line-color-2: var(--b3-font-color6);
                    --HZ-sp-vertical-line-color-3: var(--b3-font-color9);
                    --HZ-sp-vertical-line-color-4: var(--b3-font-color11);
                    --HZ-sp-vertical-line-color-5: var(--b3-font-color7);
                    --HZ-sp-vertical-line-color-6: var(--b3-font-color6);
                    --HZ-sp-vertical-line-color-7: var(--b3-font-color9);
                    --HZ-sp-vertical-line-color-8: var(--b3-font-color11);
                    /* 竖线括号粗细 */
                    --HZ-sp-vertical-line-bracket-width: 2px;
                    /* 竖线括号圆角弧度 */
                    --HZ-sp-bracket-border-radius: 8px;
                    /* 竖线与父级竖线的距离 */
                    --HZ-sp-vertical-line-interval: 18px;
                    /* 结果与左边竖线的距离 */
                    --HZ-sp-search-res-pad-left: 2px;
                }
                #HZsimpleSearchList .simpleSearchListBody {
                    margin-left: var(--HZ-sp-vertical-line-interval);
                    border-top-left-radius: var(--HZ-sp-bracket-border-radius);
                    border-bottom-left-radius: var(--HZ-sp-bracket-border-radius);
                    &>div>[data-type="search-item"] {
                        padding-left: var(--HZ-sp-search-res-pad-left)!important;
                    }
                    .b3-list-item__toggle--hl {
                        margin-left: -2px;
                        margin-right: 2px;
                    }
                    border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-1);
                    .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-2);
                    }
                    .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-3);
                    }
                    .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-4);
                    }
                    .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-5);
                    }
                    .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-6);
                    }
                    .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-7);
                    }
                    .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody .simpleSearchListBody {
                        border-left: var(--HZ-sp-vertical-line-bracket-width) solid var(--HZ-sp-vertical-line-color-8);
                    }
                }
            `;
        }
        else if (tree_style == 'ediary') {
            css = `
                :root {
                    /* 竖线与父级竖线的距离 */
                    --HZ-sp-vertical-line-interval: 22px;
                    /* 结果与左边竖线的距离 */
                    --HZ-sp-search-res-pad-left: 26px;
                    /* 竖线颜色 */
                    --HZ-sp-vertical-line-color: var(--b3-theme-on-surface-light);
                }

                #HZsimpleSearchList .simpleSearchListBody {
                    margin-left: var(--HZ-sp-vertical-line-interval);

                    &>.b3-list-item {
                        margin-left: 6px;
                    }

                    &>.b3-list-item>.b3-list-item__graphic {
                        margin-right: 0px;
                    }

                    &>div>[data-type="search-item"] {
                        padding-left: var(--HZ-sp-search-res-pad-left) !important;

                        &>.b3-list-item__graphic {
                            margin-right: 2px;
                        }
                    }
                }

                #HZsimpleSearchList>.b3-list-item {
                    margin-left: 7px;
                }

                /*折叠按钮样式*/
                #HZsimpleSearchList .b3-list-item>.b3-list-item__toggle>svg {
                    background-color: var(--b3-theme-surface);
                    border: 1px solid var(--b3-theme-on-surface-light);
                    padding: 0px;
                    border-radius: 4px;
                    margin-right: 4px;
                }

                /*文档的折叠按钮, 图标要比虚线高一层 */
                #HZsimpleSearchList .b3-list-item__toggle>svg,
                #HZsimpleSearchList .b3-list-item__graphic {
                    z-index: 2;
                }

                /* L型的线 */
                #HZsimpleSearchList .simpleSearchListBody {
                    position: relative;
                }

                #HZsimpleSearchList .simpleSearchListBody::before {
                    content: "";
                    visibility: visible;
                    position: absolute;
                    left: 19px;
                    top: -7px;
                    width: 18px;
                    height: calc(100% - 7px);
                    background: transparent;
                    border-left: 1px dashed var(--HZ-sp-vertical-line-color);
                    border-bottom: 1px dashed var(--HZ-sp-vertical-line-color);
                    z-index: 1;
                }

                /* L型的线并不能完全覆盖, 剩下的由每个文档覆盖*/
                #HZsimpleSearchList .simpleSearchListBody>.b3-list-item:not(:last-child)>.b3-list-item__toggle::before {
                    content: "";
                    visibility: visible;
                    position: absolute;
                    left: 21px;
                    width: 15px;
                    height: 1px;
                    background: transparent;
                    border-bottom: 1px dashed var(--HZ-sp-vertical-line-color);
                    z-index: 1;
                }
            `;
        }
        else {
            return;
        }
        this.css = js_insert_css(css);
    }
    // 打开插件的设置面板(左侧分类 + 右侧配置)
    openSetting() {
        const g_setting = this.g_setting;
        const categories = [
            {id: 'general',    icon: '🔌', name: '常规'},
            {id: 'history',    icon: '🕒', name: '历史记录'},
            {id: 'completion', icon: '⌨️', name: '指令补全'},
            {id: 'command',    icon: '📝', name: '指令配置'},
            {id: 'search',     icon: '🔍', name: '搜索结果'},
            {id: 'jump',       icon: '🎯', name: '跳转效果'},
            {id: 'about',      icon: 'ℹ️', name: '关于'},
        ];
        const row_switch = (key, title, desc) => `
            <label class="fn__flex b3-label config-item" data-setting-row="${key}">
                <div class="fn__flex-1">
                    <div class="config-name">${title}</div>
                    ${desc ? `<div class="b3-label__text">${desc}</div>` : ""}
                </div>
                <span class="fn__space"></span>
                <input class="b3-switch fn__flex-center" type="checkbox" data-key="${key}" ${g_setting[key] ? "checked" : ""}>
            </label>`;
        const row_select = (key, title, desc, options) => `
            <div class="fn__flex b3-label config-item">
                <div class="fn__flex-1">
                    <div class="config-name">${title}</div>
                    ${desc ? `<div class="b3-label__text">${desc}</div>` : ""}
                </div>
                <span class="fn__space"></span>
                <select class="b3-select fn__flex-center fn__size200" data-key="${key}">
                    ${options.map(opt => `<option value="${opt.value}"${g_setting[key] === opt.value ? " selected" : ""}>${opt.label}</option>`).join("")}
                </select>
            </div>`;
        const row_textarea = (key, title, desc, value) => `
            <div class="b3-label config-item">
                <div class="config-name">${title}</div>
                ${desc ? `<div class="b3-label__text">${desc}</div>` : ""}
                <div class="fn__hr"></div>
                <textarea class="b3-text-field fn__block" rows="2" placeholder="例如: /, //, -, --" data-key="${key}">${escapeHtml(value)}</textarea>
            </div>`;
        const row_number = (key, title, desc) => `
            <div class="fn__flex b3-label config-item">
                <div class="fn__flex-1">
                    <div class="config-name">${title}</div>
                    ${desc ? `<div class="b3-label__text">${desc}</div>` : ""}
                </div>
                <span class="fn__space"></span>
                <input class="b3-text-field fn__flex-center fn__size200" type="number" min="0" step="1" data-key="${key}" value="${g_setting[key] ?? 0}">
            </div>`;

        const nav_html = categories.map(cat => `
            <div class="b3-list-item" data-cat="${cat.id}">
                <span class="b3-list-item__graphic">${cat.icon}</span>
                <span class="b3-list-item__text">${cat.name}</span>
            </div>`).join("");

        const content = `
        <div class="b3-dialog__content simpleSearchSetting" style="padding:0;display:flex;flex:1;overflow:hidden;">
            <div class="simpleSearchSettingNav b3-list b3-list--background">${nav_html}</div>
            <div class="simpleSearchSettingPanes fn__flex-1" style="overflow:auto;">
                <div class="simpleSearchSettingPane" data-pane="general">
                    ${row_switch('plugin_enabled', '启用插件', '插件总开关。关闭后不再接管搜索输入、历史记录和搜索结果，并移除已插入的辅助界面；重新打开即可恢复')}
                    ${row_select('log_level', '日志等级', '控制台日志的详细程度，调试级别会输出解析过程等信息', [
                        {value: 'off',   label: '关闭 (off)'},
                        {value: 'error', label: '错误 (error)'},
                        {value: 'warn',  label: '警告 (warn)'},
                        {value: 'info',  label: '信息 (info)'},
                        {value: 'debug', label: '调试 (debug)'},
                    ])}
                    ${row_textarea('ignored_inputs', '阻止搜索的特殊输入', '当输入框内容完全匹配以下任一值时, 阻止搜索(多个值用英文逗号分隔)', (g_setting.ignored_inputs || []).join(", "))}
                    ${row_switch('btn_show_help', '显示“指令手册”按钮', '辅助区域显示时, 在搜索页顶部显示帮助按钮, 点击后在辅助信息框里查看指令速查手册')}
                    ${row_switch('btn_show_setting', '显示“简搜设置”按钮', '辅助区域显示时, 在搜索页顶部“指令手册”按钮的左侧显示设置按钮')}
                </div>
                <div class="simpleSearchSettingPane" data-pane="history">
                    ${row_select('history_auto', '自动显示历史记录', '输入内容时自动显示匹配到的历史记录<br>关闭: 不自动显示, 需要时用 alt+↓ 手动调出<br>智能显示: 存在可用的历史候选时显示(与输入完全相同的项不计入)<br>总是显示: 只要输入不为空就显示, 首行为当前输入', [
                        {value: 'close',  label: '关闭'},
                        {value: 'smart',  label: '智能显示'},
                        {value: 'always', label: '总是显示'},
                    ])}
                    ${row_switch('history_auto_prefix_only', '自动历史仅前缀匹配', '开启后: 输入时自动弹出的历史记录只保留与输入前缀匹配的记录(精确匹配也属于前缀), 过滤包含匹配和模糊匹配<br>关闭后: 保留现有的包含/模糊匹配<br>手动 Alt+↓ 打开的历史不受影响; 自动显示关闭时此项不可用')}
                    ${row_switch('replace_history', '历史列表快捷键 (Alt+↓)', '开启后: Alt+↓ 显示/隐藏历史列表; 手动状态只在当前搜索页有效, 不会修改任何设置<br>关闭后: 不使用该快捷键')}
                    ${row_switch('intercept_search', '拦截搜索', '开启: 历史列表显示期间暂停搜索, 结果区保持上一次的结果<br>关闭: 历史列表只作为输入框下方的建议层, 搜索照常实时执行')}
                    ${row_number('history_rows_intercept', '历史记录行数上限(拦截开启)', '拦截搜索开启, 历史列表显示期间暂停搜索时, 最多显示的行数; 0 表示只按窗口高度限制')}
                    ${row_number('history_rows_normal', '历史记录行数上限(拦截关闭)', '拦截搜索关闭, 历史列表只作建议层时, 最多显示的行数; 0 表示只按窗口高度限制')}
                </div>
                <div class="simpleSearchSettingPane" data-pane="completion">
                    ${row_switch('command_complete', '指令补全', '开启后: 输入 - 时列出单字符指令, 输入 -- 时列出多字符指令和 kv key, 输入 kv key 后列出配置中的可选值<br>选择指令期间会暂停搜索; -w/-q/-s/-r 模式指令之后不补全')}
                    ${row_switch('command_shortcut', '指令补全快捷键 (Tab)', '开启后: Tab 显示/隐藏指令补全列表, 没有补全候选时列出全部指令(回车插入); 手动状态只在当前搜索页有效, 不会修改任何设置<br>关闭后: 不使用该快捷键')}
                    ${row_number('command_rows', '补全菜单行数上限', '指令补全列表最多显示的行数; 0 表示只按窗口高度限制')}
                    ${row_select('completion_sort', '补全排序方式', '控制单字符、多字符、kv key 和 kv 值的补全顺序<br>设置顺序: 按指令配置的顺序<br>使用次数: 按实际搜索次数排序, 次数相同按设置顺序<br>自定义: 按下方分组列表的顺序', [
                        {value: 'config', label: '按设置顺序（默认）'},
                        {value: 'usage',  label: '按使用次数'},
                        {value: 'custom', label: '自定义'},
                    ])}
                    <div class="ss-completion-order-head">
                        <div class="fn__flex-1">
                            <div class="config-name">自定义顺序</div>
                            <div class="b3-label__text">
                                按“单字符 / 多字符与 kv key / 各 kv key 的值”分组展示；kv key 和多字符放在同一组，可一起调整顺序，每个 key 的值单独成组。<br>
                                开关只在“自定义”排序下影响补全菜单，不影响解析和搜索。<br>
                                使用次数按实际搜索/点击结果统计；非“自定义”排序时此列表置灰。
                            </div>
                        </div>
                        <button class="b3-button b3-button--outline b3-button--small" id="simpleSearchClearCompletionUsage">清空使用次数</button>
                    </div>
                    <div id="simpleSearchCompletionOrder" class="ss-completion-order"></div>
                    <textarea data-key="completion_order_json" style="display:none"></textarea>
                    <textarea data-key="completion_hidden_json" style="display:none"></textarea>
                </div>
                <div class="simpleSearchSettingPane" data-pane="command">
                    <div class="ss-cmd-head">
                        <div class="fn__flex-1">
                            <div class="config-name">指令配置</div>
                            <div class="b3-label__text">
                                每一项可以配置多个“形式”，不同项支持的形式可能不同：<br>
                                · 单字符：只填字符，输入时加 <span class="fn__code">-</span>，例如 <span class="fn__code">h</span> 对应 <span class="fn__code">-h</span>。<br>
                                · 多字符：填指令本身，例如 <span class="fn__code">--callout</span>；路径、时间这类指令，后面的内容会作为参数。<br>
                                · 自定义多字符即使不以 <span class="fn__code">--</span> 开头（如 <span class="fn__code">xxcallout</span>），也会出现在 <span class="fn__code">--</span> 补全、Tab 全部指令和自定义顺序中；以 <span class="fn__code">@</span> 等符号开头时输入前缀会自动补全。<br>
                                · kv：填 key 和值，key 末尾要带 <span class="fn__code">=</span>，例如 <span class="fn__code">--type=</span> 和 <span class="fn__code">callout</span> 组成 <span class="fn__code">--type=callout</span>。<br>
                                · 自定义 kv key 也可以不以 <span class="fn__code">--</span> 开头（如 <span class="fn__code">@@type=</span>），输入 key 后会继续补全值。<br>
                                路径过滤、排除路径只支持多字符形式；全文档不支持 kv；路径内容直接接在多字符指令后面。<br>
                                关闭某一项后，输入对应指令会整段按关键词搜索。<br>
                                标题级别、路径、时间等特殊规则，可查看对应项右侧的说明。<br>
                                保存时会校验单字符、多字符、kv 是否重复。
                            </div>
                        </div>
                        <button class="b3-button b3-button--outline b3-button--small" id="simpleSearchResetCommandConfig">恢复默认</button>
                    </div>
                    <div id="simpleSearchCommandEditor"></div>
                    <textarea data-key="command_config_json" style="display:none"></textarea>
                </div>
                <div class="simpleSearchSettingPane" data-pane="search">
                    ${row_switch('forbid_enter_create', '搜索结果为空时禁用回车创建', '开启后: 搜索结果为空时, 回车不会创建新文档, 改为点击“点击创建”项创建<br>关闭后: 恢复思源原生回车创建新文档')}
                    ${row_switch('replace_search_res', '接管搜索结果', '开启后, 搜索结果将以新的样式进行显示(按文档分组时生效)')}
                    ${row_select('restree_style', '搜索结果样式', '选择搜索结果的显示风格, 全部风格都会按照文档路径名进行排序<br><a href="https://ld246.com/article/1759408628406" target="_blank">了解更多</a>', [
                        {value: 'native_list', label: '原生列表'},
                        {value: 'native_tree', label: '原生树'},
                        {value: 'colorful',    label: '多彩树'},
                        {value: 'ediary',      label: 'eDiary树'},
                    ])}
                    ${row_switch('search_res_top', '搜索结果优先', '开启后, 搜索结果将显示在同级分组的上面(树结构时生效)')}
                    ${row_switch('restree_all_path', '显示全路径', '开启后, 分组的文档将显示全路径, 而不是只有文档名(树结构时生效)')}
                </div>
                <div class="simpleSearchSettingPane" data-pane="jump">
                    ${row_switch('is_highlight_open', '高亮关键词', '通过 双击/回车 跳转到对应位置后, 高亮搜索的关键词')}
                    ${row_switch('is_blink_open', '闪烁当前块', '通过 双击/回车 跳转到对应位置后, 闪烁当前的块<br>备注: 思源官方在 v3.4.1 版本已支持, 建议关闭')}
                    ${row_select('cursor_position', '光标定位样式', '通过 双击/回车 跳转到对应位置后, 将光标定位至第一个匹配到的位置', [
                        {value: 'none',   label: '不处理'},
                        {value: 'before', label: '关键词之前'},
                        {value: 'select', label: '选中关键词'},
                        {value: 'after',  label: '关键词之后'},
                    ])}
                </div>
                <div class="simpleSearchSettingPane" data-pane="about">
                    <div class="b3-label config-item">
                        <div class="config-name">${escapeHtml(this.displayName || this.name || '简搜')}</div>
                        <div class="b3-label__text">一个为思源笔记设计的增强型搜索插件, 支持通过输入指令控制搜索方式、块类型、路径、排序等。</div>
                    </div>
                    <div class="b3-label config-item">
                        <div class="config-name">使用手册</div>
                        <div class="b3-label__text">查看完整的功能说明、更新日志和反馈方式。</div>
                        <div class="fn__hr"></div>
                        <button class="b3-button b3-button--outline" id="simpleSearchAboutReadme">跳转至手册</button>
                    </div>
                    <div class="b3-label config-item">
                        <div class="config-name">反馈与交流</div>
                        <div class="b3-label__text">
                            <a href="https://github.com/Hug-Zephyr/HZ-syplugin-simple-search/issues" target="_blank">GitHub Issue</a>
                            <span class="fn__space"></span>
                            <a href="https://ld246.com/member/HugZephyr" target="_blank">链滴 @HugZephyr</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="b3-dialog__action">
            <button class="b3-button b3-button--outline" id="simpleSearchResetAll">重置所有</button>
            <div class="fn__flex-1"></div>
            <button class="b3-button b3-button--cancel">取消</button>
            <div class="fn__space"></div>
            <button class="b3-button b3-button--text">保存</button>
        </div>`;

        const dialog = new siyuan.Dialog({
            title: this.displayName || this.name,
            content: content,
            width: '1040px',
            height: '70vh',
        });

        // 指令说明浮层: 固定定位, 避免被滚动区域裁切
        const info_tip = document.createElement('div');
        info_tip.className = 'ss-cmd-tooltip';
        info_tip.style.display = 'none';
        document.body.appendChild(info_tip);
        let info_tip_timer = null;
        const show_info_tip = (target) => {
            const text = target.getAttribute('aria-label') || '';
            if (!text) return;
            info_tip.textContent = '';
            const lines = text.split('\n');
            const title = document.createElement('div');
            title.className = 'ss-cmd-tooltip__title';
            title.textContent = lines[0];
            info_tip.appendChild(title);
            lines.slice(1).forEach(line => {
                const row = document.createElement('div');
                row.className = 'ss-cmd-tooltip__line';
                row.textContent = line;
                info_tip.appendChild(row);
            });
            info_tip.style.display = 'block';
            const rect = target.getBoundingClientRect();
            const tip_rect = info_tip.getBoundingClientRect();
            let left = rect.right + 8;
            if (left + tip_rect.width > window.innerWidth - 8) {
                left = rect.left - tip_rect.width - 8;
            }
            left = Math.max(8, left);
            let top = rect.top + rect.height / 2 - tip_rect.height / 2;
            top = Math.max(8, Math.min(top, window.innerHeight - tip_rect.height - 8));
            info_tip.style.left = `${left}px`;
            info_tip.style.top = `${top}px`;
        };
        const hide_info_tip = () => {
            clearTimeout(info_tip_timer);
            info_tip.style.display = 'none';
        };
        const schedule_info_tip = (target) => {
            clearTimeout(info_tip_timer);
            info_tip_timer = setTimeout(() => show_info_tip(target), 200);
        };
        dialog.element.addEventListener('mouseover', (event) => {
            const target = event.target.closest('.ss-cmd-info');
            if (!target) return;
            if (event.relatedTarget && target.contains(event.relatedTarget)) return;
            schedule_info_tip(target);
        });
        dialog.element.addEventListener('mouseout', (event) => {
            const target = event.target.closest('.ss-cmd-info');
            if (!target) return;
            if (event.relatedTarget && target.contains(event.relatedTarget)) return;
            hide_info_tip();
        });
        dialog.element.addEventListener('focusin', (event) => {
            const target = event.target.closest('.ss-cmd-info');
            if (target) schedule_info_tip(target);
        });
        dialog.element.addEventListener('focusout', hide_info_tip);
        const setting_panes = dialog.element.querySelector('.simpleSearchSettingPanes');
        if (setting_panes) setting_panes.addEventListener('scroll', hide_info_tip, { passive: true });
        const destroy_dialog = dialog.destroy.bind(dialog);
        dialog.destroy = () => {
            clearTimeout(info_tip_timer);
            info_tip.remove();
            destroy_dialog();
        };

        const nav_items = dialog.element.querySelectorAll('.simpleSearchSettingNav .b3-list-item');
        const panes = dialog.element.querySelectorAll('.simpleSearchSettingPane');
        const select_cat = (cat) => {
            nav_items.forEach(item => item.classList.toggle('b3-list-item--focus', item.dataset.cat === cat));
            panes.forEach(pane => pane.classList.toggle('fn__none', pane.dataset.pane !== cat));
        };
        nav_items.forEach(item => item.addEventListener('click', () => select_cat(item.dataset.cat)));
        select_cat(categories[0].id);

        // 关于: 跳转至手册
        dialog.element.querySelector('#simpleSearchAboutReadme')?.addEventListener('click', (event) => {
            event.stopPropagation();
            window.open('https://gitee.com/Hug_Zephyr/HZ-syplugin-simple-search/blob/master/README.md', '_blank');
            event.target.blur();
        });

        // 指令配置: 可视化编辑
        const command_pane = dialog.element.querySelector('[data-pane="command"]');
        const editor_ele = command_pane ? command_pane.querySelector('#simpleSearchCommandEditor') : null;
        const json_ele = command_pane ? command_pane.querySelector('[data-key="command_config_json"]') : null;
        let base_cfg = null;

        const get_initial_command_config = () => {
            let cfg = null;
            try { cfg = JSON.parse(JSON.stringify(g_setting.command_config || get_default_command_config())); }
            catch (e) { cfg = null; }
            try {
                if (!cfg || validate_command_config(cfg)) cfg = get_default_command_config();
            } catch (e) { cfg = get_default_command_config(); }
            return cfg;
        };
        const render_command_editor = (cfg) => {
            base_cfg = cfg;
            if (!editor_ele) return;
            editor_ele.innerHTML = get_command_editor_html(cfg);
            if (json_ele) json_ele.value = JSON.stringify(cfg);
        };
        render_command_editor(get_initial_command_config());

        if (editor_ele) {
            editor_ele.addEventListener('click', (event) => {
                // 恢复某个分类的默认指令
                const reset_cat_btn = event.target.closest('[data-action="reset-cat"]');
                if (reset_cat_btn) {
                    if (!base_cfg) return;
                    const cat_id = reset_cat_btn.closest('.ss-cmd-cat').dataset.cat;
                    const def_cat = get_default_command_config().categories.find(c => c.id === cat_id);
                    if (!def_cat) return;
                    const cur = read_command_config_from_editor(editor_ele, base_cfg);
                    cur.categories = cur.categories.map(c =>
                        c.id === cat_id ? JSON.parse(JSON.stringify(def_cat)) : c);
                    render_command_editor(cur);
                    return;
                }
                // 恢复某一项的默认指令
                const reset_item_btn = event.target.closest('[data-action="reset-item"]');
                if (reset_item_btn) {
                    if (!base_cfg) return;
                    const cat_node = reset_item_btn.closest('.ss-cmd-cat');
                    const item_node = reset_item_btn.closest('.ss-cmd-item');
                    if (!cat_node || !item_node) return;
                    const cat_id = cat_node.dataset.cat;
                    const item_id = item_node.dataset.itemId;
                    const def_cat = get_default_command_config().categories.find(c => c.id === cat_id);
                    const def_item = def_cat && (def_cat.items || []).find(i => i.id === item_id);
                    if (!def_item) return;
                    const cur = read_command_config_from_editor(editor_ele, base_cfg);
                    const cat = cur.categories.find(c => c.id === cat_id);
                    if (!cat) return;
                    cat.items = cat.items.map(i =>
                        i.id === item_id ? JSON.parse(JSON.stringify(def_item)) : i);
                    render_command_editor(cur);
                    return;
                }
                const add_btn = event.target.closest('[data-action="add-form"]');
                if (add_btn) {
                    const item_node = add_btn.closest('.ss-cmd-item');
                    const forms = item_node.querySelector('.ss-cmd-forms');
                    const allowed = (item_node.dataset.allowedForms || '').split(',').filter(Boolean);
                    forms.insertAdjacentHTML('beforeend', get_command_editor_form_html(
                        { form: 'multi', content: '' }, allowed.length ? allowed : undefined));
                    forms.lastElementChild.querySelector('.ss-cmd-multi').focus();
                    return;
                }
                const del_btn = event.target.closest('[data-action="del-form"]');
                if (del_btn) del_btn.closest('.ss-cmd-form').remove();
            });
            editor_ele.addEventListener('change', (event) => {
                if (event.target.classList.contains('ss-cmd-form-type')) {
                    event.target.closest('.ss-cmd-form').dataset.form = event.target.value;
                }
            });

            // 分类内拖动排序: 类似 Chrome 标签页, 拖动对象沿列表方向跟随鼠标, 空位在槽间移动
            let drag_row = null;
            let drag_ghost = null;
            let drag_started = false;
            let drag_start_x = 0, drag_start_y = 0;
            let drag_last_x = 0, drag_last_y = 0;
            let drag_off_y = 0;
            let drag_row_height = 0;
            let reorder_token = 0;

            // 只沿纵向跟随鼠标, 尺寸和横向位置与原来那一行完全一致
            const position_ghost = (y) => {
                if (!drag_ghost || !drag_row) return;
                const row_rect = drag_row.getBoundingClientRect();
                drag_ghost.style.left = row_rect.left + 'px';
                drag_ghost.style.width = row_rect.width + 'px';
                let top = y - drag_off_y;
                const pane = editor_ele.closest('.simpleSearchSettingPanes');
                if (pane) {
                    const prect = pane.getBoundingClientRect();
                    top = Math.max(prect.top, Math.min(top, prect.bottom - drag_row_height));
                }
                drag_ghost.style.top = top + 'px';
            };

            // 先记录旧位置, DOM 移动后用 transform 做 FLIP 过渡
            const animate_reorder = (mutate) => {
                if (!drag_row || !drag_row.parentElement) return;
                const parent = drag_row.parentElement;
                const rows = Array.from(parent.querySelectorAll('.ss-cmd-item'));
                rows.forEach(row => { row.style.transition = 'none'; row.style.transform = ''; });
                const before = new Map(rows.map(row => [row, row.getBoundingClientRect().top]));
                mutate();
                const token = ++reorder_token;
                rows.forEach(row => {
                    const delta = before.get(row) - row.getBoundingClientRect().top;
                    if (!delta) return;
                    row.style.transform = `translateY(${delta}px)`;
                });
                requestAnimationFrame(() => {
                    if (token !== reorder_token) return;
                    rows.forEach(row => {
                        row.style.transition = 'transform 150ms ease';
                        row.style.transform = '';
                    });
                });
            };
            // 根据鼠标位置, 把拖动的行移动到对应的空位
            const update_drag_target = (x, y) => {
                if (!drag_row) return;
                const cat = drag_row.closest('.ss-cmd-cat');
                if (!cat) return;
                // 只在本分类范围内排序, 拖到其他分类时保持不动
                const cat_rect = cat.getBoundingClientRect();
                if (x < cat_rect.left || x > cat_rect.right || y < cat_rect.top || y > cat_rect.bottom) return;

                const parent = drag_row.parentElement;
                const rows = Array.from(parent.querySelectorAll('.ss-cmd-item')).filter(row => row !== drag_row);
                let ref = null;
                for (const row of rows) {
                    const rect = row.getBoundingClientRect();
                    if (y < rect.top + rect.height / 2) { ref = row; break; }
                }
                if (ref) {
                    if (drag_row.nextElementSibling !== ref) {
                        animate_reorder(() => parent.insertBefore(drag_row, ref));
                    }
                } else if (parent.lastElementChild !== drag_row) {
                    animate_reorder(() => parent.appendChild(drag_row));
                }
            };
            const on_drag_move = (event) => {
                if (!drag_row) return;
                drag_last_x = event.clientX;
                drag_last_y = event.clientY;
                if (!drag_started) {
                    // 移动超过阈值才算拖动, 避免误触
                    if (Math.abs(event.clientX - drag_start_x) + Math.abs(event.clientY - drag_start_y) < 4) return;
                    drag_started = true;
                    const rect = drag_row.getBoundingClientRect();
                    drag_row_height = rect.height;
                    drag_off_y = drag_start_y - rect.top;
                    drag_ghost = drag_row.cloneNode(true);
                    drag_ghost.classList.add('ss-cmd-drag-ghost');
                    drag_ghost.style.transform = '';
                    drag_ghost.style.transition = '';
                    // 脱离原来的父级后, 保持与列表里完全一致的字体尺寸
                    const row_style = getComputedStyle(drag_row);
                    drag_ghost.style.fontSize = row_style.fontSize;
                    drag_ghost.style.lineHeight = row_style.lineHeight;
                    document.body.appendChild(drag_ghost);
                    drag_row.classList.add('ss-cmd-item--placeholder');
                    document.body.classList.add('ss-cmd-dragging');
                }
                event.preventDefault();
                position_ghost(event.clientY);
                // 靠近上下边缘时自动滚动
                const pane = editor_ele.closest('.simpleSearchSettingPanes');
                if (pane) {
                    const prect = pane.getBoundingClientRect();
                    const edge = 32;
                    if (event.clientY < prect.top + edge) pane.scrollTop -= 16;
                    else if (event.clientY > prect.bottom - edge) pane.scrollTop += 16;
                }
                update_drag_target(event.clientX, event.clientY);
            };
            const finish_drag = () => {
                document.removeEventListener('pointermove', on_drag_move);
                document.removeEventListener('pointerup', finish_drag);
                document.removeEventListener('pointercancel', finish_drag);
                if (drag_ghost) drag_ghost.remove();
                if (drag_row) {
                    drag_row.classList.remove('ss-cmd-item--placeholder');
                    drag_row.style.transition = '';
                    drag_row.style.transform = '';
                }
                document.body.classList.remove('ss-cmd-dragging');
                drag_row = null;
                drag_ghost = null;
                drag_started = false;
            };
            editor_ele.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                const handle = event.target.closest('.ss-cmd-drag');
                if (!handle) return;
                const row = handle.closest('.ss-cmd-item');
                if (!row) return;
                event.preventDefault();
                drag_row = row;
                drag_ghost = null;
                drag_started = false;
                drag_start_x = drag_last_x = event.clientX;
                drag_start_y = drag_last_y = event.clientY;
                document.addEventListener('pointermove', on_drag_move);
                document.addEventListener('pointerup', finish_drag);
                document.addEventListener('pointercancel', finish_drag);
            });
            // 拖动时滚轮正常滚动, 滚动后重新计算空位位置
            editor_ele.addEventListener('wheel', () => {
                if (!drag_started) return;
                requestAnimationFrame(() => update_drag_target(drag_last_x, drag_last_y));
            }, { passive: true });
        }

        // 指令补全: 自定义顺序列表
        const completion_order_ele = dialog.element.querySelector('#simpleSearchCompletionOrder');
        // 自定义顺序列表自身不滚动, 跟随设置面板滚动; 拖动时滚动设置面板
        const completion_order_scroll = completion_order_ele?.closest('.simpleSearchSettingPanes') || completion_order_ele;
        const completion_order_json = dialog.element.querySelector('[data-key="completion_order_json"]');
        const completion_hidden_json = dialog.element.querySelector('[data-key="completion_hidden_json"]');
        const completion_sort_ele = dialog.element.querySelector('[data-key="completion_sort"]');
        const update_completion_order_disabled = () => {
            if (!completion_order_ele || !completion_sort_ele) return;
            const disabled = completion_sort_ele.value !== 'custom';
            completion_order_ele.classList.toggle('ss-completion-order--disabled', disabled);
            completion_order_ele.querySelectorAll('.ss-completion-order-switch').forEach(sw => sw.disabled = disabled);
        };
        const render_completion_order = (order, hidden, cfg) => {
            if (!completion_order_ele) return;
            const entries = get_completion_entries(cfg || this.g_setting.command_config);
            const groups = get_completion_custom_groups(entries, order);
            const hidden_set = new Set(hidden || []);
            const usage = this.completion_usage || {};
            const row_html = (e) => `
                <div class="ss-completion-order-row" data-order-key="${escapeHtml(e.key)}">
                    <span class="ss-completion-order-drag" aria-hidden="true">⠿</span>
                    <div class="ss-completion-order-main">
                        <span class="ss-completion-order-label">${escapeHtml(e.label)}</span>
                        <span class="ss-completion-order-tag">${escapeHtml(e.tag || e.group || '')}</span>
                    </div>
                    <span class="ss-completion-order-count">${usage[e.key] || 0} 次</span>
                    <input class="b3-switch ss-completion-order-switch" type="checkbox" ${hidden_set.has(e.key) ? '' : 'checked'}>
                </div>`;
            completion_order_ele.innerHTML = groups.map(group => `
                <section class="ss-completion-order-group" data-order-group="${escapeHtml(group.id)}">
                    <div class="ss-completion-order-group-head">
                        <span class="ss-completion-order-group-title">${escapeHtml(group.title)}</span>
                        ${group.tag ? `<span class="ss-completion-order-group-tag">${escapeHtml(group.tag)}</span>` : ''}
                        <span class="ss-completion-order-group-count">${group.entries.length} 项</span>
                    </div>
                    <div class="ss-completion-order-list">
                        ${group.entries.map(row_html).join('')}
                    </div>
                </section>`).join('');
            update_completion_order_disabled();
        };
        render_completion_order(this.g_setting.completion_order || [], this.g_setting.completion_hidden || []);
        completion_sort_ele?.addEventListener('change', update_completion_order_disabled);
        dialog.element.querySelector('#simpleSearchClearCompletionUsage')?.addEventListener('click', () => {
            this.clear_completion_usage();
            completion_order_ele?.querySelectorAll('.ss-completion-order-count').forEach(ele => {
                ele.textContent = '0 次';
            });
        });

        // 自定义顺序拖动
        let completion_drag_row = null;
        let completion_drag_list = null;
        let completion_drag_ghost = null;
        let completion_drag_started = false;
        let completion_drag_start_x = 0;
        let completion_drag_start_y = 0;
        let completion_drag_off_y = 0;
        completion_order_ele?.addEventListener('pointerdown', (event) => {
            if (!completion_sort_ele || completion_sort_ele.value !== 'custom') return;
            const handle = event.target.closest('.ss-completion-order-drag');
            if (!handle) return;
            const row = handle.closest('.ss-completion-order-row');
            if (!row) return;
            completion_drag_row = row;
            completion_drag_list = row.closest('.ss-completion-order-list');
            completion_drag_started = false;
            completion_drag_start_x = event.clientX;
            completion_drag_start_y = event.clientY;
            const rect = row.getBoundingClientRect();
            completion_drag_off_y = event.clientY - rect.top;
            handle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        const finish_completion_drag = () => {
            if (!completion_drag_row) return;
            completion_drag_row.classList.remove('ss-completion-order-placeholder');
            completion_drag_ghost?.remove();
            completion_drag_row = null;
            completion_drag_list = null;
            completion_drag_ghost = null;
            completion_drag_started = false;
        };
        dialog.element.addEventListener('pointermove', (event) => {
            if (!completion_drag_row || !completion_order_ele) return;
            if (!completion_drag_started) {
                if (Math.abs(event.clientX - completion_drag_start_x) + Math.abs(event.clientY - completion_drag_start_y) < 4) return;
                completion_drag_started = true;
                const rect = completion_drag_row.getBoundingClientRect();
                completion_drag_ghost = completion_drag_row.cloneNode(true);
                completion_drag_ghost.classList.add('ss-completion-order-ghost');
                completion_drag_ghost.style.position = 'fixed';
                completion_drag_ghost.style.left = `${rect.left}px`;
                completion_drag_ghost.style.top = `${rect.top}px`;
                completion_drag_ghost.style.width = `${rect.width}px`;
                completion_drag_ghost.style.height = `${rect.height}px`;
                document.body.appendChild(completion_drag_ghost);
                completion_drag_row.classList.add('ss-completion-order-placeholder');
            }
            completion_drag_ghost.style.top = `${event.clientY - completion_drag_off_y}px`;
            const scroll_ele = completion_order_scroll || completion_order_ele;
            const list_rect = scroll_ele.getBoundingClientRect();
            if (event.clientY < list_rect.top + 20) scroll_ele.scrollTop -= 8;
            else if (event.clientY > list_rect.bottom - 20) scroll_ele.scrollTop += 8;
            // 只在当前分组内拖动, 避免打乱单字符/多字符/各 kv key 的分组
            const drag_list = completion_drag_list || completion_order_ele;
            const rows = [...drag_list.querySelectorAll('.ss-completion-order-row')].filter(r => r !== completion_drag_row);
            let ref = null;
            for (const row of rows) {
                const rect = row.getBoundingClientRect();
                if (event.clientY < rect.top + rect.height / 2) { ref = row; break; }
            }
            if (ref) {
                if (completion_drag_row.nextElementSibling !== ref) drag_list.insertBefore(completion_drag_row, ref);
            } else if (drag_list.lastElementChild !== completion_drag_row) {
                drag_list.appendChild(completion_drag_row);
            }
        });
        dialog.element.addEventListener('pointerup', finish_completion_drag);
        dialog.element.addEventListener('pointercancel', finish_completion_drag);
        const destroy_before_completion_drag = dialog.destroy.bind(dialog);
        dialog.destroy = () => {
            finish_completion_drag();
            destroy_before_completion_drag();
        };

        // 指令配置: 恢复默认
        const reset_btn = dialog.element.querySelector('#simpleSearchResetCommandConfig');
        if (reset_btn) {
            reset_btn.addEventListener('click', () => {
                render_command_editor(get_default_command_config());
            });
        }

        const reset_all_btn = dialog.element.querySelector('#simpleSearchResetAll');
        const cancel_btn = dialog.element.querySelector('.b3-dialog__action .b3-button--cancel');
        const save_btn = dialog.element.querySelector('.b3-dialog__action .b3-button--text');
        // “自动历史仅前缀匹配”依赖自动显示: 自动显示关闭时置灰
        const history_auto_ele = dialog.element.querySelector('[data-key="history_auto"]');
        const history_prefix_row = dialog.element.querySelector('[data-setting-row="history_auto_prefix_only"]');
        const history_prefix_ele = history_prefix_row?.querySelector('[data-key="history_auto_prefix_only"]');
        const update_history_prefix_only_disabled = () => {
            if (!history_auto_ele || !history_prefix_ele) return;
            const disabled = history_auto_ele.value === 'close';
            history_prefix_ele.disabled = disabled;
            history_prefix_row?.classList.toggle('ss-setting-row--disabled', disabled);
        };
        update_history_prefix_only_disabled();
        history_auto_ele?.addEventListener('change', update_history_prefix_only_disabled);

        // ---- 未保存修改: 检测和左侧标记 ----
        let allow_close = false;
        const hidden_setting_keys = new Set([
            'command_config_json', 'completion_order_json', 'completion_hidden_json',
        ]);
        const get_control_value = (ele) => ele.type === 'checkbox' ? !!ele.checked : ele.value;
        const get_setting_controls = () => [...dialog.element.querySelectorAll('[data-key]')]
            .filter(ele => !hidden_setting_keys.has(ele.dataset.key));
        const initial_control_values = new Map(
            get_setting_controls().map(ele => [ele.dataset.key, get_control_value(ele)])
        );
        const get_command_config_obj = () => {
            if (!editor_ele || !base_cfg) return null;
            try {
                return read_command_config_from_editor(editor_ele, base_cfg);
            } catch (e) {
                return null;
            }
        };
        const initial_command_config_obj = get_command_config_obj();
        const initial_command_config = initial_command_config_obj
            ? JSON.stringify(initial_command_config_obj)
            : (json_ele?.value || '');
        const get_command_config_snapshot = () => {
            const cfg = get_command_config_obj();
            return cfg ? JSON.stringify(cfg) : '__invalid__';
        };
        const get_completion_order_snapshot = () => {
            if (!completion_order_ele) return '[]';
            const rows = [...completion_order_ele.querySelectorAll('.ss-completion-order-row')];
            return JSON.stringify({
                order: rows.map(row => row.dataset.orderKey),
                hidden: rows.filter(row => {
                    const sw = row.querySelector('.ss-completion-order-switch');
                    return sw && !sw.checked;
                }).map(row => row.dataset.orderKey),
            });
        };
        const initial_completion_order = get_completion_order_snapshot();
        const initial_completion_rows = completion_order_ele
            ? [...completion_order_ele.querySelectorAll('.ss-completion-order-row')]
            : [];
        const initial_completion_keys = initial_completion_rows.map(row => row.dataset.orderKey);
        const initial_completion_hidden = new Set(initial_completion_rows.filter(row => {
            const sw = row.querySelector('.ss-completion-order-switch');
            return sw && !sw.checked;
        }).map(row => row.dataset.orderKey));
        // 用最长公共子序列找出顺序发生变化的项, 避免把只是被迫位移的项也标出来
        const get_order_changed_keys = (before, after) => {
            const n = before.length;
            const m = after.length;
            const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
            for (let i = n - 1; i >= 0; i--) {
                for (let j = m - 1; j >= 0; j--) {
                    dp[i][j] = before[i] === after[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
            const kept = new Set();
            let i = 0;
            let j = 0;
            while (i < n && j < m) {
                if (before[i] === after[j]) {
                    kept.add(before[i]);
                    i++;
                    j++;
                } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                    i++;
                } else {
                    j++;
                }
            }
            const changed = new Set();
            before.forEach(key => { if (!kept.has(key)) changed.add(key); });
            after.forEach(key => { if (!kept.has(key)) changed.add(key); });
            return changed;
        };
        const is_dirty = () => {
            if (get_setting_controls().some(ele =>
                get_control_value(ele) !== initial_control_values.get(ele.dataset.key))) return true;
            if (get_command_config_snapshot() !== initial_command_config) return true;
            if (get_completion_order_snapshot() !== initial_completion_order) return true;
            return false;
        };
        const update_command_modified_marks = () => {
            const current = get_command_config_obj();
            const head = dialog.element.querySelector('.ss-cmd-head');
            const cat_nodes = [...dialog.element.querySelectorAll('.ss-cmd-cat')];
            // 配置无法读取时退回到区块标题上的标记
            if (!current || !initial_command_config_obj) {
                head?.classList.toggle(
                    'ss-setting-row--modified',
                    get_command_config_snapshot() !== initial_command_config
                );
                dialog.element.querySelectorAll('.ss-cmd-item, .ss-cmd-cat').forEach(ele => {
                    ele.classList.remove('ss-setting-row--modified');
                });
                return;
            }
            head?.classList.remove('ss-setting-row--modified');
            const initial_cats = new Map((initial_command_config_obj.categories || []).map(c => [c.id, c]));
            const current_cats = new Map((current.categories || []).map(c => [c.id, c]));
            cat_nodes.forEach(cat_node => {
                cat_node.classList.remove('ss-setting-row--modified');
                const cat_id = cat_node.dataset.cat;
                const initial_cat = initial_cats.get(cat_id);
                const current_cat = current_cats.get(cat_id);
                if (!initial_cat || !current_cat) return;
                const initial_items = new Map((initial_cat.items || []).map(item => [item.id, JSON.stringify(item)]));
                const current_items = new Map((current_cat.items || []).map(item => [item.id, JSON.stringify(item)]));
                const initial_order = (initial_cat.items || []).map(item => item.id);
                const current_order = (current_cat.items || []).map(item => item.id);
                const moved_items = get_order_changed_keys(initial_order, current_order);
                // 内容和排序的变化都具体标到对应的指令项上
                cat_node.querySelectorAll('.ss-cmd-item').forEach(item_node => {
                    const item_id = item_node.dataset.itemId;
                    const changed = moved_items.has(item_id) ||
                        !initial_items.has(item_id) ||
                        initial_items.get(item_id) !== current_items.get(item_id);
                    item_node.classList.toggle('ss-setting-row--modified', changed);
                });
            });
        };
        const update_completion_modified_marks = () => {
            if (!completion_order_ele) return;
            const rows = [...completion_order_ele.querySelectorAll('.ss-completion-order-row')];
            const current_keys = rows.map(row => row.dataset.orderKey);
            const moved_keys = get_order_changed_keys(initial_completion_keys, current_keys);
            rows.forEach(row => {
                const key = row.dataset.orderKey;
                const sw = row.querySelector('.ss-completion-order-switch');
                const hidden = !!(sw && !sw.checked);
                const changed = moved_keys.has(key) ||
                    initial_completion_hidden.has(key) !== hidden;
                row.classList.toggle('ss-setting-row--modified', changed);
            });
            dialog.element.querySelector('.ss-completion-order-head')
                ?.classList.remove('ss-setting-row--modified');
        };
        const update_dirty_marks = () => {
            get_setting_controls().forEach(ele => {
                const row = ele.closest('[data-setting-row], .config-item');
                row?.classList.toggle(
                    'ss-setting-row--modified',
                    get_control_value(ele) !== initial_control_values.get(ele.dataset.key)
                );
            });
            update_command_modified_marks();
            update_completion_modified_marks();
        };
        let dirty_update_raf = 0;
        const schedule_dirty_update = () => {
            if (dirty_update_raf) return;
            dirty_update_raf = requestAnimationFrame(() => {
                dirty_update_raf = 0;
                update_dirty_marks();
            });
        };
        dialog.element.addEventListener('input', schedule_dirty_update);
        dialog.element.addEventListener('change', schedule_dirty_update);
        // 拖动排序等 DOM 变化不会触发 input/change, 用 MutationObserver 兜底
        const dirty_observer = new MutationObserver(schedule_dirty_update);
        dirty_observer.observe(dialog.element, { childList: true, subtree: true, characterData: true });
        update_dirty_marks();

        // 重置所有: 确认后立即恢复默认并保存
        const reset_all_form = () => {
            const defaults = get_default_plugin_settings();
            dialog.element.querySelectorAll('[data-key]').forEach(ele => {
                const key = ele.dataset.key;
                if (key === 'command_config_json' || key === 'completion_order_json' || key === 'completion_hidden_json') return;
                const val = defaults[key];
                if (ele.type === 'checkbox') ele.checked = !!val;
                else if (ele.tagName === 'SELECT') ele.value = val;
                else if (ele.tagName === 'TEXTAREA') ele.value = Array.isArray(val) ? val.join(', ') : (val ?? '');
                else ele.value = val ?? '';
            });
            update_history_prefix_only_disabled();
            render_command_editor(JSON.parse(JSON.stringify(defaults.command_config)));
            if (completion_sort_ele) completion_sort_ele.value = defaults.completion_sort || 'config';
            render_completion_order(defaults.completion_order || [], defaults.completion_hidden || [], defaults.command_config);
            schedule_dirty_update();
        };
        const save_settings = (reset_all = false) => {
            // 把可视化编辑结果写回隐藏的 JSON 字段, 由 apply_setting_from_dialog 统一校验
            if (editor_ele && json_ele && base_cfg) {
                json_ele.value = JSON.stringify(read_command_config_from_editor(editor_ele, base_cfg));
            }
            // 自定义顺序/隐藏项
            if (completion_order_ele && completion_order_json && completion_hidden_json) {
                const rows = [...completion_order_ele.querySelectorAll('.ss-completion-order-row')];
                completion_order_json.value = JSON.stringify(rows.map(row => row.dataset.orderKey));
                completion_hidden_json.value = JSON.stringify(rows.filter(row => {
                    const sw = row.querySelector('.ss-completion-order-switch');
                    return sw && !sw.checked;
                }).map(row => row.dataset.orderKey));
            }
            return this.apply_setting_from_dialog(dialog.element, reset_all) !== false;
        };
        reset_all_btn?.addEventListener('click', () => {
            siyuan.confirm('重置所有设置', '确定要把所有设置恢复为默认值并立即保存吗？', () => {
                reset_all_form();
                if (save_settings(true)) {
                    allow_close = true;
                    dialog.destroy();
                }
            });
        });
        cancel_btn?.addEventListener('click', () => dialog.destroy());
        save_btn?.addEventListener('click', () => {
            if (save_settings(false)) {
                allow_close = true;
                dialog.destroy();
            }
        });

        // 有未保存修改时, 关闭设置面板前确认
        let unsaved_prompt_open = false;
        const show_unsaved_confirm = (on_save, on_discard) => {
            if (unsaved_prompt_open) return;
            unsaved_prompt_open = true;
            const confirm_dialog = new siyuan.Dialog({
                title: '设置尚未保存',
                content: `<div class="b3-dialog__content">
    <div class="ft__breakword">当前设置已修改，是否保存后再关闭？</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" data-unsaved-action="cancel">继续编辑</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--outline" data-unsaved-action="discard">不保存</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-unsaved-action="save">保存</button>
</div>`,
                width: '460px',
                destroyCallback: () => { unsaved_prompt_open = false; },
            });
            confirm_dialog.element.addEventListener('click', (event) => {
                const btn = event.target?.closest?.('[data-unsaved-action]');
                if (!btn) return;
                event.preventDefault();
                event.stopPropagation();
                const action = btn.dataset.unsavedAction;
                confirm_dialog.destroy();
                if (action === 'save') on_save();
                else if (action === 'discard') on_discard();
            });
        };
        const destroy_before_unsaved_prompt = dialog.destroy.bind(dialog);
        dialog.destroy = () => {
            if (!allow_close && is_dirty()) {
                show_unsaved_confirm(
                    () => {
                        if (save_settings(false)) {
                            allow_close = true;
                            dialog.destroy();
                        }
                    },
                    () => {
                        allow_close = true;
                        dialog.destroy();
                    }
                );
                return;
            }
            if (dirty_update_raf) {
                cancelAnimationFrame(dirty_update_raf);
                dirty_update_raf = 0;
            }
            dirty_observer.disconnect();
            destroy_before_unsaved_prompt();
        };
    }
    // 保存设置面板中的修改
    // reset_all=true 时从默认值开始, 再套用表单里的值(表单未包含的隐藏项也恢复默认)
    apply_setting_from_dialog(dialog_element, reset_all = false) {
        if (reset_all) this.g_setting = get_default_plugin_settings();
        // 指令配置单独处理: JSON 解析 + 校验
        const json_ele = dialog_element.querySelector('[data-key="command_config_json"]');
        if (json_ele) {
            let cfg;
            try {
                cfg = JSON.parse(json_ele.value);
            } catch (e) {
                alert('指令配置 JSON 解析失败: ' + e.message);
                return false;
            }
            const err = validate_command_config(cfg);
            if (err) {
                alert('指令配置校验失败: ' + err);
                return false;
            }
            this.g_setting.command_config = cfg;
        }
        // 补全自定义顺序/隐藏项
        const parse_completion_array = (selector) => {
            const ele = dialog_element.querySelector(selector);
            if (!ele) return [];
            try {
                const arr = JSON.parse(ele.value || '[]');
                return Array.isArray(arr) ? arr.filter(item => typeof item === 'string') : [];
            } catch (e) {
                return [];
            }
        };
        this.g_setting.completion_order = parse_completion_array('[data-key="completion_order_json"]');
        this.g_setting.completion_hidden = parse_completion_array('[data-key="completion_hidden_json"]');
        dialog_element.querySelectorAll('[data-key]').forEach(ele => {
            const key = ele.dataset.key;
            if (key === 'command_config_json' || key === 'completion_order_json' || key === 'completion_hidden_json') return;
            if (ele.type === 'checkbox') {
                this.g_setting[key] = ele.checked;
            } else if (ele.type === 'number') {
                const num = parseInt(ele.value, 10);
                this.g_setting[key] = Number.isFinite(num) && num >= 0 ? num : 0;
            } else if (ele.tagName === 'TEXTAREA') {
                this.g_setting[key] = ele.value.split(',').map(s => s.trim()).filter(s => s);
            } else {
                this.g_setting[key] = ele.value;
            }
        });
        set_log_level(this.g_setting.log_level);
        this.save_plugin_setting();
        this.init_css_style();
        // 总开关立即生效: 关闭时不再接管事件, 并移除已插入的界面
        this.sy_event_uninit();
        if (this.g_setting.plugin_enabled === false) {
            this.remove_plugin_ui();
        } else {
            this.sy_event_init();
        }
        // 按钮显示设置立即生效(搜索页已打开时)
        this.update_assist_btn_visibility();
        // 搜索面板不一定打开
        if (this.get_search_list()) this.show_search_res();
        return true;
    }
    // 嵌入 信息显示框
    inseart_assist_area() {
        // 1. 信息显示框, 一定插入, 通过开关控制是否显示
        const criteria = this.get_ele('#criteria');
        const is_show = this.g_setting.assist_sw ? "contents" : "none";
        // 适配浅吟主题的搜索框上移
        const order = window.getComputedStyle(criteria).order;
        criteria.insertAdjacentHTML('afterend', `
            <div id="simpleSearchAssistArea" style="display: ${is_show};">
                <div id="simpleSearchTextarea" class="fn__block b3-text-field ${is_show}" placeholder="简搜: 辅助信息" spellcheck="false" style="order: ${order};"></div>
            </div>
        `);
    }
    // 加粗: <span style="font-weight:bold"></span>
    // 代码: <span class="fn__code"></span>
    strong(str) {return `<span style="font-weight:bold">${str}</span>`};
    code(str) {return `<span class="fn__code">${str}</span>`};
    get_help_info_html() {
        // 手册按当前指令配置生成: 设置里改名、加别名后会同步显示
        let cfg = this.g_setting && this.g_setting.command_config;
        let cfg_ok = false;
        if (cfg) {
            try { cfg_ok = !validate_command_config(cfg); } catch (e) { cfg_ok = false; }
        }
        if (!cfg_ok) cfg = get_default_command_config();

        const cat_items = (id) => {
            const cat = (cfg.categories || []).find(c => c && c.id === id);
            // 关闭的项不出现在手册里
            return ((cat && cat.items) || []).filter(i => i.enabled !== false);
        };
        const find_item = (cat_id, item_id) => cat_items(cat_id).find(i => i.id === item_id) || null;
        const forms_of = (item) => item ? get_item_display_forms(item) : [];
        const code = (s) => this.code(escapeHtml(String(s)));
        const name_of = (item) => escapeHtml(String(item.name || item.id));
        // 一个项的所有形式(或第一种): 指令:名称
        const fmt = (item, all) => {
            if (!item) return "";
            const forms = forms_of(item);
            const use = all ? forms : forms.slice(0, 1);
            if (!use.length) return "";
            return `${use.map(code).join(" / ")}:${name_of(item)}`;
        };
        const list = (items, all) => items.map(it => fmt(it, all)).filter(Boolean).join(" | ");
        const join2 = (a, b) => [a, b].filter(Boolean).join("/");

        const rows = [];
        const add_row = (label, html) => {
            if (!html) return;
            rows.push(`<tr><td>${this.strong(" " + label + ": ")}</td><td colspan="3">${html}</td></tr>`);
        };

        // 搜索方式
        add_row("搜索方式", list(cat_items('mode'), true));

        // 块类型: 单字符和多字符分两行显示
        const type_items = cat_items('type');
        const single_types = type_items.filter(it => {
            const first = forms_of(it)[0] || "";
            return first.startsWith("-") && !first.startsWith("--");
        });
        const multi_types = type_items.filter(it => single_types.indexOf(it) === -1);
        let heading_note = "";
        const heading_item = type_items.find(it => it.kind === 'heading');
        if (heading_item && forms_of(heading_item).length) {
            heading_note = ` (${code(forms_of(heading_item)[0] + '13')} 表示 1、3 级标题)`;
        }
        add_row("块类型过滤", list(single_types, true) + heading_note);
        // 多字符类型 + kv 逗号多值的说明
        let type_kv_note = "";
        const first_kv = type_items.reduce((found, it) =>
            found || (it.comms || []).find(c => c.form === 'kv' && c.key), null);
        if (first_kv) {
            const vals = type_items.map(it => {
                const c = (it.comms || []).find(x => x.form === 'kv' && x.key === first_kv.key);
                return c ? c.value : "";
            }).filter(Boolean).slice(0, 2);
            type_kv_note = `; ${code(first_kv.key + (vals.join(",") || "值"))} 可用逗号写多个值`;
        }
        const multi_type_html = list(multi_types, true);
        if (multi_type_html || type_kv_note) {
            rows.push(`<tr><td></td><td colspan="3">${multi_type_html}${type_kv_note}</td></tr>`);
        }

        // 路径
        let path_html = list(cat_items('path'), true);
        const all_item = find_item('path', 'all');
        const all_multi = all_item ? (all_item.comms || []).find(c => c.form === 'multi') : null;
        if (all_multi && all_multi.content) {
            path_html += `; ${code(all_multi.content)} 单独输入表示全部文档, ${code(all_multi.content + '路径')} 表示全文档下过滤路径`;
        }
        add_row("路径", path_html);

        // 时间: 比较符和 and/or 是内置语法
        const ct_item = find_item('time', 'ct');
        const ut_item = find_item('time', 'ut');
        const time_base = (item) => {
            if (!item) return "";
            const multi = (item.comms || []).find(c => c.form === 'multi');
            if (multi) return multi.content;
            const kv = (item.comms || []).find(c => c.form === 'kv');
            return kv ? kv.key + (kv.value || "") : "";
        };
        const ct_token = time_base(ct_item);
        const ut_token = time_base(ut_item);
        let time_html = "";
        if (ct_token || ut_token) {
            const parts = [];
            const before = join2(ct_token && code(ct_token + '>2025'), ut_token && code(ut_token + '<2026'));
            if (before) parts.push(`${before}: 2025 年之前创建/更新`);
            const exact = join2(ct_token && code(ct_token + '=20251001123456'), ut_token && code(ut_token + '=20251001123456'));
            if (exact) parts.push(`${exact}: 精确到秒`);
            const conds = [];
            if (ct_token) conds.push(ct_token + '>2025&' + ct_token + '<2027');
            if (ut_token) conds.push(ut_token + '=2024');
            if (conds.length) parts.push(`${code(conds.join("|"))}: & 表示并且, | 表示或者`);
            const time_kv = ct_item ? (ct_item.comms || []).find(c => c.form === 'kv') : null;
            if (time_kv) parts.push(`${code(time_kv.key + (time_kv.value || ct_token) + '>2025')}: kv 写法`);
            time_html = parts.join(" | ");
        }
        add_row("时间过滤", time_html);

        // 分组 & 排序
        add_row("分组", list(cat_items('group'), true));
        add_row("排序", list(cat_items('sort'), true));

        // 扩展
        add_row("其他", list(cat_items('ext'), true));

        return `<div id="simpleSearchHelpTable">
        <span style="font-size: 16px; font-weight:bold">简搜插件指令速查手册: </span><span> (按“设置 → 指令配置”生成; 拖动方框右下角可以调整显示区域)</span>
        <table><tbody>
        ${rows.join("\n        ")}
        </tbody></table>
        </div>`
    }
    // 嵌入 开关按钮, 帮助按钮
    insert_assist_btn() {
        const icon_parent = this.get_ele('.search__header>.block__icons');
        // 1. 增加开关按钮
        // 关 -> 开
        const enable_sw = {
            icon: "#iconEye",
            label: "简搜: 点击显示辅助信息框",
            display: "none",
        }
        // 开 -> 关
        const disable_sw = {
            icon: "#iconEyeoff",
            label: "简搜: 点击隐藏辅助信息框",
            display: "contents",
        }
        const sw = this.g_setting.assist_sw ? disable_sw : enable_sw;
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space"></span>
            <span id="simpleSearchShowSw" aria-label="${sw.label}" class="block__icon block__icon--show ariaLabel" data-position="9south">
                <svg><use xlink:href="${sw.icon}"></use></svg>
            </span>
        `);
        const sw_ele = icon_parent.querySelector('#simpleSearchShowSw');
        const use_ele = sw_ele.querySelector('svg>use')
        const assist_area = this.get_ele('#simpleSearchAssistArea')
        sw_ele.addEventListener('click', () => {
            // 根据图标更新当前状态
            this.g_setting.assist_sw = assist_area.style.display != "none";
            // 点击说明要切换开关
            this.g_setting.assist_sw = !this.g_setting.assist_sw;
            this.save_plugin_setting();
            // 按照新的开关, 重新设置样式
            const sw = this.g_setting.assist_sw ? disable_sw : enable_sw;
            sw_ele.setAttribute('aria-label', sw.label);
            use_ele.setAttribute('xlink:href', sw.icon);
            assist_area.style.display = sw.display;
            // 辅助区域隐藏时, 设置/指令手册按钮一起隐藏
            this.update_assist_btn_visibility();
        });

        // 2. 增加简搜设置按钮(放在指令手册左边)
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space" id="simpleSearchSettingSpace"></span>
            <span id="simpleSearchDisplayTreeSetting" aria-label="简搜: 点击打开插件的设置页面" class="block__icon block__icon--show ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconSettings"></use></svg>
            </span>
        `);
        this.get_ele('#simpleSearchDisplayTreeSetting')?.addEventListener('click', (event) => {
            event.stopPropagation();  // 停止事件传播
            this.openSetting();
            event.target.blur();
        });

        // 3. 增加帮助按钮
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space" id="simpleSearchHelpSpace"></span>
            <span id="simpleSearchHelp" aria-label="简搜: 点击显示指令速查手册" class="block__icon block__icon--show ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconHelp"></use></svg>
            </span>
        `);
        const help_ele = this.get_ele('#simpleSearchHelp');
        const text_area = this.get_ele('#simpleSearchTextarea')
        help_ele.addEventListener('click', () => {
            text_area.innerHTML = this.get_help_info_html();
            if (!this.g_setting.assist_sw) {
                sw_ele.click();
            }
        });

        // 按设置应用按钮显示状态
        this.update_assist_btn_visibility();
    }
    // 顶部按钮的显示与隐藏(由设置控制, 显示/隐藏按钮本身始终显示)
    update_assist_btn_visibility() {
        [
            ['#simpleSearchSettingSpace', '#simpleSearchDisplayTreeSetting', this.g_setting.assist_sw && this.g_setting.btn_show_setting],
            ['#simpleSearchHelpSpace', '#simpleSearchHelp', this.g_setting.assist_sw && this.g_setting.btn_show_help],
        ].forEach(([space_sel, btn_sel, show]) => {
            this.get_ele(space_sel)?.classList.toggle('fn__none', !show);
            this.get_ele(btn_sel)?.classList.toggle('fn__none', !show);
        });
    }
    // 嵌入 辅助区域
    handle_assist_area() {
        // 1. 嵌入 信息显示框
        this.inseart_assist_area();
        // 2. 嵌入 开关按钮, 帮助按钮
        this.insert_assist_btn()
    }
    hidden_search_history_list() {
        const history_ul = this.get_search_history_ul();
        const box = this.get_suggestion_box();
        this.suggestion_mode = null;
        this.command_completion = null;
        if (history_ul) history_ul.innerHTML = '';
        if (box) box.classList.add('fn__none');
        this.set_suggestion_open(false);
        this.update_list_hint();
    }
    // 关闭搜索历史列表, 触发原生搜索事件
    search_history_dispatch_input() {
        // 隐藏历史列表, 打标记, 触发原生事件
        clearTimeout(this.history_timer_id);
        this.hidden_search_history_list();
        this.history_previewing = false;
        this.history_input_flag = true;
        this.dispatch_input();
        // this.get_search_input().focus();
    }
    // 取消历史记录: 关闭列表, 恢复手打的内容; 拦截模式下补一次搜索, 让结果对应手打内容
    cancel_search_history() {
        clearTimeout(this.history_timer_id);
        const input = this.get_search_input();
        if (input && this.history_previewing) {
            input.value = this.history_typed_value;
        }
        this.history_previewing = false;
        if (this.g_setting.intercept_search) {
            this.search_history_dispatch_input();
        } else {
            this.hidden_search_history_list();
        }
    }
    // 提交历史记录(回车/点击): 拦截模式下补一次搜索, 不拦截时搜索已经实时执行过
    commit_search_history() {
        clearTimeout(this.history_timer_id);
        // 列表没有显示时, 没有可提交的内容
        if (!this.is_show_history_list()) return;
        if (this.g_setting.intercept_search || this.history_previewing) {
            this.search_history_dispatch_input();
        } else {
            this.hidden_search_history_list();
            this.history_previewing = false;
        }
    }
    // Alt+↓: 切换历史列表; 手动状态只在当前搜索页有效
    toggle_history_suggestion(input = this.get_search_input()) {
        const state = this.get_page_suggestion_state(input);
        if (!state || !input) return;
        if (this.is_show_history_list()) {
            state.history = 'hide';
            this.cancel_search_history();
            return;
        }
        state.history = 'show';
        if (this.is_show_command_list()) this.hide_command_completion();
        clearTimeout(this.history_timer_id);
        const history = matchHistory(input.value, SYT.get_search_history(), true);
        this.show_search_history_list(history, true);
    }
    // Tab: 切换指令补全列表; 没有常规候选时列出所有指令
    toggle_command_suggestion(input = this.get_search_input()) {
        const state = this.get_page_suggestion_state(input);
        if (!state || !input) return;
        if (this.is_show_command_list()) {
            state.command = 'hide';
            this.hide_command_completion();
            return;
        }
        state.command = 'show';
        if (this.is_show_history_list()) {
            // 切换前若在预览历史, 先恢复手打内容, 避免把预览项带到补全里
            if (this.history_previewing) {
                input.value = this.history_typed_value;
                input.setSelectionRange(input.value.length, input.value.length);
            }
            this.history_previewing = false;
            this.hidden_search_history_list();
        }
        const sort_ctx = this.get_completion_sort_ctx();
        const result = get_command_complete(this.g_setting.command_config, input.value, input.selectionStart, true, sort_ctx)
            || get_all_command_candidates(this.g_setting.command_config, input.value, input.selectionStart, sort_ctx);
        if (result && result.candidates.length) this.show_command_completion(result);
    }
    // 插入搜索历史列表所在的元素
    insert_search_history_list() {
        const prev_ele = this.get_search_input()?.parentElement.parentElement;
        prev_ele.insertAdjacentHTML('afterend', `
            <div id="simpleSearchSuggestionBox" class="HZ-search-suggestion-box b3-menu fn__none">
                <div id="simpleSearchHistoryTopHint" class="HZ-search-list-hint HZ-search-list-hint--top" aria-hidden="true">↑ 还有 0 项</div>
                <ul id="simpleSearchHistoryList" class="HZ-search-history-list b3-list b3-list--background"></ul>
                <div id="simpleSearchHistoryBottomHint" class="HZ-search-list-hint HZ-search-list-hint--bottom" aria-hidden="true">↓ 还有 0 项</div>
            </div>
        `);
        const history_ul = this.get_search_history_ul();
        let hint_raf = 0;
        history_ul.addEventListener('scroll', () => {
            if (hint_raf) return;
            hint_raf = requestAnimationFrame(() => {
                hint_raf = 0;
                this.update_list_hint();
            });
        }, { passive: true });
        history_ul.addEventListener('click', (event) => {
            const ele = event.target;
            if (this.suggestion_mode === 'command') {
                const cmd_li = ele.closest('li.HZ-search-command-li');
                if (!cmd_li) return;
                this.apply_command_candidate(Number(cmd_li.dataset.index));
                return;
            }
            const li = ele.closest('li.HZ-search-history-li');
            const input = this.get_search_input();
            if (ele.closest('svg.HZ-search-history-svg')) {
                // 从搜索历史记录里面删掉
                SYT.delete_search_history(li.getAttribute('title'));
                // 隐藏这个历史
                li.remove();
                // 删空后直接隐藏列表, 避免留下空壳
                if (!this.get_search_history_ul()?.children.length) {
                    this.hidden_search_history_list();
                } else {
                    this.update_list_hint();
                }
                // 光标聚焦到输入框, 方便点击了删除按钮之后, 继续通过上下键选择搜索历史
                input.focus();
            }
            else if (li) {
                this.select_search_history_item(li);
                this.commit_search_history();
            }
        });
    }

    // 选中某个历史记录, 将内容填充到input上
    select_search_history_item(item) {
        const history_ul = this.get_search_history_ul();
        if(!item || !history_ul || !history_ul.contains(item)) return;
        // 用户开始用上下键选择后, 不要再被之前排队的延迟显示覆盖
        clearTimeout(this.history_timer_id);
        history_ul.querySelector('.b3-list-item--focus')?.classList.remove('b3-list-item--focus');
        item.classList.add('b3-list-item--focus');
        item.scrollIntoView({
            behavior: 'auto', // 不用平滑滚动, 如果快速切换的时候, 选中的会不在可见区域内
            block: 'center'   // 或 'start', 'center', 'end'
        })
        const value = item.getAttribute('title');
        this.get_search_input().value = value;
        // 只有与手打内容不同才算预览, 避免回车时重复触发搜索
        this.history_previewing = value !== this.history_typed_value;
    }

    // 搜索框高度变化后, 重新定位已显示的历史/补全列表
    reposition_search_history_list() {
        const input = this.get_search_input();
        const box = this.get_suggestion_box();
        if (!input || !box) return;
        if (!this.is_show_history_list() && !this.is_show_command_list()) return;
        const rect = this.position_suggestion_box();
        if (!rect) return;
        this.limit_suggestion_list_height(this.get_suggestion_row_limit());
    }

    // 建议列表容器定位在输入框下方
    position_suggestion_box() {
        const input = this.get_search_input();
        const box = this.get_suggestion_box();
        if (!input || !box) return null;
        const rect = input.getBoundingClientRect();
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.bottom}px`;
        box.style.width = `${rect.width}px`;
        return rect;
    }

    // 当前建议列表的最大行数, 0 表示不限制(只按窗口高度)
    get_suggestion_row_limit() {
        let value;
        if (this.suggestion_mode === 'command') {
            value = this.g_setting.command_rows;
        } else if (this.g_setting.intercept_search) {
            value = this.g_setting.history_rows_intercept;
        } else {
            value = this.g_setting.history_rows_normal;
        }
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
    }

    // 按窗口剩余空间限制建议列表高度, 至少保留一行, 超出部分在列表内部滚动
    // row_limit>0 时再限制最多显示的行数
    limit_suggestion_list_height(row_limit) {
        const input = this.get_search_input();
        const history_ul = this.get_search_history_ul();
        if (!input || !history_ul) return;
        // 先清掉旧值, 才能量出完整高度
        history_ul.style.maxHeight = '';
        const rect = input.getBoundingClientRect();
        // 提示条悬浮在列表上, 不再预留提示条高度
        const avail_height = window.innerHeight - rect.bottom - 8;
        let limit_height = avail_height;
        if (row_limit > 0 && history_ul.children.length > row_limit) {
            const list_top = history_ul.getBoundingClientRect().top;
            // 列表内部可能已经滚动, 补回 scrollTop 才是目标行的真实位置
            const row_bottom = history_ul.children[row_limit - 1].getBoundingClientRect().bottom + history_ul.scrollTop;
            limit_height = Math.min(limit_height, row_bottom - list_top + 8);
        }
        if (history_ul.getBoundingClientRect().height > limit_height) {
            history_ul.style.maxHeight = `${Math.max(limit_height, 40)}px`;
        }
        this.update_list_hint();
    }

    // 更新列表上下滚动提示: 悬浮在列表边缘, 不参与布局
    update_list_hint() {
        const box = this.get_suggestion_box();
        const history_ul = this.get_search_history_ul();
        const top_hint = this.get_ele('#simpleSearchHistoryTopHint');
        const bottom_hint = this.get_ele('#simpleSearchHistoryBottomHint');
        if (!box || !history_ul || !top_hint || !bottom_hint) return;
        if (box.classList.contains('fn__none')) {
            top_hint.classList.remove('HZ-search-list-hint--show');
            bottom_hint.classList.remove('HZ-search-list-hint--show');
            return;
        }
        // 按实际列表项位置统计, 兼容不同行高
        const list_rect = history_ul.getBoundingClientRect();
        let above = 0;
        let below = 0;
        for (const item of history_ul.children) {
            const item_rect = item.getBoundingClientRect();
            if (item_rect.top < list_rect.top - 0.5) above++;
            if (item_rect.bottom > list_rect.bottom + 0.5) below++;
        }
        top_hint.textContent = `↑ 还有 ${above} 项`;
        bottom_hint.textContent = `↓ 还有 ${below} 项`;
        // 只切换透明度, 不改变布局, 避免列表跳动
        top_hint.classList.toggle('HZ-search-list-hint--show', above > 0);
        bottom_hint.classList.toggle('HZ-search-list-hint--show', below > 0);
    }

    // 更新搜索历史列表的显示
    update_search_history_list_html(history) {
        this.hidden_search_history_list();
        const history_ul = this.get_search_history_ul();
        const box = this.get_suggestion_box();
        if (!history_ul || !box) return;
        // 如果没有历史记录，直接返回（保持隐藏状态）
        if (!history.length) return;
        const input_val = this.get_search_input()?.value || '';
        for (let i = 0; i < history.length; i++) {
            const html_val = history[i];
            const real_val = unescapeHtml(html_val.replace(/<span class="HZ-search-history-highlight">/g, "").replace(/<\/span>/g, ""));
            // 首行是当前输入, 不提供删除按钮
            const is_current = i === 0 && !!input_val;
            const close_html = is_current ? '' : `<svg class="HZ-search-history-svg b3-menu__action b3-menu__action--close"><use xlink:href="#iconCloseRound"></use></svg>`;
            history_ul.insertAdjacentHTML('beforeend', `<li class="HZ-search-history-li b3-list-item${is_current ? ' HZ-search-history-li--current' : ''}" title="${escapeHtml(real_val)}"><span class="b3-list-item__text">${html_val}</span>${close_html}</li>`);
            // tempMenu.addSeparator(1);
        }
        // 定位并显示
        this.set_suggestion_open(true);
        this.position_suggestion_box();
        box.classList.remove('fn__none');
        this.suggestion_mode = 'history';
        this.select_search_history_item(history_ul.firstElementChild);
        // 按窗口剩余空间限高, 每次显示都重新计算, 避免沿用旧值
        this.limit_suggestion_list_height(this.get_suggestion_row_limit());
    }
    // 显示历史搜索记录
    // force=true 用于手动调出: 跳过关闭/智能显示规则, 完整展示历史
    show_search_history_list(history, force = false) {
        const search_input = this.get_search_input();
        if (!search_input) return;
        const state = this.get_page_suggestion_state(search_input);
        const intercept = !!this.g_setting.intercept_search;
        // 当前页手动关闭历史: 不再自动显示
        if (state?.history === 'hide') {
            if (intercept) this.search_history_dispatch_input();
            else this.hidden_search_history_list();
            return;
        }
        // 当前页手动打开历史: 继续输入也保持显示
        force = force || state?.history === 'show';
        const input_val = escapeHtml(search_input.value);
        const input_html = `<span class="HZ-search-history-highlight">${input_val}</span>`;
        // 记录手打的内容, 上下键预览之后可以恢复到这里
        this.history_typed_value = search_input.value;
        if (!force) {
            // 关闭模式: 不显示历史记录
            if (this.g_setting.history_auto === 'close') {
                if (intercept) this.search_history_dispatch_input();
                else this.hidden_search_history_list();
                return;
            }
            // 智能显示模式: 去掉与当前输入完全相同的项后, 还有候选才显示
            if (this.g_setting.history_auto === 'smart') {
                history = history.filter(record => record !== input_html);
                if (!history.length) {
                    if (intercept) this.search_history_dispatch_input();
                    else this.hidden_search_history_list();
                    return;
                }
            }
        }
        // 首行放当前输入; 历史里与当前输入完全相同的项去重
        if (input_val) {
            history = history.filter(record => record !== input_html);
            history.unshift(input_html);
        }
        // 更新html
        this.update_search_history_list_html(history);
    }

    // 指令补全: 命中时立即显示并暂停搜索, 返回是否显示了补全列表
    update_command_completion(value, caret, input = this.get_search_input()) {
        const state = this.get_page_suggestion_state(input);
        const manual = state ? state.command : null;
        // 手动状态优先: show 时忽略设置, hide 时禁止自动显示
        const enabled = manual === 'show' || (manual === null && this.g_setting.command_complete);
        if (!enabled) {
            if (this.suggestion_mode === 'command') this.hide_command_completion();
            return false;
        }
        const result = get_command_complete(this.g_setting.command_config, value, caret, false, this.get_completion_sort_ctx());
        if (result && result.candidates.length) {
            this.show_command_completion(result);
            return true;
        }
        if (this.suggestion_mode === 'command') this.hide_command_completion();
        return false;
    }

    // 渲染指令补全列表(复用历史列表的元素)
    show_command_completion(result) {
        const input = this.get_search_input();
        const history_ul = this.get_search_history_ul();
        const box = this.get_suggestion_box();
        if (!input || !history_ul || !box) return;
        clearTimeout(this.history_timer_id);
        this.hidden_search_history_list();
        this.suggestion_mode = 'command';
        this.command_completion = result;
        this.history_previewing = false;
        this.history_typed_value = input.value;
        result.candidates.forEach((c, i) => {
            const name = c.name ? `<span class="HZ-search-command-name">${escapeHtml(c.name)}</span>` : '';
            const hint = c.hint ? `<span class="HZ-search-command-hint">${escapeHtml(c.hint)}</span>` : '';
            const title = [c.label, c.name, c.hint].filter(Boolean).join(' ');
            history_ul.insertAdjacentHTML('beforeend', `<li class="HZ-search-command-li b3-list-item" data-index="${i}" title="${escapeHtml(title)}"><span class="b3-list-item__text"><span class="HZ-search-command-token">${escapeHtml(c.label)}</span>${name}${hint}</span></li>`);
        });
        this.set_suggestion_open(true);
        this.position_suggestion_box();
        box.classList.remove('fn__none');
        this.select_command_item(result.default_index || 0);
        this.limit_suggestion_list_height(this.get_suggestion_row_limit());
    }

    // 选中补全列表中的某一项(只移动高亮, 不改写输入框)
    select_command_item(index) {
        const history_ul = this.get_search_history_ul();
        if (!history_ul || this.suggestion_mode !== 'command') return;
        const items = Array.from(history_ul.querySelectorAll('li.HZ-search-command-li'));
        if (!items.length) return;
        index = ((index % items.length) + items.length) % items.length;
        items.forEach(li => li.classList.remove('b3-list-item--focus'));
        const item = items[index];
        item.classList.add('b3-list-item--focus');
        item.scrollIntoView({behavior: 'auto', block: 'center'});
        this.command_index = index;
    }

    // 应用补全项
    apply_command_candidate(index) {
        if (this.suggestion_mode !== 'command' || !this.command_completion) return;
        const result = this.command_completion;
        const cand = result.candidates[index];
        const input = this.get_search_input();
        if (!cand || !input) return;
        clearTimeout(this.history_timer_id);
        const start = result.token_start;
        const end = result.token_end;
        const value = input.value;

        // 所有指令列表: 在光标处插入, 必要时补空格, 避免和前后文字粘连
        if (result.insert_at_caret) {
            const before = value.slice(0, start);
            const after = value.slice(end);
            const prefix = before && !/\s$/.test(before) && !/^\s/.test(cand.insert) ? ' ' : '';
            if (cand.kind === 'key') {
                // kv key: 把光标停在 key 末尾, 继续弹出值菜单
                const sep = after && !/^\s/.test(after) ? ' ' : '';
                const new_value = before + prefix + cand.insert + sep + after;
                const caret = before.length + prefix.length + cand.insert.length;
                this.set_command_value(input, new_value, caret);
                this.refresh_command_completion();
                return;
            }
            // 与后面的文字分开; trailing_space 的指令再补一个空格, 方便继续输入关键词
            let text = cand.insert;
            if (cand.trailing_space) {
                if (!after || !/^\s/.test(after)) text += ' ';
            } else if (after && !/^\s/.test(after)) {
                text += ' ';
            }
            const new_value = before + prefix + text + after;
            let caret = before.length + prefix.length + text.length;
            if (cand.trailing_space) {
                // 后面本来就有空白时, 光标跳到空白之后
                while (caret < new_value.length && /\s/.test(new_value[caret])) caret++;
            }
            this.set_command_value(input, new_value, caret);
            this.hide_command_completion();
            return;
        }

        // kv 多值链(块类型/排序): 选一个值后追加逗号并保持菜单; 空格项结束
        if (result.chain) {
            if (cand.kind === 'space') {
                const token = value.slice(start, end).replace(/,+$/, '');
                let text = token;
                if (!/\s/.test(value.slice(end))) text += ' ';
                const new_value = value.slice(0, start) + text + value.slice(end);
                let caret = start + text.length;
                while (caret < new_value.length && /\s/.test(new_value[caret])) caret++;
                this.set_command_value(input, new_value, caret);
                this.hide_command_completion();
                return;
            }
            const text = cand.insert + ',';
            const new_value = value.slice(0, start) + text + value.slice(end);
            this.set_command_value(input, new_value, start + text.length);
            this.refresh_command_completion();
            return;
        }

        // 时间表达式: 逐步引导; 选字段/比较符/连接符后保持菜单, 日期提示项只关闭菜单
        if (result.time) {
            if (cand.kind === 'hint') {
                this.hide_command_completion();
                return;
            }
            if (cand.kind === 'value') {
                const new_value = value.slice(0, start) + cand.insert + value.slice(end);
                this.set_command_value(input, new_value, start + cand.insert.length);
                this.refresh_command_completion(true);
                return;
            }
        }

        if (cand.kind === 'single' || cand.kind === 'terminal') {
            const new_value = value.slice(0, end) + cand.insert + value.slice(end);
            this.set_command_value(input, new_value, end + cand.insert.length);
            if (cand.close) {
                this.hide_command_completion();
            } else {
                this.refresh_command_completion();
            }
            return;
        }
        if (cand.kind === 'space') {
            const insert = /\s/.test(value[end] || '') ? '' : ' ';
            const new_value = value.slice(0, end) + insert + value.slice(end);
            let caret = end + insert.length;
            while (caret < new_value.length && /\s/.test(new_value[caret])) caret++;
            this.set_command_value(input, new_value, caret);
            this.hide_command_completion();
            return;
        }

        // 多字符 / 完整的 kv 值 / kv key / 值: 替换整个 token
        let text = cand.insert;
        if (cand.trailing_space && !/^\s/.test(value.slice(end))) text += ' ';
        const new_value = value.slice(0, start) + text + value.slice(end);
        let caret = start + text.length;
        if (cand.trailing_space) {
            // 后面本来就有空白时, 光标跳到空白之后
            while (caret < new_value.length && /\s/.test(new_value[caret])) caret++;
        }
        this.set_command_value(input, new_value, caret);
        if (cand.kind === 'key') {
            // kv key: 立即进入值菜单
            this.refresh_command_completion();
            return;
        }
        this.hide_command_completion();
    }

    set_command_value(input, value, caret) {
        input.value = value;
        this.history_typed_value = value;
        this.history_previewing = false;
        input.focus();
        input.setSelectionRange(caret, caret);
    }

    // 程序化插入后重新计算补全列表
    refresh_command_completion(manual = false) {
        const input = this.get_search_input();
        if (!input) {
            this.hide_command_completion();
            return;
        }
        const result = get_command_complete(this.g_setting.command_config, input.value, input.selectionStart, manual, this.get_completion_sort_ctx());
        if (!result || !result.candidates.length) {
            this.hide_command_completion();
            return;
        }
        this.show_command_completion(result);
    }

    hide_command_completion() {
        clearTimeout(this.history_timer_id);
        this.hidden_search_history_list();
        this.command_index = 0;
    }

    // 接管搜索历史
    handle_search_history() {
        //嵌入搜索历史列表
        this.insert_search_history_list();
        const inputElement = this.get_search_input();

        // input事件触发搜索历史列表
        // 中文触发顺序: start -> input -> input -> end
        // 英文触发顺序: input
        const schedule_history_list = (input) => {
            clearTimeout(this.history_timer_id);
            // 空输入不显示历史; 拦截模式下补一次搜索, 让结果区清空
            if (!input) {
                if (this.g_setting.intercept_search) this.search_history_dispatch_input();
                else this.hidden_search_history_list();
                return;
            }
            // 根据输入的搜索内容, 过滤出符合条件的历史记录
            // 定时器用于防止短时间触发多次搜索事件
            // 手动 Alt+↓ 打开的历史状态保持完整匹配, 不套用“仅前缀”过滤
            const state = this.get_page_suggestion_state(inputElement);
            const prefix_only = this.g_setting.history_auto_prefix_only && state?.history !== 'show';
            const history = matchHistory(input, SYT.get_search_history(), false, prefix_only);
            this.history_timer_id = setTimeout(() => this.show_search_history_list(history), 200);
        };
        inputElement?.addEventListener('compositionend', (event) => {
            // 指令补全独立于历史模式, 命中时暂停搜索
            if (this.update_command_completion(inputElement.value, inputElement.selectionStart, inputElement)) {
                event.stopPropagation();
                return;
            }
            if (this.get_history_auto_mode(inputElement) === 'close') return;
            if (!this.g_setting.intercept_search) {
                // 不拦截搜索: 交给原生处理, 这里只刷新历史建议
                this.history_typed_value = inputElement.value;
                this.history_previewing = false;
                schedule_history_list(inputElement.value);
                return;
            }
            // 因为思源原生也会监听compositionend事件, 然后触发与原生input一样的逻辑
            // 如果不阻止, 相当于还是触发了原生input事件, 这样的话, 下面的接管的逻辑就不管用了
            // 所以要阻止, 然后触发input, 由下面的逻辑判断是否触发原生input
            event.stopPropagation(); // 阻止传播
            this.dispatch_input()
        }, true);
        inputElement?.addEventListener('input', (event) => {
            // console.log('input事件触发', event.inputType, event.target.value, this.history_input_flag, event.isComposing, this.is_searching);
            const intercept = !!this.g_setting.intercept_search;
            if (this.history_input_flag) {
                // 由历史记录触发的原生 input 事件: 放行给思源执行搜索
                this.history_input_flag = false;
                this.is_searching = true;
                return;
            }
            // 用户修改了输入, 下一次搜索/点击结果重新计数
            {
                const page = inputElement.closest('.fn__flex-column');
                if (page && this._last_counted_queries) this._last_counted_queries.delete(page);
            }
            // 多值链中手动输入空格: 去掉末尾逗号, 和列表里的"空格(结束)"保持一致
            if (!event.isComposing && event.inputType === 'insertText' && event.data === ' ') {
                const caret = inputElement.selectionStart;
                const val = inputElement.value;
                if (caret >= 2 && val[caret - 1] === ' ' && val[caret - 2] === ',') {
                    let token_start = caret - 2;
                    while (token_start > 0 && !/\s/.test(val[token_start - 1])) token_start--;
                    const token = val.slice(token_start, caret - 2);
                    if (token.startsWith('--type=') || token.startsWith('--sort=')) {
                        inputElement.value = val.slice(0, caret - 2) + ' ' + val.slice(caret);
                        inputElement.setSelectionRange(caret - 1, caret - 1);
                    }
                }
            }
            // 指令补全优先于历史记录, 显示期间始终暂停搜索
            if (!event.isComposing &&
                this.update_command_completion(event.target.value, inputElement.selectionStart, inputElement)) {
                event.stopPropagation();
                this.history_typed_value = event.target.value;
                this.history_previewing = false;
                return;
            }
            if (this.get_history_auto_mode(inputElement) === 'close') {
                // 关闭模式不接管输入; 清掉可能残留的标记, 避免下一次输入被误判为历史触发
                this.history_input_flag = false;
                return;
            }
            if (intercept && this.is_searching) {
                // console.log('上次触发的搜索还没有结束, 不处理这次的input, 走思源原生input逻辑');
                return;
            }
            if (event.isComposing) {
                if (intercept) event.stopPropagation(); // 拦截时完全由插件接管输入
                // console.log('任何地方都不处理这次的input');
                return;
            }
            // 记录手打的内容, 用于取消预览时恢复
            this.history_typed_value = event.target.value;
            this.history_previewing = false;
            if (intercept) {
                // 阻止传播, 阻止原生搜索事件触发
                event.stopPropagation();
            }
            // console.log('搜索历史处理input');
            schedule_history_list(event.target.value);
        }, true);

        inputElement?.addEventListener('mousedown', () => {
            // 鼠标点回输入框: 光标位置可能变化, 立即关闭补全
            if (this.is_show_command_list()) this.hide_command_completion();
        });
        // 搜索历史列表相关事件监听
        inputElement?.addEventListener('keydown', (event) => {
            const type = event.key.toLowerCase();
            // Alt+↓ 切换历史列表; Tab 切换指令补全列表
            // 手动状态只在当前搜索页有效, 不修改任何设置
            if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && type === 'arrowdown') {
                if (!this.g_setting.replace_history) return;
                event.preventDefault();
                event.stopPropagation();
                this.toggle_history_suggestion(inputElement);
                return;
            }
            if (type === 'tab' && !event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
                if (!this.g_setting.command_shortcut) return;
                event.preventDefault();
                event.stopPropagation();
                this.toggle_command_suggestion(inputElement);
                return;
            }
            if (this.is_show_command_list()) {
                // 其他 Alt 组合键不处理, 保持补全打开
                if (event.altKey) return;
                // 快捷键关闭时, Tab 会离开输入框, 顺手关闭补全
                if (type === 'tab') {
                    this.hide_command_completion();
                    return;
                }
                if (event.ctrlKey || event.shiftKey || event.metaKey) {
                    if (event.shiftKey && (type === 'arrowup' || type === 'arrowdown')) {
                        this.hide_command_completion();
                    }
                    return;
                }
                switch(type) {
                case 'arrowdown':
                case 'arrowup':
                    event.preventDefault();
                    event.stopPropagation();
                    this.select_command_item((this.command_index || 0) + (type === 'arrowdown' ? 1 : -1));
                    break;
                case 'enter':
                    event.preventDefault();
                    event.stopPropagation();
                    this.apply_command_candidate(this.command_index || 0);
                    break;
                case 'escape':
                    event.preventDefault();
                    event.stopPropagation();
                    this.hide_command_completion();
                    break;
                }
                return;
            }
            if (event.ctrlKey || event.shiftKey || event.metaKey) return;
            // 其他 alt 组合键不处理
            if (event.altKey) return;
            if(this.is_show_history_list()) {
                // 没有alt键 有历史记录
                switch(type) {
                case 'arrowdown':
                case 'arrowup':
                    const history_ul = this.get_search_history_ul();
                    if (!history_ul) return;
                    event.preventDefault(); // 防止快捷键默认行为, 不加这个会导致光标在input里面移动
                    event.stopPropagation(); // 阻止传播
                    const ele_list = Array.from(history_ul.querySelectorAll('.HZ-search-history-li'));
                    const focus_ele = history_ul.querySelector('.b3-list-item--focus');
                    const length = ele_list.length;
                    let idx = ele_list.indexOf(focus_ele);
                    // 找到下一个位置
                    if (idx == -1) return
                    if (type == 'arrowup') idx--;
                    else if (type == 'arrowdown') idx++;
                    idx = (idx+length) % length;
                    this.select_search_history_item(ele_list[idx]);
                    break;
                case 'enter':
                    event.preventDefault(); // 防止 textarea 插入换行等默认行为
                    if (this.g_setting.intercept_search || this.history_previewing) {
                        event.stopPropagation(); // 由插件提交选中的历史项
                    }
                    // 不拦截搜索且没有预览时放行, 让原生回车立即触发搜索
                    this.commit_search_history();
                    break;
                case 'escape':
                    event.preventDefault(); // 防止 textarea 插入换行等默认行为
                    event.stopPropagation(); // 阻止传播
                    this.cancel_search_history();
                    break;
                }
            }
        });
        inputElement?.addEventListener('keyup', (event) => {
            // 左右/Home/End 移动光标后, 按新位置重新判断是否显示补全
            if (event.isComposing) return;
            if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
            const type = event.key.toLowerCase();
            if (type !== 'arrowleft' && type !== 'arrowright' && type !== 'home' && type !== 'end') return;
            this.update_command_completion(inputElement.value, inputElement.selectionStart, inputElement);
        });
        inputElement?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.isComposing) return;
            if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
            // 建议列表打开时回车用于选择, 不算搜索
            if (this.is_show_history_list() || this.is_show_command_list()) return;
            this.count_completion_usage(inputElement.value, inputElement);
        }, true);
        // 如果有搜索历史列表, 点击其他地方, 就退出
        if (!this.search_history_click_close_listener) {
            this.search_history_click_close_listener=true;
            document.addEventListener('click', (event) => {
                if (!this.is_show_history_list() && !this.is_show_command_list()) return;
                const path = event.composedPath();
                if (path.includes(this.get_search_input())) return;
                if (path.includes(this.get_suggestion_box())) return;
                if (path.includes(this.get_search_history_ul())) return;
                if (this.is_show_command_list()) {
                    this.hide_command_completion();
                    return;
                }
                this.cancel_search_history();
            }, true);
        }
    }

    // 接管上下键选中节点的效果
    handle_src_focus_file() {
        if (this.focus_file_keydown_listener) return;
        this.focus_file_keydown_listener = true;
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
            const type = event.key.toLowerCase();
            if (type != 'arrowup' && type != 'arrowdown' && type != 'enter') return;
            const new_tree = this.get_new_search_list();
            if (new_tree && !this.is_show_history_list() && !this.is_show_command_list()) {
                // 没有历史记录列表 && 存在新列表 就接管上下键
                // 原生搜索历史存在, 不处理
                if (document.querySelector('[data-name="search-history"]')) return;
                // 其他位置, 不处理
                const active_ele = document.activeElement;
                if (!(active_ele == document.body || 
                        active_ele == this.get_search_input() || 
                        active_ele == this.get_ele('#replaceInput'))) return
                
                if (type == 'arrowup' || type == 'arrowdown') {
                    event.preventDefault(); // 防止快捷键默认行为, 不加这个会导致光标在input里面移动
                    event.stopPropagation(); // 阻止传播
                    // 找到 选中的节点在搜索结果的位置
                    const focus_ele = new_tree.querySelector('.b3-list-item--focus');
                    const ele_list = Array.from(new_tree.querySelectorAll('[data-type="search-item"]'));
                    const length = ele_list.length;
                    let idx = ele_list.indexOf(focus_ele);
                    // 找到下一个位置
                    if (idx == -1) return
                    for (let i = 0; i < length; i++) {
                        if (type == 'arrowup') idx--;
                        else if (type == 'arrowdown') idx++;
                        idx = (idx+length) % length; 
                        // 直到找到下一个没有被隐藏的节点
                        if (!ele_list[idx].closest('.simpleSearchListBody.fn__none')) {
                            this._isKeyboardNav = true;
                            ele_list[idx].click();
                            setTimeout(() => this._isKeyboardNav = false, 0);
                            break;
                        }
                    }
                }
                if (type == 'enter') {
                    this.click_res_flag = true;
                    // 理论上三秒足以触发高亮
                    setTimeout(() => this.click_res_flag = false, 3000);
                }
            }
        });
    }
    // 对于当前这个搜索页面来说 第一次打开搜索页面
    handle_open_search_page(detail) {
        // 打上标记
        if (this.page.classList.contains('HZ-simple-search-page')) return;
        mylog_info('第一次打开搜索页面');
        this.page.classList.add('HZ-simple-search-page');

        // 在搜索页面嵌入: 快捷操作区域
        this.handle_assist_area();

        // 接管搜索历史
        this.handle_search_history();

        // 点击搜索结果时结算一次补全使用次数
        if (!this._result_click_count_listener) {
            this._result_click_count_listener = true;
            document.addEventListener('click', (event) => {
                const item = event.target?.closest?.('[data-type="search-item"]');
                if (!item) return;
                if (!item.closest('#searchList, #HZsimpleSearchList')) return;
                const page = item.closest('.fn__flex-column');
                const page_input = page?.querySelector('#searchInput');
                const query = page_input?.value || this.get_search_input()?.value || '';
                this.count_completion_usage(query, page_input);
            }, true);
        }

        // 新文档树事件
        // 3.接管上下键选中节点的效果
        this.handle_src_focus_file();

        // 4.全部展开/全部折叠事件
        this.get_ele('#searchExpand')?.addEventListener('click', () => {
            this.get_new_search_list()?.querySelectorAll('.b3-list-item__arrow:not(.b3-list-item__arrow--open)').forEach(arrow => arrow.parentElement.click());
        });
        this.get_ele('#searchCollapse')?.addEventListener('click', () => {
            this.get_new_search_list()?.querySelectorAll('.b3-list-item__arrow--open').forEach(arrow => arrow.parentElement.click());
        });

        // // 监听搜索框的blur事件, 保存搜索框内容, 让下次搜索自动填充上次搜索内容, 思源会自动将k的内容填充到搜索框
        // const input_ele = detail.searchElement;
        // input_ele.addEventListener("blur", (event) => {
        //     if (input_ele.value == "") return;
        //     SYT.set_search_k(input_ele.value);
        // });

        // // 搜索内容为空时, 填充上次搜索记录
        // const last_k = SYT.get_last_search_k();
        // if (!detail.config.query && last_k) {
        //     detail.config.query = last_k;
        //     input_ele.val = last_k;
        //     // new_input.focus();  // 聚焦到输入框, 聚焦之后理论上会触发blur, 但是不会触发搜索
        //     input_ele.select();
        // }

    }
    // 替换原始搜索参数
    replace_src_search(query_arg) {
        if(!query_arg) return;
        // 上次是指定的分组/排序, 这次先恢复
        if (this.last_sort != -1) {
            query_arg.sort = this.last_sort;
            this.last_sort = -1;
        }
        if (this.last_group != -1) {
            query_arg.group = this.last_group;
            this.last_group = -1;
        }
        const last_sort = query_arg.sort;
        const last_group = query_arg.group;
        const method_map = {
            "-w": {id:0, aria:"搜索方式: 关键字", icon:"#iconExact"},
            "-q": {id:1, aria:"搜索方式: 查询语法", icon:"#iconQuote"},
            "-s": {id:2, aria:"搜索方式: SQL", icon:"#iconDatabase"},
            "-r": {id:3, aria:"搜索方式: 正则表达式", icon:"#iconRegex"},
        }
        // 转换搜索内容, 传入 ignoredInputs 配置
        query_arg.ignoredInputs = this.g_setting.ignored_inputs;
        query_arg.command_config = this.g_setting.command_config;
        this.query = search_translator(query_arg);
        const res = this.query;
        // 根据转换后的内容, 设置相应的变量
        if (method_map[res.type] == undefined) return;
        // 搜索类型
        const method_id = method_map[res.type].id;
        query_arg.method = method_id;
        // 与原生 updateSearchMethodControls 联动: SQL 模式加高搜索框
        const search_input = this.get_search_input();
        if (search_input) {
            const is_sql = method_id === 2;
            if (search_input.classList.contains('search__input--sql') !== is_sql) {
                search_input.classList.toggle('search__input--sql', is_sql);
                // 输入框高度变化后, 重新定位历史列表
                this.reposition_search_history_list();
            }
        }
        this.get_ele("#searchSyntaxCheck")?.setAttribute('aria-label', method_map[res.type].aria);
        this.get_ele("#searchSyntaxCheck>svg>use")?.setAttribute('xlink:href', method_map[res.type].icon);
        // 搜索内容
        query_arg.query = res.val;

        // 如果指定了分组/排序方式, 就得记录下指定前的
        // 等到下次进来的时候, 再恢复
        if (last_sort != query_arg.sort) {
            this.last_sort = last_sort;
        }
        if (last_group != query_arg.group) {
            this.last_group = last_group;
        }
    }

    get_analysis_result_html(help) {
        const handle_arr = function(arr, def, sep=',') {
            if (!arr.length) return def;
            // return `(${arr.join(`)${sep}(`)})`;
            return `<span class="fn__code">${arr.join(`</span>${sep}<span class="fn__code">`)}</span>`;
        }
        const typeMap = {
            "-w": "关键字搜索",
            "-q": "查询语法",
            "-s": "sql语句",
            "-r": "正则表达式",
        }
        const type = typeMap[help.type] ? `${this.code(help.type)}${typeMap[help.type]}` : "识别错误"
        let group_file = help.group_file ? `(文档模式, 在符合条件的文档下进行搜索)` : "";
        let separator = help.group_file ? `|` : "&";
        let keywords = handle_arr(help.keywords, '未识别', separator);
        let excluded = handle_arr(help.excluded, '空', '&');
        let custom_time = "全部";
        if (help.custom_time.length) {
            custom_time = ` [${help.custom_time.join('] and [')}]`
        }
        let custom_path = "";
        if (help.path) {
            help.custom_path.unshift(help.path);
        }
        if (help.custom_path.length) {
            custom_path += ` and [${help.custom_path.join('] and [')}]`
        }
        if (help.excludedPath.length) {
            custom_path += ` and ![${help.excludedPath.join('] and ![')}]`
        }
        custom_path = custom_path ? custom_path.slice(5) : "全部"
        let block_type = "";
        Object.entries(help.block_type).forEach(([key, val]) => {
            // 优先使用配置中的指令形式(设置里改名/加别名后同步); 老数据回退到默认规则
            const cmd = (help.type_cmd && help.type_cmd[key])
                || (key === 's' ? '-S'
                    : (key.length > 1 && !/^h[1-6]+$/.test(key)) ? '--' + key
                    : '-' + key);
            block_type += `[${this.code(escapeHtml(cmd))}${val}],`;
        });
        block_type = block_type ? block_type.slice(0, -1) : "未识别";
        const errors = (help.errors && help.errors.length)
            ? `<tr><td style="color: var(--b3-theme-error);">指令提示:</td><td colspan="3" style="color: var(--b3-theme-error);">${help.errors.map(escapeHtml).join('<br>')}</td></tr>`
            : "";
        return `
        <span style="font-size: 16px; font-weight:bold">简搜: 解析结果 </span><span> (温馨提示: 拖动方框右下角可以调整显示区域)</span>
        <table id="simpleSearchAnalysisResTable"><tbody>
        <tr><td>搜索方式:</td><td colspan="3">${type}${group_file}</td></tr>
        <tr><td>搜索内容:</td><td>${keywords}</td><td colspan="2">排除内容: ${excluded}</td></tr>
        <tr><td>类型过滤:</td><td colspan="3">${block_type}</td></tr>
        <tr><td>路径过滤:</td><td colspan="3">${custom_path}</td></tr>
        <tr><td>时间过滤:</td><td colspan="3">${custom_time}</td></tr>
        <tr><td>分组排序:</td><td colspan="3">${help.group_desc || "—"} | ${help.sort}</td></tr>
        ${errors}
        <tr><td style="min-width:70px;">转换结果:</td><td colspan="3">${this.code(help.ret_str)}</td></tr>
        </tbody></table>`
    }
    // 显示解析结果
    update_analysis_result() {
        const text_area = this.get_ele('#simpleSearchTextarea');
        if (!text_area) return;
        text_area.innerHTML = this.get_analysis_result_html(this.query.help);
    }
    // 禁用回车创建文档
    forbid_enter_create_file(searchNew){
        // data-type不等于search-new, 说明搜到了结果, 退出
        if (searchNew.getAttribute('data-type') != 'search-new') return;
        // 修改类型
        searchNew.dataset.type = 'simple-search-new-disabled';
        // 点击时恢复类型
        searchNew.addEventListener('click', () => searchNew.dataset.type = 'search-new');

        // 修改提示语
        // console.log(searchNew.querySelector('kbd'))
        const right_str = searchNew.querySelector('kbd')
        if (right_str) right_str.textContent = `点击创建`;
        const tip_ele = searchNew.nextElementSibling;
        if (tip_ele && tip_ele.matches('.search__empty')) {
            tip_ele.textContent = `搜索结果为空，已禁用回车创建新文档, 改为 点击创建`;
            // tip_ele.style.cursor = 'pointer';
            // tip_ele.addEventListener('click', () => searchNew.click());
        }
    }
    // dfs遍历文档树, 生成文档树html
    insert_res_file_tree(head, body, tree_json) {
        if (!tree_json || !Object.keys(tree_json).length) return;
        const g_setting = this.g_setting;
        const child_key = 'hz_special_child';
        const insert_res_ele = function() {
            // 在body里面放上结果
            tree_json[child_key].classList.remove('fn__none');
            body.insertAdjacentElement('beforeend', tree_json[child_key]);
        }
        if (head && Object.keys(tree_json).length == 1 && !tree_json[child_key]){
            // 只有一个文档, 与父级合并
            const pathSpan = head.querySelector('.b3-list-item__text.ariaLabel');
            if (pathSpan) {
                const this_path = Object.keys(tree_json)[0];
                let newPath = this_path; // 全路径直接用this_path
                if (!g_setting.restree_all_path) {
                    // 不是全路径, 就拼接到父级路径的后面
                    // 新路径 = 父级路径 + 自身路径
                    newPath = pathSpan.textContent + '/' + this_path;
                }
                // 更新文本内容
                pathSpan.textContent = newPath;
                // 如果需要同时更新aria-label属性
                pathSpan.setAttribute('aria-label', newPath);
                this.insert_res_file_tree(head, body, tree_json[this_path]);
                return;
            }
        }
        // 结果优先
        if (g_setting.search_res_top && tree_json[child_key]) {
            insert_res_ele();
        }
        // 多个文档, 创建路径节点
        for (let this_path of Object.keys(tree_json).sort()) {
            if (this_path == child_key) continue;
            // 创建一个文档节点, 名字是path
            // 路径来自文档标题, 可能含 < > " 等字符, 拼 HTML 前必须转义
            const path_html = escapeHtml(this_path);
            body.insertAdjacentHTML('beforeend', `
                <div class="b3-list-item">
                <span class="b3-list-item__toggle b3-list-item__toggle--hl">
                    <svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
                </span>
                <span class="b3-list-item__graphic">📁</span>
                <span class="b3-list-item__text ariaLabel" style="color: var(--b3-theme-on-surface)" aria-label="${path_html}">${path_html}</span>
                </div><div class="simpleSearchListBody"></div>
            `);
            const new_body = body.lastElementChild;
            const new_head = new_body.previousElementSibling;
            this.insert_res_file_tree(new_head, new_body, tree_json[this_path]);
        }
        // 结果放后面
        if (!g_setting.search_res_top && tree_json[child_key]) {
            insert_res_ele();
        }
    }
    // 增加新文档树之后, 需要适配一些事件
    // 这里的逻辑, 每次搜索动作都会触发
    res_tree_event_listern(new_tree) {
        // 1.新文档树上监听鼠标事件, 同步给原节点
        new_tree.addEventListener('click', (event) => {
            const new_ele = event.target.closest('[data-type="search-item"]');
            if (!new_ele) return;
            event.stopPropagation();  // 停止事件传播
            const root_id = new_ele.getAttribute('data-root-id');
            const node_id = new_ele.getAttribute('data-node-id');
            const src_ele = this.get_search_list()?.querySelector(`[data-root-id="${root_id}"][data-node-id="${node_id}"]`);
            if (!src_ele) return;
            new_tree.querySelectorAll('.b3-list-item--focus').forEach(ele => ele.classList.remove('b3-list-item--focus'));
            new_ele.classList.add('b3-list-item--focus');
            if (this._isKeyboardNav) {
                new_ele.scrollIntoView({
                    behavior: 'auto',
                    block: 'center'
                });
            }
            // 创建新事件，显式复制所有重要属性
            const newEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                composed: event.composed,
                view: event.view,
                detail: event.detail ? event.detail : 1, // 关键！
                screenX: event.screenX,
                screenY: event.screenY,
                clientX: event.clientX,
                clientY: event.clientY,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                button: event.button,
                buttons: event.buttons,
                relatedTarget: event.relatedTarget
            });
            // 派发到目标元素
            src_ele.dispatchEvent(newEvent);
            if (event.detail == 2){
                this.click_res_flag = true;
                // 理论上三秒足以触发高亮
                setTimeout(() => this.click_res_flag = false, 3000);
            }
        });
        // 2. 打开新文档树的第一个文档
        const first_file = new_tree.querySelector('[data-type="search-item"]')
        if (!this.is_show_history_list() && !this.is_show_command_list() && first_file && !first_file.classList.contains('b3-list-item--focus')) {
            // 没有历史记录列表 && 第一个文档没有被选中的时候, 打开新文档树的第一个文档
            first_file.click();
        }

        // 3.接管上下键选中节点的效果
        // 4.全部展开/全部折叠事件
        // 在刚打开时监听: handle_open_search_page
    }
    show_search_res_list(src_tree_list, new_tree_list) {
        const new_res_arr = [];
        // 遍历原始搜索结果, 解析成数组
        for (let i = 0; i < src_tree_list.children.length; i+=2) {
            const path_ele = src_tree_list.children[i].cloneNode(true);
            const file_parent_ele = src_tree_list.children[i+1].cloneNode(true);
            if (!path_ele.classList.contains('b3-list-item')) break;
            new_res_arr.push({path_ele, file_parent_ele});
        }
        // 按照路径排序
        new_res_arr.sort((a, b) => {
            const textA = a.path_ele.querySelector('.b3-list-item__text').textContent;
            const textB = b.path_ele.querySelector('.b3-list-item__text').textContent;
            // 按字母排序，如果你需要区分大小写，可以使用 localeCompare 方法
            return textA.localeCompare(textB);
        });
        new_res_arr.forEach(res_node => {
            new_tree_list.insertAdjacentElement('beforeend', res_node.path_ele);
            new_tree_list.insertAdjacentElement('beforeend', res_node.file_parent_ele);
        });
    }
    show_search_res_tree(src_tree_list, new_tree_list) {
        const g_setting = this.g_setting;
        const new_tree_json= {};
        const fill_tree_json = function(path, file_parent) {
            // 解析路径
            const parts = path.split('/').filter(part => part !== '');
            // 按照路径填充结构体
            let current = new_tree_json;
            let currentPath = ''; // 用于构建当前路径
            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const key = g_setting.restree_all_path ? currentPath : part;
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];
            }
            // 将这个文档的所有结果, 放到固定的字段里面
            const file_parent_tmp = file_parent.cloneNode(true);
            if (current['hz_special_child']) {
                // 如果之前存在, 说明路径相同, 拼接在一起
                current['hz_special_child'].innerHTML += file_parent_tmp.innerHTML;
            }
            else {
                current['hz_special_child'] = file_parent_tmp;
            }
        }
        // 遍历原始搜索结果, 解析成文档树
        for (let i = 0; i < src_tree_list.children.length; i+=2) {
            const path_ele = src_tree_list.children[i];
            const file_parent_ele = src_tree_list.children[i+1];
            if (!path_ele.classList.contains('b3-list-item')) break;
            const path_str = path_ele.querySelector('.b3-list-item__text').textContent;
            fill_tree_json(path_str, file_parent_ele);
        }
        // 递归显示文档树结构
        this.insert_res_file_tree(null, new_tree_list, new_tree_json);
    }
    // 处理 结果文档树的显示
    show_search_res() {
        this.get_new_search_list()?.remove();
        const src_tree_list = this.get_search_list();
        src_tree_list.classList.remove("fn__none");
        const g_setting = this.g_setting;
        // 开关是关的, 退出
        if (!g_setting.replace_search_res) return;
        // 搜索结果为空, 退出
        if (this.get_ele('[data-type="simple-search-new-disabled"]')) return;
        // 原生新建文档项(未接管回车创建时), 也退出, 避免被当成文档路径渲染成树
        if (this.get_ele('#searchList>[data-type="search-new"]')) return;
        // 不分组, 退出
        if (this.get_ele('#searchList>.b3-list-item[data-type="search-item"]')) return;
        // 没有结果, 也退出, 正常不会走到这个if里面
        if (!this.get_ele('#searchList>.b3-list-item')) return;
        // 接管文档树的显示, 正式逻辑
        const new_tree_list = src_tree_list.cloneNode();
        new_tree_list.id ="HZsimpleSearchList";
        new_tree_list.classList.remove("fn__none");
        src_tree_list.classList.add('fn__none');
        src_tree_list.after(new_tree_list);
        if (g_setting.restree_style == 'native_list') {
            // 平铺
            this.show_search_res_list(src_tree_list, new_tree_list);
        }
        else {
            // 树结构
            this.show_search_res_tree(src_tree_list, new_tree_list);
        }
        // 处理监听事件
        this.res_tree_event_listern(new_tree_list);
    }
    // 搜索结束后触发
    search_completed_callback(){
        // 这里利用了一个特性, 搜索事件触发之后, search_list会重置为新的元素
        // 所以可以通过给第一个孩子打标记来判断搜索结束
        // 一直等到 新的元素(第一个孩子没有标记) 出现后, 触发
        whenExist(function() {
            return this.get_ele(`#searchList>:first-child:not(.simple-search-list-item)`);
        }.bind(this), function(ele) {
            // 搜到没有打标记的元素, 说明已经搜索结束, 直接给新元素打上标记
            ele.classList.add('simple-search-list-item');
            // 禁用回车创建文档
            if (this.g_setting.forbid_enter_create !== false) {
                this.forbid_enter_create_file(ele);
            }
            // 处理文档树显示
            this.show_search_res();
            this.is_searching = false;
        }.bind(this));
    }
    // 搜索事件触发
    inputSearchEvent(data) {
        this.page = data.detail.searchElement.closest(".fn__flex-column");
        this.is_searching = true;
        mylog('搜索事件触发', data, data.detail.config, '触发页面', this.page);

        // 1. 处理 第一次打开搜索页面, 打上标记, 而不是缓存
        this.handle_open_search_page(data.detail);
        // 2.1 替换原有搜索条件
        this.replace_src_search(data.detail.config);
        mylog("替换后参数", data.detail.config);
        // 输入被"阻止搜索的特殊输入"拦截时, 不会有正常的搜索完成回调,
        // 这里直接复位, 避免 is_searching 一直为 true 导致后续历史记录不自动显示
        if (this.query?.blocked) {
            this.is_searching = false;
            return;
        }
        // 2.2 显示解析结果
        this.update_analysis_result();
        // 3. 搜索结束后触发
        this.search_completed_callback();
    }

    highlightKeywords(search_list_text_nodes, keyword) {
        const str = keyword.trim().toLowerCase();
        const ranges = search_list_text_nodes // 查找所有文本节点是否包含搜索词
            .filter(el => {
                if (!el) return false;
                if (!el.tagName) return true;
                if (el.tagName.toLowerCase() == "mark") return false;
            }).flatMap((el) => {
                const text = el.textContent.toLowerCase();
                const indices = [];
                let startPos = 0;
                while (startPos < text.length) {
                    const index = text.indexOf(str, startPos);
                    if (index === -1) break;
                    indices.push(index);
                    startPos = index + str.length;
                }
                return indices.map((index) => {
                    const range = document.createRange();
                    range.setStart(el, index);
                    range.setEnd(el, index + str.length);
                    return range;
                });
            });
        return ranges;
    }
    // 只清除本插件注册的高亮
    // CSS.highlights 是全局注册表, 思源和其他插件也在用(如 search-mark-*), 不能整体 clear
    clear_highlight() {
        CSS.highlights.delete("highlight-keywords-search-list");
        CSS.highlights.delete("highlight-keywords-search-preview");
    }
    // 在界面加载完毕后高亮关键词
    loadedProtyleStaticEvent(data=null) {
        mylog('加载成功, 开始高亮', data);
        const query = this.query;
        if (!query) return;
        // 加载完毕的页面不在当前页面, 直接退出
        if (!this.page?.contains(data.detail.protyle.element)) return;
        // 暂时只处理sql语句的高亮
        if (query.type != '-s') return;

        this.clear_highlight();     // 清除上个高亮

        // 判断是否存在搜索界面
        let search_list = this.get_new_search_list();
        if (!search_list) search_list = this.get_search_list();
        if (!search_list) return;

        // 高亮 搜索结果列表里面的
        // 获取所有具有 b3-list-item__text 类的节点的文本子节点
        const search_list_text_nodes = Array.from(search_list.querySelectorAll(".b3-list-item__text:not(.ariaLabel)"), el => el.firstChild);
        const allRanges = []; // 收集所有高亮范围
        query.keywords.forEach((keyword) => {
            const ranges = this.highlightKeywords(search_list_text_nodes, keyword); // 收集当前关键词的高亮范围
            allRanges.push(...ranges); // 合并到总范围
        });
        const searchResultsHighlight = new Highlight(...allRanges.flat()); // 创建合并后的高亮对象
        CSS.highlights.set("highlight-keywords-search-list", searchResultsHighlight); // 注册合并的高亮

        // 高亮 点击搜索结果文档预览里面的
        const search_preview = this.get_ele('#searchPreview')
        // 获取代码块里面是否有关键词, 为了之后是否延时高亮
        let has_hljs = Array.from(search_preview.querySelectorAll('.hljs>div[spellcheck]'))
        .some(ele => query.keywords.some(
            keyword => ele.innerText.includes(keyword)
        ));
        setTimeout(() => { // 代码块会延时渲染, 如果有代码块, 也等待300毫秒(思源就这么做的)
            // 创建 createTreeWalker 迭代器，用于遍历文本节点，保存到一个数组
            const tree_walker = document.createTreeWalker(search_preview.children[1], NodeFilter.SHOW_TEXT);
            const search_preview_text_nodes = [];
            let current_node = tree_walker.nextNode();
            while (current_node) {
                if (current_node.textContent.trim().length > 1) {
                    search_preview_text_nodes.push(current_node);
                }
                current_node = tree_walker.nextNode();
            }
            const previewRanges = [];
            query.keywords.forEach((keyword) => {
                const ranges = this.highlightKeywords(search_preview_text_nodes, keyword); // 收集搜索预览的高亮范围
                previewRanges.push(...ranges);
            });
            const searchPreviewHighlight = new Highlight(...previewRanges.flat());
            CSS.highlights.set("highlight-keywords-search-preview", searchPreviewHighlight)
        }, has_hljs ? 300: 0);
    }
    scrollToCursor() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;

        // 获取光标所在的真实元素
        const currentElement = startContainer.nodeType === Node.TEXT_NODE
            ? startContainer.parentElement
            : startContainer;

        // 向上查找滚动容器
        const scrollContainer = currentElement.closest('.protyle-content.protyle-content--transition');
        if (!scrollContainer) return; // 没找到容器

        // 获取光标位置（相对于视口）
        const cursorRect = range.getBoundingClientRect();
        if (cursorRect.height == 0 && cursorRect.width == 0) return

        // 获取容器的视口范围
        const containerRect = scrollContainer.getBoundingClientRect();
        const viewportHeight = containerRect.height;

        // 判断光标是否在容器可视区域内
        const isAbove = cursorRect.top < containerRect.top;
        const isBelow = cursorRect.bottom > containerRect.bottom;

        if (isAbove || isBelow) {
            // 计算滚动偏移：让光标在容器内居中
            const targetScrollTop = (cursorRect.top - containerRect.top) - viewportHeight / 2;

            scrollContainer.scrollBy({
                top: targetScrollTop,
                behavior: 'smooth'
            });
        }
    }
    handleCursorPosition(element, keywords, type) {
        // 参数校验
        if (!element || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return;
        }

        const validTypes = ['before', 'select', 'after'];
        if (!validTypes.includes(type)) {
            return;
        }

        if (!element.isContentEditable) {
            // console.log('元素不是 contenteditable');
            return;
        }

        const textContent = element.textContent;

        // 查找最先出现的关键词
        let firstMatch = null;
        let firstIndex = -1;

        for (const keyword of keywords) {
            const index = textContent.indexOf(keyword);
            if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
                firstIndex = index;
                firstMatch = keyword;
            }
        }

        if (!firstMatch) {
            return;
        }

        const startOffset = firstIndex;
        const endOffset = firstIndex + firstMatch.length;

        // 将偏移量映射到 DOM 中的实际文本节点
        function findNodeAtOffset(root, offset) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    // 只遍历包含可见文本的文本节点
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            let currentOffset = 0;
            let node;

            while ((node = walker.nextNode())) {
                const nodeTextLength = node.textContent.length;

                if (currentOffset + nodeTextLength >= offset) {
                    return {
                        node,
                        offset: offset - currentOffset
                    };
                }

                currentOffset += nodeTextLength;
            }

            // 如果超出总长度，返回最后一个位置
            const lastNode = walker.lastChild();
            return { node: lastNode, offset: lastNode.textContent.length };
        }

        // 获取开始和结束位置
        const start = findNodeAtOffset(element, startOffset);
        const end = type === 'before' ? start : findNodeAtOffset(element, endOffset);

        // 创建选区
        const range = document.createRange();
        const sel = window.getSelection();
        sel.removeAllRanges();

        try {
            if (type === 'before') {
                range.setStart(start.node, start.offset);
                range.collapse(true);
            } else if (type === 'select') {
                range.setStart(start.node, start.offset);
                range.setEnd(end.node, end.offset);
            } else if (type === 'after') {
                range.setStart(end.node, end.offset);
                range.collapse(true);
            }

            sel.addRange(range);
            element.focus();
        } catch (e) {
            // console.error('Failed to set cursor or selection', e);
        }
        this.scrollToCursor();
    }

    // 通过搜索结果打开, 就高亮/闪烁
    switchProtyleEvent(data=null) {
        if (!this.click_res_flag) return;
        const g_setting = this.g_setting;
        if (!(g_setting.cursor_position != 'none' || g_setting.is_highlight_open || g_setting.is_blink_open)) return
        const keywords = this.query?.keywords;
        if (!keywords) return;

        mylog('点击了搜索结果, 开始高亮', data);
        this.click_res_flag = false;
        this.clear_highlight();     // 清除上个高亮

        setTimeout(() => { // 这个延时是为了让光标移到对应的位置上, 要不然获取到的光标位置不对
            // 修改光标位置
            const cursor_ele = getElementAtCursor()?.closest('[data-node-id]');
            if (!cursor_ele) return;

            this.handleCursorPosition(cursor_ele, keywords, g_setting.cursor_position)

            if (g_setting.is_blink_open) {
                // 闪烁当前块
                cursor_ele.classList.add('protyle-wysiwyg--hl');
                // 500毫秒足以看出来搜索的结果在哪里
                setTimeout(()=>cursor_ele.classList.remove('protyle-wysiwyg--hl'), 500);
            }
            if (g_setting.is_highlight_open) {
                // 高亮关键词
                const search_preview = cursor_ele;
                // const search_preview = cursor_ele ? cursor_ele : data.detail.protyle.element;
                // 获取代码块里面是否有关键词, 为了之后是否延时高亮
                let has_hljs = Array.from(search_preview.querySelectorAll('.hljs>div[spellcheck]'))
                .some(ele => keywords.some(
                    keyword => ele.innerText.includes(keyword)
                ));
                setTimeout(() => { // 代码块会延时渲染, 如果有代码块, 也等待300毫秒(思源就这么做的)
                    // 创建 createTreeWalker 迭代器，用于遍历文本节点，保存到一个数组
                    const tree_walker = document.createTreeWalker(search_preview, NodeFilter.SHOW_TEXT);
                    const search_preview_text_nodes = [];
                    let current_node = tree_walker.nextNode();
                    while (current_node) {
                        if (current_node.textContent.trim().length > 1) {
                            search_preview_text_nodes.push(current_node);
                        }
                        current_node = tree_walker.nextNode();
                    }
                    const previewRanges = [];
                    keywords.forEach((keyword) => {
                        const ranges = this.highlightKeywords(search_preview_text_nodes, keyword); // 收集搜索预览的高亮范围
                        previewRanges.push(...ranges);
                    });
                    const searchPreviewHighlight = new Highlight(...previewRanges.flat());
                    CSS.highlights.set("highlight-keywords-search-preview", searchPreviewHighlight)
                    // 高亮后, 点击就取消高亮
                    document.addEventListener('click', () => this.clear_highlight(), {once: true});
                }, has_hljs ? 300: 0);
            }
        }, 300);
    }
    sy_event_uninit() {
        if (this._on_input_search) this.eventBus.off("input-search", this._on_input_search);
        if (this._on_loaded_protyle_static) this.eventBus.off("loaded-protyle-static", this._on_loaded_protyle_static);
        if (this._on_switch_protyle) this.eventBus.off("switch-protyle", this._on_switch_protyle);
    }
    // 关闭总开关时, 移除已经插入到搜索界面里的元素
    remove_plugin_ui() {
        ['#simpleSearchShowSw',
         '#simpleSearchDisplayTreeSetting', '#simpleSearchSettingSpace',
         '#simpleSearchHelp', '#simpleSearchHelpSpace',
         '#simpleSearchAssistArea', '#simpleSearchSuggestionBox', '#simpleSearchHistoryList',
         '#simpleSearchHistoryTopHint', '#simpleSearchHistoryBottomHint'].forEach(sel => {
            document.querySelectorAll(sel).forEach(ele => ele.remove());
        });
        document.querySelectorAll('#searchInput.HZ-search-suggestion-open')
            .forEach(ele => ele.classList.remove('HZ-search-suggestion-open'));
        this.clear_highlight();
    }
    sy_event_init() {
        // 总开关关闭时不接管任何事件
        if (this.g_setting && this.g_setting.plugin_enabled === false) return;
        // 绑定结果只创建一次, on/off 必须使用同一个函数引用
        if (!this._on_input_search) {
            this._on_input_search = this.inputSearchEvent.bind(this);
            this._on_loaded_protyle_static = this.loadedProtyleStaticEvent.bind(this);
            this._on_switch_protyle = this.switchProtyleEvent.bind(this);
        }
        // 搜索事件触发, 执行回调后, 才会发送req进行搜索
        this.eventBus.on("input-search", this._on_input_search);
        // ✅ 编辑器内容静态加载事件
        this.eventBus.on("loaded-protyle-static", this._on_loaded_protyle_static);
        // 通过搜索结果打开, 就高亮/闪烁
        this.eventBus.on("switch-protyle", this._on_switch_protyle);
    }

    load_plugin_setting(func) {
        this.loadData("settings.json").then((settingFile)=>{
            // 解析并载入配置
            try {
                mylog("载入配置: ", settingFile);
                if ('restree_cfg' in settingFile) delete settingFile['restree_cfg'];
                if ('is_jump_to_match' in settingFile) delete settingFile['is_jump_to_match'];
                if (settingFile['restree_style'] == 'native') delete settingFile['restree_style'];
                // 兼容旧版本: history_auto 从布尔值迁移到字符串枚举
                if (typeof settingFile['history_auto'] === 'boolean') {
                    settingFile['history_auto'] = settingFile['history_auto'] ? 'smart' : 'close';
                }
                Object.assign(this.g_setting, settingFile);
            }catch(e){
                mylog_error("og-fdb载入配置时发生错误, 使用默认配置", e);
            }
            // 指令配置缺失或损坏时使用默认值
            if (!this.g_setting.command_config || !Array.isArray(this.g_setting.command_config.categories)) {
                this.g_setting.command_config = get_default_command_config();
            }
            // 应用日志等级
            set_log_level(this.g_setting.log_level);
            func();
        }, (e)=> {
            mylog_error("配置文件读入失败", e);
        });
    }
    save_plugin_setting(){
        this.saveData("settings.json", JSON.stringify(this.g_setting));
        mylog("保存配置: ", this.g_setting);
    }
    // 布局初始化完成后, 触发
    onLayoutReady() {
        if (window.siyuan.isPublish) return;
        this.css            = null;
        this.page           = null;  // 搜索框所在的页面, 所有搜索都在此元素下搜索, 用于隔离 搜索页签和搜索弹窗
        this.is_searching   = false; // 是否正在搜索
        this.click_res_flag = false; // 点击搜索结果的标记
        this.last_sort      = -1;    // 页面原始的排序方式
        this.last_group     = -1;    // 页面原始的分组方式
        this.history_typed_value = '';    // 用户手打的历史搜索内容, 取消预览时用于恢复
        this.history_previewing  = false; // 输入框内容是否由历史项预览写入
        this.history_timer_id    = 0;     // 历史列表延迟显示的定时器
        this.suggestion_mode     = null;  // 建议列表模式: history / command
        this.command_completion  = null;  // 当前指令补全的结果
        this.command_index       = 0;     // 指令补全当前高亮项

        this.completion_usage         = {};    // 补全形式使用次数
        this._completion_usage_loaded = false;
        this._completion_usage_dirty  = false;
        this._completion_usage_ignore_load = false;
        this._last_counted_queries    = new WeakMap(); // 每个搜索页已计数的查询
        this._completion_usage_save_timer = 0;
        this._completion_entries_cache = null;
        this._result_click_count_listener = false;

        this.page_suggestion_states = new WeakMap(); // 每个搜索页各自的历史/补全手动开关状态
        this.query        = {type:"", val:"", keywords:[], help:{}}; // 解析后的内容 {type: 搜索类型, val: 搜索内容, keywords: 关键词}
        this.g_setting    = get_default_plugin_settings();
        this.load_completion_usage();
        this.load_plugin_setting(() => {
            this.save_plugin_setting();
            this.init_css_style();
            this.sy_event_init();
            // 重新加载后, 上次搜索历史会丢, 这里重新赋值一下
            // SYT.set_last_search_k();

            mylog_info("HZ simple search start...")
        });
    }

    onunload() {
        if (window.siyuan.isPublish) return;
        this.uninit_css_style();
        this.sy_event_uninit()
        // 立即落盘使用次数, 避免防抖计时器未触发
        clearTimeout(this._completion_usage_save_timer);
        if (this._completion_usage_loaded || this._completion_usage_dirty) {
            const ret = this.saveData("completion_usage.json", JSON.stringify(this.completion_usage || {}));
            if (ret && ret.catch) ret.catch(() => {});
        }
        mylog_info("HZ simple search stop...")
    }
};

module.exports = {
    default: SimpleSearchHZ,
};
const siyuan = require("siyuan");

function mylog(...args) {
    // return
    const err = new Error();
    // 获取堆栈信息
    const stack = err.stack.split('\n');
    const location = stack[2] || "unknown location";

    // 解析函数名、文件名和行号
    const parts = location.trim().split(' ');
    const functionName = parts[1] || "unknown function";
    const fileInfo = decodeURIComponent(parts[2]?.replace(/\s*\(\s*|\s*:\d+\)\s*/g, '')); // 去掉小括号中的内容

    // 获取当前时间
    const now = new Date();
    // 获取时间部分
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    // 构造日志前缀
    // const logPrefix = `[${hours}:${minutes}:${seconds}:${milliseconds}] [${functionName} ${fileInfo}]`;
    const logPrefix = `[${functionName} ${fileInfo}]`;

    console.log(`${logPrefix} `, ...args);
}
// 功能: 监听直到元素存在
// 找到 selector 时，执行 func_cb，监听超时时间默认为 4s
// selector: string | #id | function
function whenExist(selector, func_cb, time_out = 4000) {
    console.log("whenExist begin", selector);

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
                console.error("Invalid selector type");
                resolve(false);
                return;
            }

            if (element) {
                // 元素存在时，执行回调并解析Promise
                if (func_cb) func_cb(element);
                resolve(true);
            } else if (Date.now() - startTime >= time_out) {
                // 超时处理
                console.log(selector, "whenExist timeout");
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
        window.siyuan.notebooks.forEach(book => { if(!book.closed && book.name.match(name)) book_id.push(book.id); });
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
    const defaultTypeOrderBy = `case type 
        when 'd' then 1
        when 'h' then 2
        when 'i' then 3
        when 'p' then 4
        when 't' then 5
        when 'b' then 6
        when 'c' then 7
        when 'm' then 8
        when 'l' then 9
        when 's' then 10
        when 'html' then 11
        when 'widget' then 12
        when 'query_embed' then 13
        when 'iframe' then 14
        end`;
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
    // 块映射
    const blockTypeMapping = {
        audioBlock: '',
        blockquote: 'b',
        codeBlock: 'c',
        databaseBlock: '',
        document: 'd',
        embedBlock: '',
        heading: 'h',
        htmlBlock: '',
        iframeBlock: '',
        list: 'l',
        listItem: 'i',
        mathBlock: 'm',
        paragraph: 'p',
        superBlock: 's',
        table: 't',
        videoBlock: '',
        widgetBlock: ''
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
    }
    const input           = arg.query;  // 输入的源内容
    const pageSearchPath  = arg.idPath; // 页面配置的搜索路径
    const pageSearchTypes = arg.types;  // 页面配置的搜索类型

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
        path        : arg.hPath,
        custom_path : [],
        excludedPath: [],
        custom_time : [],
        sort        : "默认",
    }

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
        help.group_file = !!options.match(/e/);
        help.keywords = keywords;
        help.excluded = excludedKeywords;
        if (Object.keys(help.block_type).length == 0 && type != '-s') {
            // 填充辅助信息的类型
            for (const key in pageSearchTypes) {
                if (pageSearchTypes[key] && blockTypeMapping[key] != "") {
                    help.block_type[blockTypeMapping[key]] = blockHelpMap[blockTypeMapping[key]];
                }
            }
        }
        if (help.sort == '默认') {
            help.sort = _getSortHelpPrefix() + sortHelpMap[arg.sort];
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
    // 解析输入内容, 解析出 关键词, 排除的关键词, 搜索选项
    const _parseInput = function() {
        const inputItems = input.split(" ");
        for (let item of inputItems) {
            if (item === "" || item === "-") {
                continue;
            } else if (item.match(/^-([kKedlptbsicmoOL]|h[1-6]*)+$/)) {
                options += item.slice(1);
            } else if (item.startsWith('-/')) {
                excludedPath.push(item.slice(1));
            } else if (_parse_time(item)) {
                continue;
            } else if (item.startsWith('-')) {
                excludedKeywords.push(item.slice(1));
            } else if (item.startsWith('/')) {
                if (item.startsWith('//')) {
                    custom_path_all = 1;
                }
                custom_path.push(item);
            } else if (_parse_sort(item)) {
                continue;
            } else {
                keywords.push(item);
            }
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
        if (is_exclude) {
            return `(content not like '%${word}%' and name not like '%${word}%' and alias not like '%${word}%' and memo not like '%${word}%')`;
        }
        else {
            return `(content like '%${word}%' or name like '%${word}%' or alias like '%${word}%' or memo like '%${word}%')`;
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
        if (!sqlTypes && !keywords.length && !excludedKeywords.length && custom_path.length) {
            return "true";
        }

        const typeHandlers = {
            // 搜索标准块类型的sql语句
            "[dlptbsicm]": (types) => {
                const basic_type = types.replace(/[^dlptbsicm]/g, "");
                Array.from(basic_type).forEach((type_once) => help.block_type[type_once] = blockHelpMap[type_once]);
                return `type rlike '^[${basic_type}]$'`
            },
            // 搜索子标题的sql语句
            "h[1-6]*": (types) => {
                types = types.match(/h[1-6]*/g)[0];
                const headType = `type rlike '^[h]$'`;
                const subType = types.replace(/[^\d]/g, "");
                if (subType == '') {
                    help.block_type['h'] = "标题";
                    return headType;
                }
                else {
                    help.block_type[types] = `${[...new Set(subType.split(''))].join(',')}级标题`;
                    return `(${headType} and subtype rlike '^h[${subType}]$')`;
                }
            },
            // 搜索待办的sql语句
            "[oO]": (types) => {
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
                help.block_type['L'] = "表示带有链接的块";
                return `(type rlike '^[htp]$' and markdown like '%[%](%)%')`
            },
        };
        // 解析选项, 拼接sql语句
        for (let key in typeHandlers) {
            if (sqlTypes.match(key)) {
                if (sqlTypeRlike !== "") sqlTypeRlike += " or ";
                sqlTypeRlike += typeHandlers[key](sqlTypes);
            }
        }

        // 未指定搜索块类型时，选择“搜索类型”中开启的块类型
        if (sqlTypeRlike === "") {
            let types = "";
            for (const key in pageSearchTypes) {
                if (pageSearchTypes[key] && blockTypeMapping[key] != "") {
                    types += blockTypeMapping[key];
                    help.block_type[blockTypeMapping[key]] = blockHelpMap[blockTypeMapping[key]];
                }
            }
            sqlTypeRlike = `type rlike '^[${types}]$'`;
        }
        return sqlTypeRlike ? `(${sqlTypeRlike})` : "true";
    }
    // [拼接sql] 以文档维度,过滤关键词
    const _buildSqlGroupByFile = function() {
        let sqlGroupByFile = "";
        if (options.match(/e/)) {
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
        // 指定搜索路径名称
        // 1. 只有搜索路径 /笔记本1/文档1
        // 2. 指定搜索路径 加其他 /笔记本1 -h 序列号
        custom_path.forEach((path) => {
            const path_arr = path.split('/').filter(part => part !== '');
            if (path_arr.length == 0) return;

            let file_sql = ""
            if (keywords.length == 0) {
                // 没有关键词时, 转成搜索文档
                const file_name = path_arr.at(-1);
                file_sql = `type rlike '^[d]$' and content like '%${file_name}%'`
                help.block_type['d'] = blockHelpMap['d'];
                keywords.push(file_name);
            }
            help.custom_path.push(`*${path_arr.join('*/*')}*`);
            file_sql = file_sql ? ` and (${file_sql})` : "";
            // 拼接剩余路径的sql语句
            // 1. 只搜索笔记本下面的路径
            let sql_once = `(hpath like '%${path_arr.join('%')}%'${file_sql})`;
            // 2. 将第一个路径当做笔记本, 剩余的当做笔记本下面的路径
            const book_arr = SYT.get_book_arr_from_name(path_arr[0]);
            path_arr.shift();
            // 有对应的笔记本id && 还有其他路径, 才搜笔记本
            // 而且笔记本可能是有多个, 都要搜出来
            if (book_arr.length) {
                const path_sql = path_arr.length ? ` and hpath like '%${path_arr.join('%')}%'` : '';
                sql_once += ` or (box in ("${book_arr.join('","')}")${path_sql}${file_sql})`
            }
            sqlCustomPath += ` and (${sql_once})`;
        });
        excludedPath.forEach((path) => {
            const path_arr = path.split('/').filter(part => part !== '');
            if (path_arr.length == 0) return;
            help.excludedPath.push(`*${path_arr.join('*/*')}*`);
            // 1. 只搜索笔记本下面的路径
            let sql_once = `(hpath like '%${path_arr.join('%')}%')`;
            // 2. 将第一个路径当做笔记本, 剩余的当做笔记本下面的路径
            const book_arr = SYT.get_book_arr_from_name(path_arr[0]);
            path_arr.shift();
            // 有对应的笔记本id && 还有其他路径, 才搜笔记本
            // 而且笔记本可能是有多个, 都要搜出来
            if (book_arr.length) {
                const path_sql = path_arr.length ? ` and hpath like '%${path_arr.join('%')}%'` : '';
                sql_once += ` or (box in ("${book_arr.join('","')}")${path_sql})`
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
                sqlCurrentDoc = options.match(/K/) ? `path rlike '${currentDocId}'` : `path like '%${currentDocId}.sy'`;
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
                    filterPath += ` or (box="${boxPath}")`;
                } else {
                    boxPath = path.slice(0, idx);
                    filePath = path.slice(idx);
                    filterPath += ` or (box="${boxPath}" and path like '${filePath}%')`;
                }
            };
            if (filterPath.length) {
                sqlCurrentDoc = `${filterPath.slice(4)}`;
            }
        }
        return sqlCurrentDoc ? `(${sqlCurrentDoc})` : "true";
    }
    const _getSortHelpPrefix = function() {
        // 示例: [指定]按文档分组: [指定]
        return `[${custom_group == -1 ? "页面配置" : "指定"}]${arg.group ? "按文档分组" : "不分组"}: [${custom_sort.length ? "指定" : "页面配置"}]`;
    }
    const _buildOrderByFromType = function(sort_e, sort_help=[]) {
        if (sort_e != TYPE_SORT) {
            sort_help.push(nonGroupSortHelpMap[sort_e]);
        }
        switch(sort_e) {
        case TYPE_SORT:
            // 按照输入的类型优先
            let ret_sql = "case type";
            let help_tmp = [];
            let sqlTypes = options.replace(/[oOL1-6]/g, "");
            if (sqlTypes == "") {
                sort_help.push(nonGroupSortHelpMap[TYPE_SORT])
                return defaultTypeOrderBy;
            }
            for (let i = 0; i < sqlTypes.length; i++) {
                if (typeOrderMapping[sqlTypes[i]]) {
                    ret_sql += typeOrderMapping[sqlTypes[i]] + i.toString();
                    help_tmp.push(blockHelpMap[sqlTypes[i]])
                }
            }
            if (ret_sql != "case type") {
                sort_help.push('('+help_tmp.join(',')+')');
                return ret_sql + ' end';
            }
            sort_help.push(nonGroupSortHelpMap[TYPE_SORT])
            return defaultTypeOrderBy;
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
        help.sort = _getSortHelpPrefix();
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
            help.sort += `文档:路径名升序->单文档下:${groupSortHelpMap[arg.sort]}`;
        }
        else {
            // 不按照文档分组的排序, 思源不会处理, 所以都可以通过sql干预
            const help_tmp = [];
            if (custom_sort.length) {
                // 指定了排序, 按照指定的拼接sql
                const sort_arr = [];
                custom_sort.forEach(sort_e => {
                    sort_arr.push(_buildOrderByFromType(sort_e, help_tmp));
                });
                sqlOrderBy += sort_arr.join(", ");
            }
            else {
                // 没有指定排序, 按照页面配置
                sqlOrderBy += _buildOrderByFromType(arg.sort, help_tmp);
            }
            help.sort += help_tmp.join('->');
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
        let sqlKeyWords = _buildSqlKeyWords(options.match(/e/));
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
        if (options.length || custom_path.length || excludedPath.length ||
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
            // 没有选项, 排除词, 自定义路径, 就是用原样输入
            mylog('type: 关键词');
            return "-w" + input;
        }
    }

    //-------------------------- 主流程
    if (input.match(/^-[wqrs]/) != null) {
        return _handle_ret(input);
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
 * @returns {string[]} 排序后的历史记录，匹配的在前（高亮），未匹配的按原顺序在后
 */
function matchHistory(input, history, is_all=false) {
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
                result.push(`<span class="HZ-search-history-highlight">${matchedText}</span>`);
                i = j;
            } else {
                result.push(record[i]);
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
        const matchScore = _calculateMatchScore(inputLower, recordLower);
        
        if (matchScore > 0) {
            // 高亮匹配项
            const highlighted = _highlightMatch(record, inputTrimmed);
            matchedResults.push({ record: highlighted, score: matchScore, original: record });
        } else if (is_all){
            unmatchedResults.push(record);
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
    is_show_history_list() {
        return !this.get_search_history_ul()?.classList.contains('fn__none');
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
        if (tree_style == 'native') {
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
                    padding: 2px;
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
                    left: 21px;
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
    get_plugin_setting_html() {
        const get_html_head = function (icon, str) {
            return `<div class="section-title"><i>${icon}</i> ${str}</div>`
        }
        const get_html_cfg_name = function (name, desc) {
            return `<div class="fn__flex-1">${name}<div class="b3-label__text">${desc}</div></div>`
        }
        const get_html_check_sw = function (id, sw) {
            return `<input class="b3-switch fn__flex-center" id="${id}" type="checkbox" ${sw ? 'checked=""' : ''}>`
        }
        const get_html_radio_sw = function (tree_style) {
            let is_native   = tree_style == "native" ? "checked" : "";
            let is_colorful = tree_style == "colorful" ? "checked" : "";
            let is_ediary   = tree_style == "ediary" ? "checked" : "";
            return `
                <div class="fn__flex b3-label">
                    ${get_html_cfg_name('搜索结果树样式 - 竖线风格 <a href="https://ld246.com/article/1759408628406">了解更多</a>', '选择树结构竖线的显示风格')}
                    <span class="fn__space"></span>
                    <div class="radio-group" id="simpleSearchTreeStyle">
                        <div class="radio-item">
                            <input type="radio" id="simpleSearchStyleNative" name="treeStyle" ${is_native}>
                            <label for="simpleSearchStyleNative">原生</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" id="simpleSearchStyleColorful" name="treeStyle" ${is_colorful}>
                            <label for="simpleSearchStyleColorful">多彩</label>
                        </div>
                        <div class="radio-item">
                            <input type="radio" id="simpleSearchStyleEdiary" name="treeStyle" ${is_ediary}>
                            <label for="simpleSearchStyleEdiary">eDiary风格</label>
                        </div>
                    </div>
                </div>
            `
        }
        const get_html_setting_once = function(id, name, desc, sw_html) {
            id = id ? `id = "${id}"` : ""
            return `
                <label ${id} class="fn__flex b3-label">
                    ${get_html_cfg_name(name, desc)}
                    <span class="fn__space"></span>
                    ${sw_html}
                </label>
            `
        }
        const g_setting = this.g_setting;
        //生成当前设置
        return `<div id="simpleSearchAssistSetting">
            <span>(温馨提示: 修改后会自动保存; 拖动方框右下角可以调整显示区域)</span>
            ${get_html_head('🕒', '历史记录')}
            ${get_html_setting_once("", "接管历史记录", `开启后, 可通过${this.code('alt+↓')}切换历史记录列表显示与隐藏, 以及打开自动显示的开关;<br>可通过${this.code('alt+↑')}隐藏历史记录, 以及关掉自动显示的开关<br>备注: 关闭后, 不会影响自动显示开关; 思源原生的历史记录依旧可以通过点击进行正常操作`, get_html_check_sw("simpleSearchReplaceHistory", g_setting.replace_history))}
            ${get_html_setting_once("", "自动显示历史记录", "开启后, 在搜索框输入内容会先匹配搜索历史, 点击/回车后才会触发真正的搜索<br>备注: 完全匹配到/完全没匹配到的时候, 不会自动显示", get_html_check_sw("simpleSearchHistoryAuto", g_setting.history_auto))}
            ${get_html_head('🔍', '搜索结果相关')}
            ${get_html_setting_once("", "接管搜索结果", "开启后, 搜索结果将以树的样式进行显示, 仅在分组下生效", get_html_check_sw("simpleSearchTreeSw", g_setting.replace_search_res))}
            ${get_html_radio_sw(g_setting.restree_style)}
            ${get_html_setting_once("", "搜索结果优先", "开启后，搜索结果将显示在同级分组的上面", get_html_check_sw("simpleSearchResTop", g_setting.search_res_top))}
            ${get_html_setting_once("", "显示全路径", "开启后, 分组的文档将显示全路径, 而不是只有文档名", get_html_check_sw("simpleSearchAllPath", g_setting.restree_all_path))}
        </div>`;
        // ${get_html_setting_once("", "树样式同步至文档树", "开启后, 文档树和大纲会修改成与搜索结果相同的样式", get_html_check_sw("simpleSearchSyncTree", g_setting.sync_file))}
    }
    // 显示
    show_plugin_setting() {
        const text_area = this.get_ele('#simpleSearchTextarea');
        if (!text_area) return;
        text_area.innerHTML = this.get_plugin_setting_html();

        const key_map = { // id -> this.g_setting.key
            simpleSearchHistoryAuto   : 'history_auto',        // 自动显示历史记录
            simpleSearchReplaceHistory: 'replace_history',     // 取代历史记录
            simpleSearchTreeSw        : 'replace_search_res',  // 接管搜索结果
            simpleSearchSyncTree      : 'sync_file',           // 同步文档树样式
            simpleSearchResTop        : 'search_res_top',      // 搜索结果优先
            simpleSearchAllPath       : 'restree_all_path',    // 显示全路径
            simpleSearchStyleNative   : 'native',              // 树样式: 原生
            simpleSearchStyleColorful : 'colorful',            // 树样式: 多彩
            simpleSearchStyleEdiary   : 'ediary',              // 树样式: eDiary风格
        }
        // 搜索历史 相关开关
        const handle_search_history = (key, is_check) => {
            // 赋值, 保存到文件, 更新css, 更新搜索结果
            if (this.g_setting[key] == is_check) return;
            this.g_setting[key] = is_check;
            this.save_plugin_setting();
        };
        // 搜索结果 相关开关
        const handle_search_restree = (key, is_check) => {
            // 赋值, 保存到文件, 更新css, 更新搜索结果
            if (this.g_setting[key] == is_check) return;
            this.g_setting[key] = is_check;
            this.save_plugin_setting();
            this.init_css_style();
            this.show_search_res_tree();
        }
        // 搜索结果树 竖线样式 相关开关
        const handle_restree_style = (style_type, is_check) => {
            if (!is_check) return;
            // 赋值, 保存到文件, 更新css, 更新搜索结果
            if (this.g_setting.restree_style == style_type) return;
            this.g_setting.restree_style = style_type;
            this.save_plugin_setting();
            this.init_css_style();
            this.show_search_res_tree();
        }
        const func_map = {
            simpleSearchHistoryAuto   : handle_search_history,
            simpleSearchReplaceHistory: handle_search_history,
            simpleSearchTreeSw        : handle_search_restree,
            simpleSearchSyncTree      : handle_search_restree,
            simpleSearchResTop        : handle_search_restree,
            simpleSearchAllPath       : handle_search_restree,
            simpleSearchStyleNative   : handle_restree_style,
            simpleSearchStyleColorful : handle_restree_style,
            simpleSearchStyleEdiary   : handle_restree_style,
        }
        text_area.addEventListener('change', (event) => {
            const id = event.target.id;
            func_map[id](key_map[id], event.target.checked);
        });
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
        return `<div id="simpleSearchHelpTable">
        <span style="font-size: 16px; font-weight:bold">简搜插件关键字: </span><span> (温馨提示: 拖动方框右下角可以调整显示区域)</span>
        <table><tbody>
        <tr>
            <td colspan="1">${this.strong(" 搜索方式: ")}</td>
            <td>${this.code("-w")}:关键字搜索</td>
            <td>${this.code("-q")}:查询语法</td>
            <td>${this.code("-s")}:SQL语句搜索</td>
            <td>${this.code("-r")}:正则表达式</td>
        </tr>
        <tr>
            <td colspan="1" rowspan="5">${this.strong(" 块类型过滤: ")}</td>
            <td>${this.code("-d")}:文档块</td>
            <td>${this.code("-h")}:标题块</td>
            <td>${this.code("-h13")}:1、3级标题</td>
            <td>${this.code("-p")}:段落块</td>
        </tr>
        <tr>
            <td>${this.code("-c")}:代码块</td>
            <td>${this.code("-b")}:引述块</td>
            <td colspan="2">${this.code("-L")}:表示带有链接的块(非思源标准的块类型)</td>
        </tr>
        <tr>
            <td colspan="3">${this.code("-l")}:列表块(包含有序列表块、无序列表块和任务列表块)</td>
            <td>${this.code("-i")}:列表项块</td>
        </tr>
        <tr>
            <td>${this.code("-t")}:表格块</td>
            <td>${this.code("-m")}:数学公式块</td>
            <td colspan="2">${this.code("-s")}:超级块(-s不能放到开头, 否则会和sql搜索冲突)</td>
        </tr>
        <tr>
            <td colspan="2">${this.code("-o")}:小写o, 未完成的待办项(todo)</td>
            <td colspan="2">${this.code("-O")}:大写o, 已完成的待办项(done)</td>
        </tr>
        <tr>
            <td colspan="1" rowspan="2">${this.strong(" 路径过滤: ")}</td>
            <td colspan="2">${this.code("//")}:在所有文档里面搜索</td>
            <td colspan="2">${this.code("/")}:过滤文档路径</td>
        </tr>
        <tr>
            <td colspan="2">${this.code("-k")}:小写k, 在当前文档搜索</td>
            <td colspan="2">${this.code("-K")}:大写k, 在当前文档及子文档搜索</td>
        </tr>
        <tr>
            <td colspan="1" rowspan="2">${this.strong(" 时间过滤: ")}</td>
            <td colspan="2">${this.code("ct<2025")}/${this.code("ut<2025")}:查询2025年之前创建/更新的内容</td>
            <td colspan="2">${this.code("ct=20251001123456")}/${this.code("ut=20251001123456")}:查询2025年10月1号12:34:56创建/更新的内容</td>
        </tr>
        <tr>
            <td colspan="2">${this.code("ct>2025")}/${this.code("ut>2025")}:查询2025年之后创建/更新的内容</td>
            <td colspan="2">${this.code("ct>2025&ct<2027|ut=2024")}:查询2025-2027年期间创建 或 2024年更新的内容</td>
        </tr>
        <tr>
            <td colspan="1" rowspan="3">${this.strong(" 分组&排序: ")}</td>
            <td colspan="2">${this.code("g<")}/${this.code("g>")}:按照文档分组</td>
            <td colspan="2">${this.code("nog<")}/${this.code("nog>")}:不按文档分组</td>
        </tr>
        <tr>
            <td colspan="2">${this.code("type<")}/${this.code("type>")}:按照类型排序</td>
            <td colspan="2">${this.code("cont<")}/${this.code("cont>")}:原文内容顺序</td>
        </tr>
        <tr>
            <td>${this.code("ct<")}:创建时间升序</td>
            <td>${this.code("ct>")}:创建时间降序</td>
            <td>${this.code("ut<")}:更新时间升序</td>
            <td>${this.code("ut>")}:更新时间降序</td>
        </tr>
        <tr>
            <td colspan="1" rowspan="2">${this.strong(" 其他: ")}</td>
            <td colspan="4">${this.code("-")}"+要排除的关键词，排除指定关键词</td></tr>
        </tr>
        <tr>
            <td colspan="4">${this.code("-e")}":文档模式, 在符合条件的文档下进行搜索</td>
        </tr>
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
            <span id="simpleSearchShowSw" aria-label="${sw.label}" class="block__icon ariaLabel" data-position="9south">
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
            const jump_div = this.get_ele('#simpleSearchQuickJump');
            if (this.g_setting.assist_sw) {
                jump_div.classList.remove('fn__none');
            }
            else {
                jump_div.classList.add('fn__none');
            }
        });

        // 2. 增加帮助按钮
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space"></span>
            <span id="simpleSearchHelp" aria-label="简搜: 点击显示插件关键词" class="block__icon ariaLabel" data-position="9south">
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

        // 3. 增加帮助与反馈按钮
        const save_ele = this.get_ele('[data-type="saveCriterion"]');
        save_ele.insertAdjacentHTML('beforebegin', `
            <div id="simpleSearchQuickJump" class="${this.g_setting.assist_sw ? "" : 'fn__none'}" >
            <button id="simpleSearchGotoReadme" class="b3-button b3-button--small b3-button--outline fn__flex-center ariaLabel" aria-label="简搜: 点击跳转至插件的readme">帮助与反馈</button>
            <span class="fn__space"></span>
            <button id="simpleSearchDisplayTreeSetting" class="b3-button b3-button--small b3-button--outline fn__flex-center ariaLabel" aria-label="简搜: 点击打开插件的设置页面">简搜设置</button>
            <span class="fn__space"></span>
            </div>
        `); 
        // const help_link = '<a href="https://gitee.com/Hug_Zephyr/HZ-syplugin-simple-search/blob/master/README.md">帮助与反馈</a>';
        this.get_ele('#simpleSearchGotoReadme')?.addEventListener('click', (event) => {
            event.stopPropagation();  // 停止事件传播
            window.open('https://gitee.com/Hug_Zephyr/HZ-syplugin-simple-search/blob/master/README.md', '_blank');
            event.target.blur();
        });
        this.get_ele('#simpleSearchDisplayTreeSetting')?.addEventListener('click', (event) => {
            event.stopPropagation();  // 停止事件传播
            this.show_plugin_setting();
            event.target.blur();
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
        if (!history_ul) return;
        history_ul.innerHTML = '';
        history_ul.classList.add('fn__none');
    }
    // 关闭搜索历史列表, 触发原生搜索事件
    search_history_dispatch_input() {
        // 隐藏历史列表, 打标记, 触发原生事件
        this.hidden_search_history_list();
        this.history_input_flag = true;
        this.dispatch_input();
        // this.get_search_input().focus();
    }
    // 插入搜索历史列表所在的元素
    insert_search_history_list() {
        const prev_ele = this.get_search_input()?.parentElement.parentElement;
        prev_ele.insertAdjacentHTML('afterend', `
            <ul id="simpleSearchHistoryList" class="HZ-search-history-list b3-menu b3-menu--list b3-list b3-list--background fn__none"></ul>
        `);
        this.get_search_history_ul().addEventListener('click', (event) => {
            const ele = event.target;
            const li = ele.closest('li.HZ-search-history-li');
            const input = this.get_search_input();
            if (ele.closest('svg.HZ-search-history-svg')) {
                // 从搜索历史记录里面删掉
                SYT.delete_search_history(li.getAttribute('title'));
                // 隐藏这个历史
                li.remove();
                // 光标聚焦到输入框, 方便点击了删除按钮之后, 继续通过上下键选择搜索历史
                input.focus();
            }
            else if (li) {
                input.value = li.getAttribute('title');
                this.search_history_dispatch_input();
            }
        });
    }

    // 选中某个历史记录, 将内容填充到input上
    select_search_history_item(item) {
        const history_ul = this.get_search_history_ul();
        if(!item || !history_ul || !history_ul.contains(item)) return;
        history_ul.querySelector('.b3-list-item--focus')?.classList.remove('b3-list-item--focus');
        item.classList.add('b3-list-item--focus');
        item.scrollIntoView({
            behavior: 'auto', // 不用平滑滚动, 如果快速切换的时候, 选中的会不在可见区域内
            block: 'center'   // 或 'start', 'center', 'end'
        })
        this.get_search_input().value = item.getAttribute('title');
    }
    // 更新搜索历史列表的显示
    update_search_history_list_html(history) {
        this.hidden_search_history_list();
        const history_ul = this.get_search_history_ul();
        if (!history_ul) return;
        const rect = this.get_search_input()?.getBoundingClientRect();
        for (let i = 0; i < history.length; i++) {
            let html_val = history[i];
            let real_val = html_val.replace(/<span class="HZ-search-history-highlight">/g, "").replace(/<\/span>/g, "");
            let close_html = `<svg class="HZ-search-history-svg b3-menu__action b3-menu__action--close"><use xlink:href="#iconCloseRound"></use></svg>`;
            history_ul.insertAdjacentHTML('beforeend', `<li class="HZ-search-history-li b3-list-item" style="width:${rect.width}px" title="${real_val}"><span class="b3-list-item__text">${html_val}</span>${close_html}</li>`);
            // tempMenu.addSeparator(1);
        }
        // 获取位置信息
        history_ul.style.left = `${rect.left+32}px`;
        history_ul.style.top  = `${rect.bottom}px`;
        // 显示
        history_ul.classList.remove('fn__none');
        this.select_search_history_item(history_ul.firstElementChild);
        const bottom = history_ul.getBoundingClientRect().bottom;
        if (bottom > window.innerHeight) {
            history_ul.style.maxHeight = `${648 - (bottom-window.innerHeight) - 30}px`;
        }
    }
    // 显示历史搜索记录
    show_search_history_list(history) {
        const input_val = this.get_search_input().value;
        const input_html = `<span class="HZ-search-history-highlight">${input_val}</span>`;
        // 完全没有匹配到历史记录 || 完全匹配到历史记录 的时候, 关掉历史记录, 触发原生搜索事件
        if (!history.length || history.includes(input_html)) {
            // console.log('完全匹配到/完全没匹配到, 触发原生搜索事件');
            this.search_history_dispatch_input();
            return;
        }
        // console.log('模糊匹配, 触发历史记录列表');
        // 在第一位加一个当前输入内容
        if (input_val) {
            history.unshift(input_html);
        }
        // 更新html
        this.update_search_history_list_html(history);
    }
    // 接管搜索历史
    handle_search_history() {
        //嵌入搜索历史列表
        this.insert_search_history_list();
        const inputElement = this.get_search_input();

        // input事件触发搜索历史列表
        // 中文触发顺序: start -> input -> input -> end
        // 英文触发顺序: input
        let timerId = 0;
        inputElement?.addEventListener('compositionend', (event) => {
            if (!this.g_setting.history_auto) return;
            // 因为思源原生也会监听compositionend事件, 然后触发与原生input一样的逻辑
            // 如果不阻止, 相当于还是触发了原生input事件, 这样的话, 下面的接管的逻辑就不管用了
            // 所以要阻止, 然后触发input, 由下面的逻辑判断是否触发原生input
            event.stopPropagation(); // 阻止传播
            this.dispatch_input()
        }, true);
        inputElement?.addEventListener('input', (event) => {
            // console.log('input事件触发', event.inputType, event.target.value, this.history_input_flag, event.isComposing, this.is_searching);
            if (!this.g_setting.history_auto) return;
            // 上次触发的搜索还没有结束, 不处理这次的input, 走思源原生input逻辑
            if (this.is_searching) return;
            if (event.isComposing) {
                event.stopPropagation(); // 阻止传播
                // console.log('任何地方都不处理这次的input');
                return;
            }
            clearTimeout(timerId);
            if (this.history_input_flag) {
                this.history_input_flag = false;
                this.is_searching = true;
                // console.log('由搜索历史触发 原生input事件');
                return;
            }
            // 阻止传播, 阻止原生搜索事件触发
            event.stopPropagation();
            // console.log('搜索历史处理input');
            // 根据输入的搜索内容, 过滤出符合条件的历史记录
            const input = event.target.value;
            const history = matchHistory(input, SYT.get_search_history());
            // 这里的定时器是为了防止短时间触发多次搜索事件
            timerId = setTimeout(() => this.show_search_history_list(history), 200);
        }, true);

        // 搜索历史列表相关事件监听
        inputElement?.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.shiftKey || event.metaKey) return;
            const type = event.key.toLowerCase();
            if (event.altKey) {
                // 处理接管历史记录
                if (!this.g_setting.replace_history) return;
                if (type == 'arrowup') {
                    event.stopPropagation();
                    if (this.g_setting.history_auto) {
                        this.g_setting.history_auto = false;
                        this.save_plugin_setting();
                        this.search_history_dispatch_input();
                        if (this.get_ele('#simpleSearchAssistSetting')) this.show_plugin_setting();
                    }
                }
                else if (type == 'arrowdown') {
                    event.stopPropagation();
                    if (!this.g_setting.history_auto) {
                        this.g_setting.history_auto = true;
                        this.save_plugin_setting();
                        if (this.get_ele('#simpleSearchAssistSetting')) this.show_plugin_setting();
                    }
                    if (this.is_show_history_list()) {
                        // 强制隐藏
                        this.search_history_dispatch_input();
                    }
                    else {
                        // 强制显示历史记录
                        const input = this.get_search_input().value;
                        let history = matchHistory(input, SYT.get_search_history(), true);
                        const input_html = `<span class="HZ-search-history-highlight">${input}</span>`;
                        history = history.filter(record => input_html != record);
                        this.show_search_history_list(history);
                    }
                }
                return;
            }
            else if(this.is_show_history_list()) {
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
                case 'escape':
                    event.stopPropagation(); // 阻止传播
                    this.search_history_dispatch_input();
                    break;
                }
            }
        });
        // 如果有搜索历史列表, 点击其他地方, 就退出
        if (!this.search_history_click_close_listener) {
            this.search_history_click_close_listener=true;
            document.addEventListener('click', (event) => {
                if (!this.is_show_history_list()) return;
                if (event.composedPath().includes(this.get_search_input())) return;
                if (event.composedPath().includes(this.get_search_history_ul())) return;
                this.search_history_dispatch_input();
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
            if (type != 'arrowup' && type != 'arrowdown') return;
            const new_tree = this.get_new_search_list();
            if (new_tree && !this.is_show_history_list()) {
                // 没有历史记录列表 && 存在新列表 就接管上下键
                // 原生搜索历史存在, 不处理
                if (document.querySelector('[data-name="search-history"]')) return;
                // 其他位置, 不处理
                const active_ele = document.activeElement;
                if (!(active_ele == document.body || 
                        active_ele == this.get_search_input() || 
                        active_ele == this.get_ele('#replaceInput'))) return

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
                        ele_list[idx].click();
                        break;
                    }
                }
            }
        });
    }
    // 对于当前这个搜索页面来说 第一次打开搜索页面
    handle_open_search_page(detail) {
        // 打上标记
        if (this.page.classList.contains('HZ-simple-search-page')) return;
        mylog('第一次打开搜索页面');
        this.page.classList.add('HZ-simple-search-page');

        // 在搜索页面嵌入: 快捷操作区域
        this.handle_assist_area();

        // 接管搜索历史
        this.handle_search_history();

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
        // 转换搜索内容
        this.query = search_translator(query_arg);
        const res = this.query;
        // 根据转换后的内容, 设置相应的变量
        if (method_map[res.type] == undefined) return;
        // 搜索类型
        query_arg.method = method_map[res.type].id;
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
        Object.entries(help.block_type).forEach(([key, val]) => block_type += `[${this.code('-'+key)}${val}],`);
        block_type = block_type ? block_type.slice(0, -1) : "未识别";
        return `
        <span style="font-size: 16px; font-weight:bold">简搜: 解析结果 </span><span> (温馨提示: 拖动方框右下角可以调整显示区域)</span>
        <table id="simpleSearchAnalysisResTable"><tbody>
        <tr><td>搜索方式:</td><td colspan="3">${type}${group_file}</td></tr>
        <tr><td>搜索内容:</td><td>${keywords}</td><td colspan="2">排除内容: ${excluded}</td></tr>
        <tr><td>类型过滤:</td><td colspan="3">${block_type}</td></tr>
        <tr><td>路径过滤:</td><td colspan="3">${custom_path}</td></tr>
        <tr><td>时间过滤:</td><td colspan="3">${custom_time}</td></tr>
        <tr><td>排序方式:</td><td colspan="3">${help.sort}</td></tr>
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
            body.insertAdjacentHTML('beforeend', `
                <div class="b3-list-item">
                <span class="b3-list-item__toggle b3-list-item__toggle--hl">
                    <svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
                </span>
                <span class="b3-list-item__graphic">📁</span>
                <span class="b3-list-item__text ariaLabel" style="color: var(--b3-theme-on-surface)" aria-label="${this_path}">${this_path}</span>
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
            new_ele.scrollIntoView({
                behavior: 'auto', // 不能用平滑滚动, 如果快速切换的时候, 会抖动
                block: 'center'   // 或 'start', 'center', 'end'
            })
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
        });
        // 2. 打开新文档树的第一个文档
        const first_file = new_tree.querySelector('[data-type="search-item"]')
        if (!this.is_show_history_list() && first_file && !first_file.classList.contains('b3-list-item--focus')) {
            // 没有历史记录列表 && 第一个文档没有被选中的时候, 打开新文档树的第一个文档
            first_file.click();
        }

        // 3.接管上下键选中节点的效果
        // 4.全部展开/全部折叠事件
        // 在刚打开时监听: handle_open_search_page
    }
    // 处理 结果文档树的显示
    show_search_res_tree() {
        this.get_new_search_list()?.remove();
        const src_tree_list = this.get_search_list();
        src_tree_list.classList.remove("fn__none");
        const g_setting = this.g_setting;
        // 开关是关的, 退出
        if (!g_setting.replace_search_res) return;
        // 搜索结果为空, 退出
        if (this.get_ele('[data-type="simple-search-new-disabled"]')) return;
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
            this.forbid_enter_create_file(ele);
            // 处理文档树显示
            this.show_search_res_tree();
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
    // 在界面加载完毕后高亮关键词
    loadedProtyleStaticEvent(data=null) {
        mylog('加载成功, 开始高亮', data);
        const query = this.query;
        if (!query) return;
        // 加载完毕的页面不在当前页面, 直接退出
        if (!this.page?.contains(data.detail.protyle.element)) return;
        // 暂时只处理sql语句的高亮
        if (query.type != '-s') return;

        CSS.highlights.clear();     // 清除上个高亮

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
        setTimeout(() => {
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

    sy_event_uninit() {
        this.eventBus.off("input-search", this.inputSearchEvent);
        this.eventBus.off("loaded-protyle-static", this.loadedProtyleStaticEvent);
    }
    sy_event_init() {
        // 搜索事件触发, 执行回调后, 才会发送req进行搜索
        this.eventBus.on("input-search", this.inputSearchEvent.bind(this));
        // ✅ 编辑器内容静态加载事件
        this.eventBus.on("loaded-protyle-static", this.loadedProtyleStaticEvent.bind(this));
    }

    load_plugin_setting(func) {
        this.loadData("settings.json").then((settingFile)=>{
            // 解析并载入配置
            try {
                mylog("载入配置: ", settingFile);
                Object.assign(this.g_setting, settingFile);
                ['restree_cfg'].forEach(key => {
                    if(this.g_setting[key]) delete this.g_setting[key];
                })
            }catch(e){
                mylog("og-fdb载入配置时发生错误, 使用默认配置", e);
            }
            func();
        }, (e)=> {
            mylog("配置文件读入失败", e);
        });
    }
    save_plugin_setting(){
        this.saveData("settings.json", JSON.stringify(this.g_setting));
        mylog("保存配置: ", this.g_setting);
    }
    // 布局初始化完成后, 触发
    onLayoutReady() {
        if (window.siyuan.isPublish) return;
        this.css          = null;
        this.page         = null;  // 搜索框所在的页面, 所有搜索都在此元素下搜索, 用于隔离 搜索页签和搜索弹窗
        this.is_searching = false; // 是否正在搜索
        this.last_sort    = -1;    // 页面原始的排序方式
        this.last_group   = -1;    // 页面原始的分组方式

        this.query        = {type:"", val:"", keywords:[], help:{}}; // 解析后的内容 {type: 搜索类型, val: 搜索内容, keywords: 关键词}
        this.g_setting    = {
            assist_sw         : true,      // 辅助信息显示框 是否显示
            history_auto      : true,      // 自动显示历史记录
            replace_history   : true,      // 取代历史记录
            replace_search_res: true,      // 是否接管搜索结果
            restree_style     : "native",  // 文档树样式: 原生:native, 多彩:colorful, ediary
            sync_file         : true,      // 搜索结果的样式是否同步到文档树那里
            search_res_top    : true,      // 文档下的结果是否置顶
            restree_all_path  : true,      // 显示全路径
        }
        this.load_plugin_setting(() => {
            this.save_plugin_setting();
            this.init_css_style();
            this.sy_event_init();
            // 重新加载后, 上次搜索历史会丢, 这里重新赋值一下
            // SYT.set_last_search_k();

            console.log("HZ simple search start...")
        });
    }

    onunload() {
        if (window.siyuan.isPublish) return;
        this.uninit_css_style();
        this.sy_event_uninit()
        console.log("HZ simple search stop...")
    }
};

module.exports = {
    default: SimpleSearchHZ,
};
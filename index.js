// siyuan-plugin-simple-search-plus v1.0.0
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
    get_search_k() {
        return window.siyuan.storage['local-searchdata'].k;
    },
    set_search_k(val) {
        window.siyuan.storage['local-searchdata'].k = val;
    },
    get_last_search_k() {
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
    const searchResSortSql = 'box ASC, hpath ASC, updated desc';
    // 块 默认排序方式
    const defaultOrderBy = `order by case type 
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
        end, ${searchResSortSql}
    `;
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
    const input = arg.query;
    const id_path = arg.idPath;
    const pageSearchTypes = arg.types;

    let options = "";
    let keywords = [];
    const excludedKeywords = [];
    let custom_path = [];
    const help = {
        ret_str    : "",
        type       : "",
        keywords   : [],
        excluded   : [],
        block_type : {},
        path       : arg.hPath,
        custom_path: [],
        sort       : "默认",
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
        return {type, val, keywords, help};
    }

    // 解析输入内容, 解析出 关键词, 排除的关键词, 搜索选项
    const _parseInput = function() {
        const inputItems = input.split(" ");
        for (let item of inputItems) {
            if (item === "" || item === "-") {
                continue;
            } else if (item.match(/^-([kKedlptbsicmoOL]|h[1-6]*|a[1-9]*)+$/)) {
                options += item.slice(1);
            } else if (item.match(/^-.+/)) {
                excludedKeywords.push(item.slice(1));
            } else if (item.match(/^\/.+/)) {
                custom_path.push(item);
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

    // [构造搜索语句] 扩展搜索
    const _buildExtendedSearchQuery = function() {
        let sqlExtendedSearch = "select path from blocks where type ='d' ";
        let sqlContentLike = "";
        for (let word of keywords) {
            sqlExtendedSearch += "and path in (select path from blocks where content like '%" + word + "%') ";
            sqlContentLike += "or content like '%" + word + "%' ";
        }
        for (let word of excludedKeywords) {
            sqlExtendedSearch += "and path not in (select path from blocks where content like '%" + word + "%') ";
        }
        help.type = '-e';
        return "-s" + 'select * from blocks where ' + SYT.SQL_FLAG + ' and path in (' +
            sqlExtendedSearch + ") and (" + sqlContentLike.slice(3) + ") and type not rlike '^[libs]$' " +
            defaultOrderBy;
    }

    // [拼接sql] 过滤关键词
    const _buildSqlKeyWords = function() {
        let sqlKeyWords = "";

        // 匹配关键词
        for (let word of keywords) {
            sqlKeyWords += "and content like '%" + word + "%' ";
        }

        // 排除关键词
        for (let word of excludedKeywords) {
            sqlKeyWords += "and content not like '%" + word + "%' ";
        }
        return sqlKeyWords ? `(${sqlKeyWords.slice(4)})` : "true";
    }

    // [拼接sql] 过滤块类型
    const _buildSqlTypeRlike = function() {
        // 去掉指定路径相关的选项
        let sqlTypes = options.replace(/[kKe]/g, "").replace(/a[1-9]*/g, "");
        let sqlTypeRlike = "";
        if (!sqlTypes && !keywords.length && !excludedKeywords.length && custom_path.length) {
            return "true";
        }

        const typeHandlers = {
            // 搜索标准块类型的sql语句
            "[dlptbsicm]": (types) => {
                const basic_type = types.replace(/[^dlptbsicm]/g, "");
                Array.from(basic_type).forEach((type_once) => help.block_type[type_once] = blockHelpMap[type_once]);
                return `type rlike '^[${basic_type}]$' `
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
                    return `(${headType} and subtype rlike '^h[${subType}]$') `;
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
                return `(subtype like 't' and type not like 'l' and (${todoCondition})) `;
            },
            // 搜索带链接的块的sql语句
            "[L]": () => {
                help.block_type['L'] = "表示带有链接的块";
                return `(type rlike '^[htp]$' and markdown like '%[%](%)%') `
            },
        };
        // 解析选项, 拼接sql语句
        for (let key in typeHandlers) {
            if (sqlTypes.match(key)) {
                if (sqlTypeRlike !== "") sqlTypeRlike += "or ";
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
            sqlTypeRlike = `type rlike '^[${types}]$' `;
        }
        return sqlTypeRlike ? `(${sqlTypeRlike})` : "true";
    }
    // [拼接sql] 自定义路径
    const _buildSqlCustomPath = function() {
        let sqlCustomPath = "";
        if (!custom_path.length) return "true";
        // 指定搜索路径名称
        // 1. 只有搜索路径 /笔记本1/文档1
        // 2. 指定搜索路径 加其他 /笔记本1 -h 序列号
        custom_path.forEach((path) => {
            const path_arr = path.split('/').filter(part => part !== '');
            if (path_arr.length == 0) return;

            let file_sql = ""
            if (keywords.length == 0) {
                // 没有关键词时, 转成搜索文档
                const file_name = path_arr.pop();
                file_sql = `type rlike '^[d]$' and content like '%${file_name}%' `
                help.block_type['d'] = blockHelpMap['d'];
                keywords.push(file_name);
                // 只有一个路径时, 直接返回
                if (path_arr.length == 0) {
                    sqlCustomPath += `or (${file_sql})`;
                    return;
                }
            }
            help.custom_path.push(path_arr.join(','));
            file_sql = file_sql ? `and (${file_sql})` : "";
            // 拼接剩余路径的sql语句
            // 1. 只搜索笔记本下面的路径
            sqlCustomPath += `or (hpath like '%${path_arr.join('%')}%' ${file_sql}) `;
            // 2. 将第一个路径当做笔记本, 剩余的当做笔记本下面的路径
            const book_arr = SYT.get_book_arr_from_name(path_arr[0]);
            path_arr.shift();
            // 有对应的笔记本id && 还有其他路径, 才搜笔记本
            // 而且笔记本可能是有多个, 都要搜出来
            if (book_arr.length) {
                const path_sql = path_arr.length ? `and hpath like '%${path_arr.join('%')}%'` : '';
                sqlCustomPath += `or (box in ("${book_arr.join('","')}") ${path_sql} ${file_sql}) `
            }
        });

        return sqlCustomPath ? `(${sqlCustomPath.slice(3)})` : "true";
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
        } else if (options.match(/a[1-9]*/)) {
            // 指定搜索路径为全部
            help.path = "全部";
            const books_idx = options.match(/a[1-9]*/g)[0].replace(/[^\d]/g, "");
            if (books_idx) {
                // help.path = `第${[...new Set(books_idx.split(''))].join(',')}个笔记本`;
                help.path = `笔记本: `;
                const books = SYT.get_book_arr();
                [...new Set(books_idx.split(''))].forEach(idx => {
                    if (idx >= books.length) return;
                    if(sqlCurrentDoc) sqlCurrentDoc += "or ";
                    sqlCurrentDoc += `box="${books[idx-1].id}" `;
                    help.path += `[${books[idx-1].name}],`
                });
                if (help.path == "笔记本: ") {
                    sqlCurrentDoc = 'box="no_exist_box"';
                }
                else {
                    help.path = help.path.slice(0, -1);
                }
            }
        } else if (id_path.length) {
            // 使用搜索页面上的搜索路径
            let filterPath = "";
            for (let path of id_path) {
                let boxPath = "";
                let filePath = "";
                const idx = path.indexOf('/');
                if (idx === -1) {
                    boxPath = path;
                    filterPath += `(box="${boxPath}")`;
                } else {
                    boxPath = path.slice(0, idx);
                    filePath = path.slice(idx);
                    filterPath += `(box="${boxPath}" and path like '${filePath}%')`;
                }
                filterPath += " or ";
            };
            if (filterPath.length) {
                sqlCurrentDoc = `${filterPath.slice(0, -3)}`;
            }
        }
        return sqlCurrentDoc ? `(${sqlCurrentDoc})` : "true";
    }

    // [拼接sql] 搜索结果排序方式
    const _buildOrderByQuery = function() {
        let sqlOrderBy = "order by case type";
        let sqlTypes = options.replace(/[oOL1-6]/g, "");

        if (sqlTypes !== "") {
            for (let i = 0; i < sqlTypes.length; i++) {
                if (typeOrderMapping[sqlTypes[i]]) {
                    sqlOrderBy += typeOrderMapping[sqlTypes[i]] + i.toString();
                }
            }
            if (sqlOrderBy == "order by case type") {
                sqlOrderBy = defaultOrderBy;
            }
            else {
                sqlOrderBy += ` end, ${searchResSortSql}`;
            }
        } else {
            sqlOrderBy = defaultOrderBy;
        }

        return sqlOrderBy;
    }
    
    // [构造搜索语句] sql搜索
    const _buildSqlSearchQuery = function() {
        let sqlPrefix = 'select * from blocks where ' + SYT.SQL_FLAG;
        // 过滤关键词
        let sqlKeyWords = _buildSqlKeyWords(keywords, excludedKeywords);
        // 过滤块类型
        let sqlTypeRlike = _buildSqlTypeRlike(options);
        // 自定义文档路径
        let sqlCustomPath = _buildSqlCustomPath();
        // 限制文档路径
        let sqlCurrentDoc = _buildSqlCurrentDoc(options, id_path);
        // 搜索结果排序方式
        let sqlOrderBy = _buildOrderByQuery(options);

        return `-s${sqlPrefix} and ${sqlKeyWords} and ${sqlTypeRlike} and ${sqlCustomPath} and ${sqlCurrentDoc} ${sqlOrderBy}`;
    }

    // 区分场景 构造搜索语句
    const _buildQuery = function() {
        if (!custom_path.length) {
            if (!options.length && !excludedKeywords.length) {
                // 没有选项, 排除词, 自定义路径, 就是用原样输入
                mylog('type: 关键词');
                return "-w" + input;
            } else if (!options.length && excludedKeywords.length) {
                // 只有排除词, 使用思源提供的查询语法
                mylog('type: 查询语法');
                return _buildExcludeQuery(keywords, excludedKeywords);
            }
            if (options.match(/e/) != null) {
                mylog('type: 扩展搜索');
                return _buildExtendedSearchQuery(keywords, excludedKeywords);
            }
        }
        mylog('type: sql语句');
        return _buildSqlSearchQuery(options, keywords, excludedKeywords, id_path);
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

class SimpleSearchHZ extends siyuan.Plugin {
    get_ele(selector) {
        if (!this.page) return null;
        return this.page.querySelector(selector);
    }
    get_search_list() {
        return this.get_ele('#searchList');
    }
    css_uninit() {
    }
    css_init() {
    }
    // 加粗: <span style="font-weight:bold"></span>
    // 代码: <span class="fn__code"></span>
    strong(str) {return `<span style="font-weight:bold">${str}</span>`};
    code(str) {return `<span class="fn__code">${str}</span>`};

    get_help_info_html() {
        return `<table id="simpleSearchHelpTable"><tbody>
        <tr><td colspan="4">${this.strong("搜索方式: ")}</td></tr>
            <tr>
                <td>${this.code("-w")}:关键字搜索</td>
                <td>${this.code("-q")}:查询语法</td>
                <td>${this.code("-s")}:SQL语句搜索</td>
                <td>${this.code("-r")}:正则表达式</td>
            </tr>
        <tr><td colspan="4">${this.strong("块类型过滤: ")}</td></tr>
            <tr>
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
        <tr><td colspan="4">${this.strong("路径过滤: ")}</td></tr>
            <tr>
                <td colspan="2">${this.code("-a")}:在所有文档里面搜索</td>
                <td colspan="2">${this.code("-a13")}:在第1和第3个笔记本里面搜索</td>
            </tr>
            <tr>
                <td colspan="2">${this.code("-k")}:小写k, 在当前文档搜索</td>
                <td colspan="2">${this.code("-K")}:大写k, 在当前文档及子文档搜索</td>
            </tr>
        <tr><td colspan="4">${this.strong("其他: ")}</td></tr>
            <tr><td colspan="4">* ${this.code("-")}"+要排除的关键词，排除指定关键词</td></tr>
            <tr><td colspan="4">* ${this.code("-e")}": 扩展搜索, 搜索出同时包含的文档</td></tr>
        </tbody></table>`
/*
<div style="display:flex;flex-direction: column;">
    <div>
        ${this.strong("搜索方式: ")}${this.code("-w")}":关键字搜索; ${this.code("-q")}":查询语法; ${this.code("-s")}":SQL语句搜索; ${this.code("-r")}":正则表达式
    </div>
    ${this.strong("块类型过滤: ")}
    <div>${this.code("-d")}":文档块; ${this.code("-h")}":标题块; ${this.code("-h13")}":1、3级标题; ${this.code("-p")}":段落块; </div>
    <div>${this.code("-c")}":代码块; ${this.code("-b")}":引述块; ${this.code("-L")}":表示带有链接的块(非思源标准的块类型); </div>
    <div>${this.code("-l")}":列表块(包含有序列表块、无序列表块和任务列表块); ${this.code("-i")}":列表项块; </div>
    <div>${this.code("-t")}":表格块; ${this.code("-o")}":未完成的待办项(todo), 小写o; ${this.code("-O")}":已完成的待办项, 大写o; 
    </div>
    ${this.strong("路径过滤")}
    <div>${this.code("-a")}":在所有文档里面搜索; ${this.code("-a13")}":在第1和第3个笔记本里面搜索; </div>
    <div>${this.code("-k")}":在当前文档搜索, 小写k; ${this.code("-K")}":在当前文档及子文档搜索, 大写k; </div>
    ${this.strong("其他")}
    <div>* ${this.code("-")}"+要排除的关键词，排除指定关键词</div>
    <div>* ${this.code("-e")}": 扩展搜索, 搜索出同时包含的文档</div>
</div>
*/
    }
    handle_assit_icon() {
        const icon_parent = this.get_ele('.search__header>.block__icons');

        // 1. 开关按钮
        const enable_sw = {
            icon: "#iconEye",
            label: "简搜: 点击显示辅助信息框",
            display: "none",
        }
        const disable_sw = {
            icon: "#iconEyeoff",
            label: "简搜: 点击隐藏辅助信息框",
            display: "block",
        }
        const sw = this.textarea_sw ? disable_sw : enable_sw;
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space"></span>
            <span id="simpleSearchShowSw" aria-label="${sw.label}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="${sw.icon}"></use></svg>
            </span>
        `);

        // 2. 信息显示框, 一定插入, 开关通过设置display控制是否显示
        const criteria = this.get_ele('#criteria');
        criteria.insertAdjacentHTML('afterend', `
            <div style="padding: 0 5px;">
                <div id="simpleSearchTextarea" class="fn__block b3-text-field" placeholder="简搜: 辅助信息" spellcheck="false"
                    style="display: ${sw.display}; resize: vertical; font-family: var(--b3-font-family-code); height: 200px; overflow-y: auto; "></div>
            </div>
        `);
        const sw_ele = icon_parent.querySelector('#simpleSearchShowSw');
        const use_ele = sw_ele.querySelector('svg>use')
        const textarea = this.get_ele('#simpleSearchTextarea')
        sw_ele.addEventListener('click', () => {
            // 根据图标更新当前状态
            this.textarea_sw = textarea.style.display != "none";
            // 点击说明要切换开关
            this.textarea_sw = !this.textarea_sw;
            // 按照新的开关, 重新设置样式
            const sw = this.textarea_sw ? disable_sw : enable_sw;
            sw_ele.setAttribute('aria-label', sw.label);
            use_ele.setAttribute('xlink:href', sw.icon);
            textarea.style.display = sw.display;
        });

        // 3. 帮助按钮
        icon_parent.insertAdjacentHTML('beforeend', `
            <span class="fn__space"></span>
            <span id="simpleSearchHelp" aria-label="简搜: 点击显示插件关键词" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconHelp"></use></svg>
            </span>
        `);
        const help_ele = this.get_ele('#simpleSearchHelp');
        help_ele.addEventListener('click', () => {
            const has_help = textarea.querySelector('#simpleSearchHelpTable');
            const is_show = textarea.style.display != 'none'
            textarea.innerHTML = this.get_help_info_html();
            if (!(is_show && !has_help)) {
                sw_ele.click();
            }
        });
    }
    // 对于当前这个搜索页面来说 第一次打开搜索页面
    handle_open_search_page(detail) {
        // 打上标记
        if (this.page.classList.contains('simple-search-page')) return;
        this.page.classList.add('simple-search-page');

        // 增加 新功能图标
        this.handle_assit_icon();

        // 监听搜索框的blur事件, 保存搜索框内容, 让下次搜索自动填充上次搜索内容, 思源会自动将k的内容填充到搜索框
        const input_ele = detail.searchElement;
        input_ele.addEventListener("blur", (event) => {
            if (input_ele.value == "") return;
            SYT.set_search_k(input_ele.value);
        });

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
        this.get_ele("#searchSyntaxCheck").setAttribute('aria-label', method_map[res.type].aria);
        this.get_ele("#searchSyntaxCheck>svg>use").setAttribute('xlink:href', method_map[res.type].icon);
        // 搜索内容
        query_arg.query = res.val;
        // 如果是 -e 扩展搜索, 就按照文档分组
        if (res.val.match(/'\^\[libs\]\$'/)) {
            query_arg.group = 1;
        }
    }

    get_analysis_result_html(help) {
        const handle_arr = function(arr, def) {
            if (!arr.length) return def;
            return `(${arr.join('),(')})`;
            // arr.forEach(key => res += `(${key}),`);
        }
        const typeMap = {
            "-w": "关键字搜索",
            "-q": "查询语法",
            "-s": "sql语句",
            "-r": "正则表达式",
            "-e": "扩展搜索",
        }
        const type = typeMap[help.type] ? `${this.code(help.type)}${typeMap[help.type]}` : "识别错误"
        let keywords = handle_arr(help.keywords, '未识别');
        let excluded = handle_arr(help.excluded, '空');
        let path = "全部";
        if (help.path && help.custom_path.length) {
            path = `[${help.path}] and [(${help.custom_path.join(')or(')})]`;
        }
        else if (help.path) {
            path = help.path;
        }
        else if (help.custom_path.length) {
            path = `(${help.custom_path.join(')or(')})`;
        }

        help.custom_path.length ? `[${help.path}] and [(${help.custom_path.join(')or(')})]` : help.path;
        let block_type = "";
        Object.entries(help.block_type).forEach(([key, val]) => block_type += `[${this.code('-'+key)}${val}],`);
        block_type = block_type ? block_type.slice(0, -1) : "未识别";
        return `<table id="simpleSearchAnalysisResTable"><tbody>
        <tr><td colspan="2">${this.strong("简搜: 解析结果")}</td></tr>
        <tr><td>搜索方式:</td><td>${type}</td></tr>
        <tr><td>搜索内容:</td><td>${keywords}</td></tr>
        <tr><td>排除内容:</td><td>${excluded}</td></tr>
        <tr><td>类型过滤:</td><td>${block_type}</td></tr>
        <tr><td>路径过滤:</td><td>${path}</td></tr>
        <tr><td>排序方式:</td><td>${help.sort}</td></tr>
        <tr><td style="min-width:70px;">转换结果:</td><td>${this.code(help.ret_str)}</td></tr>
        </tbody></table>`
    }
    // 显示解析结果
    set_analysis_result() {
        const textarea = this.get_ele('#simpleSearchTextarea')
        textarea.innerHTML = this.get_analysis_result_html(this.query.help);
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
        }.bind(this));
    }
    // 搜索事件触发
    inputSearchEvent(data) {
        console.log('搜索事件触发', data, data.detail.config);
        this.page = data.detail.searchElement.closest(".fn__flex-column");
        console.log('触发页面', this.page);

        // 1. 处理 第一次打开搜索页面, 打上标记, 而不是缓存
        this.handle_open_search_page(data.detail);
        // 2.1 替换原有搜索条件
        this.replace_src_search(data.detail.config);
        // 2.2 显示解析结果
        this.set_analysis_result();
        // 3. 搜索结束后触发
        this.search_completed_callback();
    }

    highlightKeywords(search_list_text_nodes, keyword, highlight_type) {
        const str = keyword.trim().toLowerCase();
        const ranges = search_list_text_nodes // 查找所有文本节点是否包含搜索词
            .map((el) => {
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
        const searchResultsHighlight = new Highlight(...ranges.flat()); // 创建高亮对象
        CSS.highlights.set(highlight_type, searchResultsHighlight);     // 注册高亮
    }
    // 在界面加载完毕后高亮关键词
    loadedProtyleStaticEvent(data= null) {
        console.log('加载成功触发', data);
        const query = this.query;
        if (!query) return;
        // 暂时只处理sql语句的高亮
        if (query.type != '-s') return;

        CSS.highlights.clear();     // 清除上个高亮

        // 判断是否存在搜索界面
        const search_list = this.get_search_list();
        if (search_list == null) return;

        // 获取所有具有 b3-list-item__text 类的节点的文本子节点
        const search_list_text_nodes = Array.from(search_list.querySelectorAll(".b3-list-item__text:not(.ariaLabel)"), el => el.firstChild);
        query.keywords.forEach((keyword) => {
            this.highlightKeywords(search_list_text_nodes, keyword, "highlight-keywords-search-list");
        });
        // 创建 createTreeWalker 迭代器，用于遍历文本节点，保存到一个数组
        const search_preview = this.get_ele('#searchPreview')
        const tree_walker = document.createTreeWalker(search_preview.children[1].children[0], NodeFilter.SHOW_TEXT);
        const search_preview_text_nodes = [];
        let current_node = tree_walker.nextNode();
        while (current_node) {
            if (current_node.textContent.trim().length > 1) {
                search_preview_text_nodes.push(current_node);
            }
            current_node = tree_walker.nextNode();
        }
        query.keywords.forEach((keyword) => {
            this.highlightKeywords(search_preview_text_nodes, keyword, "highlight-keywords-search-preview");
        });
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

    // 布局初始化完成后, 触发
    onLayoutReady() {
        this.page = null; // 搜索框所在的页面, 所有搜索都在此元素下搜索, 用于隔离 搜索页签和搜索弹窗
        this.query = {type:"", val:"", keywords:[], help:{}}; // 解析后的内容 {type: 搜索类型, val: 搜索内容, keywords: 关键词}
        this.textarea_sw = false;

        this.css_init();
        this.sy_event_init();
        // 重新加载后, 上次搜索历史会丢, 这里重新赋值一下
        SYT.set_last_search_k();

        console.log("HZ simple search start...")
    }

    onunload() {
        this.css_uninit();
        this.sy_event_uninit()
        console.log("HZ simple search stop...")
    }
};

module.exports = {
    default: SimpleSearchHZ,
};
# AI Coding 指南

> **重要**: 本指南是执行该项目所有开发任务的核心依据，具备强制约束力。

---

## 项目概览

- **项目名称**: HZ-syplugin-simple-search（思源笔记增强搜索插件）
- **开发语言**: JavaScript (ES6+)
- **模块系统**: CommonJS（`require("siyuan")`）
- **最低版本**: 思源笔记 v3.8.7+
- **依赖管理**: 无外部npm依赖，纯原生实现

### 技术栈
- 思源笔记插件API（`require("siyuan")`）
- CSS（思源原生CSS变量）
- 无构建工具，直接编写源码

### 项目结构
```
index.js        # 核心搜索逻辑：工具函数、搜索解析、插件主类、UI逻辑
index.css       # 搜索界面样式
plugin.json     # 插件配置
README.md       # 使用文档
AGENTS.md       # 本文件
img/            # 文档图片资源
test/           # 单元测试(node:test)
test-support/   # 测试辅助: 在 vm 中加载 index.js 并导出内部函数
```

---

## 常用命令

```bash
# 语法检查
node -c index.js

# 单元测试(输入解析)
node --test

# 格式化代码（如已安装prettier）
npx prettier --write index.js

# 开发测试：将插件目录放入思源笔记的 plugins 目录，重启即可
```

---

## 代码风格规范

### 文件组织
- 所有业务代码必须放在 `index.js`，禁止拆分其他文件
- CSS 样式放在 `index.css`，禁止写静态内联样式
- 由运行时数据计算出的动态样式（如坐标偏移、按数据算出的尺寸/颜色）允许通过 `element.style` 赋值
- 配置文件放在 `plugin.json`，版本号必须与代码同步

### 命名规范
| 类型 | 规范 | 示例 |
|------|------|------|
| 函数名 | 小驼峰，动词开头 | `mylog`、`whenExist`、`search_translator` |
| 变量名 | 小写下划线分隔 | `custom_path`、`search_method` |
| 常量名 | 全大写下划线分隔 | `SQL_FLAG`、`TYPE_SORT` |
| 类名 | 大驼峰 | `SimpleSearchHZ` |
| 内部函数 | 前缀下划线 | `_parseInput`、`_buildSqlKeyWords` |
| DOM元素ID | 小写下划线或驼峰 | `simpleSearchHistoryList` |

### 缩进与格式
- 使用 **4空格缩进**
- 行宽无强制限制，但单行代码不宜过长
- `if/else/for/while` 语句必须使用花括号，即使单行
- 函数定义前空一行，函数之间空两行

### 导入与依赖
- 使用 `const siyuan = require("siyuan")` 导入思源API
- 禁止使用 ES6 `import` 语法
- 禁止引入外部npm依赖

### 注释规范
- 除非必要，不添加注释
- 关键逻辑可添加简短注释说明，尤其是思源 API 的坑、时序依赖、绕过的限制等不易从代码本身看出的约束
- 禁止大量重复代码语义的注释，保持代码自解释

### HTML转义
- 用户输入或动态内容必须使用 `escapeHtml` 函数转义

---

## 日志规范

- **必须**使用 `mylog` 函数记录日志，禁止直接 `console.log`
- 日志格式: `[函数名 文件名:行号] 内容`
- 日志需包含操作对象，便于调试

```javascript
// 正确示例
mylog('搜索事件触发', data);

// 错误示例
console.log('search triggered');
```

---

## 异常/错误处理

- **异步操作**必须 `try-catch`，配置加载失败需降级默认值
- **DOM操作**前必须检查元素存在性
  - 元素可能尚未渲染时，使用 `whenExist` 轮询等待
- **事件处理**必须判断事件类型，阻止不必要传播
  - 使用 `event.stopPropagation()`
- **条件判断**优先使用严格相等 `===`
  - 例外: 同时判断 `null` 和 `undefined` 时使用 `== null` / `!= null`，这是有意为之，不要改成 `=== null`

---

## 思源插件API规范

- **必须**继承 `siyuan.Plugin`，实现 `onLayoutReady` 和 `onunload`
- **监听思源事件**（如 `input-search`、`loaded-protyle-static`）必须使用 `eventBus.on/off`，且 on/off 必须传入同一个函数引用，否则无法注销
- **监听 DOM 原生事件**（点击、键盘、滚动等）使用 `addEventListener`，`eventBus` 只承载思源自身事件，两者分工不同
- **配置读写**必须使用 `loadData/saveData`，禁止直接操作文件
- **插件初始化**必须检查 `window.siyuan.isPublish`，发布模式禁用

---

## 配置文件管理

- 用户配置保存在 `settings.json`，使用 `loadData/saveData` 读写
- 配置项必须定义在 `g_setting` 对象，提供默认值
- 配置修改后必须**立即保存**，禁止延迟保存

---

## CSS规范

- **必须**使用思源原生CSS变量表达主题相关的前景色、背景色、边框色，如 `var(--b3-theme-primary)`、`var(--b3-theme-on-error)`
- 禁止为主题相关颜色硬编码具体色值（如前景色写 `#fff`），否则深色主题下会失效
- 例外: 阴影类 `box-shadow` 使用黑色半透明 `rgba(0, 0, 0, ...)` 属于常规做法（思源自身也这样写），不受此限
- 样式选择器应简洁，避免过度嵌套

```css
/* 正确 */
background-color: var(--b3-protyle-inline-mark-background);

/* 错误 */
background-color: #ff0000;
```

---

## 测试规范

- 解析逻辑使用 `node --test` 做单元测试，测试文件放在 `test/`，辅助代码放在 `test-support/`
- 测试重点：不同输入经过 `search_translator` 后的 `type` / `val` / `help` 是否符合预期
- UI 相关逻辑仍需手动在思源笔记中验证
- 测试覆盖：搜索解析、历史匹配、结果展示、快捷键操作
- 修改代码后需验证：语法检查通过、单元测试通过、手动功能测试正常

---

## 通用最佳实践

- **KISS原则**: 代码逻辑简洁，无冗余实现
- **DRY原则**: 同类逻辑复用，不重复编写
- **单一职责**: 类/函数仅承担一项核心功能
- **最小改动**: 仅修改满足需求的必要代码，不做无关联重构
- 优先复用项目现有工具类和业务逻辑
- 禁止过度设计：仅实现需求明确的功能
- 代码交付前完成全量自检：确保无语法、路径、依赖错误
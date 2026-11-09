'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { load_plugin } = require('../test-support/load-plugin');
const manifest = require('../plugin.json');

const { api } = load_plugin();
const { get_default_command_config, migrate_command_config, compare_version } = api;

const plain = (value) => JSON.parse(JSON.stringify(value));
const clone_defaults = () => JSON.parse(JSON.stringify(get_default_command_config()));

test('指令配置版本与 plugin.json 一致', () => {
    assert.equal(get_default_command_config().version, manifest.version);
});

test('版本号比较', () => {
    assert.equal(compare_version('1.3.7', '1.3.7'), 0);
    assert.equal(compare_version('1.3.6', '1.3.7'), -1);
    assert.equal(compare_version('1.3.10', '1.3.7'), 1);
    assert.equal(compare_version(undefined, '1.3.7'), -1);
});

test('配置合并: 只补缺失项, 已有项保持不变', () => {
    const defaults = get_default_command_config();
    const stored = clone_defaults();
    stored.version = '1.3.6';

    const type_cat = stored.categories.find(c => c.id === 'type');
    type_cat.items = type_cat.items.filter(i => i.id !== 'tabs');
    const d_item = type_cat.items.find(i => i.id === 'd');
    d_item.enabled = false;
    d_item.comms = [{ form: 'single', content: 'D' }];

    const merged = migrate_command_config(stored);
    const merged_type = merged.categories.find(c => c.id === 'type');
    // 缺失项补回
    assert.ok(merged_type.items.some(i => i.id === 'tabs'));
    // 已有项完全保留
    const merged_d = merged_type.items.find(i => i.id === 'd');
    assert.equal(merged_d.enabled, false);
    assert.deepEqual(plain(merged_d.comms), [{ form: 'single', content: 'D' }]);
    // 版本更新为当前插件版本
    assert.equal(merged.version, defaults.version);
});

test('配置合并: 缺失的分类会补回', () => {
    const stored = clone_defaults();
    stored.version = '1.3.6';
    stored.categories = stored.categories.filter(c => c.id !== 'ext');

    const merged = migrate_command_config(stored);
    const ext = merged.categories.find(c => c.id === 'ext');
    assert.ok(ext);
    assert.ok(ext.items.some(i => i.id === 'not'));
});

test('配置合并: 新项命令与现有启用项冲突时跳过', () => {
    const stored = clone_defaults();
    stored.version = '1.3.6';
    // 删掉 ext 分类里的“排除关键词”(命令 !), 再把 ! 加到已有排序项上
    const ext = stored.categories.find(c => c.id === 'ext');
    ext.items = ext.items.filter(i => i.id !== 'not');
    const sort = stored.categories.find(c => c.id === 'sort');
    sort.items[0].comms.push({ form: 'multi', content: '!' });

    const merged = migrate_command_config(stored);
    const merged_ext = merged.categories.find(c => c.id === 'ext');
    assert.equal(merged_ext.items.some(i => i.id === 'not'), false);
});

test('配置合并: 同版本/更高版本不处理, 重复合并幂等', () => {
    const defaults = get_default_command_config();
    assert.equal(migrate_command_config(defaults), defaults);

    const newer = clone_defaults();
    newer.version = '9.9.9';
    assert.equal(migrate_command_config(newer), newer);

    const stored = clone_defaults();
    stored.version = '1.3.6';
    stored.categories.find(c => c.id === 'type').items =
        stored.categories.find(c => c.id === 'type').items.filter(i => i.id !== 'tabs');
    const first = migrate_command_config(stored);
    const second = migrate_command_config(first);
    assert.equal(second, first);
    const count = first.categories.find(c => c.id === 'type').items.filter(i => i.id === 'tabs').length;
    assert.equal(count, 1);
});

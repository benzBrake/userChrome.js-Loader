import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createOptionsStore, localize, parseInput, parseOptions } from '../src/profile/chrome/utils/UcScriptOptions.sys.mjs';
import { pickOptionFile } from '../src/profile/chrome/utils/UcScriptOptionsUI.sys.mjs';

const parse = (...items) => parseOptions(items.map(item => `// @pref ${JSON.stringify(item)}`).join('\n'));
const option = raw => {
    const result = parse(raw);
    assert.deepEqual(result.optionErrors, []);
    return result.options[0];
};
const basic = (type, extra = {}) => option({ key: 'test.value', type, ...extra });
const throws = (callback, code) => assert.throws(callback, error => error.code === code);

class File {
    constructor(value) { if (value) this.initWithPath(value); }
    initWithPath(value) {
        if (!path.win32.isAbsolute(value) || !/^(?:[a-z]:[\\/]|\\\\)/iu.test(value)) throw new Error('Not absolute');
        this.path = path.win32.normalize(value);
    }
    clone() { return new File(this.path); }
    append(part) { this.path = path.win32.join(this.path, part); }
    equals(other) { return this.path.toLowerCase() === other.path.toLowerCase(); }
    get leafName() { return path.win32.basename(this.path); }
    get parent() {
        const parent = path.win32.dirname(this.path);
        return parent === this.path ? null : new File(parent);
    }
}

function fixture() {
    const user = new Map(), defaults = new Map(), locked = new Set(), observers = new Map(), complexWrites = [];
    const types = { string: 32, number: 64, boolean: 128 };
    const branch = values => ({
        getPrefType: key => types[typeof values.get(key)] || 0,
        getStringPref: key => values.get(key), getIntPref: key => values.get(key), getBoolPref: key => values.get(key),
        getComplexValue(key, iid) {
            return iid === 'file' ? new File(values.get(key)) : { data: values.get(key) };
        },
    });
    const effective = () => new Map([...defaults, ...user]);
    const notify = key => {
        for (const [prefix, listeners] of observers) {
            if (key.startsWith(prefix)) for (const observer of listeners) observer.observe(null, 'nsPref:changed', key);
        }
    };
    const prefs = {
        getPrefType: key => branch(effective()).getPrefType(key),
        getStringPref: key => effective().get(key), getIntPref: key => effective().get(key), getBoolPref: key => effective().get(key),
        getComplexValue: (key, iid) => branch(effective()).getComplexValue(key, iid),
        getDefaultBranch: () => branch(defaults),
        prefHasUserValue: key => user.has(key), prefIsLocked: key => locked.has(key),
        clearUserPref(key) { user.delete(key); notify(key); },
        addObserver(key, observer) {
            if (!observers.has(key)) observers.set(key, new Set());
            observers.get(key).add(observer);
        },
        removeObserver(key, observer) { observers.get(key).delete(observer); },
    };
    for (const method of ['setStringPref', 'setIntPref', 'setBoolPref']) {
        prefs[method] = (key, value) => { user.set(key, value); notify(key); };
    }
    prefs.setComplexValue = (key, iid, value) => {
        complexWrites.push({ key, iid, value });
        prefs.setStringPref(key, iid === 'file' ? value.path : value.data);
    };
    const interfaces = { nsIFile: 'file', nsIPrefLocalizedString: 'localized' };
    const store = createOptionsStore({
        prefs, interfaces,
        directories: { get: key => new File(key === 'UChrm' ? 'C:\\profile\\chrome' : 'C:\\profile') },
        classes: {
            '@mozilla.org/file/local;1': { createInstance: () => new File() },
            '@mozilla.org/pref-localizedstring;1': { createInstance: () => ({ data: '' }) },
        },
    });
    return { store, prefs, user, defaults, locked, observers, complexWrites };
}

test('collects strict JSON declarations in order without aborting after invalid entries', () => {
    const header = '// @pref {broken}\r\n// @pref\r\n// @pref {"key":"a","type":"bool"}\r\n' +
        '// @pref {"key":"a","type":"string"}\r\n// @pref {"key":"b","type":"string"}\r\n// @preferences ignored';
    const result = parseOptions(header);
    assert.deepEqual(result.options.map(item => item.key), ['a', 'b']);
    assert.deepEqual(result.optionErrors, [
        { line: 1, code: 'invalid-json' }, { line: 2, code: 'invalid-json' }, { line: 4, code: 'duplicate-key' },
    ]);
    assert.ok(Object.isFrozen(result.options[0]));
});

test('validates enum types, bounds, complex interfaces, and path schema', () => {
    const invalid = [
        { type: 'enum', valueType: 'number', choices: [{ value: '1' }] },
        { type: 'enum', valueType: 'string', choices: [{ value: 'x' }, { value: 'x' }] },
        { type: 'number', min: 1.5 }, { type: 'number', min: 10, max: 5 },
        { type: 'complex', interface: 'nsISupportsString' },
        { type: 'complex', interface: 'nsIFile', path: { base: 'ProfD', format: 'relative' } },
        { type: 'bool', control: 'filepicker' }, { type: 'string', label: { 'zh-CN': '名称' } },
        { type: 'string', path: { base: 'arbitrary', format: 'relative' } },
        { type: 'string', fallback: 0 }, { type: 'bool', picker: {} },
    ];
    assert.equal(parse(...invalid.map(item => ({ key: 'test', ...item }))).options.length, 0);
    assert.deepEqual(basic('enum', { valueType: 'bool', choices: [{ value: false }, { value: true }] }).choices.map(c => c.value), [false, true]);
});

test('translations fall back independently and preserve empty translations', () => {
    assert.equal(localize({ default: 'Name', zh: '名称', 'en-US': 'US' }, ['zh-TW']), '名称');
    assert.equal(localize({ default: 'Name', ja: '' }, ['ja-JP']), '');
    assert.equal(localize({ default: 'Name', 'zh-CN': '名称' }, ['fr']), 'Name');
});

test('number inputs reject empty, fractional, non-decimal and overflowing values', () => {
    for (const input of ['', ' ', '1.5', '1e3', '0x10', '2147483648', '-2147483649']) {
        throws(() => parseInput(basic('number'), input), 'invalid-number');
    }
    assert.equal(parseInput(basic('number'), '-2147483648'), -2147483648);
    throws(() => parseInput(basic('number', { min: 2 }), '1'), 'invalid-number');
});

test('keeps unset and script fallback distinct from the default and user branches', () => {
    const { store, user, defaults } = fixture();
    const o = basic('bool', { fallback: true });
    assert.equal(store.read(o).value, undefined);
    assert.equal(user.size + defaults.size, 0);
    defaults.set(o.key, false);
    assert.equal(store.read(o).defaultValue, false);
    store.write(o, true);
    assert.equal(store.read(o).value, true);
    assert.equal(store.read(o).hasUserValue, true);
    store.reset(o);
    assert.equal(store.read(o).value, false);
    defaults.clear();
    store.write(o, false);
    store.reset(o);
    assert.equal(store.read(o).value, undefined);
});

test('locks and type conflicts prevent writes but conflicts can be reset', () => {
    const { store, user, locked } = fixture();
    const o = basic('string');
    user.set(o.key, 1);
    assert.equal(store.read(o).error, 'type-conflict');
    throws(() => store.write(o, 'new'), 'type-conflict');
    store.reset(o);
    locked.add(o.key);
    throws(() => store.write(o, 'new'), 'locked');
    throws(() => store.reset(o), 'locked');
    assert.equal(user.size, 0);
});

test('preserves unknown enum values until explicitly replaced', () => {
    const { store, user } = fixture();
    const o = basic('enum', { valueType: 'number', choices: [{ value: 0 }, { value: 1 }] });
    user.set(o.key, 8);
    assert.equal(store.read(o).value, 8);
    assert.equal(store.read(o).error, 'unknown-choice');
    throws(() => store.write(o, 8), 'unknown-choice');
    store.write(o, 0);
    assert.equal(user.get(o.key), 0);
});

test('resolves and round-trips relative paths without accepting parent traversal or sibling prefix matches', () => {
    const { store, user } = fixture();
    const o = basic('string', { control: 'filepicker', path: { base: 'UChrm', format: 'relative' } });
    store.write(o, 'configs/menu.js');
    assert.equal(user.get(o.key), 'configs\\menu.js');
    assert.equal(store.resolvePath(o, user.get(o.key)).path, 'C:\\profile\\chrome\\configs\\menu.js');
    for (const input of ['..\\escape.js', 'a/../escape.js', 'C:\\outside.js', 'C:\\profile\\chrome-other\\x.js']) {
        assert.throws(() => store.write(o, input));
    }
    assert.equal(user.get(o.key), 'configs\\menu.js');
    assert.equal(store.serializePath(o, new File('C:\\profile\\chrome')), '.');
    const script = { file: new File('C:\\profile\\chrome\\scripts\\script.uc.mjs') };
    const byScript = basic('string', { path: { base: 'script', format: 'relative' } });
    assert.equal(store.resolvePath(byScript, 'data.js', script).path, 'C:\\profile\\chrome\\scripts\\data.js');
    const preferred = basic('string', { path: { base: 'UChrm', format: 'prefer-relative' } });
    assert.equal(store.serializePath(preferred, new File('D:\\menu.js')), 'D:\\menu.js');
});

test('complex values use the declared XPCOM interface and return path or data explicitly', () => {
    const { store, complexWrites } = fixture();
    const file = basic('complex', { interface: 'nsIFile' });
    store.write(file, 'C:\\editor.exe');
    assert.equal(complexWrites[0].iid, 'file');
    assert.equal(store.read(file).value, 'C:\\editor.exe');
    const localized = option({ key: 'test.localized', type: 'complex', interface: 'nsIPrefLocalizedString' });
    store.write(localized, '中文');
    assert.equal(complexWrites[1].iid, 'localized');
    assert.equal(store.read(localized).value, '中文');
});

test('preference observers filter prefix notifications and detach without leaking listeners', () => {
    const { store, prefs, observers } = fixture();
    const o = basic('string');
    const updates = [];
    const dispose = store.observe([o], key => updates.push(key));
    prefs.setStringPref('test.value.child', 'ignored');
    store.write(o, 'one');
    assert.deepEqual(updates, [o.key]);
    dispose();
    dispose();
    store.write(o, 'two');
    assert.equal(updates.length, 1);
    assert.equal([...observers.values()].every(listeners => listeners.size === 0), true);
});

test('file picker uses BrowsingContext, localized filters and asynchronous cancellation', async () => {
    const previousClasses = globalThis.Cc, previousInterfaces = globalThis.Ci;
    const context = {}, calls = [];
    const selected = new File('C:\\profile\\chrome\\menu.js');
    const picker = {
        modeOpen: 0, modeGetFolder: 2, file: selected,
        init(...args) { calls.push(['init', ...args]); },
        appendFilter(...args) { calls.push(['filter', ...args]); },
        appendFilters(value) { calls.push(['all', value]); },
        open(callback) { queueMicrotask(() => callback(this.result)); },
        result: 1,
    };
    globalThis.Cc = { '@mozilla.org/filepicker;1': { createInstance: () => picker } };
    globalThis.Ci = { nsIFilePicker: { returnOK: 0, filterAll: 1 } };
    try {
        const o = basic('string', { label: { default: 'File', 'zh-CN': '文件' }, control: 'filepicker',
            path: { base: 'UChrm', format: 'relative' }, picker: {
                mode: 'open', filters: [{ label: { default: 'Scripts', 'zh-CN': '脚本' }, pattern: '*.js' }],
            } });
        const args = { option: o, value: '', script: {}, browserWindow: { browsingContext: context }, locales: ['zh-CN'],
            store: { resolvePath() { throw new Error('unset'); }, baseDirectory: () => new File('C:\\profile\\chrome') } };
        assert.equal(await pickOptionFile(args), null);
        assert.deepEqual(calls.slice(0, 3), [['init', context, '文件', 0], ['filter', '脚本', '*.js'], ['all', 1]]);
        assert.equal(picker.displayDirectory.path, 'C:\\profile\\chrome');
        picker.result = 0;
        assert.equal(await pickOptionFile(args), selected);
    } finally {
        if (previousClasses === undefined) delete globalThis.Cc; else globalThis.Cc = previousClasses;
        if (previousInterfaces === undefined) delete globalThis.Ci; else globalThis.Ci = previousInterfaces;
    }
});

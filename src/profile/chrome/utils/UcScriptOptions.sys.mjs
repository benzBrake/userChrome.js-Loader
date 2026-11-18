/* Declarative userChrome script preferences. Importing this module has no side effects. */

export class OptionError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
    }
}

const fail = code => { throw new OptionError(code); };
const own = (object, key) => Object.hasOwn(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const storageType = option => option.type === 'enum' ? option.valueType :
    option.type === 'complex' ? 'string' : option.type;
const validNumber = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;

function text(value) {
    if (typeof value === 'string') return value;
    if (!record(value) || typeof value.default !== 'string' ||
        Object.values(value).some(item => typeof item !== 'string')) fail('invalid-text');
    return Object.freeze({ ...value });
}

export function localize(value, locales = globalThis.Services?.locale.appLocalesAsBCP47 || []) {
    if (typeof value === 'string') return value;
    if (!value) return '';
    const entries = new Map(Object.entries(value).map(([key, item]) => [key.toLowerCase(), item]));
    for (const locale of locales) {
        const tag = locale.toLowerCase();
        if (entries.has(tag)) return entries.get(tag);
        if (entries.has(tag.split('-')[0])) return entries.get(tag.split('-')[0]);
    }
    return value.default || '';
}

function normalize(raw) {
    if (!record(raw) || typeof raw.key !== 'string' || !raw.key.trim() || /[\s\0]/u.test(raw.key)) fail('invalid-key');
    if (!['bool', 'string', 'number', 'enum', 'complex'].includes(raw.type)) fail('invalid-type');
    const option = { key: raw.key, type: raw.type, label: text(raw.label ?? raw.key) };
    for (const name of ['description', 'group']) {
        if (own(raw, name)) option[name] = text(raw[name]);
    }
    if (raw.type === 'enum') {
        if (!['bool', 'string', 'number'].includes(raw.valueType) ||
            !Array.isArray(raw.choices) || !raw.choices.length) fail('invalid-choices');
        option.valueType = raw.valueType;
        const seen = new Set();
        option.choices = Object.freeze(raw.choices.map(choice => {
            if (!record(choice) || typeof choice.value !== (raw.valueType === 'bool' ? 'boolean' : raw.valueType) ||
                (raw.valueType === 'number' && !validNumber(choice.value)) || seen.has(choice.value)) fail('invalid-choices');
            seen.add(choice.value);
            return Object.freeze({ value: choice.value, label: text(choice.label ?? String(choice.value)) });
        }));
    }
    if (raw.type === 'number') {
        for (const name of ['min', 'max']) {
            if (own(raw, name)) {
                if (!validNumber(raw[name])) fail('invalid-range');
                option[name] = raw[name];
            }
        }
        if ((option.min ?? -2147483648) > (option.max ?? 2147483647)) fail('invalid-range');
    }
    if (raw.type === 'complex') {
        if (!['nsIFile', 'nsIPrefLocalizedString'].includes(raw.interface)) fail('invalid-interface');
        option.interface = raw.interface;
    }
    const isFile = option.interface === 'nsIFile';
    if (own(raw, 'path')) {
        if ((!isFile && raw.type !== 'string') || !record(raw.path) ||
            !['UChrm', 'ProfD', 'script'].includes(raw.path.base) ||
            !['relative', 'absolute', 'prefer-relative'].includes(raw.path.format) ||
            (isFile && raw.path.format !== 'absolute')) fail('invalid-path-schema');
        option.path = Object.freeze({ base: raw.path.base, format: raw.path.format });
    }
    if (own(raw, 'control') && raw.control !== 'filepicker') fail('invalid-control');
    if (raw.control === 'filepicker' || isFile) {
        if (!isFile && !option.path) fail('invalid-path-schema');
        option.control = 'filepicker';
        const picker = raw.picker ?? {};
        if (!record(picker) || !['open', 'folder'].includes(picker.mode ?? 'open')) fail('invalid-picker');
        const filters = picker.filters ?? [];
        if (!Array.isArray(filters)) fail('invalid-picker');
        option.picker = Object.freeze({
            mode: picker.mode ?? 'open',
            filters: Object.freeze(filters.map(filter => {
                if (!record(filter) || typeof filter.pattern !== 'string' || !filter.pattern || /[\0\r\n]/u.test(filter.pattern)) fail('invalid-picker');
                return Object.freeze({ label: text(filter.label ?? filter.pattern), pattern: filter.pattern });
            })),
        });
    } else if (own(raw, 'picker')) fail('invalid-control');
    if (own(raw, 'fallback')) {
        validateValue(option, raw.fallback);
        option.fallback = raw.fallback;
    }
    return Object.freeze(option);
}

export function parseOptions(header) {
    const options = [], errors = [], keys = new Set();
    header.split(/\r?\n/u).forEach((line, index) => {
        const match = line.match(/^\/\/[ \t]+@pref(?:[ \t]+(.*))?$/u);
        if (!match) return;
        try {
            const option = normalize(JSON.parse(match[1] || ''));
            if (keys.has(option.key)) fail('duplicate-key');
            keys.add(option.key);
            options.push(option);
        } catch (error) {
            errors.push(Object.freeze({ line: index + 1, code: error.code || 'invalid-json' }));
        }
    });
    return { options: Object.freeze(options), optionErrors: Object.freeze(errors) };
}

export function validateValue(option, value) {
    const type = storageType(option);
    if (typeof value !== (type === 'bool' ? 'boolean' : type)) fail('type-conflict');
    if (type === 'number' && (!validNumber(value) || value < (option.min ?? -2147483648) ||
        value > (option.max ?? 2147483647))) fail('invalid-number');
    if (option.type === 'enum' && !option.choices.some(choice => choice.value === value)) fail('unknown-choice');
    return value;
}

export function parseInput(option, value) {
    if (storageType(option) === 'number') {
        if (typeof value === 'string' && !/^[+-]?\d+$/u.test(value.trim())) fail('invalid-number');
        value = Number(value);
    }
    return validateValue(option, value);
}

export function createOptionsStore({ prefs = Services.prefs, directories = Services.dirsvc,
    interfaces = Ci, classes = Cc } = {}) {
    const expectedType = option => ({ string: 32, number: 64, bool: 128 })[storageType(option)];
    function assertWritable(option) {
        if (prefs.prefIsLocked(option.key)) fail('locked');
        const type = prefs.getPrefType(option.key);
        if (type && type !== expectedType(option)) fail('type-conflict');
    }
    function baseDirectory(option, script) {
        if (option.path?.base === 'script') {
            if (!script?.file?.parent) fail('missing-base');
            return script.file.parent.clone();
        }
        return directories.get(option.path?.base || 'UChrm', interfaces.nsIFile).clone();
    }
    function absoluteFile(value) {
        const file = classes['@mozilla.org/file/local;1'].createInstance(interfaces.nsIFile);
        file.initWithPath(value);
        return file;
    }
    function resolvePath(option, value, script) {
        if (!value || /[\0\r\n]/u.test(value)) fail('invalid-path');
        try { return absoluteFile(value); } catch { /* Try a declared relative path. */ }
        if (!option.path || option.path.format === 'absolute') fail('invalid-path');
        const parts = value.split(/[\\/]/u);
        if (parts.some(part => !part || part === '..' || /[:]/u.test(part))) fail('invalid-path');
        const file = baseDirectory(option, script);
        for (const part of parts) {
            if (part !== '.') file.append(part);
        }
        return file;
    }
    function serializePath(option, file, script) {
        if (!option.path || option.path.format === 'absolute') return file.path;
        const base = baseDirectory(option, script);
        // Walk native nsIFile parents rather than comparing platform-dependent path prefixes.
        const parts = [];
        let current = file;
        while (current && !current.equals(base)) {
            parts.unshift(current.leafName);
            current = current.parent;
        }
        if (current) return parts.join(base.path.includes('\\') ? '\\' : '/') || '.';
        if (option.path.format === 'prefer-relative') return file.path;
        fail('outside-base');
    }
    function read(option) {
        const state = { value: undefined, hasUserValue: prefs.prefHasUserValue(option.key),
            defaultValue: undefined, locked: prefs.prefIsLocked(option.key), error: '' };
        const getValue = branch => {
            if (option.type === 'complex') {
                const object = branch.getComplexValue(option.key, interfaces[option.interface]);
                return option.interface === 'nsIFile' ? object.path : object.data;
            }
            const method = { string: 'getStringPref', number: 'getIntPref', bool: 'getBoolPref' }[storageType(option)];
            return branch[method](option.key);
        };
        try {
            const defaults = prefs.getDefaultBranch('');
            if (defaults.getPrefType(option.key) === expectedType(option)) state.defaultValue = getValue(defaults);
        } catch { /* A script may implement its fallback without a Firefox default branch. */ }
        try {
            const type = prefs.getPrefType(option.key);
            if (!type) return state;
            if (type !== expectedType(option)) fail('type-conflict');
            state.value = getValue(prefs);
            validateValue(option, state.value);
        } catch (error) {
            state.error = error.code || 'read-failed';
        }
        return state;
    }
    function write(option, value, script) {
        assertWritable(option);
        validateValue(option, value);
        if (option.path || option.interface === 'nsIFile') {
            const file = resolvePath(option, value, script);
            value = serializePath(option, file, script);
            if (option.interface === 'nsIFile') {
                prefs.setComplexValue(option.key, interfaces.nsIFile, file);
                return;
            }
        }
        if (option.type === 'complex') {
            const object = classes['@mozilla.org/pref-localizedstring;1'].createInstance(interfaces.nsIPrefLocalizedString);
            object.data = value;
            prefs.setComplexValue(option.key, interfaces.nsIPrefLocalizedString, object);
        } else {
            const method = { string: 'setStringPref', number: 'setIntPref', bool: 'setBoolPref' }[storageType(option)];
            prefs[method](option.key, value);
        }
    }
    function reset(option) {
        if (prefs.prefIsLocked(option.key)) fail('locked');
        if (prefs.prefHasUserValue(option.key)) prefs.clearUserPref(option.key);
    }
    function observe(options, callback) {
        const keys = new Set(options.map(option => option.key));
        const observer = { observe(subject, topic, key) { if (keys.has(key)) callback(key); } };
        const attached = [];
        const dispose = () => {
            for (const key of attached.splice(0)) prefs.removeObserver(key, observer);
        };
        try {
            for (const key of keys) {
                prefs.addObserver(key, observer);
                attached.push(key);
            }
        } catch (error) { dispose(); throw error; }
        return dispose;
    }
    return { read, write, reset, observe, baseDirectory, resolvePath, serializePath };
}

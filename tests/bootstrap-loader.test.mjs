import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = fs.readFileSync(
    path.join(REPO_ROOT, 'src/profile/chrome/utils/BootstrapLoader.js'),
    'utf8',
);

function makeShared() {
    const registry = new Map();
    const addonManager = {
        isReady: false,
        addExternalExtensionLoader(loader) {
            registry.set(loader.name, loader);
        },
    };
    const xpidb = {};
    const originalVerify = async () => 'original';
    const xpiExports = {verifyBundleSignedState: originalVerify};
    return {registry, addonManager, xpidb, originalVerify, xpiExports};
}

function evaluate(browserName, shared = makeShared()) {
    const observers = [];
    const sandbox = {
        Services: {
            appinfo: {name: browserName},
            obs: {
                addObserver(observer, topic) {
                    observers.push({observer, topic});
                },
            },
            wm: {},
        },
        ChromeUtils: {
            defineESModuleGetters(target, getters) {
                for (const name of Object.keys(getters)) {
                    Object.defineProperty(target, name, {
                        configurable: true,
                        value: {},
                    });
                }
            },
            defineLazyGetter(target, name, getter) {
                Object.defineProperty(target, name, {
                    configurable: true,
                    get: getter,
                });
            },
            importESModule(specifier) {
                if (specifier.endsWith('AddonManager.sys.mjs')) {
                    return {
                        AddonManager: shared.addonManager,
                        AddonManagerPrivate: {externalExtensionLoaders: shared.registry},
                    };
                }
                if (specifier.endsWith('XPIDatabase.sys.mjs')) {
                    return {AddonInternal: function AddonInternal() {}, XPIDatabase: shared.xpidb};
                }
                if (specifier.endsWith('XPIExports.sys.mjs')) {
                    return {XPIExports: shared.xpiExports};
                }
                if (specifier.endsWith('Console.sys.mjs')) {
                    return {ConsoleAPI: function ConsoleAPI() {}};
                }
                return {};
            },
        },
        Cc: {},
        Ci: {},
        Components: {},
        Cu: {},
    };
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, {filename: 'BootstrapLoader.js'});
    return {observers, sandbox, shared};
}

test('Waterfox keeps the loader fully inert', () => {
    const {observers, shared} = evaluate('Waterfox');

    assert.deepEqual(observers, []);
    assert.equal(shared.registry.size, 0);
    assert.equal('isDisabledLegacy' in shared.xpidb, false);
    assert.equal(shared.xpiExports.verifyBundleSignedState, shared.originalVerify);
});

test('Firefox initializes the loader exactly once', () => {
    const first = evaluate('Firefox');
    const wrappedVerify = first.shared.xpiExports.verifyBundleSignedState;

    assert.equal(first.observers.length, 1);
    assert.equal(first.shared.registry.size, 1);
    assert.equal(typeof first.shared.xpidb.isDisabledLegacy, 'function');
    assert.notEqual(wrappedVerify, first.shared.originalVerify);

    const second = evaluate('Firefox', first.shared);
    assert.deepEqual(second.observers, []);
    assert.equal(second.shared.registry.size, 1);
    assert.equal(second.shared.xpiExports.verifyBundleSignedState, wrappedVerify);
});

test('a registered legacy loader also blocks reinitialization on rebranded forks', () => {
    const shared = makeShared();
    shared.registry.set('other-loader', {manifestFile: 'install.rdf'});

    const result = evaluate('MyBrowser', shared);

    assert.deepEqual(result.observers, []);
    assert.equal(shared.registry.size, 1);
    assert.equal('isDisabledLegacy' in shared.xpidb, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    clearScriptRunning,
    everLoaded,
    forgetWindow,
    getRunningWindows,
    getWindowSandbox,
    hasEverLoaded,
    isScriptRunning,
    markEverLoaded,
    markScriptRunning,
    registerScript,
    setWindowSandbox,
} from '../profile/chrome/utils/UcScriptRuntime.sys.mjs';
import {
    getUnloadMaps,
    initUloadMap,
    setUnloadMap,
} from '../profile/chrome/utils/ucf.sys.mjs';

class FixtureWindow {
    constructor(name) {
        this.name = name;
        this.closed = false;
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    close() {
        this.closed = true;
        this.listeners.get('unload')?.();
    }
}

globalThis.Cu = {
    reportError(error) {
        throw error;
    },
};

test('tracks @onlyonce body state and startup windows separately', () => {
    const script = {
        filename: 'onlyonce.uc.js',
        scriptId: 'fixtures/onlyonce.uc.js',
        id: 'onlyonce@fixture',
        onlyonce: true,
    };
    const winA = new FixtureWindow('A');
    const winB = new FixtureWindow('B');

    registerScript(script);
    markScriptRunning(script, winA);
    assert.equal(isScriptRunning(script), true);
    assert.deepEqual(getRunningWindows(script), [winA]);

    markScriptRunning(script, winB);
    assert.deepEqual(getRunningWindows(script), [winA, winB]);

    forgetWindow(winA);
    assert.equal(isScriptRunning(script), true);
    assert.deepEqual(getRunningWindows(script), [winB]);

    clearScriptRunning(script);
    assert.equal(isScriptRunning(script), false);
});

test('tracks ordinary scripts per window and preserves everLoaded for the session', () => {
    const script = {
        filename: 'ordinary.uc.js',
        scriptId: 'fixtures/ordinary.uc.js',
        id: 'ordinary@fixture',
        onlyonce: false,
    };
    const winA = new FixtureWindow('A');
    const winB = new FixtureWindow('B');

    registerScript(script);
    markScriptRunning(script, winA);
    markScriptRunning(script, winB);
    markEverLoaded(script);
    assert.deepEqual(getRunningWindows(script), [winA, winB]);
    assert.equal(hasEverLoaded(script), true);
    assert.equal(everLoaded.includes(script.id), true);

    forgetWindow(winA);
    assert.equal(isScriptRunning(script), true);
    assert.deepEqual(getRunningWindows(script), [winB]);

    forgetWindow(winB);
    assert.equal(isScriptRunning(script), false);
    assert.equal(hasEverLoaded(script), true);
});

test('shares one sandbox per window across loader instances', () => {
    const win = new FixtureWindow('shared');
    const sandbox = {};

    setWindowSandbox(win, sandbox);
    assert.equal(getWindowSandbox(win), sandbox);

    forgetWindow(win);
    assert.equal(getWindowSandbox(win), undefined);
});

test('isolates setUnloadMap callbacks by window', () => {
    const winA = new FixtureWindow('A');
    const winB = new FixtureWindow('B');
    const calls = [];

    assert.equal(initUloadMap(winA), initUloadMap(winA));
    setUnloadMap(winA, 'shared-key', () => calls.push('A-old'));
    setUnloadMap(winA, 'shared-key', () => calls.push('A-new'));
    setUnloadMap(winB, 'shared-key', () => calls.push('B'));
    assert.notEqual(getUnloadMaps(winA), getUnloadMaps(winB));

    winA.close();
    assert.deepEqual(calls, ['A-new']);
    assert.equal(getUnloadMaps(winB).size, 1);

    winB.close();
    assert.deepEqual(calls, ['A-new', 'B']);
});

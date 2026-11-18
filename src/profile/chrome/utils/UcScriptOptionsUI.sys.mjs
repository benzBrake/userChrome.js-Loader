import { createOptionsStore, localize, parseInput } from './UcScriptOptions.sys.mjs';

const MESSAGES = {
    options: { default: 'Options', zh: '选项', ja: '設定' },
    empty: { default: 'This script provides no options.', zh: '此脚本未提供选项。', ja: 'このスクリプトには設定項目がありません。' },
    browse: { default: 'Browse…', zh: '浏览…', ja: '参照…' },
    reset: { default: 'Remove the custom value and restore the default or script preset', zh: '移除自定义配置，恢复 Firefox 默认或脚本预设', ja: 'カスタム値を削除し、Firefoxの既定値またはスクリプトの初期値に戻す' },
    unset: { default: 'Not configured', zh: '尚未配置', ja: '未設定' },
    modified: { default: 'Customized', zh: '已自定义', ja: '変更済み' },
    default: { default: 'Using Firefox default', zh: '使用 Firefox 默认', ja: 'Firefoxの既定値を使用' },
    saved: { default: 'Saved', zh: '已保存', ja: '保存しました' },
    fallback: { default: 'Using script preset', zh: '使用脚本预设', ja: 'スクリプトの初期値を使用' },
    resetDefault: { default: 'Firefox default', zh: 'Firefox 默认', ja: 'Firefoxの既定値' },
    resetFallback: { default: 'Script preset', zh: '脚本预设', ja: 'スクリプトの初期値' },
    on: { default: 'On', zh: '开启', ja: 'オン' },
    off: { default: 'Off', zh: '关闭', ja: 'オフ' },
    emptyString: { default: 'Empty text', zh: '空文本', ja: '空のテキスト' },
    separator: { default: ': ', zh: '：', ja: '：' },
    external: { default: 'Changed elsewhere; save your input or press Esc to reload.', zh: '配置已在其他位置修改；保存当前输入或按 Esc 重新读取。', ja: '別の場所で設定が変更されました。入力を保存するか、Escキーで再読み込みしてください。' },
    independent: { default: 'Open separate settings page', zh: '打开独立设置页', ja: '専用の設定ページを開く' },
    hint: { default: 'Changes are saved automatically. When they take effect depends on the script.', zh: '修改后自动保存，生效时间取决于脚本的实现。', ja: '変更は自動的に保存されます。反映されるタイミングはスクリプトによって異なります。' },
    'invalid-json': { default: 'Invalid JSON declaration', zh: 'JSON 声明无效', ja: 'JSON宣言が無効です' },
    'invalid-key': { default: 'Invalid preference key', zh: 'pref key 无效', ja: '設定キーが無効です' },
    'invalid-type': { default: 'Unsupported option type', zh: '选项类型不受支持', ja: '未対応の設定型です' },
    'invalid-text': { default: 'Invalid label or translation', zh: '文案或翻译格式无效', ja: 'ラベルまたは翻訳が無効です' },
    'invalid-choices': { default: 'Invalid enum choices', zh: '枚举候选值无效', ja: '列挙型の選択肢が無効です' },
    'duplicate-key': { default: 'Duplicate preference key', zh: '重复的 pref key', ja: '設定キーが重複しています' },
    'invalid-range': { default: 'Invalid number range', zh: '数字范围无效', ja: '数値の範囲が無効です' },
    'invalid-interface': { default: 'Unsupported complex interface', zh: 'complex 接口不受支持', ja: '未対応の複合型インターフェースです' },
    'invalid-path-schema': { default: 'Invalid path declaration', zh: '路径声明无效', ja: 'パス宣言が無効です' },
    'invalid-control': { default: 'Invalid control declaration', zh: '控件声明无效', ja: 'コントロール宣言が無効です' },
    'invalid-picker': { default: 'Invalid file picker declaration', zh: '文件选择器声明无效', ja: 'ファイル選択ダイアログの宣言が無効です' },
    'type-conflict': { default: 'The stored preference type does not match the declaration. Reset it before editing.', zh: '现有 pref 类型与声明不符，请重置后编辑。', ja: '保存された設定の型が宣言と一致しません。リセットしてから編集してください。' },
    'invalid-number': { default: 'Enter a 32-bit integer within the declared range.', zh: '请输入声明范围内的 32 位整数。', ja: '宣言された範囲内の32ビット整数を入力してください。' },
    'unknown-choice': { default: 'The current value is not in the choices. Select a new value to change it.', zh: '当前值不在候选列表中，可选择新值进行修改。', ja: '現在の値は選択肢にありません。変更するには新しい値を選択してください。' },
    locked: { default: 'Locked by Firefox or policy', zh: '已被 Firefox 或策略锁定', ja: 'Firefoxまたはポリシーによってロックされています' },
    'missing-base': { default: 'The path base directory is unavailable.', zh: '路径基准目录不可用。', ja: 'パスの基準ディレクトリを利用できません。' },
    'invalid-path': { default: 'Enter a valid path. Relative paths cannot contain parent traversal.', zh: '请输入有效路径，相对路径不能包含上级目录跳转。', ja: '有効なパスを入力してください。相対パスに上位ディレクトリへの移動は含められません。' },
    'outside-base': { default: 'Choose a file inside the declared base directory.', zh: '请选择声明的基准目录内的文件。', ja: '宣言された基準ディレクトリ内のファイルを選択してください。' },
    'read-failed': { default: 'Unable to read this preference. You can reset or replace it.', zh: '无法读取此项配置，可以重置或填写新值。', ja: 'この設定を読み取れません。リセットするか、新しい値を入力してください。' },
    'write-failed': { default: 'Unable to save this preference.', zh: '无法保存此项配置。', ja: 'この設定を保存できません。' },
    'picker-failed': { default: 'Unable to open the file picker.', zh: '无法打开文件选择器。', ja: 'ファイル選択ダイアログを開けません。' },
};

// Keep these HTML styles with the component: the legacy AddonsPage sheet defaults to XUL.
const OPTIONS_CSS = `
    [data-ucjs-options] .tab-group { display: flex !important; }
    [data-ucjs-options] .tab-group .tab-button:not([name="details"]):not([name="ucjs-options"]) {
        display: none !important;
    }
    .ucjs-options-panel {
        --ucjs-muted: var(--text-color-deemphasized, var(--in-content-deemphasized-text, GrayText));
        --ucjs-border: var(--border-color-deemphasized, var(--in-content-border-color, color-mix(in srgb, currentColor 18%, transparent)));
        --ucjs-accent: var(--color-accent-primary, var(--in-content-primary-button-background, AccentColor));
        padding: 20px 24px 24px;
        font: 14px/1.5 system-ui, sans-serif;
        color: var(--text-color, var(--in-content-page-color, CanvasText));
        container-type: inline-size;
    }
    .ucjs-options-panel *, .ucjs-options-panel *::before { box-sizing: border-box; }
    .ucjs-options-hint {
        margin: 0 0 24px;
        color: var(--ucjs-muted);
        font-size: 12px;
    }
    .ucjs-options-group { margin-block: 24px 0; }
    .ucjs-options-group-title { margin: 0; padding-block-end: 8px; font-size: 14px; font-weight: 650; }
    .ucjs-option-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px 24px;
        padding-block: 16px;
        border-block-start: 1px solid var(--ucjs-border);
    }
    .ucjs-option-info { min-width: 0; }
    .ucjs-option-label { display: block; margin: 0; font-size: 14px; font-weight: 500; cursor: pointer; }
    .ucjs-option-key {
        display: block;
        margin-block-start: 3px;
        font: 11px/1.5 ui-monospace, monospace;
        color: var(--ucjs-muted);
        overflow-wrap: anywhere;
        user-select: text;
    }
    .ucjs-option-description { margin-block-start: 6px; font-size: 12px; color: var(--ucjs-muted); }
    .ucjs-option-status { margin-block-start: 5px; font-size: 11px; color: var(--ucjs-muted); overflow-wrap: anywhere; }
    .ucjs-option-row[data-customized] .ucjs-option-status:not(.ucjs-option-error) { color: var(--ucjs-accent); }
    .ucjs-option-controls { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ucjs-option-controls > input:not([type="checkbox"]), .ucjs-option-controls > select {
        margin: 0;
        min-width: 0;
        width: 160px;
        max-width: 100%;
        padding: 7px 10px;
        font: inherit;
        color: inherit;
        background: var(--background-color-box, var(--in-content-box-background, Field));
        border: 1px solid var(--ucjs-border);
        border-radius: 6px;
    }
    .ucjs-option-row[data-option-type="string"] > .ucjs-option-controls,
    .ucjs-option-row[data-option-type="complex"] > .ucjs-option-controls { grid-column: 1 / -1; }
    .ucjs-option-row[data-option-type="string"] input,
    .ucjs-option-row[data-option-type="complex"] input { flex: 1; width: 0; }
    .ucjs-option-controls > button { margin: 0; font: inherit; }
    .ucjs-option-controls > .ucjs-option-reset {
        display: inline-grid;
        place-items: center;
        min-width: 28px;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--ucjs-muted);
        font-size: 20px;
        line-height: 1;
    }
    .ucjs-option-reset:enabled:hover { background: var(--button-background-color-hover, var(--in-content-button-background-hover)); color: inherit; }
    .ucjs-option-reset:disabled { opacity: .25; }
    .ucjs-option-controls > input[type="checkbox"] {
        appearance: none;
        width: 34px;
        height: 20px;
        margin: 0;
        padding: 2px;
        border: 1px solid var(--ucjs-border);
        border-radius: 12px;
        background: var(--button-background-color, var(--in-content-button-background, ButtonFace));
        cursor: pointer;
        flex: none;
    }
    .ucjs-option-controls > input[type="checkbox"]::before {
        content: "";
        display: block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--ucjs-muted);
        transition: transform 120ms ease;
    }
    .ucjs-option-controls > input[type="checkbox"]:checked { background: var(--ucjs-accent); border-color: transparent; }
    .ucjs-option-controls > input[type="checkbox"]:checked::before { transform: translateX(14px); background: var(--color-accent-primary-contrast, var(--in-content-primary-button-text-color, white)); }
    .ucjs-option-controls > input[type="checkbox"]:checked:dir(rtl)::before { transform: translateX(-14px); }
    .ucjs-option-controls > input[type="checkbox"]:indeterminate::before { border-radius: 2px; height: 3px; margin-block: 5.5px; }
    .ucjs-option-controls > input[type="checkbox"]:disabled { opacity: .5; cursor: default; }
    .ucjs-option-controls > :focus-visible { outline: 2px solid var(--ucjs-accent); outline-offset: 3px; }
    .ucjs-options-panel .ucjs-option-error { color: var(--text-color-error, var(--in-content-error-text-color, #c50042)); overflow-wrap: anywhere; }
    @container (max-width: 520px) {
        .ucjs-option-row { column-gap: 12px; }
        .ucjs-option-row[data-option-type="number"] > .ucjs-option-controls,
        .ucjs-option-row[data-option-type="enum"] > .ucjs-option-controls { grid-column: 1 / -1; }
        .ucjs-option-controls > input:not([type="checkbox"]), .ucjs-option-controls > select { flex: 1; }
    }
    @media (prefers-reduced-motion: reduce) { .ucjs-option-controls > input[type="checkbox"]::before { transition: none; } }
    @media (forced-colors: active) {
        .ucjs-option-controls > input[type="checkbox"] { appearance: auto; }
        .ucjs-option-controls > input[type="checkbox"]::before { display: none; }
    }
`;

function translator(locales) {
    // Use the same ordered locale matching as script-provided labels and descriptions.
    return key => {
        const message = MESSAGES[key];
        return message ? localize({ en: message.default, ...message }, locales) : key;
    };
}

function element(doc, tag, attributes = {}, parent) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (name === 'text') node.textContent = value;
        else node.setAttribute(name, value);
    }
    parent?.appendChild(node);
    return node;
}

// The returned nsIFile is converted to the declared storage format only at commit time.
export async function pickOptionFile({ option, value, script, store, browserWindow, locales }) {
    const picker = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
    const mode = option.picker.mode === 'folder' ? picker.modeGetFolder : picker.modeOpen;
    picker.init(browserWindow.browsingContext, localize(option.label, locales), mode);
    try {
        const file = store.resolvePath(option, value, script);
        let directory = file.exists() && file.isDirectory() ? file : file.parent;
        while (directory && !directory.exists()) directory = directory.parent;
        if (directory) picker.displayDirectory = directory;
        if (option.picker.mode !== 'folder') picker.defaultString = file.leafName;
    } catch {
        try { picker.displayDirectory = store.baseDirectory(option, script); } catch { /* Use native default. */ }
    }
    for (const filter of option.picker.filters) picker.appendFilter(localize(filter.label, locales), filter.pattern);
    picker.appendFilters(Ci.nsIFilePicker.filterAll);
    return new Promise(resolve => {
        picker.open(result => resolve(result === Ci.nsIFilePicker.returnOK ? picker.file : null));
    });
}

/** Mount once per script/declaration. Preference notifications update rows without replacing inputs. */
export function mountScriptOptions({ doc, detail, section, addon, browserWindow,
    store = createOptionsStore(), pickFile = pickOptionFile,
    locales = Services.locale.appLocalesAsBCP47 }) {
    const script = addon._script;
    const options = addon.scriptOptions || script?.options || [];
    const errors = addon.scriptOptionErrors || script?.optionErrors || [];
    const t = translator(locales);
    const deck = section.closest('named-deck');
    const tabGroup = detail.querySelector('.tab-group');
    if (!deck || !tabGroup) return null;
    const host = detail.querySelector('addon-details') || detail;
    const style = element(doc, 'style', { text: OPTIONS_CSS, 'data-ucjs-options-style': '' }, doc.head);
    host.setAttribute('data-ucjs-options', '');
    const originalHidden = tabGroup.hidden;
    tabGroup.hidden = false;
    // Native update() knows about preferences but not this name, so it never creates an options browser.
    const tab = doc.createElement('button', { is: 'named-deck-button' });
    for (const [name, value] of Object.entries({ is: 'named-deck-button', deck: deck.id,
        name: 'ucjs-options', class: 'tab-button ghost-button', 'data-ucjs-options-tab': '' })) {
        tab.setAttribute(name, value);
    }
    tab.textContent = t('options');
    const detailsButton = tabGroup.querySelector('[name="details"]');
    tabGroup.insertBefore(tab, detailsButton?.nextSibling || null);
    const panel = element(doc, 'section', { name: 'ucjs-options', class: 'ucjs-options-panel' }, deck);
    // Activate the first tab even when returning from a native extension's preference view.
    deck.selectedViewName = 'details';
    element(doc, 'p', { text: t('hint'), class: 'ucjs-options-hint' }, panel);
    const optionsURL = script?.optionsURL;
    if (optionsURL && /^(?:https?|about|chrome|resource|file|moz-extension):/iu.test(optionsURL)) {
        const link = element(doc, 'a', { href: optionsURL, text: t('independent') }, panel);
        link.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            browserWindow.openTrustedLinkIn(optionsURL, 'tab');
        });
    }
    if (!options.length) element(doc, 'p', { text: t('empty') }, panel);
    for (const error of errors) {
        element(doc, 'p', { class: 'ucjs-option-error', text: `@pref · ${error.line}: ${t(error.code)}` }, panel);
    }
    const groups = new Map(), rows = new Map(), cleanups = [];
    let disposed = false;
    const isCurrent = () => !disposed && panel.isConnected &&
        (!detail.querySelector('addon-card') || detail.querySelector('addon-card').addon === addon);
    for (const [index, option] of options.entries()) {
        const groupName = localize(option.group, locales);
        let container = panel;
        if (groupName) {
            if (!groups.has(groupName)) {
                const headingId = `ucjs-options-group-${groups.size}`;
                const group = element(doc, 'section', { class: 'ucjs-options-group', 'aria-labelledby': headingId }, panel);
                element(doc, 'h2', { id: headingId, class: 'ucjs-options-group-title', text: groupName }, group);
                groups.set(groupName, group);
            }
            container = groups.get(groupName);
        }
        const row = element(doc, 'div', { class: 'ucjs-option-row', 'data-pref-key': option.key, 'data-option-type': option.type }, container);
        const info = element(doc, 'div', { class: 'ucjs-option-info' }, row);
        const id = `ucjs-option-${index}`;
        element(doc, 'label', { for: id, class: 'ucjs-option-label', text: localize(option.label, locales) }, info);
        element(doc, 'code', { class: 'ucjs-option-key', text: option.key }, info);
        const description = localize(option.description, locales);
        const help = element(doc, 'div', { id: `${id}-help`, class: 'ucjs-option-description', text: description }, info);
        help.hidden = !description;
        const controls = element(doc, 'div', { class: 'ucjs-option-controls' }, row);
        const input = element(doc, option.type === 'enum' ? 'select' : 'input', {
            id, 'aria-describedby': `${id}-help ${id}-status`,
        }, controls);
        if (option.type !== 'enum') {
            input.type = option.type === 'bool' ? 'checkbox' : option.type === 'number' ? 'number' : 'text';
            if (option.type === 'number') {
                input.min = option.min ?? -2147483648;
                input.max = option.max ?? 2147483647;
                input.step = 1;
            }
        }
        const browse = option.control === 'filepicker' ?
            element(doc, 'button', { type: 'button', text: t('browse') }, controls) : null;
        const reset = element(doc, 'button', { type: 'button', text: '↶', class: 'ucjs-option-reset',
            title: t('reset'), 'aria-label': `${t('reset')} · ${localize(option.label, locales)}` }, controls);
        const status = element(doc, 'div', { id: `${id}-status`, class: 'ucjs-option-status', 'aria-live': 'polite' }, info);
        const displayValue = value => option.type === 'enum' ?
            localize(option.choices.find(choice => choice.value === value)?.label, locales) || String(value) :
            typeof value === 'boolean' ? t(value ? 'on' : 'off') : value === '' ? t('emptyString') : String(value);
        let dirty = false, picking = false;
        const showError = error => {
            input.setAttribute('aria-invalid', 'true');
            status.textContent = t(error.code || 'write-failed');
            status.classList.add('ucjs-option-error');
        };
        const refresh = (force = false, message = '') => {
            if (!isCurrent()) return;
            const state = store.read(option);
            row.toggleAttribute('data-customized', state.hasUserValue);
            input.disabled = state.locked || state.error === 'type-conflict';
            if (browse) browse.disabled = input.disabled || picking;
            reset.disabled = state.locked || !state.hasUserValue;
            if (dirty && !force) {
                status.textContent = state.locked ? t('locked') : t('external');
                return;
            }
            dirty = false;
            const value = state.value ?? option.fallback;
            if (option.type === 'enum') {
                input.replaceChildren();
                const matched = option.choices.findIndex(choice => choice.value === value);
                if (matched < 0) {
                    const unknown = element(doc, 'option', { value: '', text: value === undefined ? t('unset') : String(value) }, input);
                    unknown.disabled = true;
                    unknown.selected = true;
                }
                option.choices.forEach((choice, choiceIndex) => {
                    const item = element(doc, 'option', { value: String(choiceIndex), text: localize(choice.label, locales) }, input);
                    item.selected = choiceIndex === matched;
                });
            } else if (option.type === 'bool') {
                input.checked = value === true;
                input.indeterminate = value === undefined;
            } else {
                input.value = value === undefined ? '' : String(value);
                input.placeholder = t('unset');
            }
            input.removeAttribute('aria-invalid');
            status.classList.remove('ucjs-option-error');
            const defaultValue = state.defaultValue ?? option.fallback;
            const defaultLabel = state.defaultValue !== undefined ? t('resetDefault') : t('resetFallback');
            const stateText = state.hasUserValue ? t('modified') : state.value !== undefined ?
                `${t('default')}${t('separator')}${displayValue(state.value)}` : option.fallback !== undefined ?
                    `${t('fallback')}${t('separator')}${displayValue(option.fallback)}` : t('unset');
            status.textContent = state.locked ? t('locked') : state.error ? t(state.error) :
                message ? `${message} · ${stateText}` : stateText;
            if (state.error) status.classList.add('ucjs-option-error');
            if (state.hasUserValue && defaultValue !== undefined && !state.error) {
                status.textContent += ` · ${defaultLabel}${t('separator')}${displayValue(defaultValue)}`;
            }
        };
        rows.set(option.key, refresh);
        const commit = value => {
            if (!isCurrent()) return;
            try {
                store.write(option, value, script);
                refresh(true, t('saved'));
            } catch (error) { dirty = true; showError(error); }
        };
        const commitInput = () => {
            if (!dirty) return;
            try {
                const value = option.type === 'enum' ? option.choices[Number(input.value)]?.value :
                    option.type === 'bool' ? input.checked : parseInput(option, input.value);
                commit(value);
            } catch (error) { showError(error); }
        };
        input.addEventListener('input', () => { dirty = true; });
        input.addEventListener('change', () => { dirty = true; commitInput(); });
        input.addEventListener('blur', commitInput);
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); refresh(true); }
            else if (event.key === 'Enter') { event.preventDefault(); commitInput(); }
        });
        reset.addEventListener('click', () => {
            if (!isCurrent()) return;
            try { store.reset(option); refresh(true); } catch (error) { showError(error); }
        });
        browse?.addEventListener('click', async () => {
            picking = true;
            browse.disabled = true;
            try {
                const file = await pickFile({ option, value: input.value || option.fallback,
                    script, store, browserWindow, locales });
                if (file && isCurrent() && deck.selectedViewName === 'ucjs-options') {
                    commit(store.serializePath(option, file, script));
                }
            } catch (error) {
                if (isCurrent()) showError({ code: error.code || 'picker-failed' });
            } finally {
                picking = false;
                if (isCurrent()) browse.disabled = input.disabled;
            }
        });
        refresh(true);
    }
    // Addon-card treats change events as enable/disable operations; keep form events local.
    for (const type of ['click', 'change', 'input', 'keydown']) {
        panel.addEventListener(type, event => event.stopPropagation());
    }
    cleanups.push(store.observe(options, key => rows.get(key)?.()));
    return {
        panel,
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const cleanup of cleanups) cleanup();
            if (deck.selectedViewName === 'ucjs-options') deck.selectedViewName = 'details';
            panel.remove();
            style.remove();
            tab.remove();
            host.removeAttribute('data-ucjs-options');
            tabGroup.hidden = originalHidden;
        },
    };
}

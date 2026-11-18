// ==UserScript==
// @name            CompatCanary
// @description     CI 兼容性测试金丝雀：加载成功后向 profile/chrome/ 写入标记文件
// @author          userChrome.js-Loader
// @include         main
// @charset         utf-8
// @compatibility   Firefox 136+
// @version         1.0
// @onlyonce
// @pref {"key":"userChrome.compatCanary.enabled","type":"bool","label":{"default":"Enabled","zh-CN":"启用"}}
// ==/UserScript==
(function () {
    "use strict";

    // 仅用于 scripts/compat-test.mjs 端到端验证；标记文件内容即测试断言依据。
    const loader = window.userChrome_js;
    const script = loader?.scripts.find(item => item.filename === "CompatCanary.uc.js");
    const marker = {
        marker: "userchromejs-compat-test",
        appName: Services.appinfo.name,
        version: Services.appinfo.version,
        platformVersion: Services.appinfo.platformVersion,
        hasLoaderGlobal: "userChrome_js" in window,
        scriptCount: Array.isArray(loader?.scripts) ? loader.scripts.length : null,
        hasPreferenceMetadata: script?.options?.[0]?.key === "userChrome.compatCanary.enabled" &&
            script.options[0].type === "bool" && script.optionErrors.length === 0,
        loadedAt: new Date().toISOString(),
    };

    IOUtils.writeUTF8(
        PathUtils.join(PathUtils.profileDir, "chrome", "compat-test-marker.json"),
        JSON.stringify(marker, null, 2) + "\n",
    );
    console.log("compat-canary:", JSON.stringify(marker));
})();

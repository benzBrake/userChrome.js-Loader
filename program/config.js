// skip 1st line
/*
 2023/07/11 Removed Services.jsm, per Bug 1780695
 2022/06/07 remove osfile.jsm
 2021/08/05 fix for 92+ port Bug 1723723 - Switch JS consumers from getURLSpecFromFile to either getURLSpecFromActualFile or getURLSpecFromDir
 2019/12/11 01:30 fix 72 use "load" in config.js, working with Sub-Script/Overlay Loader v3.0.60mod
 2019-10-22 23:00
*/
lockPref("toolkit.telemetry.enabled", false);

let {
  classes: Cc,
  interfaces: Ci,
  manager: Cm,
  utils: Cu
} = Components;

try {
  let cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
  cmanifest.append('utils');
  cmanifest.append('chrome.manifest');

  if (cmanifest.exists()) {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);
    Services.scriptloader.loadSubScript('chrome://userchromejs/content/utils/RemoveSignatureCheck.js');
    ChromeUtils.importESModule("chrome://userchromejs/content/utils/BootstrapLoader.sys.mjs");
  }

  ChromeUtils.importESModule("chrome://userchromejs/content/utils/boot.sys.mjs")
} catch (ex) { Cu.reportError(ex); }
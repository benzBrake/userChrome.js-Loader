// skip 1st line
lockPref('xpinstall.signatures.required', false);
lockPref('extensions.install_origins.enabled', false);

try {
  const cmanifest = Services.dirsvc.get('UChrm', Ci.nsIFile);
  cmanifest.append('utils');
  cmanifest.append('chrome.manifest');
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);

  Services.scriptloader.loadSubScript('chrome://userchromejs/content/utils/BootstrapLoader.js');
  Services.scriptloader.loadSubScript('chrome://userchromejs/content/utils/RemoveSignatureCheck.js');
} catch (ex) { };

try {
  ChromeUtils.importESModule("chrome://userchromejs/content/utils/boot.sys.mjs")
} catch (ex) { };
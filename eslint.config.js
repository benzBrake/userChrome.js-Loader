import js from "@eslint/js";
import globals from "globals";

const firefoxGlobals = {
  ...globals.browser,
  AppConstants: "readonly",
  BrowsingContext: "readonly",
  Cc: "readonly",
  ChromeUtils: "readonly",
  Ci: "readonly",
  Components: "readonly",
  Cr: "readonly",
  Cu: "readonly",
  IOUtils: "readonly",
  JSWindowActorChild: "readonly",
  JSWindowActorParent: "readonly",
  PathUtils: "readonly",
  Services: "readonly",
  lockPref: "readonly",
  pref: "readonly",
};

const sourceRules = {
  ...js.configs.recommended.rules,
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-unused-vars": [
    "error",
    {
      args: "none",
      caughtErrors: "none",
      ignoreRestSiblings: true,
    },
  ],
};

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      globals: firefoxGlobals,
      sourceType: "script",
    },
    rules: sourceRules,
  },
  {
    files: ["src/**/*.mjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      globals: firefoxGlobals,
      sourceType: "module",
    },
    rules: sourceRules,
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
  },
  {
    files: ["src/profile/chrome/userChrome.js"],
    languageOptions: {
      globals: {
        L10nFileSource: "readonly",
        L10nRegistry: "readonly",
        retrieveToolbarIconsizesFromTheme: "readonly",
        userChrome_js: "writable",
      },
    },
    rules: {
      "no-empty": "off",
      "no-redeclare": "off",
      "no-unreachable": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["src/profile/chrome/userChromeJS/AddonsPage_fx72.uc.js"],
    languageOptions: {
      globals: {
        AddonManager: "readonly",
        AddonManagerPrivate: "readonly",
        AM_Helper: "writable",
        openURL: "readonly",
        userChromeJSAddon: "writable",
        XPCOMUtils: "readonly",
        xPref: "readonly",
      },
    },
    rules: {
      "getter-return": "off",
      "no-empty": "off",
      "no-prototype-builtins": "off",
      "no-setter-return": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
    },
  },
  {
    files: ["src/profile/chrome/utils/BootstrapLoader.js"],
    languageOptions: {
      globals: {
        Blocklist: "readonly",
        BOOTSTRAP_REASONS: "readonly",
        ChromeManifest: "readonly",
        ConsoleAPI: "readonly",
        InstallRDF: "readonly",
        logger: "readonly",
      },
    },
    rules: {
      "no-empty": "off",
      "no-redeclare": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["src/profile/chrome/utils/RDFDataSource.sys.mjs"],
    languageOptions: {
      globals: {
        RDF_R: "readonly",
        USE_RDFNS_ATTR: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
    },
  },
  {
    files: ["src/profile/chrome/utils/_uc.sys.mjs"],
    rules: {
      "no-prototype-builtins": "off",
    },
  },
];

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

// Ordered strategy list (ADR-0002): first match wins per extension.
// Add new strategies here to support MCP-based LSP gateways in the future.
const STRATEGIES = [
  scanOfficialPlugins,
  scanPluginLspJson,
  // Future: scanMcpServerConfigs (for cclsp, Serena, lsp-tools-mcp)
];

// Official Claude Code LSP plugins don't ship .lsp.json — their config is
// embedded in the binary. Detect them via enabledPlugins in settings.json.
const OFFICIAL_PLUGIN_EXTENSIONS = {
  'typescript-lsp@claude-plugins-official': {
    extensions: { '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact', '.mts': 'typescript', '.cts': 'typescript', '.mjs': 'javascript', '.cjs': 'javascript' },
  },
  'pyright-lsp@claude-plugins-official': {
    extensions: { '.py': 'python', '.pyi': 'python' },
  },
  'php-lsp@claude-plugins-official': {
    extensions: { '.php': 'php' },
  },
};

const LSP_OPERATIONS = {
  typescript: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  typescriptreact: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  javascript: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  javascriptreact: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  python: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  php: ['goToDefinition', 'findReferences', 'workspaceSymbol', 'hover', 'documentSymbol'],
  markdown: ['workspaceSymbol', 'findReferences', 'documentSymbol'],
  yaml: ['goToDefinition', 'findReferences', 'hover', 'documentSymbol'],
};

function readJsonSilent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function scanOfficialPlugins() {
  const extensionMap = {};
  const settings = readJsonSilent(path.join(HOME, '.claude', 'settings.json'));
  if (!settings?.enabledPlugins) return extensionMap;

  for (const [pluginKey, mapping] of Object.entries(OFFICIAL_PLUGIN_EXTENSIONS)) {
    if (settings.enabledPlugins[pluginKey]) {
      for (const [ext, lang] of Object.entries(mapping.extensions)) {
        if (!extensionMap[ext]) {
          extensionMap[ext] = { language: lang, source: 'official-plugin' };
        }
      }
    }
  }
  return extensionMap;
}

function scanPluginLspJson() {
  const extensionMap = {};
  const searchDirs = [
    path.join(HOME, '.claude', 'plugins', 'cache'),
    path.join(HOME, '.claude', 'plugins', 'marketplaces'),
  ];

  for (const baseDir of searchDirs) {
    if (!fs.existsSync(baseDir)) continue;
    findLspJsonFiles(baseDir, 4).forEach(lspFile => {
      const config = readJsonSilent(lspFile);
      if (!config || typeof config !== 'object') return;
      for (const serverName of Object.keys(config)) {
        const server = config[serverName];
        const extMap = server?.extensionToLanguage;
        if (!extMap || typeof extMap !== 'object') continue;
        for (const [ext, lang] of Object.entries(extMap)) {
          if (!extensionMap[ext]) {
            extensionMap[ext] = { language: lang, source: 'plugin-lsp' };
          }
        }
      }
    });
  }
  return extensionMap;
}

function findLspJsonFiles(dir, maxDepth, depth = 0) {
  const results = [];
  if (depth > maxDepth) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === '.lsp.json' && entry.isFile()) {
        results.push(fullPath);
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...findLspJsonFiles(fullPath, maxDepth, depth + 1));
      }
    }
  } catch { /* permission errors, etc */ }
  return results;
}

function detectProviders(cachedState) {
  if (cachedState?.providerCache && cachedState?.providerCacheTime) {
    const age = Date.now() - cachedState.providerCacheTime;
    if (age < 60 * 60 * 1000) return cachedState.providerCache;
  }

  let extensionMap = {};
  for (const strategy of STRATEGIES) {
    const result = strategy();
    for (const [ext, info] of Object.entries(result)) {
      if (!extensionMap[ext]) extensionMap[ext] = info;
    }
  }
  return extensionMap;
}

function isLspCapable(extension, providerMap) {
  return Boolean(providerMap[extension]);
}

function buildNudgeMessage(extension, providerMap) {
  const info = providerMap[extension];
  if (!info) return null;

  const lang = info.language || 'unknown';
  const ops = LSP_OPERATIONS[lang] || LSP_OPERATIONS.typescript || [];

  return (
    `LSP is available for ${lang} files. Use the LSP tool for ` +
    ops.join(', ') +
    ` — it's faster and more accurate than grep/find. ` +
    `Fall back to grep/find only if LSP returns no result.`
  );
}

module.exports = {
  detectProviders,
  isLspCapable,
  buildNudgeMessage,
  STRATEGIES,
};

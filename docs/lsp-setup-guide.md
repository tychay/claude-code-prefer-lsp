# Getting Language Servers Running with Claude Code

This guide covers installing language servers and enabling LSP plugins so Claude Code can use deterministic, AST-based navigation instead of grep/find. The samples cover some I did for testing purposes on MacOSX with homebrew installed: Typescript/Javascript, Python, PHP, Obsidian markdown, and Ansible yaml.

## Why LSP?

LSP gives Claude go-to-definition, find-references, hover, and workspace-symbol — precise results from the language server's AST. Without it, Claude greps for symbols (noisy, ~40x more tokens) and reads multiple files hoping to find the right one.

## Install Language Servers

Each language needs a language server binary on your PATH.

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server typescript

# Python
npm install -g pyright

# Obsidian/Markdown
brew install markdown-oxide
```

### Language servers from VS Code extensions

Some language servers may not be available as standalone packages. The easiest way I found to get this to work is to install them via VS Code extensions, then create a wrapper script pointing at the bundled binary:

```bash
mkdir -p ~/bin
```

**PHP (Intelephense):** Install the "Intelephense" VS Code extension, then:

```bash
cat > ~/bin/intelephense << 'EOF'
#!/usr/bin/env bash
exec node "$HOME/.vscode/extensions/bmewburn.vscode-intelephense-client-1.18.4/node_modules/intelephense/lib/intelephense.js" "$@"
EOF
chmod +x ~/bin/intelephense
```

**Ansible:** Install the "Ansible" (Red Hat) VS Code extension and `ansible-lint`:

```bash
brew install ansible-lint

cat > ~/bin/ansible-language-server << 'EOF'
#!/usr/bin/env bash
exec node "$HOME/.vscode/extensions/redhat.ansible-26.6.0/packages/ansible-language-server/dist/cli.cjs" "$@"
EOF
chmod +x ~/bin/ansible-language-server
```

> **Note:** The version numbers in the extension paths change on update. After updating either extension, re-create the wrapper with the new path (`ls ~/.vscode/extensions/ | grep <name>` to find it).

## Install Claude Code LSP Plugins

### Official plugins (TypeScript, Python, PHP)

```bash
claude plugin install typescript-lsp@claude-plugins-official
claude plugin install pyright-lsp@claude-plugins-official
claude plugin install php-lsp@claude-plugins-official
```

### Community plugins (Markdown, Ansible)

These require a local marketplace or direct directory install. Example `.lsp.json` configs:

**markdown-oxide-lsp:**
```json
{
  "markdown-oxide": {
    "command": "markdown-oxide",
    "extensionToLanguage": { ".md": "markdown" }
  }
}
```

**ansible-lsp:**
```json
{
  "ansible": {
    "command": "ansible-language-server",
    "args": ["--stdio"],
    "extensionToLanguage": { ".yml": "ansible", ".yaml": "ansible" }
  }
}
```

## Configure PATH

Claude Code needs to find language server binaries, you need to add them to your `$PATH` for it to work. For this one, it's best to edit your `~/.zshrc` or `~/.bashrc` because Claude doesn't have `$PATH` expansion in it's json env.

```json
{
  "env": {
    "PATH": "/Users/you/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  }
}
```

> **Note:** `$PATH` is NOT shell-expanded in `settings.json` — list all directories explicitly. Include `~/bin` (for wrapper scripts), Homebrew, and system paths.

## Enable the LSP Tool (Feature Flag)

As of mid-2026, the LSP tool is still gated behind an undocumented feature flag. Without it, plugins install fine but the LSP tool never appears — Claude reports "No LSP server available for file type" even with everything else configured correctly.

Add to `~/.claude/settings.json`:

```json
{
  "env": {
    "ENABLE_LSP_TOOL": "1"
  }
}
```

Or launch with the env var: `ENABLE_LSP_TOOL=1 claude`

This flag may be removed in a future release (see [anthropics/claude-code#15619](https://github.com/anthropics/claude-code/issues/15619) for status). If you're on a version where LSP works without it, skip this step.

## Verify

After installing, reload Claude Code (Cmd-Shift-P → "Developer: Reload Window") and test each language:

1. **TypeScript:** Ask Claude to find a symbol definition — should use the LSP tool, not grep
2. **Python:** Ask for type info on a symbol — should use LSP tool
3. **PHP:** Ask to find references to a function — should use LSP tool
4. **Markdown:** Open a `.md` file in a vault, resolve a wikilink — should use LSP tool
5. **Ansible:** Open a `.yml` playbook, check for diagnostics — should use LSP tool

If Claude still defaults to grep, install the [prefer-lsp plugin](../README.md) to enforce LSP-first behavior via hooks.

## Setup Checklist (New Machine)

1. Install VS Code extensions: Intelephense, Ansible (Red Hat)
2. Run the binary install commands above (npm, brew, wrapper scripts)
3. Install Claude Code LSP plugins (official + community)
4. Add PATH to `~/.claude/settings.json`
5. Install the prefer-lsp plugin
6. Reload Claude Code

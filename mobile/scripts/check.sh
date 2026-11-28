#!/usr/bin/env bash
# Checks the app code for undefined names before a release (run from mobile/).
# ESLint ignores files outside the folder it runs in, so it must run here, not from traccar-web.
set -euo pipefail
cd "$(dirname "$0")/.."
cat > /tmp/xm-mobile-eslint.mjs <<CFG
import globals from '$(pwd)/../traccar-web/node_modules/globals/index.js';
import hooks from '$(pwd)/../traccar-web/node_modules/eslint-plugin-react-hooks/index.js';
export default [{ files: ['**/*.js', '**/*.jsx'], plugins: { 'react-hooks': hooks },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { ...globals.browser, ...globals.node, __DEV__: true } },
  rules: { 'no-undef': 'error', 'react-hooks/rules-of-hooks': 'error' } }];
CFG
../traccar-web/node_modules/.bin/eslint --no-config-lookup --quiet -c /tmp/xm-mobile-eslint.mjs "src/**/*.js" "src/**/*.jsx"
python3 - <<'PY'
import re, glob, sys
bad = False
for f in glob.glob('src/**/*.jsx', recursive=True):
    s = open(f).read()
    used = set(re.findall(r'<([A-Z][A-Za-z0-9]*)[\s/>.]', s))
    defined = set()
    for m in re.finditer(r'import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from', s):
        if m.group(1):
            defined.add(m.group(1))
        for part in (m.group(2) or '').split(','):
            if part.strip():
                defined.add(part.split(' as ')[-1].strip())
    defined |= set(re.findall(r'import\s+\*\s+as\s+(\w+)', s))
    defined |= set(re.findall(r'(?:function|const|let|class)\s+([A-Z]\w*)', s))
    missing = used - defined
    if missing:
        bad = True
        print(f'{f}: JSX component not imported: {sorted(missing)}')
sys.exit(1 if bad else 0)
PY
echo "mobile check passed"

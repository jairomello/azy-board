#!/usr/bin/env bash
#
# Wrapper POSIX para o conector cross-platform (connect-mcp.mjs).
# No Windows, rode o .mjs direto: `node connect-mcp.mjs ...`.
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v node >/dev/null 2>&1; then
  exec node "$DIR/connect-mcp.mjs" "$@"
fi
if command -v bun >/dev/null 2>&1; then
  exec bun "$DIR/connect-mcp.mjs" "$@"
fi
echo "Node.js 18+ (ou Bun) é necessário para o conector automático." >&2
echo "Instale Node/Bun ou configure manualmente conforme references/mcp-setup.md." >&2
exit 1

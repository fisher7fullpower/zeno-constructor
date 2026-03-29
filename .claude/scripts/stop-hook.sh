#!/bin/bash
# stop-hook.sh — Stop hook
# Запускается при завершении сессии Claude
# Напоминает о незакоммиченных изменениях

cd /Users/adm/Documents/rep/REP_test 2>/dev/null || exit 0

# Проверить незакоммиченные изменения
CHANGED=$(git diff --name-only 2>/dev/null)
STAGED=$(git diff --cached --name-only 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -5)

if [ -n "$CHANGED" ] || [ -n "$STAGED" ]; then
  echo ""
  echo "=== Незакоммиченные изменения ==="
  if [ -n "$STAGED" ]; then
    echo "Staged:"
    echo "$STAGED" | head -10
  fi
  if [ -n "$CHANGED" ]; then
    echo "Modified:"
    echo "$CHANGED" | head -10
  fi
  echo ""
  echo "→ git add . && git commit -m '...' && git push"
fi

exit 0

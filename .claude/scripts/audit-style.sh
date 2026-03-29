#!/bin/bash
# audit-style.sh — Проверка соответствия дизайн-системе Morrow Lab
# Использование: .claude/scripts/audit-style.sh [file.html] или без аргументов (весь проект)

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Файлы для проверки
if [ -n "$1" ]; then
  FILES="$1"
else
  FILES=$(find "$PROJECT_ROOT" -name "*.html" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/smm-admin/*" \
    -not -path "*/backups/*" \
    -not -path "*/venv/*" \
    -not -path "*/screenshots*/*" 2>/dev/null)
fi

echo "=== Morrow Lab Design System Audit ==="
echo ""

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  FILE_ERRORS=0
  FILE_WARNINGS=0

  # 1. Проверка шрифта (только Inter)
  WRONG_FONTS=$(grep -n "font-family" "$FILE" 2>/dev/null | grep -v "Inter\|inherit\|sans-serif\|monospace" | grep -v "^Binary")
  if [ -n "$WRONG_FONTS" ]; then
    echo -e "${RED}[ERROR]${NC} $FILE — Wrong font:"
    echo "$WRONG_FONTS" | head -3
    ((ERRORS++)); ((FILE_ERRORS++))
  fi

  # 2. Проверка hardcoded цветов (не из дизайн-системы)
  HARDCODED_COLORS=$(grep -En "#[0-9a-fA-F]{6}" "$FILE" 2>/dev/null | \
    grep -Ev "#d1fe17|#000000|#000[^0-9a-fA-F]|#0a0a0a|#1c1c1c|#666666|#666[^0-9a-fA-F]|#fff[^0-9a-fA-F]|#ffffff|#FFFFFF" | \
    grep -v "<!--\|//\|og-image\|favicon\|logo" | \
    grep -E "color:|background:|border-color:|box-shadow:|fill:" | head -5)
  if [ -n "$HARDCODED_COLORS" ]; then
    echo -e "${YELLOW}[WARN]${NC} $FILE — Non-system color:"
    echo "$HARDCODED_COLORS" | head -3
    ((WARNINGS++)); ((FILE_WARNINGS++))
  fi

  # 3. Проверка секретов (критично)
  SECRETS=$(grep -nE "(api_key|apikey|secret|password|token)[[:space:]]*=[[:space:]]*['\"][a-zA-Z0-9_\-]{10,}" "$FILE" 2>/dev/null | \
    grep -v "user_token\|partner_token\|X-Admin-Key\|{{" | head -3)
  if [ -n "$SECRETS" ]; then
    echo -e "${RED}[CRITICAL]${NC} $FILE — Possible hardcoded secret:"
    echo "$SECRETS" | head -3
    ((ERRORS++)); ((FILE_ERRORS++))
  fi

  # 4. Проверка XSS (innerHTML без esc)
  UNSAFE_HTML=$(grep -nE "innerHTML[[:space:]]*=" "$FILE" 2>/dev/null | \
    grep -v "esc(\|escHtml(\|sanitize(\|DOMPurify\|'';\|\"\";" | head -3)
  if [ -n "$UNSAFE_HTML" ]; then
    echo -e "${YELLOW}[WARN]${NC} $FILE — Possible unsafe innerHTML:"
    echo "$UNSAFE_HTML" | head -3
    ((WARNINGS++)); ((FILE_WARNINGS++))
  fi

  # 5. Проверка TODO/FIXME
  TODOS=$(grep -n "TODO\|FIXME\|HACK\|XXX" "$FILE" 2>/dev/null | head -3)
  if [ -n "$TODOS" ]; then
    echo -e "${YELLOW}[WARN]${NC} $FILE — TODO/FIXME found:"
    echo "$TODOS" | head -2
    ((WARNINGS++)); ((FILE_WARNINGS++))
  fi

  if [ "$FILE_ERRORS" -eq 0 ] && [ "$FILE_WARNINGS" -eq 0 ]; then
    echo -e "${GREEN}[OK]${NC} $FILE"
  fi
done <<< "$FILES"

echo ""
echo "=== Summary ==="
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

if [ "$ERRORS" -gt 0 ]; then
  echo -e "\n${RED}FAILED: $ERRORS errors must be fixed before deploy${NC}"
  exit 1
else
  echo -e "\n${GREEN}PASSED: No critical errors${NC}"
  exit 0
fi

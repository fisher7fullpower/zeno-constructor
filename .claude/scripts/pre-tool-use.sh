#!/bin/bash
# pre-tool-use.sh — PreToolUse hook
# Запускается перед каждым Write/Edit операцией
# Читает JSON из stdin, проверяет на секреты

INPUT=$(cat)

# Извлечь имя инструмента
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)

# Для Write и Edit — проверить content на секреты
if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
  CONTENT=$(echo "$INPUT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
inp = d.get('tool_input',{})
print(inp.get('content','') + inp.get('new_string',''))
" 2>/dev/null)

  # Паттерны секретов
  PATTERNS=(
    "REPLICATE_TOKEN\s*=\s*['\"]r8_[a-zA-Z0-9]"
    "GROQ_API_KEY\s*=\s*['\"]gsk_[a-zA-Z0-9]"
    "RESEND_KEY\s*=\s*['\"]re_[a-zA-Z0-9]"
    "JWT_SECRET\s*=\s*['\"][a-zA-Z0-9]{16,}"
    "ADMIN_KEY\s*=\s*['\"][a-zA-Z0-9\-]{8,}"
    "178\.172\.[0-9]+\.[0-9]+"
  )

  for PATTERN in "${PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qE "$PATTERN"; then
      echo "BLOCK: Possible secret detected in $TOOL operation. Pattern: $PATTERN" >&2
      exit 2
    fi
  done
fi

exit 0

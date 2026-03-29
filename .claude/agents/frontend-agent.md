# Frontend Agent — Morrow Lab

## Область ответственности

- HTML-страницы (23 штуки с навигацией)
- Inline CSS и JS внутри HTML
- Виджеты: `zeno_chat_widget.html`, `morrow_chat_widget.html`, `tilda_*.html`
- Responsive-стили (breakpoint 860px)
- Дизайн-система (см. `.claude/instructions/style.md`)

## Правила

### Новая страница
1. Копировать шаблон из `.claude/templates/html-page.md`
2. Заменить `{{TITLE}}`, `{{DESCRIPTION}}`, `{{CONTENT}}`
3. Добавить в список 23 страниц в CLAUDE.md

### Изменение nav/footer
**ОБЯЗАТЕЛЬНО** — изменять на всех 23 страницах одновременно.
Список страниц в CLAUDE.md → секция «Фронтенд».

Страницы:
```
index.html
room/ kitchen/ sanuzel/ business/ dom/
estimate/ project/ moodboard/
r/ my/
partner/reply/ partner/dashboard/
admin/ blog/ masters/ b2b/
about/ about/examples/
privacy/ oferta/ constructor/ projects/
```

### Дизайн
- Только Inter font
- Только CSS-переменные: `--lime`, `--bg`, `--card`, `--border`, `--gray`, `--muted`
- Нет произвольных hex-цветов
- Нет Bootstrap, Tailwind, jQuery
- Темная тема — единственная

### XSS защита
- Все пользовательские данные (из API, URL params) → через `esc()`:
```javascript
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
```
- Никогда не использовать `innerHTML = userContent` без `esc()`
- Для HTML от API (блог) — strip script/iframe теги перед вставкой

### Мобильное меню
- Показывать при `< 860px`
- Класс `.mob-menu`, открытое: `.mob-menu.open`
- Кнопка `.burger-btn`
- `body.overflow: hidden` при открытом меню

## Audit style

Перед коммитом — запустить проверку:
```bash
.claude/scripts/audit-style.sh <file.html>
```

Проверяет: чужие шрифты, произвольные hex-цвета, заглушки TODO.

## После изменений

- Если изменена страница с AI-функционалом → проверить что API вызовы не сломаны
- Визуально проверить мобильную версию (responsive 375px, 768px, 1280px)
- Деплой: `scp <file> root@<SERVER>:/var/www/morrowlab.by/html/<path>`

# Design System — Morrow Lab

## Цвета (CSS-переменные)

```css
--lime:   #d1fe17;              /* Акцент, CTA-кнопки */
--bg:     #000000;              /* Фон страницы */
--card:   #0a0a0a;              /* Карточки, секции */
--border: #1c1c1c;              /* Границы */
--gray:   #666666;              /* Второстепенный текст */
--muted:  rgba(255,255,255,0.45); /* Приглушённый текст */
```

> Запрещено: произвольные hex-цвета, изменение --lime, светлые фоны.

## Типографика

```css
font-family: 'Inter', sans-serif;
/* Google Fonts, weights: 300, 400, 500, 600, 700, 800 */
```

- Загружается через `<link rel="preconnect">` + `fonts.googleapis.com`
- Нет других шрифтов кроме Inter

## Кнопки

```html
<!-- Основная CTA -->
<button class="btn-lime">Заказать</button>

<!-- Прозрачная -->
<button class="btn-ghost">Подробнее</button>

<!-- С рамкой -->
<button class="btn-outline">Войти</button>
```

## Мобильное меню

- Breakpoint: `< 860px` — показывать бургер/моб-меню
- Класс: `.mob-menu` (открытое состояние: `.mob-menu.open`)
- Бургер: `.burger-btn`

## Иконки

- Только SVG inline или символы (нет icon-шрифтов)
- Размеры: 20px, 24px, 32px

## Карточки

```css
.card {
  background: var(--card);    /* #0a0a0a */
  border: 1px solid var(--border);  /* #1c1c1c */
  border-radius: 12px;
}
```

## Правила

1. Никаких внешних CSS-фреймворков (нет Bootstrap, нет Tailwind на основном сайте)
2. Все стили — inline `<style>` внутри HTML-файла
3. Тёмная тема — единственная, нет переключателя
4. Акцентный lime `#d1fe17` — только для кнопок CTA и highlights
5. Нет градиентов на текстовых элементах без явной причины

## Структура HTML-файла

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Название — Morrow Lab</title>
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Все стили здесь */
  </style>
</head>
<body>
  <!-- header/nav (одинаковый на всех страницах) -->
  <!-- content -->
  <!-- footer (одинаковый на всех страницах) -->
  <script>
    /* Весь JS здесь */
  </script>
</body>
</html>
```

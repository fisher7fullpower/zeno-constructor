# Шаблон: Новая HTML-страница

> Копировать структуру целиком. Заменить `{{TITLE}}`, `{{DESCRIPTION}}`, `{{CONTENT}}`.
> После создания — добавить в список 23 страниц в CLAUDE.md.

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} — Morrow Lab</title>
  <meta name="description" content="{{DESCRIPTION}}">
  <meta property="og:title" content="{{TITLE}} — Morrow Lab">
  <meta property="og:description" content="{{DESCRIPTION}}">
  <meta property="og:image" content="https://morrowlab.by/og-image.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --lime: #d1fe17;
      --bg: #000;
      --card: #0a0a0a;
      --border: #1c1c1c;
      --gray: #666;
      --muted: rgba(255,255,255,0.45);
    }
    body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; }

    /* ===== NAV ===== */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px;
      background: rgba(0,0,0,0.9); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo { font-size: 18px; font-weight: 700; color: #fff; text-decoration: none; }
    .nav-logo span { color: var(--lime); }
    .nav-links { display: flex; gap: 24px; list-style: none; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; transition: color .2s; }
    .nav-links a:hover { color: #fff; }
    .nav-right { display: flex; gap: 12px; align-items: center; }

    /* ===== MOB MENU ===== */
    .burger-btn {
      display: none; background: none; border: none; cursor: pointer;
      flex-direction: column; gap: 5px; padding: 4px;
    }
    .burger-btn span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; transition: all .3s; }
    .mob-menu {
      display: none; position: fixed; inset: 0; z-index: 99;
      background: #000; padding: 80px 24px 24px;
      flex-direction: column; gap: 24px;
      opacity: 0; transform: translateY(-8px); transition: opacity .3s, transform .3s;
    }
    .mob-menu.open { opacity: 1; transform: none; }
    .mob-menu a { color: #fff; text-decoration: none; font-size: 20px; font-weight: 500; }

    @media (max-width: 860px) {
      .nav-links, .nav-right { display: none; }
      .burger-btn { display: flex; }
      .mob-menu { display: flex; }
    }

    /* ===== MAIN ===== */
    main { padding-top: 64px; }

    /* ===== BTN ===== */
    .btn-lime {
      background: var(--lime); color: #000; font-weight: 700;
      padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer;
      font-size: 15px; font-family: 'Inter', sans-serif; transition: opacity .2s;
    }
    .btn-lime:hover { opacity: .88; }
    .btn-ghost {
      background: transparent; color: #fff; font-weight: 500;
      padding: 12px 24px; border: 1px solid var(--border);
      border-radius: 8px; cursor: pointer; font-size: 15px;
      font-family: 'Inter', sans-serif; transition: border-color .2s;
    }
    .btn-ghost:hover { border-color: #555; }

    /* ===== FOOTER ===== */
    footer {
      border-top: 1px solid var(--border); padding: 40px 24px;
      text-align: center; color: var(--gray); font-size: 13px;
    }
    footer a { color: var(--gray); text-decoration: none; }
    footer a:hover { color: #fff; }

    /* ===== PAGE STYLES ===== */
    /* {{CUSTOM_STYLES}} */
  </style>
</head>
<body>

<!-- NAV -->
<nav>
  <a href="/" class="nav-logo">Morrow<span>Lab</span></a>
  <ul class="nav-links">
    <li><a href="/room/">Комната</a></li>
    <li><a href="/kitchen/">Кухня</a></li>
    <li><a href="/estimate/">Заявка</a></li>
    <li><a href="/blog/">Блог</a></li>
  </ul>
  <div class="nav-right">
    <a href="/my/" class="btn-ghost" style="padding:8px 16px;font-size:13px;">Кабинет</a>
  </div>
  <button class="burger-btn" onclick="toggleMenu()" aria-label="Меню">
    <span></span><span></span><span></span>
  </button>
</nav>

<!-- MOB MENU -->
<div class="mob-menu" id="mobMenu">
  <a href="/room/" onclick="toggleMenu()">Комната</a>
  <a href="/kitchen/" onclick="toggleMenu()">Кухня</a>
  <a href="/estimate/" onclick="toggleMenu()">Заявка</a>
  <a href="/blog/" onclick="toggleMenu()">Блог</a>
  <a href="/my/" onclick="toggleMenu()">Кабинет</a>
</div>

<!-- MAIN -->
<main>
  {{CONTENT}}
</main>

<!-- FOOTER -->
<footer>
  <p>© 2025 Morrow Lab · <a href="/privacy/">Политика конфиденциальности</a> · <a href="/oferta/">Оферта</a></p>
</footer>

<script>
function toggleMenu() {
  const m = document.getElementById('mobMenu');
  m.classList.toggle('open');
  document.body.style.overflow = m.classList.contains('open') ? 'hidden' : '';
}

// {{CUSTOM_JS}}
</script>
</body>
</html>
```

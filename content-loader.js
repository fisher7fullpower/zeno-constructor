/**
 * Morrow Lab CMS Content Loader
 * Fetches /content.json and patches DOM elements with data-cms="key" attributes.
 * Falls back silently to hardcoded HTML if content.json is unavailable.
 */
(function () {
  var page = document.body ? document.body.getAttribute('data-page') : null;
  if (!page) return;

  // Keys that intentionally contain trusted HTML (spans, br, etc.)
  var HTML_KEYS = ['hero_title', 'hero_subtitle'];
  function escCms(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  fetch('/content.json?_=' + Math.floor(Date.now() / 30000))
    .then(function (r) { return r.json(); })
    .then(function (all) {
      var c = all[page];
      if (!c) return;

      document.querySelectorAll('[data-cms]').forEach(function (el) {
        var key = el.getAttribute('data-cms');
        var val = c[key];
        if (val == null || val === '') return;

        if (el.tagName === 'IMG') {
          // Set src and explicitly show/hide image vs emoji fallback
          el.setAttribute('src', val);
          el.style.display = 'block';
          el.style.width = '100%';
          el.style.height = '100%';
          el.style.objectFit = 'cover';
          // Hide adjacent emoji span if present
          var next = el.nextElementSibling;
          if (next && (next.classList.contains('ex-emoji') || next.tagName === 'SPAN')) {
            next.style.display = 'none';
          }
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = val;
        } else if (HTML_KEYS.indexOf(key) !== -1) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      });

      // FAQ dynamic rebuild
      if (c.faq && Array.isArray(c.faq)) {
        var faqContainer = document.querySelector('[data-cms-faq]');
        if (faqContainer) {
          faqContainer.innerHTML = c.faq.map(function (item) {
            return '<div class="faq-item">' +
              '<button class="faq-q" onclick="toggleFaq(this)">' +
              escCms(item.q) + '<span class="faq-icon">+</span></button>' +
              '<div class="faq-a">' + escCms(item.a) + '</div>' +
              '</div>';
          }).join('');
        }
      }

      // Pricing dynamic rebuild
      if (c.pricing) {
        ['free', 'basic', 'pro', 'business'].forEach(function (tier) {
          var p = c.pricing[tier];
          if (!p) return;
          var nameEl = document.querySelector('[data-cms-price-name="' + tier + '"]');
          var priceEl = document.querySelector('[data-cms-price-val="' + tier + '"]');
          if (nameEl && p.name) nameEl.textContent = p.name;
          if (priceEl && p.price !== undefined) priceEl.textContent = p.price + ' BYN';
        });
      }
    })
    .catch(function () { /* silent fallback */ });
})();

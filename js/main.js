/*
 * main.js — общий код для всех страниц:
 * меню, сохранение UTM-меток, цены компании, галерея «до и после»,
 * копирование промокода, расчёт экономии на странице подписки.
 */
(function () {
  'use strict';

  /* ---------- Цены из раздела 2 ТЗ ---------- */
  var PRICES = {
    types: {
      regular:      { name: 'Поддерживающая', perM2: 75, min: 3000 },
      deep:         { name: 'Генеральная', perM2: 160 },
      after_repair: { name: 'После ремонта', perM2: 220 },
      windows:      { name: 'Мойка окон', perSash: 450 },
      upholstery:   { name: 'Химчистка дивана', fixed: 2500, from: true }
    },
    extras: {
      oven:         { name: 'Духовка', price: 700 },
      fridge:       { name: 'Холодильник', price: 600 },
      balcony:      { name: 'Балкон', price: 900 },
      ironing:      { name: 'Глажка', price: 600, unit: 'ч' },
      window_2sash: { name: 'Окно (2 створки)', price: 900, unit: 'шт.' }
    },
    subscription: { weekly: 15, biweekly: 10 },   // скидка в процентах
    promo: { code: 'CLEAN15', percent: 15, type: 'deep', from: '2026-11-15', to: '2026-12-15' }
  };

  // Форматирует число как сумму в рублях: 9800 → "9 800 ₽".
  function rub(n) {
    return Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
  }

  // Дата сегодня в формате ГГГГ-ММ-ДД по московскому времени.
  function todayMsk() {
    var msk = new Date(Date.now() + (new Date().getTimezoneOffset() + 180) * 60000);
    return msk.toISOString().slice(0, 10);
  }

  /* ---------- UTM-метки ----------
   * Если в адресе есть utm_*, сохраняем все пять в sessionStorage,
   * чтобы метки не потерялись при переходе по страницам до отправки формы. */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function saveUtm() {
    var params = new URLSearchParams(window.location.search);
    var hasUtm = UTM_KEYS.some(function (k) { return params.get(k); });
    if (!hasUtm) return;
    var utm = {};
    UTM_KEYS.forEach(function (k) { utm[k] = (params.get(k) || '').trim().toLowerCase().slice(0, 100); });
    try { sessionStorage.setItem('chisty_utm', JSON.stringify(utm)); } catch (e) { /* хранилище недоступно */ }
  }

  function getUtm() {
    var utm = {};
    try { utm = JSON.parse(sessionStorage.getItem('chisty_utm') || '{}'); } catch (e) { utm = {}; }
    return {
      utm_source: utm.utm_source || 'direct',
      utm_medium: utm.utm_medium || 'none',
      utm_campaign: utm.utm_campaign || 'not_set',
      utm_content: utm.utm_content || 'not_set'
    };
  }

  /* ---------- Мобильное меню ---------- */
  function initMenu() {
    var btn = document.querySelector('.nav-toggle');
    var nav = document.getElementById('nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
  }

  /* ---------- Галерея «до и после» ---------- */
  function initGallery() {
    var box = document.getElementById('lightbox');
    if (!box) return;
    var before = document.getElementById('lb-before');
    var after = document.getElementById('lb-after');
    var title = document.getElementById('lightbox-title');
    var closeBtn = box.querySelector('[data-close]');
    var lastFocus = null;

    function close() {
      box.classList.remove('is-open');
      if (lastFocus) lastFocus.focus();
    }
    document.querySelectorAll('.gallery__item').forEach(function (item) {
      item.addEventListener('click', function () {
        var room = item.dataset.room;
        before.src = 'img/before-' + room + '.webp';
        before.alt = item.dataset.title + ' до уборки';
        after.src = 'img/after-' + room + '.webp';
        after.alt = item.dataset.title + ' после уборки';
        title.textContent = item.dataset.title + ': до и после';
        lastFocus = item;
        box.classList.add('is-open');
        closeBtn.focus();
      });
    });
    closeBtn.addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('is-open')) close(); });
  }

  /* ---------- Копирование промокода ---------- */
  function initPromoCopy() {
    var btn = document.querySelector('[data-copy]');
    if (!btn) return;
    var status = document.getElementById('promo-status');
    btn.addEventListener('click', function () {
      var code = btn.dataset.copy;
      var ok = function () { status.textContent = 'Скопировано'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(ok, function () { status.textContent = 'Скопируйте вручную: ' + code; });
      } else {
        status.textContent = 'Скопируйте вручную: ' + code;
      }
      try { sessionStorage.setItem('chisty_promo', code); } catch (e) { /* ничего */ }
    });
  }

  /* ---------- Подписка: экономия за месяц ---------- */
  function initSubscription() {
    var buttons = document.querySelectorAll('.freq__btn');
    if (!buttons.length) return;
    var area = document.getElementById('sub-area');
    var range = document.getElementById('sub-area-range');
    var cta = document.querySelector('[data-button-name="subscription_order"]');
    var freq = 'weekly';

    function update() {
      var a = Math.min(300, Math.max(15, Number(area.value) || 15));
      var t = PRICES.types.regular;
      var one = Math.max(a * t.perM2, t.min);                 // цена одной уборки без скидки
      var count = freq === 'weekly' ? 4 : 2;                   // уборок в месяц
      var percent = PRICES.subscription[freq];
      var full = one * count;
      var saving = full * percent / 100;
      document.getElementById('sub-line').textContent =
        count + ' уборки по ' + rub(one) + ' = ' + rub(full) + ' без скидки';
      document.getElementById('sub-saving').textContent = rub(saving);
      document.getElementById('sub-pay').textContent = 'К оплате в месяц: ' + rub(full - saving) + ' (скидка ' + percent + ' %)';
      if (cta) cta.href = 'calculator.html?type=regular&freq=' + freq + '&area=' + a;
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        freq = b.dataset.frequency;
        update();
      });
    });
    area.addEventListener('input', function () { range.value = area.value; update(); });
    range.addEventListener('input', function () { area.value = range.value; update(); });
    update();
  }

  saveUtm();
  window.Chisty = { PRICES: PRICES, rub: rub, getUtm: getUtm, todayMsk: todayMsk };

  // Скрипт подключён с defer: он выполняется, когда HTML уже разобран,
  // поэтому элементы страницы можно искать сразу.
  initMenu();
  initGallery();
  initPromoCopy();
  initSubscription();
})();

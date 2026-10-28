/*
 * analytics.js — все вызовы gtag('event', …) сайта находятся только в этом файле.
 *
 * Как это работает:
 * 1. Элементы в HTML помечены атрибутом data-event="имя_события".
 *    Остальные data-атрибуты становятся параметрами события:
 *    data-button-name="hero_calc" → button_name: "hero_calc".
 * 2. Клик по такому элементу отправляет событие (cta_click, service_view, contact_click…).
 * 3. Флажки и переключатели с data-event отправляют событие при включении (extra_toggle).
 * 4. Блоки <details data-event="faq_open"> отправляют событие при раскрытии.
 * 5. Другие скрипты (калькулятор, форма) вызывают ChistyAnalytics.track(имя, параметры).
 *
 * Имя, телефон и e-mail посетителя в GA4 не передаются.
 */
(function () {
  'use strict';

  // Если тег Google не загрузился (блокировщик рекламы), создаём пустую функцию,
  // чтобы сайт продолжал работать без ошибок.
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  // Параметры, которые нельзя отправлять в GA4 (персональные данные).
  var FORBIDDEN = ['name', 'phone', 'email', 'address'];

  // Превращает "buttonName" в "button_name".
  function toSnake(key) {
    return key.replace(/[A-Z]/g, function (ch) { return '_' + ch.toLowerCase(); });
  }

  // Приводит имя и значения к правилам GA4: имена до 40 символов, значения до 100.
  function clean(params) {
    var result = {};
    Object.keys(params || {}).forEach(function (key) {
      var name = toSnake(key).slice(0, 40);
      var value = params[key];
      if (FORBIDDEN.indexOf(name) !== -1 || value === undefined || value === null || value === '') return;
      result[name] = typeof value === 'string' ? value.slice(0, 100) : value;
    });
    return result;
  }

  // Единая функция отправки события.
  function track(eventName, params, callback) {
    var data = clean(params);
    if (typeof callback === 'function') {
      var done = false;
      var finish = function () { if (!done) { done = true; callback(); } };
      data.event_callback = finish;           // gtag вызовет её после отправки
      setTimeout(finish, 1200);               // запасной вариант, если ответа нет
    }
    window.gtag('event', eventName, data);
  }

  // Собирает параметры из data-атрибутов элемента (кроме data-event и служебных).
  var SKIP = ['event', 'copy', 'room', 'title', 'qty'];
  function paramsFrom(el) {
    var params = {};
    Object.keys(el.dataset).forEach(function (key) {
      if (SKIP.indexOf(key) === -1) params[key] = el.dataset[key];
    });
    if (params.photoIndex) params.photoIndex = Number(params.photoIndex);
    return params;
  }

  // Клики по кнопкам, ссылкам и карточкам с data-event.
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-event]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'DETAILS') return;
    track(el.dataset.event, paramsFrom(el));
  });

  // Флажки и переключатели: событие только при включении.
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('input[data-event]')) return;
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
    track(el.dataset.event, paramsFrom(el));
  });

  // Раскрытие блоков «Что входит в уборку». Событие toggle не всплывает,
  // поэтому слушаем его на этапе перехвата (третий аргумент true).
  document.addEventListener('toggle', function (e) {
    var el = e.target;
    if (el.tagName === 'DETAILS' && el.open && el.dataset.event) {
      track(el.dataset.event, paramsFrom(el));
    }
  }, true);

  window.ChistyAnalytics = { track: track };
})();

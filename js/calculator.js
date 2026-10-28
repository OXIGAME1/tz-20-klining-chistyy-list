/*
 * calculator.js — калькулятор стоимости уборки (calculator.html).
 * Правила расчёта — раздел 2 ТЗ:
 *   поддерживающая 75 ₽/м² (минимум 3 000 ₽), генеральная 160 ₽/м², после ремонта 220 ₽/м²,
 *   мойка окон 450 ₽ за створку, химчистка дивана от 2 500 ₽;
 *   подписка: раз в неделю −15 %, раз в 2 недели −10 % (только поддерживающая);
 *   акция: генеральная −15 % при заказе до 15.12.2026 или по промокоду CLEAN15.
 *   Скидки не суммируются — применяется большая.
 */
(function () {
  'use strict';

  var P = window.Chisty.PRICES;
  var rub = window.Chisty.rub;
  var calc = document.getElementById('calc');
  if (!calc) return;

  var areaInput = document.getElementById('area');
  var areaRange = document.getElementById('area-range');
  var sashInput = document.getElementById('sashes');
  var sashField = document.getElementById('sash-field');
  var promoInput = document.getElementById('promo');
  var timer = null;

  // Ограничивает число диапазоном: clamp(400, 15, 300) → 300.
  function clamp(value, min, max) {
    var n = Math.round(Number(value));
    if (isNaN(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  // Значение выбранного переключателя (radio) по его имени.
  function checkedValue(name) {
    var el = calc.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  // Идёт ли акция сегодня (15.11–15.12.2026 по Москве).
  function promoPeriod() {
    var today = window.Chisty.todayMsk();
    return today >= P.promo.from && today <= P.promo.to;
  }

  // Считает всю стоимость и возвращает объект с деталями расчёта.
  function compute() {
    var type = checkedValue('cleaning_type');
    var t = P.types[type];
    var area = clamp(areaInput.value, 15, 300);
    var sashes = clamp(sashInput.value, 1, 50);
    var freq = checkedValue('frequency');

    // 1. Стоимость основной уборки.
    var base;
    if (t.perM2) base = area * t.perM2;
    else if (t.perSash) base = sashes * t.perSash;
    else base = t.fixed;
    if (t.min) base = Math.max(base, t.min);          // минимальная сумма заказа

    // 2. Дополнительные услуги (с учётом количества, если оно есть).
    var extras = [];
    var extrasSum = 0;
    calc.querySelectorAll('input[name="extra"]:checked').forEach(function (box) {
      var e = P.extras[box.value];
      var qtyInput = calc.querySelector('[data-qty="' + box.value + '"]');
      var qty = qtyInput ? clamp(qtyInput.value, 1, 10) : 1;
      extrasSum += e.price * qty;
      extras.push(e.name + (qtyInput ? ' × ' + qty : ''));
    });

    var subtotal = base + extrasSum;

    // 3. Скидки: выбираем большую, не складываем.
    var discount = 0;
    var label = 'Скидка';
    if (type === 'regular' && P.subscription[freq]) {
      discount = P.subscription[freq];
      label = 'Подписка −' + discount + ' %';
    }
    var promoCode = promoInput.value.trim().toUpperCase();
    if (type === P.promo.type && (promoPeriod() || promoCode === P.promo.code) && P.promo.percent > discount) {
      discount = P.promo.percent;
      label = 'Акция −' + discount + ' %';
    }
    var discountSum = Math.round(subtotal * discount / 100);

    return {
      type: type, typeName: t.name, from: !!t.from, area: area, sashes: sashes, freq: freq,
      base: base, extras: extras, extrasSum: extrasSum, subtotal: subtotal,
      discount: discount, discountLabel: label, discountSum: discountSum,
      total: subtotal - discountSum, promo: promoCode
    };
  }

  // Выводит расчёт на страницу и сохраняет его для формы заказа.
  function render() {
    var r = compute();
    var prefix = r.from ? 'от ' : '';
    document.getElementById('sum-base').textContent = prefix + rub(r.base);
    document.getElementById('sum-extras').textContent = r.extrasSum ? rub(r.extrasSum) : '—';
    document.getElementById('sum-subtotal').textContent = prefix + rub(r.subtotal);
    document.getElementById('sum-discount-label').textContent = r.discount ? r.discountLabel : 'Скидка';
    document.getElementById('sum-discount').textContent = r.discount ? '−' + rub(r.discountSum) : '—';
    document.getElementById('sum-total').textContent = prefix + rub(r.total);
    document.getElementById('sum-note').textContent =
      (r.freq !== 'once' && r.type === 'regular' ? 'Цена одной уборки по подписке. ' : '') + 'Оплата после уборки.';
    try { sessionStorage.setItem('chisty_calc', JSON.stringify(r)); } catch (e) { /* ничего */ }
    return r;
  }

  // Подписка доступна только для поддерживающей уборки; окна считаются по створкам.
  function syncControls() {
    var type = checkedValue('cleaning_type');
    sashField.hidden = type !== 'windows';
    calc.querySelectorAll('input[name="frequency"]').forEach(function (radio) {
      radio.disabled = type !== 'regular' && radio.value !== 'once';
      if (radio.disabled && radio.checked) calc.querySelector('input[name="frequency"][value="once"]').checked = true;
    });
  }

  // После изменения ждём 800 мс и отправляем одно событие cleaning_calc,
  // чтобы при перетаскивании ползунка не уходили десятки событий.
  function onChange() {
    syncControls();
    var r = render();
    clearTimeout(timer);
    timer = setTimeout(function () {
      window.ChistyAnalytics.track('cleaning_calc', {
        cleaning_type: r.type,
        area_m2: r.area,
        extras_count: r.extras.length,
        total_price: r.total
      });
    }, 800);
  }

  // Начальные значения из адреса: ?type=deep&freq=weekly&area=60
  var params = new URLSearchParams(window.location.search);
  var preType = calc.querySelector('input[name="cleaning_type"][value="' + params.get('type') + '"]');
  if (preType) preType.checked = true;
  var preFreq = calc.querySelector('input[name="frequency"][value="' + params.get('freq') + '"]');
  if (preFreq) preFreq.checked = true;
  if (params.get('area')) areaInput.value = areaRange.value = clamp(params.get('area'), 15, 300);
  try { promoInput.value = sessionStorage.getItem('chisty_promo') || ''; } catch (e) { /* ничего */ }

  // Ползунок и поле площади повторяют друг друга.
  areaRange.addEventListener('input', function () { areaInput.value = areaRange.value; });
  areaInput.addEventListener('input', function () { areaRange.value = clamp(areaInput.value, 15, 300); });
  areaInput.addEventListener('change', function () { areaInput.value = clamp(areaInput.value, 15, 300); onChange(); });

  calc.addEventListener('input', onChange);
  calc.addEventListener('change', onChange);

  syncControls();
  render();
})();

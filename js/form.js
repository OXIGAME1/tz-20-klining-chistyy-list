/*
 * form.js — выбор даты, форма заказа (contacts.html) и страница «Спасибо» (thanks.html).
 * Форма отправляется без перезагрузки (fetch) в веб-приложение Apps Script,
 * которое записывает строку в Google Таблицу «ChistyList — Orders», лист leads.
 */
(function () {
  'use strict';

  // Адрес веб-приложения Apps Script (Развернуть → Веб-приложение → URL, оканчивается на /exec).
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZ4FKLxUJLOhBLXHNpBlUA7Scvzmf0V689e6kY3rOSZKpg9_CcgX1UKKTGzcVecDJd/exec';

  var TYPES = ['regular', 'deep', 'after_repair', 'windows', 'upholstery'];
  var WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var track = window.ChistyAnalytics.track;
  var rub = window.Chisty.rub;

  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }

  // "2026-10-28 08:00" → "28.10.2026, 08:00"
  function humanDate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] + ', ' + m[4] : value;
  }

  /* ======================= Страница «Спасибо» ======================= */
  if (document.getElementById('t-id')) {
    var order = readJson('chisty_last_order');
    var idFromUrl = new URLSearchParams(window.location.search).get('id');
    document.getElementById('t-id').textContent = (order && order.request_id) || idFromUrl || '—';
    if (order) {
      document.getElementById('t-date').textContent = humanDate(order.cleaning_date);
      document.getElementById('t-type').textContent = order.type_name + ', ' + order.area_m2 + ' м²';
      document.getElementById('t-sum').textContent = order.total ? (order.from ? 'от ' : '') + rub(order.total) : 'уточнит менеджер';
    }
    return;
  }

  var form = document.getElementById('order-form');
  if (!form) return;

  /* ======================= Выбор даты и времени ======================= */
  var datesBox = document.getElementById('dates');
  var dateInput = document.getElementById('cleaning_date');
  var picked = document.getElementById('picked');
  var chosenDate = '';
  var chosenTime = '';

  // Строим 14 кнопок: с завтрашнего дня по московскому времени.
  var today = window.Chisty.todayMsk();
  for (var i = 1; i <= 14; i++) {
    var d = new Date(today + 'T12:00:00Z');        // полдень UTC — без сдвига даты
    d.setUTCDate(d.getUTCDate() + i);
    var iso = d.toISOString().slice(0, 10);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-btn';
    btn.dataset.date = iso;
    btn.dataset.weekday = WEEKDAYS[d.getUTCDay()];
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<small>' + WEEKDAYS_RU[d.getUTCDay()] + '</small>' + iso.slice(8, 10) + '.' + iso.slice(5, 7);
    btn.setAttribute('aria-label', d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
    datesBox.appendChild(btn);
  }

  function selectIn(container, button) {
    container.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    button.setAttribute('aria-pressed', 'true');
  }

  // Когда выбраны и дата, и время — заполняем скрытое поле и отправляем date_select.
  function updateDate(weekday) {
    if (!chosenDate || !chosenTime) {
      picked.textContent = chosenDate ? 'Выберите время приезда' : 'Выберите дату';
      return;
    }
    dateInput.value = chosenDate + ' ' + chosenTime;
    picked.textContent = 'Приезд бригады: ' + humanDate(dateInput.value);
    clearError('cleaning_date');
    track('date_select', { cleaning_date: dateInput.value, weekday: weekday });
  }

  var currentWeekday = '';
  datesBox.addEventListener('click', function (e) {
    var b = e.target.closest('.date-btn');
    if (!b) return;
    selectIn(datesBox, b);
    chosenDate = b.dataset.date;
    currentWeekday = b.dataset.weekday;
    updateDate(currentWeekday);
  });
  document.getElementById('times').addEventListener('click', function (e) {
    var b = e.target.closest('.time-btn');
    if (!b) return;
    selectIn(this, b);
    chosenTime = b.dataset.time;
    updateDate(currentWeekday);
  });

  /* ======================= Подстановка данных ======================= */
  // Номер заявки: REQ- + UUID. Повторная отправка той же заявки не создаст дубль в таблице.
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  document.getElementById('request_id').value = 'REQ-' + uuid();

  // UTM-метки из sessionStorage (их сохраняет main.js при входе на сайт).
  var utm = window.Chisty.getUtm();
  Object.keys(utm).forEach(function (k) { document.getElementById(k).value = utm[k]; });

  // Расчёт из калькулятора.
  var calcState = readJson('chisty_calc');
  var info = document.getElementById('calc-info');
  if (calcState) {
    form.elements.cleaning_type.value = calcState.type;
    form.elements.area_m2.value = calcState.area;
    info.hidden = false;
    info.textContent = 'Расчёт из калькулятора: ' + calcState.typeName + ', ' + calcState.area + ' м²' +
      (calcState.extras.length ? ', ' + calcState.extras.join(', ') : '') +
      '. Итого: ' + (calcState.from ? 'от ' : '') + rub(calcState.total) + '.';
  }
  if (new URLSearchParams(window.location.search).get('office')) {
    info.hidden = false;
    info.textContent = 'Заявка на уборку офиса: укажите площадь офиса и дату первой уборки — менеджер подготовит предложение и согласует график.';
    if (!form.elements.cleaning_type.value) form.elements.cleaning_type.value = 'regular';
  }

  /* ======================= Проверка полей ======================= */
  // Приводит телефон к виду +7XXXXXXXXXX: "8 (900) 123-45-67" → "+79001234567".
  function normalizePhone(raw) {
    var digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
    return digits.length === 10 ? '+7' + digits : String(raw).trim();
  }

  function showError(field, text) {
    var el = form.querySelector('[name="' + field + '"]');
    var box = el ? el.closest('.field') : null;
    if (box) box.classList.add('has-error');
    if (el && el.type === 'checkbox') el.closest('.check').classList.add('has-error');
    if (el && el.type !== 'hidden') el.setAttribute('aria-invalid', 'true');
    document.getElementById(field + '-error').textContent = text;
  }

  function clearError(field) {
    var el = form.querySelector('[name="' + field + '"]');
    var box = el ? el.closest('.field') : null;
    if (box) box.classList.remove('has-error');
    if (el && el.type === 'checkbox') el.closest('.check').classList.remove('has-error');
    if (el) el.removeAttribute('aria-invalid');
    document.getElementById(field + '-error').textContent = '';
  }

  // Возвращает список ошибок: [{field, type, text}].
  function validate() {
    var errors = [];
    var name = form.elements.name.value.trim();
    var phone = normalizePhone(form.elements.phone.value);
    var email = form.elements.email.value.trim();
    var area = Number(form.elements.area_m2.value);

    if (!name) errors.push({ field: 'name', type: 'required', text: 'Укажите имя' });
    else if (name.length < 2 || name.length > 60) errors.push({ field: 'name', type: 'length', text: 'Имя — от 2 до 60 символов' });

    if (!form.elements.phone.value.trim()) errors.push({ field: 'phone', type: 'required', text: 'Укажите телефон' });
    else if (!/^\+7\d{10}$/.test(phone)) errors.push({ field: 'phone', type: 'format', text: 'Телефон в формате +7 и 10 цифр, например +7 900 123-45-67' });

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push({ field: 'email', type: 'format', text: 'Проверьте e-mail, например name@mail.ru' });

    if (TYPES.indexOf(form.elements.cleaning_type.value) === -1) errors.push({ field: 'cleaning_type', type: 'required', text: 'Выберите вид уборки' });

    if (!form.elements.area_m2.value) errors.push({ field: 'area_m2', type: 'required', text: 'Укажите площадь' });
    else if (!(area >= 15 && area <= 300)) errors.push({ field: 'area_m2', type: 'range', text: 'Площадь — от 15 до 300 м²' });

    if (!dateInput.value) errors.push({ field: 'cleaning_date', type: 'required', text: 'Выберите дату и время приезда в блоке выше' });

    if (!form.elements.consent.checked) errors.push({ field: 'consent', type: 'required', text: 'Нужно согласие на обработку персональных данных' });

    return { errors: errors, phone: phone };
  }

  // Ошибка исчезает, как только посетитель исправляет поле.
  form.addEventListener('input', function (e) { if (e.target.name) clearError(e.target.name); });
  form.addEventListener('change', function (e) { if (e.target.name) clearError(e.target.name); });

  /* ======================= Отправка ======================= */
  var submitBtn = document.getElementById('submit-btn');
  var status = document.getElementById('form-status');

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('is-error', !!isError);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ['name', 'phone', 'email', 'cleaning_type', 'area_m2', 'cleaning_date', 'consent'].forEach(clearError);
    setStatus('');

    var check = validate();
    if (check.errors.length) {
      check.errors.forEach(function (err) {
        showError(err.field, err.text);
        track('form_error', { field_name: err.field, error_type: err.type });
      });
      var first = form.querySelector('[name="' + check.errors[0].field + '"]');
      if (check.errors[0].field === 'cleaning_date') document.getElementById('date-block').scrollIntoView({ block: 'center' });
      else if (first) first.focus();
      return;
    }

    form.elements.phone.value = check.phone;
    var payload = {
      request_id: form.elements.request_id.value,
      name: form.elements.name.value.trim(),
      phone: check.phone,
      email: form.elements.email.value.trim(),
      cleaning_type: form.elements.cleaning_type.value,
      area_m2: Number(form.elements.area_m2.value),
      cleaning_date: dateInput.value,
      address: form.elements.address.value.trim(),
      utm_source: form.elements.utm_source.value,
      utm_medium: form.elements.utm_medium.value,
      utm_campaign: form.elements.utm_campaign.value,
      utm_content: form.elements.utm_content.value
    };

    // Сумма заказа: из калькулятора, если вид уборки совпадает, иначе базовая цена без доп. услуг.
    var P = window.Chisty.PRICES.types[payload.cleaning_type];
    var total = calcState && calcState.type === payload.cleaning_type && calcState.area === payload.area_m2
      ? calcState.total
      : (P.perM2 ? Math.max(payload.area_m2 * P.perM2, P.min || 0) : (P.fixed || 0));

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    // Content-Type text/plain — «простой» запрос без предварительной проверки CORS,
    // который Apps Script принимает и на который отвечает JSON.
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error((data && data.error) || 'unknown');

        try {
          sessionStorage.setItem('chisty_last_order', JSON.stringify({
            request_id: payload.request_id,
            cleaning_date: payload.cleaning_date,
            type_name: P.name,
            area_m2: payload.area_m2,
            total: total,
            from: !!P.from
          }));
        } catch (err) { /* ничего */ }

        // generate_lead — только после ответа {"ok": true}; без имени, телефона и e-mail.
        track('generate_lead', {
          lead_cleaning_type: payload.cleaning_type,
          area_m2: payload.area_m2,
          value: total,
          currency: 'RUB'
        }, function () {
          window.location.href = 'thanks.html?id=' + encodeURIComponent(payload.request_id);
        });
      })
      .catch(function (err) {
        track('form_error', { field_name: 'form', error_type: 'server' });
        setStatus('Не удалось отправить заказ. Попробуйте ещё раз или позвоните: +7 (900) 020-20-20.', true);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заказ';
        if (window.console) console.warn('Приёмник заявок:', err.message);
      });
  });
})();

/**
 * Приёмник заявок «Чистый лист» — веб-приложение Google Apps Script.
 * Принимает заявку с сайта (POST, JSON в теле), проверяет поля
 * и дописывает строку в лист leads таблицы «ChistyList — Orders».
 *
 * Установка:
 * 1. Откройте таблицу → Расширения → Apps Script, вставьте этот код.
 * 2. В SHEET_ID вставьте идентификатор таблицы (часть адреса между /d/ и /edit).
 * 3. Один раз запустите функцию setupSheet (заголовки, списки, подсветка).
 * 4. Развернуть → Новое развёртывание → Веб-приложение:
 *    «Выполнять как» — я, «Доступ» — все. Полученный URL вставьте в js/form.js.
 * После каждого изменения кода: Развернуть → Управление развёртываниями → Изменить → Новая версия.
 */

const SHEET_ID = 'ВСТАВЬТЕ_ИДЕНТИФИКАТОР_ТАБЛИЦЫ';
const SHEET_NAME = 'leads';
const TIMEZONE = 'Europe/Moscow';

// Порядок столбцов — раздел 6.1 ТЗ. address — необязательное поле формы (раздел 3.3), последним столбцом.
const HEADERS = [
  'request_id', 'created_at', 'name', 'phone', 'email', 'cleaning_type', 'area_m2', 'cleaning_date',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'status', 'address'
];
const CLEANING_TYPES = ['regular', 'deep', 'after_repair', 'windows', 'upholstery'];
const STATUSES = ['new', 'contacted', 'confirmed', 'done', 'cancelled'];
const MAX_LEN = 200;

/** Обработка заявки с сайта. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);                       // одновременно записывается только одна заявка

    const data = parseRequest_(e);
    const error = validate_(data);
    if (error) return json_({ ok: false, error: error });

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    // Повторная отправка с тем же request_id не создаёт вторую строку.
    const found = sheet.getRange('A:A').createTextFinder(data.request_id).matchEntireCell(true).findNext();
    if (found) return json_({ ok: false, error: 'duplicate_request_id' });

    const row = [
      data.request_id,
      new Date(),                               // created_at ставит приёмник
      data.name,
      data.phone,
      data.email || '',
      data.cleaning_type,
      Number(data.area_m2),
      parseDate_(data.cleaning_date),
      utm_(data.utm_source, 'direct'),
      utm_(data.utm_medium, 'none'),
      utm_(data.utm_campaign, 'not_set'),
      utm_(data.utm_content, 'not_set'),
      'new',                                    // статус из браузера игнорируется
      data.address || ''
    ];

    const rowIndex = sheet.getLastRow() + 1;
    const range = sheet.getRange(rowIndex, 1, 1, row.length);
    sheet.getRange(rowIndex, 4).setNumberFormat('@');   // телефон хранится как текст: +7…
    range.setValues([row]);

    return json_({ ok: true, request_id: data.request_id, row: rowIndex });
  } catch (err) {
    return json_({ ok: false, error: 'server_error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/** Проверка, что приёмник работает: откройте URL веб-приложения в браузере. */
function doGet() {
  return json_({ ok: true, service: 'ChistyList orders receiver' });
}

/** Читает JSON из тела запроса; запасной вариант — обычные параметры формы. */
function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* не JSON */ }
  }
  return (e && e.parameter) ? e.parameter : {};
}

/** Возвращает текст ошибки или пустую строку, если всё верно. */
function validate_(d) {
  const required = ['request_id', 'name', 'phone', 'cleaning_type', 'area_m2', 'cleaning_date'];
  for (const field of required) {
    if (d[field] === undefined || d[field] === null || String(d[field]).trim() === '') return 'required: ' + field;
  }
  for (const key in d) {
    if (String(d[key]).length > MAX_LEN) return 'too_long: ' + key;
  }
  if (!/^REQ-[0-9a-f-]{36}$/i.test(d.request_id)) return 'format: request_id';

  const name = String(d.name).trim();
  if (name.length < 2 || name.length > 60) return 'length: name';

  if (!/^\+7\d{10}$/.test(String(d.phone))) return 'format: phone';

  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email))) return 'format: email';

  if (CLEANING_TYPES.indexOf(d.cleaning_type) === -1) return 'value: cleaning_type';

  const area = Number(d.area_m2);
  if (!(area >= 15 && area <= 300)) return 'range: area_m2';

  const date = parseDate_(d.cleaning_date);
  if (!date) return 'format: cleaning_date';
  const tomorrow = Utilities.formatDate(new Date(Date.now() + 24 * 3600 * 1000), TIMEZONE, 'yyyy-MM-dd');
  if (String(d.cleaning_date).slice(0, 10) < tomorrow) return 'range: cleaning_date';

  return '';
}

/** "2026-10-28 08:00" → дата по московскому времени или null. */
function parseDate_(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const date = new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00+03:00');
  return isNaN(date.getTime()) ? null : date;
}

/** Метка: строчные латинские буквы, цифры, «_» и скобки; пусто → значение по умолчанию. */
function utm_(value, fallback) {
  const v = String(value || '').trim().toLowerCase();
  return v ? v.slice(0, 100) : fallback;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Однократная настройка листа leads: заголовки, форматы, выпадающие списки
 * и условное форматирование (пустые обязательные ячейки, повторы request_id).
 */
function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ss.setSpreadsheetTimeZone(TIMEZONE);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  sheet.getRange('B2:B').setNumberFormat('dd.MM.yyyy HH:mm:ss');
  sheet.getRange('D2:D').setNumberFormat('@');
  sheet.getRange('H2:H').setNumberFormat('dd.MM.yyyy HH:mm');

  // Выпадающие списки: ввод другого значения отклоняется.
  sheet.getRange('M2:M').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  sheet.getRange('F2:F').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CLEANING_TYPES, true).setAllowInvalid(false).build());

  // Условное форматирование.
  const rules = [];
  // 1) Повторяющиеся request_id — красный фон.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2<>"",COUNTIF($A:$A,$A2)>1)')
    .setBackground('#F4C7C3')
    .setRanges([sheet.getRange('A2:A')])
    .build());
  // 2) Пустые обязательные ячейки в заполненной строке — жёлтый фон (все столбцы, кроме email и address).
  const requiredRanges = ['A2:A', 'B2:B', 'C2:C', 'D2:D', 'F2:F', 'G2:G', 'H2:H', 'I2:I', 'J2:J', 'K2:K', 'L2:L', 'M2:M'];
  requiredRanges.forEach(function (a1) {
    const col = a1.charAt(0);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(COUNTA($A2:$N2)>0,ISBLANK(' + col + '2))')
      .setBackground('#FFF2CC')
      .setRanges([sheet.getRange(a1)])
      .build());
  });
  sheet.setConditionalFormatRules(rules);
  sheet.autoResizeColumns(1, HEADERS.length);
}

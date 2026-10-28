# Таблица событий GA4

Все вызовы `gtag('event', …)` — в `js/analytics.js` (функция `track`, строка 54). Остальные файлы либо размечают элементы атрибутами `data-event`, либо вызывают `ChistyAnalytics.track()`.

Как читать столбец «Где отправляется»: для HTML — строка элемента с атрибутом `data-event` (клик/изменение ловит `js/analytics.js`); для JS — строка вызова `ChistyAnalytics.track(…)`. Номера строк — для версии из этого коммита; после правок пересчитайте.

| № | Событие | Тип | Когда | Где отправляется (файл:строка) | Параметры и пример значений |
|---|---|---|---|---|---|
| 1 | `page_view` | авто | Открытие любой страницы | расширенная статистика GA4 (кода нет) | page_location: https://…/calculator.html; page_title: Калькулятор стоимости уборки — Чистый лист |
| 2 | `scroll` | авто | Прокрутка до 90 % | расширенная статистика GA4 (кода нет) | percent_scrolled: 90 |
| 3 | `click` | авто | Переход на внешний сайт (соцсети, Telegram, WhatsApp) | расширенная статистика GA4 (кода нет) | link_url: https://t.me/chisty_list_manager; outbound: true |
| 4 | `file_download` | авто | Скачивание PDF | services.html:67<br>tips.html:67 | file_name: /files/chek-list-rabot.pdf; file_extension: pdf |
| 5 | `form_start` | авто | Первое взаимодействие с формой заказа | contacts.html:76 | form_id: order-form |
| 6 | `form_submit` | авто | Отправка формы заказа | contacts.html:76 | form_id: order-form |
| 7 | `generate_lead` | рекоменд., ключевое | Приёмник ответил {"ok": true} | js/form.js:266 | lead_cleaning_type: deep; area_m2: 50; value: 8330; currency: RUB |
| 8 | `cta_click` | своё | Клик по кнопке заявки | 404.html:62<br>calculator.html:111<br>index.html:62,63<br>office.html:71<br>services.html:72<br>subscription.html:88 | button_name: hero_calc_deep; page_section: hero |
| 9 | `service_view` | своё | Клик по карточке услуги | index.html:81<br>services.html:59 | cleaning_type: deep |
| 10 | `cleaning_calc` | своё | Расчёт в калькуляторе (через 0,8 с после изменения) | js/calculator.js:127 | cleaning_type: deep; area_m2: 50; extras_count: 1; total_price: 9800 |
| 11 | `extra_toggle` | своё | Включение доп. услуги | calculator.html:91 | extra_name: window_2sash |
| 12 | `date_select` | своё | Выбраны дата и время приезда | js/form.js:82 | cleaning_date: 2026-10-28 08:00; weekday: wednesday |
| 13 | `subscription_select` | своё | Выбор частоты подписки | subscription.html:61,64 | frequency: biweekly |
| 14 | `promo_copy` | своё | Кнопка «Скопировать» промокод | tips.html:73 | promo_code: CLEAN15 |
| 15 | `contact_click` | своё, ключевое | Клик по телефону или e-mail | 404.html:50,78,79<br>calculator.html:50,128,129<br>contacts.html:50,140,141,163…<br>index.html:50,120,121<br>office.html:50,86,87<br>privacy.html:50,98,99 | contact_type: phone |
| 16 | `messenger_click` | своё, ключевое | Клик по Telegram или WhatsApp | contacts.html:144,145 | messenger: telegram |
| 17 | `social_click` | своё | Иконка соцсети в подвале или на thanks.html | 404.html:85<br>calculator.html:135<br>contacts.html:170<br>index.html:127<br>office.html:93<br>privacy.html:105 | network: vk; page_section: footer |
| 18 | `form_error` | своё | Ошибка поля или приёмника | js/form.js:210,276 | field_name: phone; error_type: format (required / length / format / range / server) |
| 19 | `faq_open` | своё, по выбору | Раскрытие блока «Что входит» | index.html:88 | question_id: kitchen |
| 20 | `gallery_view` | своё, по выбору | Открытие фото «до и после» | index.html:95 | photo_index: 3 |

## Пользовательские параметры (Admin → Custom definitions, Event scope)

button_name, page_section, cleaning_type, extra_name, frequency, lead_cleaning_type, messenger.

## Ключевые события

generate_lead, contact_click, messenger_click — других ключевых событий нет.

## Что не передаётся

Имя, телефон, e-mail и адрес посетителя в GA4 не отправляются: `analytics.js` удаляет параметры name, phone, email, address, а событие generate_lead содержит только вид уборки, площадь и сумму.

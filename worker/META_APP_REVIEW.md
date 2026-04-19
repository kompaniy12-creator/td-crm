# Meta App Review — сценарий прохождения

Это пошаговая инструкция для получения production-доступа у Meta для
TD CRM Connector. Без ревью подключаться могут только `testers/admins`
приложения — этого достаточно для пилота, но не для всех клиентов.

Процесс занимает 3–14 дней. Ревью подают от имени **TD CONSULTING GROUP**
в Business Manager (роль **Admin**).

---

## Какие permissions запрашивать

| Permission | Зачем |
|---|---|
| `pages_show_list` | Показать менеджеру список его страниц в OAuth-диалоге |
| `pages_messaging` | Читать/отправлять DMs в Messenger |
| `pages_manage_metadata` | Подписать страницу на наш webhook (`subscribed_apps`) |
| `pages_read_engagement` | Получать имя/профиль собеседника |
| `instagram_basic` | Видеть IG-аккаунт, привязанный к странице |
| `instagram_manage_messages` | Читать/отправлять Instagram Direct |
| `business_management` | (опционально) Показать список Business Portfolio |

Всё остальное (`pages_manage_engagement`, `instagram_manage_comments` и т.д.)
запрашивать **не надо** — ревьюер отклонит, если не сможете
продемонстрировать использование.

---

## Что подготовить до подачи

### 1. Privacy Policy

Разместите страницу `https://td-consulting-group.com/privacy` (или любой
публичный URL). Шаблон — в конце этого файла. Обязательно должны быть:

- Какие данные собираете (имя FB-пользователя, текст сообщений, timestamps).
- Для чего используете (коммуникация с клиентом в рамках юруслуг).
- Как хранятся (Supabase EU регион, шифрование at rest).
- Как удалить данные (email на `privacy@td-consulting-group.com` + инструмент
  Meta «Data Deletion Callback URL»).
- Срок хранения (пока клиент остаётся клиентом + 3 года по GDPR).

### 2. Data Deletion Request URL

В `App Dashboard → Settings → Basic → Data Deletion Instructions URL`:
`https://td-consulting-group.com/data-deletion` — страница с инструкцией
«напишите на privacy@td-consulting-group.com, удалим в течение 30 дней».

Альтернативно — Callback URL: `https://<worker>/webhooks/facebook/deletion`
(сейчас не реализован, добавим если Meta потребует).

### 3. Verified Business

- **Business Manager → Security Center → Start Verification**.
- Загрузить KRS / NIP выписку TD CONSULTING GROUP.
- Meta верифицирует 1–3 дня.
- Без этого Facebook Login for Business не выйдет из Development mode.

### 4. App Icon & About

- Иконка 1024×1024, логотип TD Group на белом фоне.
- Категория: **Business and Pages**.
- Display name: `TD CRM Connector`.
- App Domain: `td-consulting-group.com`.

---

## Видео-демонстрация (по одному на permission)

Meta требует screencast, где видно:
1. Пользователь (менеджер TD Group) открывает CRM.
2. Жмёт «Подключить Facebook».
3. Проходит Facebook Login.
4. Выбирает страницу.
5. Возвращается в CRM, видит статус «Активно».
6. С телефона отправляет сообщение на эту страницу в Messenger.
7. Сообщение появляется в CRM в реальном времени.
8. Менеджер отвечает — ответ приходит клиенту в Messenger.

Для Instagram — тот же сценарий, только с Instagram Business-аккаунтом.

**Сценарий записи (2 минуты):**

```
00:00 — "Hello, this is TD CRM Connector submission for pages_messaging."
00:05 — показ главной страницы CRM, вход как admin
00:15 — клик на «Интеграции» → карточка Facebook Messenger
00:25 — клик «Подключить» → модалка → «Войти через Facebook»
00:35 — Facebook Login popup, выбор страницы "TD Group PL"
00:50 — возврат в CRM, статус «connecting» → «active»
01:00 — переход в раздел «Чаты», он пустой
01:10 — на телефоне: открываем Messenger, пишем на страницу "привет"
01:20 — в CRM сообщение появилось за секунду
01:30 — печатаем ответ "добрый день, чем помочь?" → отправить
01:40 — на телефоне приходит ответ
01:50 — конец, "thank you for review"
```

Запишите OBS / QuickTime, загрузите в YouTube **unlisted**, ссылку — в
App Review submission.

---

## Форма заявки

В каждом permission-реквесте Meta просит:

**How will your app use this permission?**

```
TD CRM Connector is an internal communication tool used by TD CONSULTING
GROUP (a legal services firm in Poland, NIP XXXXX) to manage client
conversations across multiple messaging channels. Our managers need to
reply to prospective clients who contact us via our Facebook Page
Messenger, alongside Telegram, WhatsApp and email, from a single CRM
interface rather than switching between apps.

We use pages_messaging to (1) read new messages sent to our Page and (2)
send replies from the Page to users who initiated the conversation,
within the 24-hour messaging window allowed by Meta's Messaging Policy.
No promotional/broadcast messaging is performed — only 1:1 replies to
user-initiated conversations.
```

Для `instagram_manage_messages`:

```
Same use case for our Instagram Business account linked to the Facebook
Page. Clients who DM our Instagram are answered from the same CRM
workspace. Only human-initiated 1:1 replies to user-initiated DMs.
```

Для `pages_manage_metadata`:

```
Required to call /page/subscribed_apps to subscribe our Meta app to the
page's messaging webhooks. Without this permission, the app cannot
receive realtime message events.
```

---

## Порядок подачи

1. **App Dashboard → App Review → Permissions and Features**.
2. Для каждого permission → **Request** → заполнить форму выше + прикрепить
   видео.
3. Submit. Ожидание 3–14 дней.
4. Если отказ — Meta пришлёт конкретную причину. Частые:
   - «Video doesn't show permission being used» — перезапишите, чтобы было
     явно видно, что именно сообщение приходит/отправляется.
   - «App is in development mode» — сначала пройдите Business Verification.
   - «Privacy Policy not accessible» — проверьте URL, не должен быть за paywall.

---

## Шаблон Privacy Policy

Разместите на `https://td-consulting-group.com/privacy` (замените
реквизиты и контакты):

```markdown
# Privacy Policy

**Effective date:** 2025-04-19
**Controller:** TD CONSULTING GROUP Sp. z o.o., NIP XXXXXXXXXX,
ul. …, Warszawa, Poland. Contact: privacy@td-consulting-group.com.

## What we collect

When you contact TD CONSULTING GROUP via our Facebook Page, Instagram,
WhatsApp, Telegram, email, or our website chat widget, we collect:

- Your public profile name and avatar on the platform.
- The text, images, and metadata (timestamps) of the messages you send us.
- A platform-specific identifier used to address replies back to you.

We do **not** collect passwords, payment data, or data from your other
contacts.

## How we use it

- To reply to your enquiry about legal services.
- To keep a case history so any of our legal advisors can pick up your
  case without re-asking the same questions.
- To comply with Polish legal-services record-keeping obligations.

## Storage

Data is stored in Supabase (EU region, encrypted at rest). Access is
restricted to authorised TD Group staff. We never sell or share data
with third parties except (a) Meta, Google, and other messaging
platforms that carry your message to us, (b) tax/legal authorities when
required by law.

## Retention

We keep conversation history for as long as you remain a client, plus
3 years, after which data is permanently deleted.

## Your rights (GDPR)

You may at any time:

- Request a copy of your data.
- Ask us to correct or delete it (`privacy@td-consulting-group.com`).
- Withdraw consent (we will stop processing immediately).
- Complain to UODO (the Polish data-protection authority).

## Data deletion via Meta

To remove data collected through Facebook/Instagram specifically, email
`privacy@td-consulting-group.com` with subject line "Meta data deletion".
We will remove your data within 30 days and confirm by reply.
```

---

## Пока ревью идёт

Добавьте себя и менеджеров в **App Roles → Administrators / Testers**
(App Dashboard → Roles). Они смогут подключать свои FB/IG аккаунты
немедленно, без ожидания ревью. Этого достаточно для пилота на
внутренней команде.

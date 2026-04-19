# td-crm worker

Бэкенд-воркер для модуля «Чаты». Держит долгоживущие сокеты мессенджеров,
пишет входящие сообщения в Supabase, отправляет исходящие из очереди.

Работает со схемой миграций `007_chats_and_integrations.sql` и
`008_integrations_flows.sql`.

## Что умеет

| Канал               | Вход | Выход | Реализация                      |
|---------------------|------|-------|---------------------------------|
| `telegram_bot`      | да   | да    | `node-telegram-bot-api` (long-polling) |
| `telegram_personal` | да   | да    | `telegram` (gramjs, MTProto)    |
| `whatsapp_qr`       | да   | да    | `@whiskeysockets/baileys`       |
| `gmail`             | да   | да    | `googleapis` (history polling)  |
| остальные           | —    | —     | заглушки, расширяются по мере   |

## Как запустить локально

```bash
cd worker
cp .env.example .env
# заполнить SUPABASE_* и (для Gmail) GOOGLE_*
npm install
npm run dev
```

## Деплой

**Полный чек-лист в [DEPLOY.md](./DEPLOY.md).** Кратко:

## Деплой на Railway

1. Новый проект → **Deploy from GitHub repo** → подпапка `worker/`.
2. Railway подхватит `railway.json` + `Dockerfile`.
3. В `Variables` задать всё из `.env.example`.
4. Volume: смонтировать `/app/.data` (храним Baileys-creds и gramjs-сессии).

Любой другой хостинг с Docker работает аналогично (Fly.io, Render, VPS).

## Как подключаются каналы (кратко)

- **Telegram Bot**: пользователь создаёт бота у `@BotFather`, вставляет токен
  в форме «Подключить». Воркер поднимает long-polling.
- **Telegram personal**: в UI вводится номер телефона и `api_id`/`api_hash`
  с [my.telegram.org](https://my.telegram.org). Воркер запрашивает код,
  UI показывает инпут, при необходимости 2FA — второй шаг. Сессия хранится
  в `credentials.session`.
- **WhatsApp QR**: воркер открывает клиент Baileys, публикует QR-картинку в
  `auth_state.qr_code_data_url`. Пользователь сканирует с телефона.
- **Gmail**: фронтенд уводит на Google OAuth, возвращает `code` в колбэк
  `/oauth/google`, пишет в `auth_state.oauth_code`. Воркер видит это и
  обменивает код на токены через `GOOGLE_CLIENT_SECRET` (который живёт
  только здесь).

## Безопасность

- Используется **service role key** — воркер обходит RLS. Доступ к нему
  должен быть ТОЛЬКО у этого процесса.
- `credentials` никогда не отдаются во фронт (RLS это и так запрещает
  обычным пользователям).

## TODO

- `instagram` / `facebook_messenger` по логину+паролю — высокий риск бана,
  нужны неофициальные библиотеки (`instagram-private-api`, fb-messenger).
- `whatsapp_cloud` и webhook-каналы удобнее перенести в Supabase Edge
  Functions.
- `email_imap` через `imapflow` + `nodemailer`.

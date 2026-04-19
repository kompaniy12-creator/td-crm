# Deploy td-crm worker

Пошаговый чек-лист. Делается один раз. После деплоя менеджеры подключают
Facebook / Instagram / Gmail из UI в один клик.

## 0. Что понадобится

- Платёжная карта (Railway — ~$5/мес, первый месяц бесплатно).
- Доступ к GitHub-репозиторию `kompaniy12-creator/td-crm`.
- Ключи Supabase (URL + `service_role`) — уже есть в `.env.local` этого репо.
- Аккаунт на [developers.facebook.com](https://developers.facebook.com/) и
  [Google Cloud Console](https://console.cloud.google.com/) — пока не обязателен,
  нужен будет на шаге 4.

---

## 1. Deploy на Railway

1. Откройте <https://railway.com/new>.
2. **Deploy from GitHub repo** → выберите `kompaniy12-creator/td-crm`.
3. После создания сервиса:
   - **Settings → Service → Root Directory**: `worker`.
   - **Settings → Service → Build** должен автоматически подхватить `Dockerfile`
     (Railway читает `worker/railway.json`).
4. **Variables → Raw Editor**, вставьте:

   ```env
   SUPABASE_URL=https://dpfxwkxpzqqjtmgqwozw.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<скопировать из .env.local>
   POLL_INTERVAL_MS=3000
   OUTBOUND_INTERVAL_MS=2000
   GMAIL_POLL_INTERVAL_MS=60000
   WORKER_DATA_DIR=/app/.data
   LOG_LEVEL=info
   ```

   `GOOGLE_*` и `FACEBOOK_VERIFY_TOKEN` не нужны — секреты читаются из
   таблицы `oauth_apps` (настраивается в CRM).

5. **Settings → Networking → Generate Domain** — Railway выдаст публичный URL
   вида `td-crm-worker-production.up.railway.app`. Скопируйте.
6. Вернитесь в **Variables**, добавьте:
   ```env
   PUBLIC_WEBHOOK_URL=https://td-crm-worker-production.up.railway.app
   ```
7. **Settings → Volumes** → **+ New Volume**:
   - Mount path: `/app/.data`
   - Size: 1 GiB (для Baileys-creds и gramjs-сессий)
8. **Deployments** — подождите первый build (~2 мин), статус должен стать
   🟢 Success. В логах увидите:
   ```
   td-crm worker starting
   webhook server listening { port: 8080 }
   ```
9. Проверка здоровья: в браузере откройте
   `https://<ваш-домен>/healthz` → должно вернуть `ok`.

---

## 2. Настройка OAuth-приложений в CRM

Откройте CRM → **Интеграции** (только админ видит раздел «OAuth-приложения»).

### Google (Gmail)

1. <https://console.cloud.google.com/apis/credentials> → **Create Credentials → OAuth client ID**.
2. Application type = **Web application**, имя «TD CRM Gmail».
3. **Authorized redirect URIs** — вставьте то, что CRM показывает рядом с
   полем «Redirect URI» (например `https://kompaniy12-creator.github.io/td-crm/oauth/google`).
4. Сохраните, скопируйте **Client ID** и **Client Secret** в CRM → «Сохранить».

### Facebook / Instagram

1. <https://developers.facebook.com/apps/> → **Create App** → тип **Business**.
2. Имя «TD CRM Connector», email поддержки — ваш.
3. В созданном приложении добавьте два продукта:
   - **Facebook Login for Business** → Quick Start.
   - **Messenger** → Setup.
4. **Facebook Login for Business → Settings**:
   - Valid OAuth Redirect URIs:
     `https://kompaniy12-creator.github.io/td-crm/oauth/facebook`
5. В CRM «OAuth-приложения → Facebook / Instagram»:
   - Client ID / Client Secret — из **App Settings → Basic** в Meta.
   - **Public Webhook URL воркера** — `https://td-crm-worker-production.up.railway.app`
     (ваш Railway-домен).
   - **Verify Token** — любая длинная строка, например
     `td-crm-meta-hook-2025-PWIEF83hf` (тот же токен потом впишете в Meta).
   - Сохранить.
6. Теперь Webhook в Meta:
   - **App Dashboard → Webhooks → Add Product → Subscribe**.
   - Object = **Page**.
   - Callback URL = `https://td-crm-worker-production.up.railway.app/webhooks/facebook`.
   - Verify Token = та же строка, что в CRM.
   - Нажмите **Verify and Save** — должно написать «Verified».
   - **Subscribe to fields**: `messages`, `messaging_postbacks`, `message_reactions`, `message_reads`.
   - Повторите для Object = **Instagram** (Callback URL тот же), поля
     `messages`, `messaging_postbacks`, `message_reactions`.

---

## 3. App Review в Meta (обязательно для production)

Без ревью Messenger/Instagram работают только с аккаунтами, добавленными
в **App Roles → Testers/Admins**. Для продакшена:

См. `worker/META_APP_REVIEW.md` — там отдельный подробный сценарий,
сценарий видео и шаблон Privacy Policy.

На время ревью в CRM можно спокойно подключать **владельца приложения
и добавленных testers** — у них всё работает сразу.

---

## 4. Проверка end-to-end

1. В CRM → Интеграции → Facebook Messenger → **Подключить**.
2. Откроется Facebook Login → выберите Business Portfolio → страницу → Continue.
3. Вернётесь в CRM, статус интеграции станет `connecting` → `active`.
4. С телефона напишите в Messenger на вашу страницу «тест».
5. В CRM → Чаты — сообщение должно появиться **в течение 2 секунд**
   (через webhook, не polling).
6. Отправьте ответ из CRM — должен прийти клиенту в Messenger.

Если сообщение не пришло через 30 сек — читайте логи воркера:
Railway → Service → Deployments → View Logs.

---

## Обновление воркера

Любой `git push` в `main` автоматически передеплоит Railway.

## Откат

Railway → Deployments → выбрать предыдущий → **Redeploy**.

## Диагностика

| Симптом | Что смотреть |
|---|---|
| `/healthz` не отвечает | Railway Deployments → логи, скорее всего упал из-за env |
| Webhook не верифицируется | Verify Token в CRM ≠ Verify Token в Meta |
| Сообщения приходят с задержкой 5 мин | Webhook не подписан — сообщения приходят только через safety-poll. Проверьте Meta → Webhooks → Page → что подписаны поля `messages` |
| `SIGNATURE invalid` в логах | В Meta App изменили Client Secret — обновите в CRM |
| Gmail не синхронится | `last_history_id` мог устареть (>7 дней без активности). Удалите интеграцию и подключите заново |

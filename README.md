# air-lohas-controller-server

パナソニックホームズの全館空調システム「エアロハス」の制御プログラム。温度設定をSQLiteバックエンドのCloudflare Durable Objectに書き込むWebアプリケーション。

書き込まれた設定は[air-lohas-controller-client](https://github.com/unhurried/air-lohas-controller-client)によって読み込まれ、エアロハス本体と通信して制御を行う。

## 開発手順

### ランタイム・開発ツール

- Node.js 26 LTS（26.13.0以上、27未満）。`.node-version`、Dev Container、CIで使用するバージョンを揃える。
- TypeScriptは6.0系、ESLintは9系を使用する。`eslint-config-next`が依存するTypeScript ESLintとReact関連プラグインの対応範囲に合わせる。
- 依存ライブラリは`npm ci`で`package-lock.json`のバージョンを再現する。
- 更新時は`.npmrc`の`min-release-age=7`に従い、公開から7日以上経過した安定版を使用する。

### 開発コマンド

| コマンド | 用途 |
|---------|------|
| `npm run dev` | ローカル開発サーバー起動 |
| `npm run build` | Next.jsプロダクションビルド |
| `npm run lint` | ESLint実行 |
| `npm run test:e2e` | Playwright E2Eテスト実行（devサーバーをport 3099で自動起動） |
| `npm run cf:build` | Cloudflare Workers向けビルド（OpenNext） |
| `npm run cf:preview` | Cloudflareローカルプレビュー |
| `npm run cf:deploy:stg` | ステージング環境へデプロイ |
| `npm run cf:deploy:prod` | 本番環境へデプロイ |

### ローカル環境での起動（開発モード）

- `.env.example` をコピーして `.env.local` を作成し、`ACCESS_SECRET` を設定する。
  
  - `ACCESS_SECRET` はページのアクセス制御のための鍵となる。アプリケーションにアクセスする際には、下記のように鍵をクエリパラメータで渡す必要がある。
  `https://<your-domain>/?key=<ACCESS_SECRET>` 
  
- 下記のコマンドでアプリケーションを開発モードで起動する。

  ```bash
  npm ci
  npm run dev
  ```

## Cloudflareへのデプロイ

### デプロイ先環境

| 環境 | Worker名 | 用途 |
|-----|---------|------|
| stg | ac-stg1 | ステージング環境 |
| prod | ac | 本番環境 |

### デプロイ手順

* (初回のみ) Cloudflarにログインする。

  ```
  wrangler login
  ```

* データストアはSQLiteバックエンドのDurable Object（`AirconStateDO`）を使用する。`wrangler.jsonc`の各環境に`durable_objects.bindings`と`migrations`が定義済みで、`npm run cf:deploy:stg`/`cf:deploy:prod`時にマイグレーションが自動適用されるため、事前の手動プロビジョニングは不要。

* 鍵を環境ごとに Secrets に登録する。

  ```bash
  # ステージング環境用
  npx wrangler secret put ACCESS_SECRET --env stg

  # 本番環境用
  npx wrangler secret put ACCESS_SECRET --env prod
  ```

* Cloudflare Workers にアプリケーションをデプロイする。

  ```bash
  # ステージング環境へデプロイ
  npm run cf:deploy:stg

  # 本番環境へデプロイ
  npm run cf:deploy:prod
  ```

## アーキテクチャ

### 技術スタック

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Cloudflare Workers** + **Durable Objects**（SQLiteバックエンド、OpenNext経由でデプロイ）
- **Tailwind CSS v4**
- ユニットテスト（Vitest、`npm run test:unit`）＋ E2Eテスト（Playwright、`npm run test:e2e`）

### データフロー

```
ブラウザ → Server Actions ┐
                          ├→ Durable Object (SQLite)
GET/PUT /api/state ───────┘         ↑
   ↑                        Cronジョブ（毎分）が予約を適用
air-lohas-controller-client → エアコン実機
```

`air-lohas-controller-client`はDurable Objectを直接読めないため、`/api/state`（Bearerトークン認証）を介して状態を読み書きする（[クライアント向けAPI](#クライアント向けapiapistate)参照）。

### ページ構成

- `/` — 現在のエアコン設定（運転モード・基準温度・部屋別オフセット）
- `/reservations` — 予約設定（時刻指定で設定を自動適用）

### 主要モジュール

- `src/middleware.ts` — アクセス制御（`ACCESS_SECRET`クエリパラメータまたはCookieで認証、8時間TTL）
- `src/lib/aircon-settings.ts` — Durable Objectスタブ経由の読み書き。DO未接続時（`next dev`/E2E）はインメモリフォールバック
- `src/lib/aircon-state-do.ts` — SQLiteバックエンドのDurable Objectクラス（`AirconStateDO`）。SQLの読み書きとアトミックなread-modify-writeを担う
- `src/lib/aircon-normalize.ts` — 状態の正規化・clamp・デフォルト（純粋関数）
- `src/lib/aircon-cron.ts` — 予約適用の判定ロジック（純粋関数）
- `src/lib/aircon-mode.ts` — 運転モードのヘルパー（ラベル取得・正規化）
- `src/lib/aircon-types.ts` — 型定義・共有定数
- `src/app/api/state/route.ts` — 外部クライアント向けの設定API（GET/PUT、Bearerトークン認証、現在設定のみ）
- `worker.mjs` — Cloudflare Workerエントリポイント（fetch + cronスケジュールハンドラ）。`AirconStateDO`をエクスポートする

### クライアント向けAPI（`/api/state`）

Durable Objectのデータは外部から直接読めないため、旧構成で`air-lohas-controller-client`が直接読み書きしていたKVの代替として、現在設定を読み書きするHTTP APIを提供する。読み書きとも**現在設定（`AirconSettings`）のみ**を対象とし、予約はクライアントからは扱わない（サーバのCron/UIが管理）。

- 認証: `Authorization: Bearer <ACCESS_SECRET>` ヘッダ（`ACCESS_SECRET`はブラウザ用アクセス鍵と共通）。未認証・不正時は`401`（`WWW-Authenticate: Bearer`）。このルートは`middleware`のクエリ/Cookie認証から除外され、ルート側でBearer認証する。
- `GET /api/state` — 現在設定（`{ mode, baseTemperature, roomOffsets, updatedAt }`）をJSONで返す。
- `PUT /api/state` — 現在設定を更新する。ボディは`AirconSettings`（`{ mode, baseTemperature, roomOffsets }`）。正規化・clampして保存し、`updatedAt`はサーバ側で更新する。不正なJSONは`400`。

```bash
# 読み取り（設定のみ）
curl -H "Authorization: Bearer $ACCESS_SECRET" https://<your-domain>/api/state

# 書き込み（設定のみ）
curl -X PUT -H "Authorization: Bearer $ACCESS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"heat","baseTemperature":24,"roomOffsets":{"リビング":0,"寝室":0,"書斎":0,"玄関":0,"洗面室":0,"子供部屋1":0,"子供部屋2":0,"ホール2":0}}' \
  https://<your-domain>/api/state
```

### データストア構造（SQLite）

Durable Object内のSQLiteに、正規化した2テーブルで永続化する。

```sql
-- 現在設定（1行のみ）
CREATE TABLE current_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT, base_temperature INTEGER,
  room_offsets TEXT /* JSON */, updated_at TEXT
);
-- 予約（行ごと）
CREATE TABLE reservations (
  id TEXT PRIMARY KEY, time TEXT,
  enabled INTEGER, settings TEXT /* JSON */,
  last_applied_date TEXT
);
```

アプリケーション層では従来どおり `{ currentSettings, reservations }`（`AirconState`）として扱う。

## 環境変数

`.env.example`を`.env.local`にコピーして設定:
- `ACCESS_SECRET` — アプリアクセス用シークレットキー（必須）

Cloudflareデプロイ時は`wrangler secret put ACCESS_SECRET --env stg`（または`--env prod`）で設定する。

# air-lohas-controller-server

パナソニックホームズの全館空調システム「エアロハス」の制御プログラム。温度設定をCloudflare Durable Objectsに書き込むWebアプリケーション。

Cloudflare Durable Objectsに書き込まれた設定は[air-lohas-controller-client](https://github.com/unhurried/air-lohas-controller-client)によって読み込まれ、エアロハス本体と通信して制御を行う。

## 開発手順

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
  npm install
  npm run dev
  ```

## Cloudflareへのデプロイ

### デプロイ先環境

| 環境 | Worker名 | 用途 |
|-----|---------|------|
| stg | ac-stg | ステージング環境 |
| prod | ac-prod | 本番環境 |

### デプロイ手順

* (初回のみ) Cloudflarにログインする。

  ```
  wrangler login
  ```

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

  * Durable Objects はデプロイ時に自動的に作成されるため、手動でのリソース作成は不要。

## アーキテクチャ

### 技術スタック

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Cloudflare Workers** + **Durable Objects** (OpenNext経由でデプロイ)
- **Tailwind CSS v4**
- ユニットテストフレームワークは未導入。E2Eテストのみ（Playwright）

### データフロー

```
ブラウザ → Server Actions → Cloudflare Durable Objects ← air-lohas-controller-client → エアコン実機
                                     ↑
                            Cronジョブ（毎分）が予約を適用
```

### ページ構成

- `/` — 現在のエアコン設定（運転モード・基準温度・部屋別オフセット）
- `/reservations` — 予約設定（時刻指定で設定を自動適用）

### 主要モジュール

- `src/middleware.ts` — アクセス制御（`ACCESS_SECRET`クエリパラメータまたはCookieで認証、8時間TTL）
- `src/lib/aircon-settings.ts` — Durable Objectsの読み書き・バリデーション・正規化。DO未接続時はインメモリフォールバック
- `src/lib/aircon-mode.ts` — 運転モードのヘルパー（ラベル取得・正規化）
- `src/lib/aircon-types.ts` — 型定義
- `worker.mjs` — Cloudflare Workerエントリポイント（fetch + cronスケジュールハンドラ + Durable Objectクラス定義）

### データ構造（Durable Objects Storage）

```typescript
{
  currentSettings: { mode, baseTemperature, roomOffsets, updatedAt },
  reservations: [{ id, time, enabled, settings, lastAppliedDate? }]
}
```

## 環境変数

`.env.example`を`.env.local`にコピーして設定:
- `ACCESS_SECRET` — アプリアクセス用シークレットキー（必須）

Cloudflareデプロイ時は`wrangler secret put ACCESS_SECRET --env stg`（または`--env prod`）で設定する。
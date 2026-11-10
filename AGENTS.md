# AGENTS.md

## プロジェクト概要・開発手順

README.mdを参照

## 実装ルール

### 動作確認

- 実装完了後に正しく動作しているか動作確認すること。
- 実装完了後に単体テスト（`npm run test:unit`）・E2Eテスト（`npm run test:e2e`）・型チェック（`npx tsc --noEmit`）・リント（`npm run lint`）が通過するか確認すること。
- `worker.mjs`（Cronハンドラ）を変更した場合は、`npx wrangler deploy --env stg --dry-run` でバンドルが壊れていないか確認すること（実際のデプロイは行わない）。
- 機能変更によってテストコードのメンテナンスが必要な場合は実施すること。

### コード品質

- ファイルを適切に分割して、コードの保守性を高めること。
- 必要に応じてリファクタリングをすること。

## アーキテクチャ上の注意点

### `worker.mjs`と`src/lib/`の関係

- `worker.mjs`はCloudflare Workersのエントリポイント（`wrangler.jsonc`の`main`）で、`wrangler`が直接esbuildでバンドルする。Next.js/OpenNextのビルド成果物（`.open-next/worker.js`）とは別に、`src/lib/*.ts`を**直接importできる**（TypeScriptのまま、ビルド不要）。
- 予約適用のCronロジック（`applyDueReservation`）や状態の正規化（`normalizeState`）は`src/lib/aircon-cron.ts` / `src/lib/aircon-settings.ts`にのみ実装する。**`worker.mjs`側にロジックを再実装・コピーしないこと。** 過去にここが二重実装になっており、片方だけ修正されてズレるリスクがあったため、共通化した経緯がある。
- `worker.mjs`は「KVの読み書き・ログ出力」など、Cloudflareの`env`に依存する薄いラッパーの役割に留めること。
- `src/lib/aircon-cron.ts`はCloudflare固有APIに依存しないPure関数として保つこと（Vitestで単体テストするため）。

### テスト方針

- ユニットテスト対象: `src/lib/`配下の純粋関数（正規化・clamp・Cron適用ロジックなど）。`*.test.ts`として同じディレクトリに置き、Vitest（`vitest.config.ts`、`npm run test:unit`）で実行する。
- E2Eテスト対象: ブラウザ経由のユーザーフロー（`e2e/`、Playwright、`npm run test:e2e`）。
- 温度・モード・予約適用など、実機の空調挙動に直結するロジックを変更した場合は、必ずユニットテストで境界値（複数予約が同時刻に該当する場合、無効化された予約、当日適用済みの予約など）を確認すること。

### デプロイ

- `master`へのpushで自動的にstg環境へデプロイされる（`.github/workflows/deploy.yml`）。prod環境へは`v*`タグのpushでのみデプロイされる。
- ローカルから`npm run cf:deploy:stg` / `npm run cf:deploy:prod`を実行すると実際の家庭内の空調制御に影響するため、ユーザーの明示的な指示なしに実行しないこと。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

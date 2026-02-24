# air-lohas-controller-server

パナソニックホームズの全館空調システム「エアロハス」の制御プログラム。温度設定をCloudflare Workers KVに書き込むWebアプリケーション。

Cloudflare Workers KVに書き込まれた設定は[air-lohas-controller-client](https://github.com/unhurried/air-lohas-controller-client)によって読み込まれ、エアロハス本体と通信して制御を行う。

## 注意事項

エアロハスは本プロジェクトのような使い方を正式にサポートしていないため、試す場合は自己責任で行うこと。また、エアロハス本体との通信方式は公開されていないため、具体的な通信ロジックはスケルトンコードとしている。

## 開発手順

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

* (初回のみ) Cloudflarにログインする。

  ```
  wrangler login
  ```

* Cloudflare Workers KVを作成する。

  ```bash
  npx wrangler kv namespace create AC_SETTINGS_KV
  ```

  * 出力された namespace ID を `wrangler.jsonc` の `kv_namespaces[0].id` に設定する。

* 鍵をSecretsに登録する。

  ```bash
  wrangler secret put ACCESS_SECRET
  ```

* Cloudflare Workersにアプリケーションをデプロイする。

  ```bash
  npm run cf:deploy
  ```

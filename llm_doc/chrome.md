# Chrome連携（Claude in Chrome）

## 制約
- **拡張は `file://` のページを一切扱えない**（2026-08-29 実測）。
  `navigate` だけでなく `javascript_tool` / `read_page` / `get_page_text` /
  `read_console_messages` / スクリーンショットも、すべて同じ文言で拒否される:
  `Can't interact with browser-internal or unparseable URLs. Navigate to a web page first.`
  **ユーザーが手で `file://` を開いても変わらない。** タブは見えるが操作できない
- `javascript_tool`の`window.location.href`でも`file://`遷移不可
- `chrome://newtab`等のChrome内部ページはスクリーンショット取得不可

## 手順（UIを実機で見るとき）

`file://` が使えないので、ローカルにHTTPで出して確認する。

1. `python -m http.server 8931 --bind 127.0.0.1` をリポジトリ直下で起動
2. `tabs_context_mcp`で`createIfEmpty:true`を指定してタブグループ作成
3. `navigate` で `http://127.0.0.1:8931/index.html`
4. 確認が終わったらサーバを落とす

**この方法で見えないもの**（`http://` と `file://` で挙動が変わる範囲）:

- `file://` 固有の読み込み制約（`.mjs`、`fetch`、Web Worker、CORS）
- ServiceWorkerは登録に失敗する。`python -m http.server` が `.js` を
  `text/plain` で返すため。**アプリ側の不具合ではない**ので、コンソールのこのエラーは無視してよい
- **保存領域が別**。IndexedDB・localStorageはオリジン単位なので、
  `file://` で使っているプロジェクトや設定は見えない。逆に、ここで書いたものは本番に影響しない

DOM・CSS・イベント・ドロップダウンの中身はプロトコルに依存しないので、
UIの確認はこの方法で足りる。

## 接続できない場合
`tabs_context_mcp`に接続できない場合はユーザーに`/claude`コマンドの実行を求める。

# コーディング規約詳細

## 変数名・プロパティ名
- 変数名: camelCase（例: `var promptId=response.prompt_id;`）
- APIレスポンスのプロパティ名はAPI仕様のまま（camelCase変換しない）

## コメント
- コード内コメントは基本不要
- JSファイル先頭にファイル概要のみ記載
- JSDoc不要

## ログ
- `console.log`禁止 → `js/core/logger.js`のSimpleLoggerを使用
- ロガーは`js/core/logger.js`に集約定義（各ファイルで`new SimpleLogger()`しない）
- 新規ロガー追加時は`logger.js`末尾に`const xxxLogger=SimpleLogger('xxx',LogLevel.WARN);`を追加
- レベル: TRACE, DEBUG, INFO, WARN, ERROR, SILENT（デフォルトWARN）
- 使用例: `logger.debug("msg");`, `comfyuiLogger.error("msg");`

## 非表示タブでの待ち
- `await new Promise(requestAnimationFrame)`を直接書かない。**非表示タブ（裏タブ・最小化・
  他ウィンドウで完全に隠れた状態）ではrequestAnimationFrameが一度も発火せず、そこで
  一括処理が永久に止まる。** `waitNextFrame()`（`js/core/util/js-util.js`）を使う。
  隠れている間は描画自体が不要なので`MessageChannel`で次のタスクへ回す
- `setTimeout`のポーリングも非表示タブでは1秒間隔まで、5分以上隠れていると1分間隔まで
  間引かれる。完了を待つ用途では通知で起こす仕組みを用意する（例: `TaskQueue.whenIdle()`）
- 経過時間でタイムアウトさせるループは、隠れていた時間を差し引く。実時間で測ると
  処理は終わっているのに誤ってタイムアウトする（`btmWaitForPageReady()`）
- WebSocketの受信は間引かれないため、ComfyUIの生成完了待ちは影響を受けない

## フォーマットスクリプト
```bash
npm run format
```

削除対象:
- 行頭インデント、行末空白
- 演算子周りのスペース
- カンマ/セミコロン後のスペース
- 括弧内側のスペース

保持対象:
- 文字列リテラル内のスペース
- コメント内のスペース
- 改行

# AI生成システム

## アーキテクチャ
```
ai-management.js（ルーター）
├─ provider/
│   ├─ ai-provider.js（基底クラス。接続状態の通知処理もここ）
│   ├─ local-sdwebui-provider.js
│   ├─ local-comfyui-provider.js
│   ├─ runpod-comfyui-provider.js
│   ├─ cloud-image-provider.js（クラウド画像生成の共通処理）
│   ├─ falai-provider.js
│   ├─ google-image-provider.js（Google Nano Banana）
│   ├─ llm-provider.js（LLM基底クラス。OpenAI互換chat/completions）
│   ├─ grok-provider.js
│   ├─ ollama-provider.js
│   └─ provider-registry.js（プロバイダ登録・ロール割り当て）
├─ queue/
│   ├─ task-queue.js（並行実行制御）
│   └─ generation-task-manager.js（aiTaskMap）
├─ comfyui/（ワークフロー、エディタ、v2）
├─ sdwebui/（設定、API呼び出し）
├─ inpainting/（マスクエディタ、ワークフロー）
├─ angle/（カメラアングルエディタ、Three.js使用）
├─ role/（ロール割り当てUI）
├─ ui/
│   ├─ unified-settings-window.js（APIサービス設定）
│   ├─ model-settings-window.js（モデル・ワークフロー設定フローティングウインドウ）
│   └─ ai-ui-util.js
├─ reference/（リファレンス画像。シート管理・収集・ウインドウ）
├─ prompt/auto/（自動プロンプト生成）
├─ prompt/panel-composition.js（役割→構図タグ、SDXLバケット）
├─ prompt/llm/llm-story-service.js, -ui.js（ストーリー→コマのプロンプト）
└─ prompt/prompt-apply.js（コマへの書き込みとページ送り）
```

## プロバイダ基底クラス（ai-provider.js）
```javascript
class AIProvider{
  async executeT2I(layer,spinnerId)
  async executeI2I(layer,spinnerId)
  async executeRembg(layer,spinnerId)
  async executeUpscale(layer,spinnerId)
  async executeInpaint(layer,spinnerId)
  async executeAngle(layer,spinnerId,anglePrompt)
  supportsDetachedT2I()                       // キャンバスへ置かない生成に対応するか
  async executeDetachedT2I(request,spinnerId) // {prompt,width,height} -> dataURL|null
  async fetchModels()
  async fetchSamplers()
  async fetchUpscalers()
}
```

接続状態の通知（`setConnectionNotice()` / `getStatusReason()` / `classifyFailure()` /
`checkModelsEndpointHeartbeat()`）は基底クラスに置いてある。通知欄とチップのtitleで同じ文言を出すため、
プロバイダ側で文言を組み立てない。使うのは`getModelsUrl()` `_listHeaders()` `getNoticeElementId()`
`getHelpUrl()`を返すプロバイダだけ。

## クラウド画像生成の共通処理（cloud-image-provider.js）
Fal.aiとGoogle Nano Bananaはどちらも「キューへ入れる→生成タスクを登録→結果をコマへ置く」が同じなので、
`CloudImageProvider`に寄せてある。サービスごとに書くのはリクエストの組み立てと送信だけ。

```javascript
class CloudImageProvider extends AIProvider{
  getQueue()                       // このプロバイダが使うTaskQueue
  getQueueName()                   // spinner.jsの_getQueueByNameが引く名前
  async _generate(modelId,input)   // 送信して生成結果をfabric.Imageで返す
  translateError(error)            // サービス固有の失敗理由が分かるときだけ上書き
  _requireModelId(role,spinnerId,label)
  async _execute(layer,spinnerId,Type,modelId,buildInput)
}
```

- キュー名を増やしたら`spinner.js`の`_getQueueByName()`にも足す。足さないと待機中の取消が効かない
- `_execute()`の中でしか`buildInput()`を呼ばない。キューが空くまで送信内容を確定させないため
- `_executeDetached()`はキャンバスへ置かない生成。`_execute()`から配置（`_placeResult()`）と
  生成タスク登録（ページ復帰用）を抜いた形で、dataURLを返す。設定資料をその場で作る経路で使う
  （→`llm_doc/reference-image.md`）

## TaskQueue（task-queue.js）
Promise-based並行実行。プロバイダ別にキューが分かれる。
| キュー | 対象 | 並行数 |
|--------|------|--------|
| `sdQueue` | SD WebUI | 1 |
| `comfyuiQueue` | ComfyUI | 1 |
| `falaiQueue` | Fal AI | 1-10 |
| `googleImageQueue` | Google Nano Banana | 1-10 |
| `grokQueue` | Grok | 1-10 |
| `ollamaQueue` | Ollama | 1-10 |

**キューの空きを`setTimeout`でポーリングしない。** 非表示タブのタイマーは1秒間隔まで、
5分以上隠れていると1分間隔まで間引かれるため、1ページ終わるたびに最大1分止まる。
`queue.whenIdle()`が完了通知で起こすので、`waitAllQueuesIdle()`（ai-management.js）を使う。
通知漏れで進行が止まらないよう保険のタイマーでも起き、呼び出し側で`existsWaitQueue()`を
再判定する。`_notifyIdle()`は件数が0になり得る3か所（完了・個別取消・全取消）すべてから呼ぶ。

## ロール割り当て（provider-registry.js）
タスク種別ごとにどのプロバイダを使うか設定。行の定義は`ROLE_MATRIX_ROWS`（ai-roles.js）に
集約してあり、マトリクスUIと接続状態チェックの両方がこれを参照する。

- T2I, I2I, UP, BG, IP, ANG, TAG
- LLM系: `Text2Prompt`（文章を英語プロンプト化）, `Image2Prompt_LLM`（画像からプロンプト化）
- `ROLE_NONE`（`'none'`）を選ぶとそのロールは無効。`getProviderForRole()`が
  アクティブプロバイダへフォールバックせず即nullを返すため、関連ボタンも消える
- 未設定（`'default'`）はアクティブプロバイダへのフォールバック。マトリクスのラジオは
  `getProviderForRole()`の実際の戻り値で初期選択する。特定列をハードコードで
  選択すると、表示と実際の呼び出し先がずれるため
- **localStorageへの保存は`settingsAutoSaveCheckbox`がONのときだけ。**
  `role-assignment-ui.js`の`saveIfAutoSaveEnabled()`が入口。
  `debouncedSettingsSave()`を直接呼ぶと、URL・APIキーが保存されない設定のまま
  ロール割り当てだけが（空欄の全設定ごと）書き戻される
- 行ラベル（`labelKey`）は表示名。**保存キーはロール名の文字列**（`Image2Prompt_DEEPDOORU`など）
  なので、表示名を直しても保存済みの設定は壊れない。逆にロール名は変えないこと。
  `Image2Prompt_DEEPDOORU`が呼ぶのは`sdwebuiInterrogate(layer,"deepdanbooru")`で、
  表示名は`DeepDanbooru`

## Google Nano Banana（google-image-provider.js）
GeminiのInteractions API（`POST https://generativelanguage.googleapis.com/v1beta/interactions`）を
ブラウザから直接叩く。プリフライトが`Access-Control-Allow-Origin: null`を返すため`file://`でも通る。
認証は`x-goog-api-key`ヘッダ。担当ロールはT2IとI2Iだけ。

- モデルは`index.html`のselectに直書きしている4つ（Nano Banana 2 Lite / 2 / Pro / 旧Nano Banana）。
  `models.list`の応答からは画像生成モデルかどうかを判別できないため、APIからは取らない。
  **Googleが新しいNano Bananaを出したらこのselectを更新する**
- 既定は`gemini-3.1-flash-lite-image`（Nano Banana 2 Lite）
- 出力サイズは画素数で指定できない。コマの縦横比から一番近い`aspect_ratio`を選び、
  解像度は設定の`googleImageSize`（1K/2K/4K）を`image_size`で送る。
  **Liteは1Kのみ。**外した値はAPIがエラーを返すので、こちらで黙って書き換えない
- ネガティブプロンプトの項目がAPIに無い。効いていないのに欄があると誤解を招くため、
  T2IをこのプロバイダにするとネガティブUI（`negativeAreaId`）を隠す（`ai-ui-util.js`）
- 応答は`steps[]`。`thought`ステップにも途中の画像が入るので、`model_output`ステップの
  imageブロックだけを見る。画像が無いときは同じステップのテキスト（生成拒否の理由）を文面に載せる
- リファレンス画像（登場人物・背景・小道具・その他）を一緒に送れる。
  仕組みと制約は`llm_doc/reference-image.md`

## LLMプロバイダ（llm-provider.js）
GrokもOllamaもOpenAI互換の`/v1/chat/completions`で叩けるため、本体は`LLMProvider`に集約し、
サブクラスは接続先・認証ヘッダ・モデルselectのidだけを返す。

```javascript
class LLMProvider extends AIProvider{
  getBaseUrl()                                   // 例: https://api.x.ai/v1
  getModelSelectIds()                            // {text:'grokModelText',vision:'grokModelVision'}
  async chat(messages,options)                   // options.vision=true でvisionモデルを使う
  buildTextMessages(systemPrompt,userPrompt)
  buildVisionMessages(systemPrompt,userPrompt,imageDataUrl)
  async fetchModels()                            // GET /v1/models → 両selectに反映
  async heartbeat()
}
```

- テキスト用と画像認識用でモデルを別々に選べる（`getModelId('text')` / `getModelId('vision')`）
- `stream:false`固定。タイムアウトは`LLM_REQUEST_TIMEOUT_MS`（AbortController）
- 失敗時はフォールバックせず例外を投げる。呼び出し側で明示的に通知すること

### Grok（grok-provider.js）
- `https://api.x.ai/v1`、`Authorization: Bearer <key>`
- **ブラウザ直叩き可**。`access-control-allow-origin: *` を返すため`file://`（`Origin: null`）でも通る
- 単価は`GET /v1/language-models`から取得する（`getTokenPrices()`）。**単価表をコードに持たない。**
  値上げ・新モデル追加のたびに嘘の金額を出すため。単位はUSDセント/1億トークンなので
  `XAI_PRICE_UNIT_USD`（1e-10）でUSD/トークンへ換算する
- `long_context_threshold`を超える入力は`*_long_context`の単価に切り替える。
  キャッシュ済みトークン・画像トークンは`usage.prompt_tokens_details`の実測値で単価を分ける

### 外部API利用料の計上（ダッシュボード）
`LLMProvider.chat()`が応答を受けた直後に`_recordUsage()`を1回呼ぶだけで計上する。
**戻り値は`string`のまま変えない。** `{content,usage}`にすると呼び出し側（llm-prompt /
llm-story / llm-storyboard）を全部直すことになり修正漏れの温床になるため。

- 対象は`needsApiKey()`が真のプロバイダだけ。Ollamaはローカルなので計上しない
  （「単価不明」と出すと有料に見える）
- `_recordUsage()`はawaitしない（単価取得のfetchでchatを待たせないため）。
  非同期のまま投げっぱなしにすると unhandled rejection になるので**内部でtry/catchして必ずログに出す**
- **単価が取れない項目にトークンが出ていたらその呼び出しは金額に足さず`unpricedCalls`で数える**
  （`_calcCostUsd()`がnullを返す）。0円として足すと総額を実際より安く見せるため。
  画面ではその件数を「単価不明」列に出す
- 保存は`ApiCostStorage`（`js/dashboard/api-cost-storage.js`、localforage
  `MangaEditor_Performance`/`apiCostStats`）。キーは`cost_<providerId>_<modelId>`
- 表示はダッシュボードの「外部API利用料（推定）」セクションとサマリーカード。
  実際の請求額と一致する保証はないので注記を必ず出す

### Ollama（ollama-provider.js）
- 既定`http://127.0.0.1:11434` + `/v1`。APIキー不要
- **`OLLAMA_ORIGINS`の設定が必須。** 未設定だと`Origin: null`のリクエストは403で拒否される。
  手順は`html/API_Help/llm_settings.html`（設定画面の「?」とHelpメニューから開く）

### 接続失敗の切り分け（classifyFailure）
ブラウザではCORS拒否とサーバー停止がどちらも同じ`TypeError`になり区別できない。
そこで通常のfetchが失敗したら`mode:'no-cors'`でもう一度投げ、
opaqueレスポンスが返る＝サーバーは生きている＝CORS拒否、と判定する。

- 判定結果は`setConnectionNotice(kind)`で設定画面の`#ollamaConnNotice` / `#grokConnNotice`に表示
- CORS拒否を「接続できません」と丸めない。原因が違えば対処も違うため

### モデル一覧の自動取得とトースト
**起動時の自動取得は使用サービス表で選ばれているLLMだけに行う**（`llmFetchModelsIfInUse()`）。
Ollamaは接続先URLに既定値が入っているため、無条件に取得すると「なし」にしていても
起動のたびに接続を試みてエラートーストが出る。
**設定ウィンドウを開いた時はロール未割り当てでも接続情報が入っていれば取得する**
（`llmFetchModelsIfConfigured()` / `isConfigured()`）。割り当て前にモデルを選べないと設定が完了しないため。
どちらも`{silent:true}`なのでトーストは出ない。

| 呼び出し | 条件 | 失敗時 |
|----------|------|--------|
| 起動時 | 使用中かつモデル未取得（`hasLoadedModels()`） | 画面内の警告のみ（`{silent:true}`） |
| 設定ウインドウを開いた時 | 接続情報が入力済みかつモデル未取得 | 画面内の警告のみ（`{silent:true}`） |
| 再取得ボタン・APIキー/URLの変更 | 常に | 警告＋トースト |

`hasLoadedModels()`は取得成否のフラグ（`_modelsLoaded`）で判定する。select内の`<option>`数では判定しない
（取得失敗時も保存済みの選択値のoptionを残すため、数では区別できない）。

heartbeat（15秒毎）も`getInUseProviders()`が対象なので、「なし」のサービスには接続しない。

### モデル選択値の保持
selectの`<option>`はAPI取得後に作られるため、リロード直後は保存値に対応するoptionが存在しない。
`el.value=保存値`は無言で`''`になり、設定の自動保存でlocalStorage側まで潰れるため、
復元・再構築のどちらも`applySettingValue()`（project-management.js）でoptionを補ってから選択する。
取得中の一時表示（`_showFetchingState()`）で消える選択値は`_pendingValues`に退避して復元する。
詳細は`history-and-data.md`の「selectの復元」を参照。

## ストーリー→コマのプロンプト（prompt/llm/llm-story-service.js, -ui.js）
左パネル「プロンプト」の入口。ストーリー1本と、キャンバス上のページ数・コマ数・
コマ配置をLLMへ渡して各コマのプロンプトを作る。ロールは`Text2Prompt`。
範囲は`storyApplyScope`で「1コマ / 1ページ / 全ページ」。

LLM呼び出しは3種類。いずれも`response_format:{type:'json_object'}`で受け、
**欠けた分を黙って埋めずエラーにする**。

| 呼び出し | 入力 | 出力 |
|----------|------|------|
| `llmStorySheets(story)` | ストーリー | `{"characters":[...],"locations":[...]}` → 1行1件のテキスト2本 |
| `llmStoryPagePlan(story,pageInfos)` | ストーリー＋各ページのコマ数 | `[{page,summary,place}]`（`place`は`location / time`を1行に繋いだもの） |
| `llmStoryPanelPrompts(context)` | ページのあらすじ＋場所＋前後ページ＋コマ配置＋キャラ表＋ロケ表 | `{entries:[{prompt,role}],warning}` |

**どの範囲でも必ず「構成 → コマ」の順で通す。** 1コマ / 1ページ範囲も
`llmStoryPagePlan(story,[{page:1,panelCount:N}])`を先に通す。ストーリー全文を
そのまま1ページ分として渡すと、どのコマにも情報を詰め込もうとして緩急が消えるため。
圧縮結果はプレビュー上部（`llmStoryPlanNote`）に必ず出す。黙って圧縮したまま進めない。

**場面転換はコード側で判定する。** `place`が前のページと違えば場面転換とみなし、
そのページの1コマ目に`establishing`を要求する（`findPanelRhythmProblem`の第2引数）。
1ページ目は必ず場面の始まり。選択コマだけの範囲はページ先頭とは限らないので対象外。
判定は文字列一致だけで行うため、プレビューの「場所 / 時間」欄を直すと判定も追随する。

**各ページのコマ生成には前後のページを渡す。** 前ページを知らないと
ページ境界の場面転換が分からず、転換直後に引きの絵を置く判断ができない。
`prevSummary` / `prevPlace` / `nextSummary`を`llmStoryPanelPrompts`のcontextへ入れる。

- コマの並べ替え（`sortPanelsInReadingOrder`）・レイアウト要約（`buildPanelLayoutSummary`）・
  コマ応答のパース（`parseStoryboardResponse`）・役割の検証と再依頼（`requestPanelPrompts`）は
  **llm-storyboard-service.jsの関数をそのまま使う**。同じ処理を二重に持たない
- **キャラ表は、そのコマのフレームに入る範囲だけ使わせる。** 顔と髪は毎回入れて同じ人物と
  分かるようにし、服は身体が入るとき、靴は足が入るときだけ。全部そのまま入れると
  顔だけのコマにも靴が入り、それを収めようとして絵が引く。空でも動く（任意項目）
- **ロケ表（`storyLocationInput`）も同じくそのままコピーさせる。** 同じ場所のコマで
  背景タグが揺れると場所が飛んで見える。キャラ表と1回の呼び出しでまとめて抽出する
  （`llmStorySheets`／ボタンは`llmStoryExtractSheets`）
- 画風タグ（`storyArtStyle`）はLLMに書かせず`promptApplyToPanel()`が足す。
  毎回書かせると揺れるため。既に入っているタグは足さない（追記で重ならない）
- 1コマ / 1ページは構成1回＋コマ1回。**全ページは「採寸の送り」→ページ構成→
  プレビュー→「全ページ分を並列生成」→「書き込みの送り」**。ページ送りは2回。
  ページをまたいでfabricオブジェクトの参照は持てないため、書き込む側では
  コマを取り直す
- **LLM呼び出しをページ送りの内側でawaitしない。** そうするとページ送りに
  直列化され、プロバイダごとの「同時実行数」設定（`grokConcurrency`等）が効かない。
  コマ配置（`buildPanelLayoutSummary`）はキャンバスを開かないと取れないが、
  LLM呼び出し自体はその結果のデータしか使わない。だから
  **採寸（送り1回目）→ 全ページ分をまとめてキューへ投入 → 書き込み（送り2回目）**
  に分ける。実際に何本同時に走るかは`TaskQueue`の設定が決める
  （Grokは上げてよい。Ollamaはローカルなので既定の1のまま。ユーザー設定に委ねる）
- 並列生成は`llmStoryGeneratePagePrompts()`。**1ページの失敗で全ページ分を捨てない**よう
  成否はページ単位で受ける（`{page,guid,panelResult}` / `{page,guid,error}`）
- 採寸してから書き込むまでにコマを増減された場合は、**コマ数が合わないページを
  書かずに`storySkippedPages`で報告する**。ずれたまま入れると別のコマ用の
  プロンプトが別のコマに入る。黙って部分適用しない
- **生成結果は必ずプレビューウインドウに出し、編集してから「追記」「置き換え」を選ばせる。**
  黙って書き換えない。全ページはページ構成の段階でプレビューする
- 中止（`OP_isCancelled`）はページの境界で見る。中止ボタンの`clearAllQueues()`が
  待機中のLLM呼び出しを落とすため、例外時も`OP_isCancelled()`なら中止として扱う
- 書き込み側とページ送りは`prompt/prompt-apply.js`（→`history-and-data.md`）

自動生成パネルの「ネームから一括生成」（`llm-storyboard-ui.js`）は
1ページ分だけを扱う従来の入口で、こちらの「1ページ」範囲と機能が重なる。

## LLMプロンプト生成（prompt/llm/）
`llm-prompt-service.js`がLLM呼び出し、`llm-prompt-ui.js`がフローティングウインドウ。

| 機能 | ロール | 入口 |
|------|--------|------|
| 文章→タグ | `Text2Prompt` | プロンプトパネルの「文章から生成」ボタン（Generateの隣） |
| 画像→タグ | `Image2Prompt_LLM` | レイヤーのアクションバー（DeepDanbooru/CLIPの隣、`actLlmTag`） |

- どちらも出力は`normalizeTagOutput()`を通す。コードフェンス・箇条書き記号を除去し、
  改行をカンマに変換して大小文字を無視した重複排除を行う。空になったらエラーにする
- 画像→タグは`sdwebuiInterrogate`と同じ挙動。`layer.text2img_prompt`へ追記し、
  `refreshPromptPanel(layer)`（auto-prompt-ui.js）でパネルを描き直す
- 文章→タグは生成結果を一度ウインドウに表示し、「設定」「追記」をユーザーが選ぶ。
  黙って上書きしない
- キャンセルは`updateAiTaskCancelInfo(spinnerId,{queueName:provider.id})`。
  `_getQueueByName()`（spinner.js）に`grok` / `ollama`を登録済み
- システムプロンプトは`LLM_TEXT2PROMPT_SYSTEM` / `LLM_IMAGE2PROMPT_SYSTEM`に定数化。
  「タグのみ出力」「存在しない作品名・キャラ名を作らない」を明示している

## ネーム→コマ一括生成とコマの役割（llm-storyboard-service.js / -ui.js）
あらすじ1本からページ内の全コマ分のプロンプトを生成する。入口は
左パネル「自動プロンプト」内の「ネームから一括生成」ボタン。ロールは`Text2Prompt`。
**システムプロンプトの本体（`buildPanelSystemPrompt()`）はストーリー側と共有する。**
片方だけ直して食い違うのを防ぐため。

- `sortPanelsInReadingOrder(panels,rightToLeft)`で読み順に並べる。
  上端でソート→先頭コマの縦帯に中心Yが入るものを同じ段とみなす→段内をleftでソート
  （右→左がデフォルト。チェックボックスで左→右に切替可）。帯は広げない。広げると
  背の高いコマが後続の段を飲み込んでしまうため
- `buildPanelLayoutSummary()`が各コマの形状・キャンバス比・面積シェア・
  `bleed`（断ち切り＝紙面端に接する）・`first` / `last`をLLMに渡す。
  **これは判断材料であって割り当て表ではない。** どの形にどの役割を当てるかは
  LLMが決める（大ゴマは引きか見せ場を担えるが、決まりではない）
- **タグを直接書かせず、先にコマの役割（`role`）を宣言させる。**
  `MANGA_PANEL_ROLE_NAMES` = establishing / scenery / insert / full / medium / closeup / impact。
  役割を挟まないと、どのコマもキャラのバストアップに収束してページの緩急が消える
- **壊れ方だけをコード側で拾う**（`findPanelRhythmProblem(entries,sceneChange)`）。
  **枚数の割り当て表は持たない。** 何枚を人物なしにするかはLLMの判断。
  - `MANGA_MIN_PANELS_NEEDING_BREATH`（4）以上のコマ数で、`MANGA_EMPTY_ROLES`かつ
    `no humans`タグ付きのコマが**1枚も無い**とき。LLMを放置すると全コマを人物の
    バストアップで埋めるので、その一点だけ拾う
  - 場面転換: `sceneChange`が真なら1コマ目の役割が`establishing`であること
  
  違反があれば`requestPanelPrompts()`が内容を添えて**1度だけ**作り直す。
  2度目も守られなければ結果は返すが`warning`を必ず画面に出す。黙って通さない
- 応答は`response_format:{type:'json_object'}`（`chat`の`options.jsonObject`）で
  `{"panels":[{"index":1,"role":"...","prompt":"..."}]}`固定。`parseStoryboardResponse()`が
  1..Nの全indexが揃っているか検証し、欠けていたら**欠番を挙げてエラー**にする。
  足りない分を埋めたり黙って部分適用したりしない。知らない役割名は空にする
  （近い役割へ寄せると人物なしコマを数え違えるため）
- **フレーミングの作り方をシステムプロンプトで教えている。** `full body`や`wide shot`は
  結果に付いたラベルであって指示ではなく、単独では効かない。全身を描かせたいなら
  足元にあるもの（ブーツ・脚・床）を名指しさせる。顔だけなら靴や地面を書かせない。
  詳しくは`llm_doc/prompt-composition.md`
- 見切れについては書かせない。判断が揺れるうえ、後から直せない事故になるため
  書き込み側で常にネガティブへ入れる
- **人数タグ（1girl / 2girls / solo）はコマ側で決める。** キャラ表には入れさせない。
  2人のコマでキャラ表を2つ並べると`1girl`が2回入り、soloへの偏りと噛み合って破綻する
- **キャラ表はそのコマのフレームに入る範囲だけ使わせる。** 顔と髪は毎回、服は身体が
  入るとき、靴は足が入るときだけ。全部をそのままコピーさせると、顔だけのコマにも
  靴が入って勝手に引いた絵になる。**システムプロンプトとユーザーメッセージの両方で
  同じことを言う**（片方が「そのままコピー」のままだと食い違う）
- 生成結果はコマ単位のtextareaでプレビューし、編集してから「設定」「追記」を選ぶ。
  コマ番号の下に役割名（引き・情景…）を出し、ページの緩急を目で確認できるようにする。
  textareaにフォーカスすると該当コマがキャンバス上で選択され、対応を確認できる
- **`Text2Prompt`が未割り当てでもウインドウは開く。** 開かずにトーストだけ出すと、
  消えたあと次の一手がどこにも残らない。状態行（`#llmStoryboardStatus`）に
  「生成AI設定を開く」ボタンを出す（`llmStoryboardShowNoProvider()`）。
  判定は**開いた時と生成を押した時の両方**で見る。押した時にも見ておけば、
  開いたまま設定を直した人が開き直さずに続けられる（ボタンをdisabledにして
  戻し忘れる作りを避けるため、disabledでは持たない）

## コマの構図（panel-composition.js）
漫画のコマと、画像生成AIが既定で描く絵の差を埋める。**知見の本体は
`llm_doc/prompt-composition.md`**。ここには実装の置き場所だけ書く。

**どのコマを寄りにしてどのコマを引きにするかはLLMが判断する。**
役割ごとにタグを決め打つ表は持たない。`full body` / `wide shot` のような
フレーミングタグは効きが弱く、表で機械的に入れても補助にしかならないため。

このファイルが持つのは判断の余地がない3つだけ:

- **作品傾向**（`MANGA_TONE_PRESETS`）— タグではなくLLMに読ませる指示文。
  `general` / `seinen` / `shonen` / `shojo` / `adult` / `none`。
  入口は左パネル「プロンプト」内の「どんな漫画か」。
  **プリセットは欄（`storyToneGuidance`）を書き換えるだけで、真実は欄の中身。**
  何をLLMへ渡しているかが常に画面に出ている状態にする。
  文面は`llmStoryboard()`と`llmStoryPanelPrompts()`の両方でユーザープロンプトの先頭に入る
- **見切れのネガティブ**（`MANGA_FRAME_NEGATIVE_DEFAULT` → `panelApplyFrameNegative()`）—
  枠で切れた腕や脚は後から直せないので常に入れる。**手書きのネガティブは消さない**（足す側に回る）。
  ポジティブに入っているタグは打ち消し合うので除く。同じコマに2回書き込んでも増えない。
  意図して見切れさせたいときはプロンプトではなく、生成後に画像をコマの枠へ接させる
- **コマの形→生成解像度**（`PANEL_SDXL_BUCKETS` → `panelCompositionApplySize()`、既定オフ）—
  横長コマに引きの絵を頼んでも正方形で生成して嵌めると上下が切られ、結局バストアップに見えるため

フレーミングの作り方（要素を名指しさせる）はシステムプロンプト側
（`buildPanelSystemPrompt()`）に書いてLLMに実行させる。

書き込みは`promptApplyToPanel()`の1か所だけ。ネーム窓とストーリー→コマの
両方がここを通るので、片方だけ効かない状態にならない。

## ローカル / 外部 のタグ（生成AI設定）
使用サービス表のヘッダーと接続先表のサービス欄で、サービス名の下に枠付きの小さいタグを出す。
`index.html`に直書き（`<span class="us-tag us-tag-local">` / `us-tag-ext`、文言は
`usTagLocal` / `usTagExternal`）。JSでは生成していないので、サービスを増やしたら
両方の表に手で付ける。

| ローカル | 外部 |
|---|---|
| ComfyUI / SD WebUI (A1111/Forge) / Ollama | RunPod ComfyUI / Fal.ai / Google Nano Banana / Grok |

分け方は接続先が自分のPC（127.0.0.1など）かどうか。SD WebUIは既定URLが
`http://127.0.0.1:7860`なのでローカル扱い。
使用サービス表はサービス名が1行のもの（Grok）と2行のもの（RunPod ComfyUIなど）が混ざり、
名前の直後に置くとタグの高さが揃わない。そのため`.role-matrix th`を`position:relative`にして
タグをセル下端へ絶対配置し、その分`padding-bottom`で空けている（`css/ui/role-assign-modal.css`）。
接続先表は名前の直下でよいので`.us-tag`のまま。

## 接続状態の表示
`#ExternalService_Heartbeat_Container`のチップは`getInUseProviders()`が対象。
`ROLE_MATRIX_ROWS`の各ロールについて`getProviderForRole()`を引き、**実際に選ばれている
サービスだけ**を返す。「なし」や未対応（—）の行しかないサービスは接続チェックしない。
使用サービス表のチェック状態と接続状態の表示を一致させるため。
チップの`title`にはオフライン時の理由（`getStatusReason()`）が入る。

## ObjectInfo（ComfyUIノード定義）
ワークフローの**ノードの有無**と**選択肢が列挙されている入力の値**（モデル名・`sampler_name`等）が
接続先ComfyUIに存在するかを`checkWorkflowNodeVsComfyUI(workflow,repo)`で照合する。
引数はclass_typeの配列ではなく**ワークフロー本体**（値の照合にノードIDと入力名が要るため）。
照合元は`comfyObjectInfoRepo_local` / `comfyObjectInfoRepo_runpod`（IndexedDB）。

- **未取得だと全ノードが「存在しない」と判定され、生成・背景削除・アップスケールが
  一律に中断される。** 取得は`comfyui_monitorConnection_v2()`の接続確立時のみで、
  この監視はモデル・ワークフロー設定ウィンドウを開くまで開始されない
- そのため`checkWorkflowNodeVsComfyUI()`は未取得なら`fetchAndSaveComfyObjectInfo()`で
  その場で`/object_info`を取得する。起動直後でも動くようにするため
- 取得できなかった場合は「全ノード欠落」ではなく接続エラーとして通知する。
  ノード名を並べると原因を誤認させるため
- 監視ループは`comfyMonitorStarted`で1本に制限。複数動くと接続状態の変化を
  取り合ってObjectInfoの更新が走らないことがある。ループ内は例外を握りつぶす
  （例外でループが終了するとObjectInfoが二度と更新されない）

### モデル名など「値」の照合
`/object_info`は、選択肢を持つ入力について**実在するモデル名の一覧そのもの**を返す。
形が2つあり、実測（ComfyUI 0.27.0）では旧2434件・新448件が同居していた。

| 形 | 例 |
|---|---|
| 旧 | `"ckpt_name":[["SD1.0\\yden_v20.safetensors", ...],{メタ}]` |
| 新 | `"model_name":["COMBO",{"multiselect":false,"options":["RealESRGAN_x4plus.pth", ...]}]` |

取り出しは`comfyGetComboOptions()`、照合は`comfyCollectValueMismatches(workflow,objectInfo)`
（どちらも`comfyui-object-info-repository.js`）。生成側とエディタ側が同じ関数を呼ぶ。

照合しないもの（**通したいからではなく、起動時には正解が確定しないから**）:

- `isPlaceholderValue()`が真の値（`%prompt%` `%mask%` `%model%`等）。
  判定は`comfyui-workflow-builder.js`のものを再利用する。同じ判定を二重に書かない
- `image_upload` / `file_upload` / `video_upload` / `audio_upload` / `remote` を持つ入力。
  LoadImageの`image`は実行時にアプリが差し込むファイル名なので、
  照合すると必ず不一致になる
- 配列（他ノードへの接続）・数値・真偽・選択肢を持たない自由文字列
- class_typeがObjectInfoに無いノードの入力。ノード欠落として別に報告される

選択肢が0件の入力（modelsフォルダが空）は**不一致として報告する**。
「選択肢が取れないから通す」はしない。

`sampler_name` / `scheduler` のようなモデル以外の選択肢も同じ仕組みに乗る。
そのため文言は「モデルが無い」ではなく「ComfyUI側に無い値」で統一する
（`comfyMissingValue` / `missingValue`）。
案内は`ComfyUIGuide.showValueErrorGuide()`。カスタムノードの入れ直しでは直らないので、
`showNodeErrorGuide()`とは別の手順を出す。

### ワークフローエディタ側の照合表示
`ComfyUIWorkflowEditorTab.renderNodes()`（`js/ai/comfyui/v2/comfyui-workflow-editor-tab.js`）も
同じObjectInfoを見る。**「未取得（接続できていない）」と「取得できたが欠落している」を
言い分けること。** 未取得を欠落として扱うと、ComfyUIを起動すれば済む人に
カスタムノードの入れ直しを案内することになる。

| 状態 | 判定 | バナー | ノード・入力ごとの表示 |
|------|------|--------|------------------|
| 未取得 | ObjectInfoが0件 | `nodeCheckNotFetched` / `nodeCheckNotFetchedDescription` | `.comfui-node-title-unchecked` + `nodeCheckNotFetchedLabel`（未照合） |
| ノード欠落 | 1件以上あり、workflowのclass_typeに無いものがある | `missingNode` / `missingDescription`（Install Missing Custom Nodesの手順） | `.comfui-node-title-warning` + `unverifiedNode`（ComfyUIに無い） |
| 値の不一致 | `comfyCollectValueMismatches()`が1件以上返す | `missingValue` / `missingValueDescription` + 該当箇所の一覧 | `.comfui-input-label-warning` + selectの先頭に`⚠ 現在値` |
| 一致 | どちらも0件 | 出さない | `.comfui-node-title-normal` |

バナーは排他ではなく、当てはまるものを並べて出す。

selectに現在値の選択肢を足しているのは見た目のためではない。
`setupInputListeners()`は描画直後に`input.value`をワークフローへ書き戻すので、
ComfyUI側に無い値を選択肢に入れないと、**先頭の選択肢が選ばれた状態になり、
壊れているモデル名が黙って別の値に置き換わる**。

未取得のときは接続すれば`comfyui_monitorConnection_v2()`が
`updateObjectInfoAndWorkflows()`→`tab.renderNodes()`まで回すので、
エディタ側に再取得ボタンは置いていない。

## デフォルトワークフロー
`comfyuiDefaultWorkflows`（comfyui-default-workflows.js）をDOMContentLoaded時に
IndexedDBへ登録する。`getEnabledWorkflowByType(type)`は該当typeで`enabled`のものを返す。
有効なワークフローが無い場合はnullを返すので、呼び出し側で明示的に弾くこと。

## タスクライフサイクル（generation-task-manager.js）
→ `layer-structure.md`のAIタスク進捗管理セクション参照

## ComfyUI プロバイダ切り替え（comfyui-management.js）
`_comfyUIExecProvider` グローバル変数でリクエスト単位のプロバイダを制御する。
```javascript
async function comfyUIExecWithProvider(provider, fn){
  _comfyUIExecProvider = provider;
  try { return await fn(); }
  finally { _comfyUIExecProvider = null; }
}
```
- `getComfyUIServerAddress()` / `getComfyUIAuthHeaders()` / `getComfyUIProviderTag()` はすべて `_comfyUIExecProvider || providerRegistry.getActive()` を参照
- `comfyUIUrls` は Proxy で、プロパティアクセスのたびに `getComfyUIServerAddress()` を呼ぶ動的URL
- **注意**: `fn()` 内で長時間の await（WebSocket待機等）を行うと、その間に別の非同期タスク（ワークフローエディタ更新等）が `comfyUIExecWithProvider` を呼び `_comfyUIExecProvider` を上書きする。await 後に `comfyUIUrls.*` や `comfyuiFetch()` を使うと別プロバイダのURLに接続してしまう
- **対処**: 関数冒頭で `getComfyUIServerAddress()` / `getComfyUIAuthHeaders()` をローカル変数にキャプチャし、await後はそのローカル変数を使って直接 `fetch()` する

## ComfyUI v2ワークフロー
- `comfyui-workflow-repository.js` でワークフロー保存/読み込み（ファクトリパターン）
  - `createWorkflowRepository(providerKey)` でプロバイダー別インスタンス生成
  - `comfyUIWorkflowRepo_local` / `comfyUIWorkflowRepo_runpod`
- `comfyui-object-info-repository.js` でノード情報キャッシュ（同様のファクトリパターン）
  - `comfyObjectInfoRepo_local` / `comfyObjectInfoRepo_runpod`
- `comfyui-workflow-editor.js` でビジュアルエディタ（オプションで providerKey, workflowRepo, objectInfoRepo, provider, containerEl を受け取る）
- デフォルトワークフロー: t2i, inpaint, angle, upscale, rembg

## モデル設定フローティングウインドウ（model-settings-window.js）
3タブ構成：
1. **ComfyUI Workflow** — Local ComfyUIのワークフロー管理（ObjectInfo: comfyUIPageUrl）
2. **RunPod ComfyUI Workflow** — RunPod ComfyUIの独立ワークフロー管理（ObjectInfo: runpodComfyUIUrl）
3. **SD WebUI** — モデル・サンプラー等のSD WebUI固有コントロール

各タブは遅延初期化。ComfyUIタブはそれぞれ独立した `ComfyUIWorkflowEditor` + `ComfyUIWorkflowWindow` インスタンスを持つ。

### 2つの設定ウインドウの閉じ方
`unifiedSettingsWindow`（生成AI設定）と `modelSettingsWindow`（使用モデル・ワークフロー設定）は
どちらも `.us-overlay` / `.us-window` で、**両方とも `FocusTrap` を通す**。
片方だけに入れると、生成AI設定の中のボタンからモデル設定を開いたとき
Escが下のウインドウへ届き、**手前を残したまま下だけが閉じる**。

重ねて開いたときにEscが最前面だけを閉じるのは次の3つによる（`js/ui/util/focus-trap.js`）。
1. `FocusTrap.activate()` が起動時に `focusable[0].focus()` でそのウインドウの中へフォーカスを移す
2. キー監視は `trap.container`（各ウインドウの `.us-window`）に付くので、
   keydownはフォーカスのあるウインドウのcontainerだけを通る。2つのoverlayはDOM上の兄弟で入れ子ではない
3. `_handleKey()` のEsc分岐が `stopPropagation()` する

`.us-overlay` は全面の暗幕（`position:fixed` / 100%）で、z-indexが同値のためDOMで後ろにある
モデル設定側が上に載る。暗幕がある間は下のウインドウをクリックできないので、
フォーカスが下へ戻る経路も無い。

## 生成タスクの取消
入口は`cancelAiTask()`（`js/ai/queue/spinner.js`）1つ。

`TaskQueue.cancelItem(itemId)`が**待機中と実行中の両方**を扱う。
- 待機中: キューから外して`reject(new Error('Task cancelled'))`
- 実行中: 実行中台帳（`_running`）から引いて同じく`reject`

呼び出し側は`.catch`で`'Task cancelled'` / `'Queue cancelled'`を見る分岐を
すでに持っているため、取り消すと**結果の配置も実績記録も通らない**。

以前は待機中しか落としておらず、実行中は`removeAiTask()`でインジケータを
消すだけだった。Promiseが生き残るため`.then`が走り、取り消したはずの画像が
キャンバスに配置され`recordGeneration`まで記録されていた
（中断信号を送っていたのはComfyUIのみ）。

**リモート側の処理と課金は止まらない。** `AbortController`は未対応で、
送信済みのリクエストはサービス側で最後まで走る。止めるのは受け取りだけ。

`activeCount`は実行中タスクが実際に終わるまで減らさない。
先に減らすと同時実行数を超えてリクエストが飛ぶ。

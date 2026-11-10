# 034: 漫画画像の解析取り込みとコマ・セリフ再生成

## 規模: L (大)

## 概要

既存の漫画画像をフォルダ単位で読み込み、コマ・セリフ・人物を解析する。コマは Canvas 上のコマ割りとして、セリフは吹き出しとして再配置し、絵だけを AI で再生成する。

画像解析そのものは既存プロジェクト `manga-scenario-builder`（以下 manga-analyzer）のパイプラインを使う。本リポジトリには解析コードもモデルも持ち込まない。

**主要機能は `file://` のまま動く。** サーバーは ComfyUI や Ollama と同じ「起動していれば使える外部サービス」として扱う。

---

## 構成

### プロセス構成

```
[ブラウザ file://]  manga-editor-desu
        |
        | fetch (Origin: null) / WebSocket
        v
[127.0.0.1:8770]    manga-editor-server      ← 本リポジトリに新設
        |                    ^
        |                    └── MCP (stdio) ── [Claude Code]
        | HTTP（サーバー間。CORS 無関係）
        v
[127.0.0.1:8765]    manga-analyzer           ← 無改造で使う（別リポジトリ）
                     (CUDA / モデル)
```

### 3つの層の役割

| 層 | 責務 | GPU | 本リポジトリ |
|---|---|---|---|
| ブラウザ | 描画・編集。`file://` で動く | 不要 | ○ |
| **manga-editor-server** | **エディタのサーバー機能全般。** 形式変換、ローカルファイル操作、Claude Code 連携 | 不要 | ○（新設） |
| manga-analyzer | 漫画画像の解析（モデル推論） | **必須** | ×（別リポジトリ・無改造） |

### 機能をどちらのサーバーに置くかの判断基準

**この基準を守る限り、新しいサーバー機能の置き場で迷うことはない。**

| 置き場 | 条件 |
|---|---|
| **manga-analyzer** | 画像を見てモデルが何かを判定する。GPU が要る。エディタ以外からも使える汎用の解析である |
| **manga-editor-server** | エディタのデータ形式・UI・ファイル配置を知っている。GPU が不要。エディタのためだけに存在する |

`manga-editor-server` に将来入るもの（例）:

- MangaImport 形式への変換（本件）
- ローカルフォルダの列挙・参照画像の一括取り込み
- プロジェクトファイルのディスク保存・一覧・世代管理
- サーバー側での書き出し（PDF、連番画像）
- インストール済みフォントの列挙
- Claude Code 向け MCP ツール

`manga-analyzer` に足すもの: **本件では無し。**

### この構成を選ぶ理由

当初 `manga-analyzer` にエディタ向け router と MCP を足す案を検討したが、以下の理由で採らない。

- 解析専用プロジェクトにエディタ固有の関心事が混ざる
- **エディタにしか属さないサーバー機能の置き場が無い。** 本件以外のサーバー機能を作るたびに置き場を決め直すことになる
- 本リポジトリの機能が、別リポジトリへの改変を前提にしてしまう

自前サーバーを挟むことで得られる具体的な利点:

1. **`manga-analyzer` を無改造で使える。** ブラウザは 8765 に一切触らない。サーバー間通信は CORS の対象外なので、analyzer に `CORSMiddleware` を足す必要が消える
2. **`Origin: null` を許可するサーバーが自分のものだけになる。** 任意の Web ページから解析サーバーを叩けてしまう懸念が、自分の管理下に収まる
3. **「サーバー連携機能が使えるか」が1つの真偽値になる。** ユーザーから見て起動するものが1つで済む（analyzer は解析実行時にだけ必要）
4. **解析バックエンドを差し替えられる。** 別の解析器やリモート GPU に向け替えても、ブラウザ側は変わらない
5. スキーマ変換が Python 側に閉じる。JS は完成品の1形式だけを知ればよい

### コスト

Python 環境が2つ必要になる。ただし `manga-editor-server` の依存は `fastapi` / `uvicorn` / `httpx` / `mcp` のみで、**torch も CUDA も要らない**。venv 作成は数十秒で終わる。

`99_server.py` / `99_server.bat` は削除する（`99_server.bat` は存在しない `01_server.py` を呼んでおり、現状すでに動作しない）。

### アプリ本体を HTTP 配信してはいけない

`file://` と `http://localhost` ではオリジンが変わり、IndexedDB / localStorage が別物になる（`llm_doc/chrome.md:25-27`）。HTTP 配信に切り替えるとユーザーの既存プロジェクトと設定が全部見えなくなる。`manga-editor-server` は **API 専用**とし、静的ファイル配信は行わない。

---

## 解析パイプラインの実測

manga-analyzer のタスク列と実測値（45ページ・162コマ、`_data/log/` の PERF 出力より）。

| 経路 | タスク列 | LLM | モデル計 | 時間 |
|---|---|---|---|---|
| コマのみ | `image_import → panel_detection` | 不要 | 約3.9GB | 約1分 |
| **コマ＋セリフ** | `image_import → panel_detection → bubble_detection → text_ocr` | **不要** | **約4.1GB** | **約2.5分** |
| 話者・演出まで | ＋ `vision_analysis` 以降 | llama-server 必須（VRAM 24GB） | ＋約8GB | 約28分 |

**本機能の既定は「コマ＋セリフ」経路。** LLM を起動せずに済み、実用的な待ち時間に収まる。話者推定は任意の上位モードとする。

| 処理 | 手法 | 1ページ |
|---|---|---|
| コマ検出 | MagiV2 (`ragavsachdeva/magiv2`) | 約1.3秒 |
| 吹き出し検出 | YOLOv8m (`ogkalu/comic-speech-bubble-detector-yolov8m`) | 約0.12秒 |
| OCR | manga-ocr（縦書きはモデル側が対応） | 約1.3秒 |

**CUDA 必須。** `BaseTask._require_cuda()` が CPU 実行を明示的に禁止している。GPU の無い環境ではこの機能を出さない。

### 使う manga-analyzer の既存 API（追加不要）

| 用途 | エンドポイント |
|---|---|
| 起動確認 | `GET /health` |
| フォルダ読み込み | `POST /api/projects/{id}/load-path` |
| 解析実行 | `POST /api/projects/{id}/run/{phase_index}` |
| 進捗 | `WS /ws/projects/{id}/progress` |
| 結果取得 | `GET /api/projects/{id}/data/{task_name}` / `data-bulk` |
| 画像 | `GET .../image/{page}` / `.../crop/{spread}/{panel}` |

---

## 中間フォーマット MangaImport v1

ブラウザと `manga-editor-server` が合意する唯一の形式。analyzer の中間タスク JSON（7本）はブラウザに一切露出させない。

**座標はすべて 0.0〜1.0 の正規化値、ページ画像基準、左上原点。**
`canvas.width` はウィンドウ依存で環境ごとに変わるため、ピクセル値を持ってはいけない（`js/canvas-manager.js:66-70`）。

```json
{
  "format": "manga-editor-import",
  "version": 1,
  "source": {
    "folder": "C:/manga/ep01",
    "analyzed_at": "2026-08-29T12:00:00+09:00",
    "level": "panel_text"
  },
  "pages": [
    {
      "index": 0,
      "source_file": "001.jpg",
      "width": 2122,
      "height": 3018,
      "panels": [
        {
          "id": "p1_1",
          "reading_order": 1,
          "shape": "normal",
          "is_bleed": false,
          "points": [[0.02,0.01],[0.98,0.01],[0.98,0.33],[0.02,0.33]],
          "crop_url": "/api/imports/{id}/panel/1/1/image",
          "tags": [],
          "characters": []
        }
      ],
      "balloons": [
        {
          "id": "b1_1",
          "panel_id": "p1_1",
          "reading_order": 1,
          "type": "normal",
          "bbox": {"x":0.10,"y":0.05,"w":0.20,"h":0.10},
          "tail": {"x":0.15,"y":0.16},
          "text": "前回といえば…",
          "vertical": true,
          "outside_panel": false,
          "speaker": null,
          "speaker_confidence": null,
          "excluded": false,
          "exclusion_reason": null
        }
      ]
    }
  ],
  "characters": []
}
```

### 設計上の決め事

- **`points` は多角形。** MagiV2 は現状 bbox のみ返すので当面は4頂点だが、斜めコマ対応（analyzer 側 `llm_doc/斜めコマ対応Lora.md`）が入ったときにフォーマットを変えずに済ませる
- **`excluded` のセリフを削除しない。** analyzer は自信の低い OCR 結果を消さず `excluded` + `exclusion_reason` を残す設計になっている。エディタ側もこれを踏襲し、区別して置くかユーザーに選ばせる
- **`text` は必ず OCR の実測値。** analyzer は Vision LLM が返したセリフを採用せず、OCR 実測と Jaccard 類似度で突き合わせてメタ情報のみ LLM 側を採る。幻覚セリフを持ち込まないこの方針をそのまま引き継ぐ
- **`speaker` は上位モードでのみ埋まる。** 既定の「コマ＋セリフ」経路では常に `null`

### 元データとの対応（変換は manga-editor-server 側）

| MangaImport | 由来 |
|---|---|
| `panels[].points` | `panel_detection` の `PanelInfo.bbox`（ページ絶対px）をページ幅高で除算 |
| `panels[].shape` / `is_bleed` | `PanelInfo.shape` (`normal`/`bleed`/`inferred`) / `is_bleed` |
| `panels[].reading_order` | `PanelInfo.panel_number`（コマの読み順は `panel_detection` 内で確定済み） |
| `balloons[].type` | `BubbleInfo.bubble_type` |
| `balloons[].bbox` | `BubbleInfo.bbox` を正規化 |
| `balloons[].text` | `text_ocr.json` の `bubble_texts[bubble_id]` |
| `balloons[].tail` | `bubble → magiv2_text_idx → text_tail_associations → tails[idx].center` |
| `balloons[].speaker` | `speech_attribution.json` の `speaker_char_id`（上位モードのみ） |
| `characters[]` | `character_identification.json` の `clusters[]`（上位モードのみ） |

**`page_side` は使わない。** analyzer は見開き前提で `right`/`left`/`across` を持つが、エディタは単ページ単位で扱う。見開き画像1枚の場合は `manga-editor-server` 側で左右に分割してから MangaImport に載せる。

---

## manga-editor-server（新設）

### 配置

```
server/
  pyproject.toml
  manga_editor_server/
    __init__.py
    app.py                HTTP アプリ（ブラウザ向け。CORS 設定を持つ唯一の場所）
    mcp_entry.py          MCP（stdio）エントリポイント
    analyzer_client.py    manga-analyzer への薄いクライアント
    manga_import.py       analyzer スキーマ → MangaImport v1 変換
    import_jobs.py        非同期ジョブ管理と進捗中継
    local_files.py        ローカルフォルダ列挙
50_start_server.bat
```

**HTTP と MCP は入口が違うだけで、同じ変換ロジックを共有する。** ツールを追加したいときに片方だけ実装が進む状態を作らない。

### HTTP API（ブラウザ向け）

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/capabilities` | 疎通確認と能力申告 |
| GET | `/api/folders?path=` | ローカルフォルダ一覧 |
| POST | `/api/imports` | 解析開始。`{folder_path, level}` → `{import_id}` を即時返却 |
| GET | `/api/imports/{id}` | 状態 `{status, progress, current_step}` |
| WS | `/ws/imports/{id}` | 進捗ストリーム（analyzer の WS を中継） |
| GET | `/api/imports/{id}/result` | MangaImport v1 JSON |
| GET | `/api/imports/{id}/page/{n}/image` | ページ原画像（analyzer から中継） |
| GET | `/api/imports/{id}/panel/{p}/{n}/image` | コマ切り出し（analyzer から中継） |

`capabilities` の応答例:

```json
{
  "server": "manga-editor-server",
  "version": "1.0.0",
  "formats": ["manga-editor-import/1"],
  "analyzer": {
    "reachable": true,
    "cuda": true,
    "levels": ["panel", "panel_text"],
    "llm_running": false
  }
}
```

- **`analyzer.reachable: false`** → 取り込み機能は無効。ただしサーバー自体は動いているので、他のサーバー機能は使える
- **`analyzer.cuda: false`** → 同じく無効
- **`levels` は analyzer が実際に回せる経路のみ。** llama-server が動いていなければ `full` を含めない

### CORS とセキュリティ

`Origin: null` を許可するのは**このサーバーだけ**。

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Editor-Token"],
)
```

`Origin: null` の許可は、ユーザーが開いた任意の Web ページからもこのサーバーを叩けることを意味する。緩和策:

- **`127.0.0.1` バインド限定**（`0.0.0.0` にしない）
- **起動時生成のトークンを全 API で要求**。トークンはコンソールに表示し、ユーザーがエディタの設定欄へ貼る（ComfyUI の認証ヘッダと同じ扱い）
- **ローカルファイルの読み取り範囲を、ユーザーが設定した既定フォルダ配下に限定する。** `/api/folders` に任意パスを渡してディスク全体を走査できる状態にしない

### フォルダの指定方法

**ブラウザは仕様上ファイルの絶対パスを取得できない。** `input[webkitdirectory]` でも相対パスしか得られないため、どの手段でもサーバーにフォルダ位置を伝えられない。

→ `GET /api/folders` で**サーバー側がフォルダを列挙し、ブラウザはその一覧から選ぶ**。

---

## エディタ側の実装

### ファイル配置

```
js/import/manga-import-client.js    サーバー疎通・API 呼び出し・JSON 検証
js/import/manga-import-apply.js     MangaImport → Canvas 流し込み
js/import/manga-import-ui.js        取り込みダイアログ・進捗
css/ui/manga-import.css
```

ES Modules ではなくグローバル前提の `<script defer>`。`index.html:2470` 付近に、参照される側が先になる順で追加。**URL に `?v=7.x` を付ける**（Service Worker が `.js` をキャッシュ優先で持つため、上げないと更新が届かない）。

### 取り込みの2経路

1. **サーバー経由**: `manga-editor-server` が起動していれば、フォルダ選択 → 解析 → 取り込みまで一気に行う
2. **JSON ファイル読み込み**: Claude Code や CLI が書き出した MangaImport JSON を `<input type="file">` で読む。**サーバー起動なしで動く**

2 を用意することで、`file://` 主義を崩さずに済む。解析済みデータを他人と受け渡すこともできる。

### 流し込み手順

```
withoutHistory(() => {
  ページごとに:
    loadBookSize(page.width, page.height, false, true)   // 元画像の縦横比を渡す
    btmWaitForPageReady()                                 // 必須
    cw = canvas.getWidth(), ch = canvas.getHeight()

    コマごとに:
      poly = new fabric.Polygon(points.map(p => ({x: p[0]*cw, y: p[1]*ch})),
                                {isPanel: true, strokeUniform: true,
                                 objectCaching: false, ...})
      setText2ImageInitPrompt(poly)
      setPanelValue(poly)
      canvas.add(poly)
      poly.fill = ...        // add の後（object:added が fill を上書きするため）
      poly.selectable = false

    吹き出しごとに:
      createSpeechBubbleFromImport({svg, left, top, width, text, vertical})
});
updateLayerPanel();
saveStateByManual();
```

### 実装上の罠（調査で確認済み）

| 罠 | 対処 |
|---|---|
| `object:added` が `isPanel` の `fill` を `rgba(255,255,255,0.25)` に無条件上書き（`js/fabric/fabric-management.js:311-313`） | `canvas.add()` の**後**に fill を設定 |
| `putImageInFrame()` が内部で `saveStateByManual()` を呼ぶ | `withoutHistory()` で囲む。履歴は全スナップショット方式なので、刻むほど保存ファイルが線形に肥大する |
| `chengeCanvasByGuid()` 直後にオブジェクトが0件 | `btmWaitForPageReady()` で待つ |
| 縦横を独立に正規化するとページのアスペクト比が違うときコマが歪む | `loadBookSize()` に元画像の縦横比を渡してページ自体を合わせる |
| `commonProperties` 未登録のプロパティは保存で消える | 後述の通り登録する |
| `getText('x') \|\| '既定'` は効かない（未定義でもキー文字列が返る） | 既定値のフォールバックに使わない |
| `data-i18n="[title]key"` 記法は使えない | ツールチップは `data-tip` + tippy |

### commonProperties への追加

`js/core/settings.js:77-102` の配列に追加する。ここに列挙しないプロパティは `customToJSON()` の対象外になり、保存時に消える。

```
importSourceFile     元画像のファイル名
importPageIndex      元ページ番号
importPanelId        元コマID
importBalloonId      元吹き出しID
importReadingOrder   読み順
importBubbleType     解析が判定した吹き出し種別
importOcrText        OCR 原文（ユーザーが書き換えても原文を残す）
importSpeakerId      話者 char_id（上位モードのみ）
```

これで保存・再読込後も「どの原稿のどのコマか」が残り、再生成やセリフ差し替えの基準になる。

---

## 吹き出しの再配置

### 方式

**SVG テンプレート方式（`customType: speechBubbleSVG`）を使う。** フリーハンド方式（`speech-bubble-freehand.js`）は座標指定こそできるが、追随に必要な `freehandBubbleGrid` 等が `commonProperties` に未登録で、**保存→再読込で文字の追随が壊れる**ため採用しない。

SVG 方式は本体 SVG Group ＋ `Textbox` ＋ 内接矩形の3点セットで、文字位置は吹き出し内部の最大内接矩形から自動決定される。縦書きは `VerticalTextbox` に切り替わる。

### 種別の対応表

解析が返す `bubble_type` を、既存のテンプレート分類（`js/svg/speechbubble.js` の接頭辞）に写す。

| `bubble_type` | テンプレート接頭辞 | 備考 |
|---|---|---|
| `normal` | `01_normal` | |
| `shout` | `12_!` | 爆発型 |
| `whisper` | `10__silent` | 破線 |
| `monologue` | `20_other` | |
| `narration` | `11_rect` | 角型 |
| `inverted` | `11_rect` | 黒地。塗りを反転 |
| `none` | — | 吹き出しを作らずテキストのみ配置 |

各分類の中のどのテンプレートを使うかは、設定で既定を1つ選べるようにする。

### 引数付き生成関数の新設

既存の `loadSpeechBubbleSVGReadOnly(svgString, name)`（`js/sidebar/speechBubble/speech-bubble-effect.js:164`）は、位置を `placeNewObject()` 任せ、サイズを `canvas.width*0.35` 固定、文字・フォント・色を DOM 直読みで決めており、**戻り値もない**。一括生成には使えない。

既存関数はそのまま残し、引数付きの派生関数を新設する。

```
createSpeechBubbleFromImport({svgString, left, top, width, height,
                              text, vertical, fill}) -> Promise<fabric.Object>
```

内部で `createSpeechBubbleMetrics()`（`speech-bubble-text.js:143`）をそのまま使い、DOM から読んでいた箇所だけを引数に差し替える。既存の呼び出し側は変更しない。

### しっぽの向き

**analyzer はしっぽの座標しか持たない**（`tails: list[BBox]`、角度・方向のフィールドなし）。向きは、しっぽ中心と吹き出し中心の位置関係からエディタ側で8方位に量子化して推定し、その向きを持つテンプレートを選ぶ。

### 吹き出しの読み順

`reading_order.json` は依存宣言に `vision_analysis`（LLM）が入っており、既定の「コマ＋セリフ」経路では得られない可能性がある。

→ **`manga-editor-server` 側で同じロジックを実装する。** 内容は単純:

1. Y 中心の差が「コマ高さ × 0.3」以内の吹き出しを同一行にまとめる
2. 行を上→下にソート
3. 行内を中心 X の降順（右→左）にソート

analyzer が `reading_order` を返した場合はそちらを優先する。

---

## 再生成

取り込み直後の状態は「コマ（Polygon）＋吹き出し＋セリフ」だけで、絵は空。ここから既存の T2I をそのまま回す。

- **コマのプロンプト初期値**: `setText2ImageInitPrompt(poly)` の直後に、解析で得たコマのタグ（`wd_tagging`、上位モードのみ）とキャラの `appearance_prompt` を上書きする
- **生成は必ず既存の TaskQueue 経由**にする。コマ単位で `T2I(layer, spinner)` を呼ぶ既存経路をそのまま使う
- **配置は `putImageInFrame(img, cx, cy, false, false, true, panel)`**（`js/sidebar/panel/panel-manager.js:136`）。第7引数に対象コマを渡せば座標判定を飛ばして確実にそのコマへ入る。AI 生成画像と同じ経路
- **元コマ画像を i2i / 参照画像として使うモードは既定 OFF** の設定項目とする

---

## サーバー起動検知と機能の ON/OFF

### 疎通

1. `SETTINGS_SCHEMA`（`js/project-management.js:291` 付近）に2行追加

```javascript
editorServerUrl:   {id: 'editorServerUrl',   default: 'http://127.0.0.1:8770'},
editorServerToken: {id: 'editorServerToken', default: ''},
```

これだけで保存・復元・自動保存の対象になる。UI は `index.html:2196-2215` の Ollama 行と同型で追加し、`us-tag-local` タグを使用サービス表と接続先表の**両方に手で**付ける。

**analyzer の URL はエディタの設定に持たない。** analyzer は `manga-editor-server` の設定で指定する。ブラウザは analyzer の存在を知らなくてよい。

2. 疎通は既存の `apiHeartbeat()`（`js/ai/ai-management.js:234`、15秒間隔）に相乗りし、`GET /api/capabilities` を叩く
3. 状態バッジは `#ExternalService_Heartbeat_Container`（`index.html:1831`）に追加

**CORS 拒否とサーバー停止はブラウザ上でどちらも `TypeError` になり区別できない。** 既存の `_probeReachable()`（`mode:'no-cors'` で再投擲）で切り分ける実装をそのまま使い、「接続できません」に丸めない。

### 機能の出し分け

判定を1か所に集約する。`isPWAEligible()`（`js/core/service/worker-register.js:1-18`）と同型。

```javascript
function getMangaImportAvailability() {
  // -> {ok: true}
  //  | {ok: false, reason: 'no-server'      , message: ...}
  //  | {ok: false, reason: 'no-token'       , message: ...}
  //  | {ok: false, reason: 'no-analyzer'    , message: ...}
  //  | {ok: false, reason: 'no-cuda'        , message: ...}
  //  | {ok: false, reason: 'format-version' , message: ...}
}
```

UI 側はこの1関数だけを見る。判定条件が増えてもここだけ直せばよい。

**利用できないときはメニューを隠さず、無効化して理由を表示する。** 既存の `{ok:false, message}` を返すパターン（`js/ai/reference/reference-generator.js:31`）に合わせる。黙って別の動作にすること（fallback）はしない。

**JSON ファイル読み込み経路は常に有効。** サーバーが無くても取り込み自体はできる。

### 進捗表示

- **`aiTaskMap` / `createSpinner()` は使わない。** レイヤー GUID 必須で、フォルダ解析には対応しない
- **`js/ui/overlay-progress.js` を使う。** `OP_showLoading()` → `OP_updateLoadingState()` → `OP_hideLoading()`。キャンセルは `OP_isCancelled()` を毎回見る協調方式
- **進捗の取得に `setTimeout` ポーリングを使わない。** 非表示タブで1分間隔まで間引かれる。`WS /ws/imports/{id}` を使う（WebSocket は CORS の対象外で、ComfyUI 相手に `file://` から繋がる実績がある）
- Toast は完了・失敗時のみ（同一内容を `×N` にまとめる仕様のため進捗に向かない）

---

## Claude Code 連携

`manga-editor-server` の MCP エントリポイントを **stdio トランスポート**で公開し、`.mcp.json` を本リポジトリにコミットする。

```json
{
  "mcpServers": {
    "manga-editor": {
      "command": "python",
      "args": ["-m", "manga_editor_server.mcp_entry"],
      "env": {
        "MANGA_ANALYZER_URL": "${MANGA_ANALYZER_URL:-http://127.0.0.1:8765}"
      }
    }
  }
}
```

**HTTP ではなく stdio を選ぶ理由**: ポートも認証も要らず、Claude Code がプロセスの起動と終了を管理する。**HTTP サーバーが起動していなくても Claude Code から使える。** 変換ロジックは `app.py` と共有する。

### ツール

**戻り値は軽量メタデータのみ。** MCP の出力には既定で約26,000トークンの上限があり、解析結果をそのまま返す設計は破綻する。

| ツール | 戻り値 |
|---|---|
| `list_source_folders(path?)` | フォルダ名の配列 |
| `start_import(folder_path, level)` | `{import_id}` を即時返却 |
| `get_import_status(import_id)` | `{status, progress, current_step}` |
| `get_import_summary(import_id)` | ページ数・コマ数・セリフ数・キャラ数のみ |
| `get_page_analysis(import_id, page)` | **1ページ分だけ**のコマ・セリフ |
| `export_editor_json(import_id, out_path)` | ファイルに書き出し、**パスを返す** |

- **長時間処理は分割必須。** MCP ツールの既定タイムアウトは30秒。「開始 → ID返却 → 状態問い合わせ」に分ける
- **画像は base64 で返さない。** ファイルパスを返す

### Claude Code からブラウザ側は触れない

`file://` のページは Chrome 拡張から一切操作できない。Claude Code とエディタの連携は**ファイル経由の間接連携のみ**とする。`export_editor_json` が書き出した MangaImport JSON を、エディタが `<input type="file">` で読む。

---

## 段階

| Phase | 内容 | 依存 |
|---|---|---|
| 1 | MangaImport v1 スキーマ確定 / `manga-editor-server` の骨格（capabilities・folders・CORS・トークン） | — |
| 2 | analyzer 中継と MangaImport 変換 / ブラウザ側の疎通・設定・状態バッジ / JSON ファイル読み込み経路 / コマ流し込み | 1 |
| 3 | 引数付き吹き出し生成関数 / 種別対応表 / 縦書き・テキスト流し込み | 2 |
| 4 | 再生成（プロンプト初期値、TaskQueue 経由の一括生成） | 3 |
| 5 | MCP エントリポイントと `.mcp.json` | 1 |

Phase 2 まででコマ割りの取り込みが完成し、単体で価値が出る。

---

## 該当箇所

### 削除

- `99_server.py`、`99_server.bat`

### 新規

- `server/`（`manga_editor_server` パッケージ、`pyproject.toml`）
- `50_start_server.bat`
- `js/import/manga-import-client.js`、`manga-import-apply.js`、`manga-import-ui.js`
- `css/ui/manga-import.css`
- `.mcp.json`
- `llm_doc/manga-import.md`（形式仕様とサーバー責務の境界）

### 修正

| ファイル | 内容 |
|---|---|
| `js/core/settings.js:77-102` | `commonProperties` に `import*` を8件追加 |
| `js/project-management.js:291` 付近 | `SETTINGS_SCHEMA` に URL・トークンを追加 |
| `js/ai/ai-management.js:234` | `apiHeartbeat()` に `manga-editor-server` を追加 |
| `js/sidebar/speechBubble/speech-bubble-effect.js` | `createSpeechBubbleFromImport()` を新設（既存関数は変更しない） |
| `index.html` | 設定行、状態バッジ、`<script>` 追加（`?v=` 更新） |
| `js/ui/third/base-translation/base-*.js` | 8言語ぶんの文言 |
| `service-worker.js:2` | `CACHE_VERSION` 更新 |
| `.gitignore` | `server/.venv` |

### manga-analyzer（別リポジトリ）

**変更なし。**

---

## 未確認・リスク

| 項目 | 内容 | 対処 |
|---|---|---|
| **モデルのライセンス** | MagiV2 / YOLOv8（ultralytics は AGPL-3.0）等の利用条件が analyzer 側に一切記載されておらず、検証された形跡がない | 本リポジトリにモデルを同梱しない構成にすることで影響を切り離す。analyzer 側で別途確認が必要 |
| **`reading_order` の依存** | 依存宣言に `vision_analysis`（LLM）が入っており、軽量経路で得られるか未確認 | `manga-editor-server` 側に同じロジックを実装する前提で設計。analyzer が返せば優先 |
| **VRAM 下限** | 「コマ＋セリフ」経路の最低 VRAM が記載されていない | `capabilities` で `cuda` は判定できるが容量は判定できない。実測が必要 |
| **見開き画像の分割** | analyzer は見開き前提の `page_side` を持つが、単ページ入力との切り分けが未確認 | Phase 1 で確認し、必要なら `manga-editor-server` 側で分割する |
| **MCP SDK の API 詳細** | 調査で得たコード例の裏取りが不十分 | Phase 5 の実装時に公式 SDK で確認 |
| **`Origin: null` 許可の影響範囲** | 任意の Web ページからローカルサーバーを叩けるようになる | `127.0.0.1` バインド限定 + トークン必須 + 読み取り範囲の限定 |
| **Python 環境が2つ** | インストール手順が増える | `manga-editor-server` は torch を要求しない軽量構成にする |

---

## 関連

- `llm_doc/layer-structure.md` — GUID 連携、リンク機構
- `llm_doc/history-and-data.md` — 履歴スタック、data:URL 制約
- `llm_doc/ai-system.md` — 疎通監視、プロバイダ構成
- `llm_doc/ai-verification.md` — `file://` の実測表
- `llm_doc/chrome.md` — オリジンの分離
- `roadmap/030_storyboard_mode.md` — ネーム機能との関係（要検討）

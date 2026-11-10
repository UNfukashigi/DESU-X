# DESU-X の変更点（GPL v3 第5条の「改変の告知」）

DESU-X は [Manga Editor Desu! Pro Edition](https://github.com/new-sankaku/manga-editor-desu)（作者 [new-sankaku](https://github.com/new-sankaku)、GPL v3.0）を改変したものです。
改変日：2026-11-10

## 新しく足したファイル
| ファイル | 中身 |
|---|---|
| `js/project/qanima-folder-import.js` | DESU-X JSON（format: qanima-editor-1）の読み込み（JSON・ZIP のドロップ、フォルダから読み込み） |
| `js/project/qanima-export.js` | DESU-X JSON の書き出し（JSONだけ／ZIP） |
| `js/layer/layer-folder.js` | レイヤーフォルダ（まとめて選ぶ・動かす、ロック、パネルでのドラッグ出し入れ） |
| `js/fabric/click-select-first.js` | 最初のクリックは選ぶだけ、上の物を半透明表示、上の物をクリックで選び直し、まとめ選択中の文字のダブルクリック、フキダシの中の文字も動かせるように |
| `js/sidebar/text/text-edit-modal.js` | 文字の入力モーダル（横書きで入力して縦書きで反映）、「フキダシの中央に配置」 |
| `css/no-ai.css` | AI 生成機能の画面部品を隠す |
| `DESU-X_JSON仕様.md`、`examples/` | JSON の仕様書と見本 |
| `README.md`（DESU-X の説明。元の英語の説明は `README_ORIGINAL.md` に移した）、`CHANGES_DESU-X.md`、`AGENTS.md`、`CLAUDE.md` | 説明書・この変更点・AI エージェント向けの案内 |

## 変更したファイル
| ファイル | 変更 |
|---|---|
| `index.html` | ツール名を DESU-X に（元のツールへのリンクは残す）。ファイルメニューに DESU-X JSON の読み込み（JSON・ZIP、フォルダ）・書き出しを追加。スクリプト・CSS の読み込みを追加。吹き出しの文字の向きの既定を縦書きに |
| `manifest.json`、`404.html`、`js/core/util/share-util.js` | 表示名を DESU-X に（元のツールの名前・リンクは出典として残す） |
| `js/core/settings.js` | `AI_FEATURES_ENABLED`、保存する項目（フォルダ・取り込み元の情報）を追加 |
| `js/layer/layer-management.js` | 選んでいる行の色付け、種類ごとの色とアイコン、フォルダ表示、AI のボタン列を削除、文字編集ボタン、行のレイアウト |
| `js/layer/layer-button.js` | 文字の入力中のロック表示を正しく |
| `js/sidebar/panel/panel-manager.js` | DESU-X JSON・ZIP のドロップ、キャンバスで動かしてもコマを乗り換えない、不要なロック警告を出さない、コマと一緒に選んだ物の所属を保つ |
| `js/sidebar/speechBubble/speech-bubble-effect.js` | 線を画像で持つ吹き出しに四角い枠が出ないように |
| `js/sidebar/text/vertical-textbox.js` | 「〜」「～」「―」「－」「‐」を縦書きで縦向きに |
| `js/sidebar/sidebar.js` | 起動時に左のパネルを開かない |
| `js/ui/canvas-object-menu.js` | 右クリックの AI 項目を出さない |
| `css/layout-layer.css`、`css/icon.css` | レイヤーパネル・フォルダ・モーダル・左メニューの見た目、レイヤー一覧の高さ |
| `llm_doc/` | 上の仕組みの説明を追記 |

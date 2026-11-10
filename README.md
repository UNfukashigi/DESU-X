# DESU-X

**DESU-X** は、new-sankaku さんの漫画エディタ **[Manga Editor Desu! Pro Edition](https://github.com/new-sankaku/manga-editor-desu)** をもとに改造した漫画エディタです。
AI に作らせた漫画の JSON を読み込んで、コマ割り・フキダシ・縦書きのセリフを手で仕上げる使い方に向けて、手を入れています。

- 元のツール：[Manga Editor Desu!（GitHub）](https://github.com/new-sankaku/manga-editor-desu) ／ [Web 版](https://new-sankaku.github.io/manga-editor-desu/)
- 元の作者：[new-sankaku](https://github.com/new-sankaku)
- ライセンス：GNU General Public License v3.0（元のツールと同じ。`LICENSE` を参照）

> **ご注意**：DESU-X は、改造者が自分用に作ったツールを公開しているものです。サポートはしていません。
> 不具合や分からないことは、ご自身で AI に相談するなどして解決してください。

---

## 使い方（基本）

1. GitHub の「Code → Download ZIP」でダウンロードして、展開する。
2. 展開したフォルダの **`index.html` をブラウザ（Chrome 推奨）で開く**。これだけで使えます（インストール不要、Python なども不要）。
3. 漫画の JSON（または ZIP）を、真ん中のキャンバスにドロップする（または「ファイル → DESU-X JSON を読み込み」で選ぶ）。新しいページとして入ります。
   - 試しに `examples/sample-text-only.json` をドロップすると、どう入るかが分かります。
4. コマ・フキダシ・セリフを手で直す。
5. 「ファイル → 画像ダウンロード」（Ctrl+D）で画像として保存する。

サーバーに置いて公開する使い方や、コードの改造は、自己責任でどうぞ。

---

## AI に「これを使えるようにして」と頼む

AI エージェント（Claude Code、Codex など、フォルダを読めるもの）に、展開したフォルダ（または ZIP）を渡して、

> これを使えるようにして

と頼むと、AI がこのツールの開き方と使い方を案内します（AI 向けの案内を `AGENTS.md`・`CLAUDE.md` に書いてあります）。

## AI に漫画の JSON を作ってもらう

同じように、

> このツール用にJSONを作って。内容は〇〇（話・コマ数・セリフなど）

と頼むと、AI が `DESU-X_JSON仕様.md`（このツールの JSON の仕様書）を読んで、読み込める JSON を作ります。
フォルダを読めない AI（チャットだけのもの）には、`DESU-X_JSON仕様.md` の中身を貼り付けてから頼んでください。

- 絵（コマの画像）も入れたいときは、画像を JSON に埋め込むか、`project.json` と画像を ZIP にまとめます（仕様書の 5 章）。

## 直した漫画を JSON で書き出す

「ファイル → DESU-X JSON で書き出し」で、エディタで直した漫画を同じ形式で書き出せます。

- **JSONだけ**：文字と配置だけの軽いファイル。AI に渡して、セリフの手直しなどを頼めます。
- **ZIP（画像込み）**：画像も入った一式。キャンバスにドロップすると、そのまま読み込み直せます。

---

## 元のツールからの主な変更

細かい一覧は `CHANGES_DESU-X.md` にあります。

- **DESU-X JSON の読み込み・書き出し**（JSON・ZIP）と、AI 向けの仕様書
- **レイヤーフォルダ**：まとめて動かす、ロック（解除の誤操作防止）、コマごとのフォルダ分け
- **レイヤーパネル**：種類ごとの色とアイコン、選んでいる行の強調、親子の字下げ、ドラッグでコマ・フォルダへ出し入れ
- **文字**：「文字編集」ボタンから横書きで入力して縦書きで反映、「フキダシの中央に配置」、「〜」「―」も縦向きに
- **誤操作の防止**：最初のクリックは選ぶだけ、キャンバスで動かしても別のコマに入らない
- **見やすさ**：下のレイヤーを選んだとき上の物を半透明で表示、上の物をクリックで選び直し
- **AI 生成機能を画面から外した**

---

## ライセンスについて

- このツールは GNU GPL v3.0 です。改造・再配布するときも GPL v3.0 に従ってください（ソースを公開し、同じライセンスで配る）。
- 同梱のフォント（`font/`）・ライブラリ（`third/`）は、それぞれのライセンスに従います（元のツールに同梱されていたものです）。
- 元のツールの説明は `README_ORIGINAL.md`（英語）・`README_JP.md`（日本語）・`README_CN.md`（中国語）に残しています。

---

## English

**DESU-X** is a modified version of [Manga Editor Desu! Pro Edition](https://github.com/new-sankaku/manga-editor-desu) by [new-sankaku](https://github.com/new-sankaku), licensed under GPL-3.0.
It is a personal tool shared as-is, with no support. Please solve problems on your own (for example, by asking an AI).

- Download the ZIP, extract it, and open `index.html` in a browser (Chrome recommended). No install, no Python needed.
- Drop a DESU-X JSON (or ZIP) onto the canvas, or use File → "DESU-X JSON を読み込み", to load manga pages. Try `examples/sample-text-only.json`.
- Ask an AI agent with this folder: "Make a JSON for this tool". It reads `DESU-X_JSON仕様.md` (spec, Japanese).
- Export your edits with File → "DESU-X JSON で書き出し" (JSON only / ZIP with images).
- Hosting on a server or modifying the code is at your own risk. Changes from the original: `CHANGES_DESU-X.md`.

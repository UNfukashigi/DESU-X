# 操作性監査（2026-08-26）の対応記録

対象: `llm_doc/ux-audit-2026-08-26.md` の45件（高11／中22／低12）。
作業日: 2026-08-27。7チーム並列＋取りまとめ。**45件すべてに手を入れた。**

実機確認は行っていない。確認したのは「コードを読んだ範囲」「`node --check`」
「`npm run check-translations`」まで。実機で確かめるべき点は末尾にまとめた。

---

## 1. 根っこ（R1〜R6）で何を1か所にしたか

症状ごとの対症療法ではなく、監査冒頭の6つの構造に対して入口を1つずつ作った。

### R1 「ロックが既定」なのにロックが見えない → `ModeManager.lock`
モードに入るときに書き換えるプロパティを、**書き換える分だけ**オブジェクトごとの
`_modeLockBackup` へ退避し、抜けるときに退避値へ戻す。退避が無いオブジェクトは触らない。

- 「退避が無ければ `selectable:true`」という既定値への倒し込みを一切作っていない。
  これを作ると、ロックされたコマがモードを抜けるたびに動かせるようになる（監査 #07 の症状そのもの）
- 除外（ナイフの分割線・吹き出しの下描き線・切り抜き枠など `excludeFromLayerPanel` が付くもの）は
  `lock._isTarget()` の1か所。呼び出し側ごとに書くと、書き忘れた経路で分割線が掴めるようになる
- `restore()` には除外を入れていない。`apply()` が除外するので除外対象には退避が付かず、
  `restore()` に足すと「モード中にフラグが付いた」場合に退避が戻らず残り続ける
- モード中に増えたオブジェクト（分割で生まれたコマ）は `lock.inherit(source,target)` で
  **今の値と退避の両方**を引き継ぐ。退避を引き継がないと、抜けたときに兄弟のコマだけ元へ戻る

一律書き換えをしていた4か所（ナイフ2・吹き出し3→1に集約・Shift一時解除）をすべてこれに載せ替えた。

### R2 モード状態が1か所に集まっていない → `ModeManager` へ経路を一本化
ナイフ・ペン・トーン・コマ編集・クロップが `ModeManager.change()` を通らない経路を持っていた。
入口を分離（`switchPencilType` / `switchMangaTone` は入口だけ、実処理は `applyPencilType` /
`applyMangaTone`）し、`ModeManager` から呼ぶ形にした。

- 案内文は `ModeManager.help` の1か所。`_defs` にモードと翻訳キーを1行足すだけで
  `change()` で出て `clearAll()` で消える。**全モードで `#canvas-help-text` が出る**
- 「モード解除(ESC)」の点灯条件から `isKnifeMode` 依存を外し、`_current!==SELECT` だけで決める
- パネル切替（`toggleVisibility()`）で「別パネルへ切り替わったときだけ」モードを解除
- 吹き出しの座標モードだけは `help._defs` に置いていない。打った点数で文言が変わる（#22）ため、
  `speech-bubble-freehand.js` が持つ。ここにも定義を置くと同じ場所を2か所から書くことになる

### R3 履歴の粒度が操作と一致しない → 履歴が変わる場所に通知を集約
`notifyHistoryChanged()` を `image-history-management.js` に置き、履歴スタックを触る
全経路（`captureState` / `applyHistoryState` / `allRemove` / `lastRedo` の空スタック時）から呼ぶ。

- ナイフON時の名前・GUID付与など「利用者から見て操作でないもの」を履歴に積まない
- `#undo` / `#redo` はスタックの端で `disabled` になる
- `applyHistoryState()` では `currentStateIndex=index` の**直後**に置き、
  JSON解析に失敗して抜ける経路も覆う

### R4 ページは「保存された時」にしか登録されない → `btmRegisterCurrentPage()`
ページが作られた時点で `btmProjectsMap` へ載せる登録口を1つ作り、ページを作る全経路から呼ぶ。
中身が空でも登録するので、空のまま別ページへ移ってもページが消えない。
起動直後の1ページ目も自動保存を待たずに Ctrl+B に出る。

原稿サイズ(mm)も `derivePageSizeMm()` の1か所に寄せ、`resizeCanvasToObject()` の中から呼ぶ。
4つの入口それぞれにあった `setPageSizeMm()` は全部消した。

### R5 親子リンクの解除経路が右クリックだけ → イベント2つに集約
`object:modified` と `object:removed` の**イベント1か所ずつ**に寄せた。
全呼び出し箇所にプロパティ変更を撒く形を避けている（CLAUDE.md の指示）。

- 移動が確定したら、現在位置から所属コマを判定し直して `clipPath` と `relatedPoly` を張り直す。
  どのコマにも属さなくなったら表示制限を外す（#13）
- コマを削除したら、子の `clipPath` と `relatedPoly` を外して残す（#14）
- 複製は `relinkClonedObject(cloned, sourceObj)` の1つに集約。Ctrl+C/V（`shortcut.js`）と
  右クリック「複製」（`canvas-object-menu.js`）が同じ関数を通る（#18）

### R6 後から差し込む文言が翻訳を通らない → 属性の役割を分離
`data-label` を「ラベルの原文だけ」を持つ属性にし、値は `data-value-text` に分けた。
表示は CSS の `content: attr(data-label) attr(data-value-text)` で連結する。

**#21 の機序**: 初回起動は `savedLanguage="en"` で `updateContent()` が走り、`setupSlider()` が
英語のラベルを掴んで保持する。その後日本語を選ぶと `updateContent()` が `data-label` を
日本語に戻すが、**スライダーの値が動いた瞬間**に `updateLabel()` が掴んだままの英語で
上書きするため英語に戻り、以後戻らない。**#39 のコントロールパネル英語化も同一原因**で、
訳は `base-*.js` に既にあった。

翻訳の追加・修正は `js/ui/third/i18next.js` の `const resources` に日付キーブロック
`20260827000000_001` を1つ足す形（88キー×8言語）。既存キーの修正も後勝ちで上書きされる。

---

## 2. 意図的に見送った点（判断と理由）

### #20 新規テキストの `fontSize` 14px は変えない — ユーザー判断
位置の問題（選択中のコマの中央／キャンバス中央に置く、押すたび24pxずらす、
作成直後に選択してハンドルを出す）は直したが、大きさは 14px のまま。

`fontSizeSlider` は画面に出ていて利用者が変えられ保存もされる設定なので、作成時に
黙って上書きするとスライダーの表示と実際の文字の大きさが食い違う（fallback 禁止）。

原稿サイズ(mm)から導く案も検証したが**成立しない**。`derivePageSizeMm()` は長辺を必ず
297mm に固定して短辺だけ縦横比から求めるため、**mm は縦横比の言い換えでしかなく
「A4はA5より大きい」という情報を持たない**。148×210(A5) も「A5である」ではなく
「原稿サイズが不明である」を意味する値（`applyPageSizeMm` のフォールバック）。

### #20 新規テキストをコマへリンクさせない
`moveSettings()` はコマの形の `clipPath` を設定するため、テキストがコマ枠で切り取られる。
漫画のセリフは枠をはみ出して置くことが珍しくないので、既定にすると
「打った文字が枠で切れて見えなくなる」状態を新たに作る。それは #13（コマの外へ出した画像が
消える）と同じ種類の問題。コマへ入れたい場合は右クリック「panelIn」から明示的に行える。

### #03 「操作させるチュートリアル」への作り替え
対象要素が無いステップを黙って飛ばすのはやめ、枠が出せなくても説明は画面中央に出すようにした。
ステップ定義と進行の仕組みごと作り替えるのは見落とし防止という範囲を超えるため見送り。

### #29 ドラッグ移動直後の Ctrl+Z の異常（監査でも「再現条件未特定」）
`dragPreviewLocked` / `dragStartChangeCounter` / `commitHistory()` の流れを読んだが、
原因を特定できなかった。**推測で直していない。未検証のまま残る。**

### フランス語の `cropHelpText` だけ強調が効かない
`showCanvasHelpText(text,"Enter")` は本文中の "Enter" をキー表示に置き換えるが、
フランス語だけ "Entrée"（正しいフランス語）なので置換が空振りする。表示のみの問題で、
正しいフランス語を英語に変えるのは改悪なので触っていない。

### 既存の `typeof` ガード（今回入れた分は全て除去済み）
今回の作業で入った `typeof X==='function'` 形式のガードは全部外した（下記参照）。
`js/ai/**` などに元からある十数か所は監査の対象外なので触っていない。

---

## 3. 監査の45件の外で見つけて直したもの

チーム間の相互作用や、修正が別の修正の前提を壊すことで表面化したもの。

| 内容 | 経緯 |
|---|---|
| `typeof X==='function'` ガード計13か所 | 存在確認して黙って素通りする形。未定義でも何も起きず、読み込み順が壊れたときに「押したのに何も起きない」を生む。`index.html` の script は全て `defer` で記述順に実行され、呼び出しはユーザー操作時なので不要 |
| `initMessage()` に `excludeFromExport` が無い | #32 でページ作成時に保存が走るようになり、**案内文が保存データに混入**。開き直すと `isInitMessage` を失った消せないテキストとして復活し、書き出し画像にも写る |
| `auto-save.js` の空プロジェクト判定が常に偽に | #32 で起動直後の1ページ目が必ず一覧に載るため、何も描いていなくても自動保存が走り、次回起動で「空のプロジェクトを復元しますか」が毎回出る |
| `askProjectLoadMode()` が毎回聞く | 同じ理由で `hasPages` が常に真に。起動直後に読み込むだけで毎回3択を聞かれる |
| ボトムバー「＋」が保存前に `setPageSizeMm()` | 今のページの `canvas_info.json` に**次ページのmm**が記録されていた |
| トーン適用中に右クリック→切り抜きでモードが二重に走る | `startCropMode()` が `clearAll()` を通らず、直前のモードが動き続けたまま案内文だけ差し替わる。`contextmenu` ハンドラにモード判定が無いため到達可能 |
| `crop.disable()` の `selectable:true` 決め打ち | `crop._enable()` は空でロックを掛けず、`selectable=false` にする箇所もどこにもない。ロックした画像を切り抜くだけでロックが外れる（#07 と同じ形） |
| 雪トーンの一時canvasが解放されない | 旧 `switchMangaTone` が `snowToneEnd()` を呼んでいなかった |
| `nowTone` の変数取り合いとデバウンス中の参照落ち | トーンを `ModeManager` に載せる過程で発見 |
| `text-effect.js` の `applyInnerShadow()` 二重定義 | 後勝ちで死んでいた方を削除 |
| `canvasMarginFromPanel` の `\|\|20` 二重定義 | `SETTINGS_SCHEMA` の `default` 参照に統一 |
| ペン `Marker` / `crayon` の訳抜け | ピッカーの `labelKey` / `hintKey` / `titleKey` 124キーを全件照合して発見 |
| `index.html` トーストの `min-width:250px` インライン固定幅 | CLAUDE.md の固定幅禁止 |
| 監査 #03 の見落とし | 再開導線は `index.html:625` の Help メニューに**既に存在していた**（監査は「完了トーストの文言のみ」としていた） |

### 言語選択オーバーレイがキー操作を通す（監査に無い）
`.tutorial-overlay` はポインタを塞ぐが `document` の `keydown` は通るため、
言語未選択のまま Ctrl+V や Delete が届く。`js/ui/tutorial.js` に `Escape` の文字列自体が無く、
×・背景クリック・`FocusTrap` のいずれも無い。**塞げていない。**

---

## 4. 実機で確かめるべき点（すべて未検証）

- **#01** 起動順（言語 → 復旧 → チュートリアル）が実際にその順で出るか
- **#02** 初回起動でAI基本設定欄に既定値が入り、生成結果と一致するか
- **#07 / #12** ナイフ・吹き出し・Shift を出入りしてもコマのロックが元に戻るか。
  モード中／モード外で分割したコマそれぞれ
- **#10** 各モードの案内文が `.area-header`（1行ぶんの高さ）に収まるか。
  狭い画面・長い訳（de/ru）での折り返し
- **#11 / #35** 4つの入口それぞれで原稿サイズ(mm)が更新され、出力ピクセル寸法が
  読めるか。mm を整数へ丸めるぶん比率が最大 0.17% ずれ、その分出力が大きくなる
- **#19** 吹き出しを置いた直後に編集モードへ入り既定文言が全選択されるか
  （`VerticalTextbox` の `enterEditing` 上書き実装でも動くか）
- **#25** トーンA→Bの切替で設定UIの作り直しが1回増えている。体感速度は未計測
- **#32 / #36** 新ページがボトムバーに出るか。ハンドルの文言が長い訳で収まるか
- **#33** 3択ダイアログの表示と、置き換え後のページ番号
- **#41** 上限で閉じたトーストが一瞬DOMに残る（Bootstrap の `hide()` が遷移込みで非同期）
- **#45** `.jscolor-color-picker` を使う全箇所（ページ管理・キャンバスメニュー・ブレンド・pen）
- **#35** `show.bs.dropdown` が document まで上がるか。上がらなくても
  DPI・原稿サイズを打ち替えた時点では更新される

---

## 5. 検証したこと

- `node --check`: 変更した全 js ファイルが通過。
  `package.json` に `"type":"module"` があるため **ESM として**検査される。
  classic script なら後勝ちで通るトップレベル関数の二重定義がここだけで落ちる
- `npm run check-translations`: 全1506キーが8言語すべてに存在
- 日付キーブロックの重複なし（重複すると後勝ちで前のブロックが丸ごと消える）
- 変更ファイル内の `getText()` / `i18next.t()` / `data-i18n*` / `titleKey` 参照を全照合し、
  未定義キーへの参照なし（`dashboardDay0-6` / `panelRole_*` の動的連結も実在を確認）
- 案内文の強調キー（`ESC` / `Enter`）が8言語すべての訳文に含まれることを確認。
  含まれないと `text.replace()` が空振りする
- 追加行のインデントはテンプレートリテラル内のHTMLとJSDocのみで、
  `npm run format` の保持対象（`npm run format` は未実行。`js/` 全体を走査するため）
- `npm run lint` は eslint が未インストールで実行できず

---

## 6. 分担（ファイル排他）

| チーム | 主な担当ファイル | 指摘 |
|---|---|---|
| A1-mode | `mode-manager` / `knife-mode` / `sidebar` / `tone-*` / `pen-tools` / `preset-panel` | #07 #10 #24 #25 #26 #39一部 |
| A2-panel | `panel-manager` / `layer-button` / `layer-management` / `fabric-util` / `canvas-object-menu` | #05 #06 #12 #13 #14 #15 #17 #31 #39一部 |
| A3-history | `knife-split-engine` / `fabric-management` / `shortcut` / `speech-bubble-freehand` / `image-history-management` | #08 #09 #16 #18 #22 #28 #29 #30 |
| A4-page | `bottom-bar` / `panel-template` / `canvas-manager` | #11 #27 #32 #36 |
| A5-boot | `project-management` / `auto-save` / `tutorial` / `unsaved-guard` / `settings` / `image-util` / `confirm-dialog` | #01 #02 #03 #33 #34 #35 #04一部 |
| A6-ai | `unified-settings-window` / `model-settings-window` / `llm-*` / `role-*` / `reference-sheet-window` / `dashboard-ui` / `comfyui-*` | #37 #38 #39 #40 #42 #43 #44 |
| A7-text | `custom-html-component` / `text-*` / `speech-bubble-text` / `speech-bubble-effect` / `toast` / `sidebar-ui` / `glfx-ui` | #04 #19 #20 #21 #23 #41 #45 |

翻訳ファイル（`base-*.js` 8本と `i18next.js`）は全チーム編集禁止とし、各チームが
キーと8言語訳をJSONマニフェストに書き出したものを最後にまとめて反映した。
`index.html` と `css/**` は共有だが Edit（一意な短い文字列の置換）に限定した。

今回の見落としパターンは `llm_doc/review-checklist.md` の #240〜#248 に追加した。

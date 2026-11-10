# レイヤー構造

## オブジェクト間のリンク機構
| リンク方式 | 方向 | 用途 |
|-----------|------|------|
| `parent.guids[]` | 親→子 | 親が子オブジェクトのGUID一覧を保持 |
| `child.relatedPoly` | 子→親 | 子が親Polygonへの参照を保持 |
| `child.clipPath` | 属性 | 親Polygon形状でマスク |

## 構造図
```
キャンバス (canvasGuid)
├─ Panel1 (guid:A, guids:[B,C])
│  ├─ ImageB (relatedPoly:Panel1, clipPath:Polygon)
│  └─ ImageC (relatedPoly:Panel1, clipPath:Polygon)
└─ SpeechBubble (guid:D, guids:[E,F], customType:speechBubbleSVG)
   ├─ Textbox (guid:E, customType:speechBubbleText)
   └─ Rect (guid:F, customType:speechBubbleRect)
```

## リンク確立の流れ
1. `putImageInFrame()` → `findTargetFrame()`でフレーム特定
2. `moveSettings(img, poly)`:
   - `updateClipPath()` → clipPath設定
   - `img.relatedPoly = poly` → 双方向参照
   - `img._clipPathHandler` → イベントハンドラを保存
   - イベントリスナー登録（moving/scaling/rotating/skewing/modified）
   - `img.removeClipPathListeners()` → リスナーのみ解除（guids維持）
   - `img.removeSettings()` → 完全解除（guidsも削除）
3. `setGUID(parentFrame, img)` → `parent.guids[]`に追加

## updateClipPath(img, poly)
- 親Polygonの形状からclipPathを動的生成
- オブジェクト移動/変形時にリスナー経由で自動呼び出し
- 部分削除後にリスナーを解除しないとclipPathが復活する

## リンク削除の流れ
1. `img.removeSettings()`を呼び出し
2. `removeGUID(relatedPoly, img)` → guids配列から削除
3. イベントリスナー削除
4. `relatedPoly`と`removeSettings`プロパティを削除

`removeSettings()`は`clipPath`そのものを消さない。表示制限ごと外すときは
`releasePanelLink(child)`（`panel-manager.js`）を使う。中で`removeSettings()`を
呼んでから`clipPath=undefined`まで行う。

## リンクを追随させる場所は2つのイベントだけ

`clipPath`は`absolutePositioned:true`で、**置いた時のコマの形と位置のまま固定される**。
`updateClipPath()`は`relatedPoly`から作り直すため、絵だけを動かしても切り抜きは
元のコマの位置に残る。配置・移動・複製・削除の各所へ直しを入れると必ず漏れるので、
次の2つのイベントに寄せてある（`panel-manager.js`のDOMContentLoaded内）。

| イベント | 処理 | 目的 |
|---------|------|------|
| `object:modified` | `relinkToPanelUnderObject(obj)` | 中心座標から所属コマを判定し直す。別のコマなら乗り換え（`releasePanelLink`→`moveSettings`+`setGUID`）、どのコマにも入っていなければ表示制限を外す |
| `object:removed` | `releasePanelChildren(panel)` | コマを消したとき、`guids`の子の表示制限と親子リンクを外す。**子そのものは消さない** |

- 乗り換えの対象は「今`relatedPoly`にコマ（`isPanel`）が入っている子」だけ。
  トーンや図形を親にしているものは触らない
- 複数選択（`activeSelection`）中の子は`left/top`がグループ基準になるため、
  中心は`getAbsoluteCenterPoint()`で取る
- `object:removed`は`canvas.clear()`でも1件ずつ飛ぶ。Undo/Redoの復元は
  一度空にしてから作り直すため、`isHistoryRestoreInProgress()`で抜ける。
  復元後は`resetEventHandlers()`が`guids`からリンクを張り直すので、
  「コマを消す→Undo」で子の切り抜きも戻る
- コマの中身を消さずに残すのは、消すと取り消しづらいため。
  吹き出しは`fabric-management.js`の`object:removed`で親子ごと消えるが、
  絵はコマから出しても意味を持つので揃えていない

## どのコマに入るかの判定

`findTargetFrame(x,y)`（落とし先）も`findPanelUnderPoint(x,y,除外)`（乗り換え先）も、
`isPointInShape()`でコマの**実際の形**を見る。外接矩形で見ると、斜めのコマや
重なったコマではポインタが乗っていないコマに入る。
polygon以外（rect/circle/path）は形の情報を持たないため外接矩形のまま。

## ロックと非表示

- **ロックは`selectable`**。`lockMovementX`等ではない（`llm_doc/review-checklist.md` #47）
- コマは`selectable:false`で生まれる。キャンバス側には理由が出ないため、
  `mouse:over`でカーソルを`not-allowed`にし、押されたら`hintLockedLayer(obj)`で
  レイヤー行の鍵に`.layer-lock-hint`を付けて4秒だけ点滅させる。
  解除の入口は`putMoveLockButton`の鍵1つだけなので、そこへ目を向けさせる
- **非表示のオブジェクトは選択しない。** fabricの当たり判定（`_checkTarget`）が
  `visible`を見るためキャンバスからは掴めないが、レイヤー行のクリックは
  `setActiveObject()`を通るので行側でも弾く。`visibleChange()`は非表示にするとき
  選択を外す。外さないとハンドルだけが宙に残り、Deleteで見えないものが消える。
  `selectable`/`evented`は触らない（`evented`は`commonProperties`に無く保存されない）

## 画像置き換え時の注意
- `layer.relatedPoly`で親Polygonを取得してから新画像を配置
- 元画像は`saveHistory=false`を設定してから削除（履歴に残さない）

## AIタスク進捗管理
`generation-task-manager.js`の`aiTaskMap`でAIタスク状態をグローバル管理する。
`updateLayerPanel()`がDOM全再構築するため、状態をグローバルに保持し毎回再描画する。

### aiTaskMapのデータ構造
```javascript
{taskId, canvasGuid, layerGuid, taskType, status, order, stepValue, stepMax}
```
- `taskType`: T2I, I2I, UP, BG, IP, ANG, TAG
- `status`: waiting → running

### ライフサイクル
1. `registerAiTask(layerGuid, taskType)` → タスク登録（status:waiting）
2. `setCurrentAiTask(taskId)` → 実行開始（status:running）、各プロバイダのqueue.add()内で呼ぶ
3. `updateAiTaskProgress(taskId, value, max)` → ステップ進捗更新
4. `removeAiTask(taskId)` → 完了/キャンセル時に削除、`.finally()`で呼ぶ

### レイヤーパネル描画
`executeUpdate()`内で`renderAiTaskIndicators(detailsDiv, layerGuid)`を呼び出し。
進捗更新は`refreshAiTaskIndicator(taskId)`でDOM直接更新（全再構築を避ける）。

### ページ切り替え対応
`aiTaskMap`に`canvasGuid`を保持。`getAiTasksForLayer()`で現在のキャンバスのタスクのみ取得。

## レイヤーフォルダ（`js/layer/layer-folder.js`）
- キャンバス上の入れ物（fabric.Group）は作らない。各オブジェクトに `layerFolderId`・`layerFolderName`・`layerFolderClosed` を持たせるだけ（`commonProperties` に入れて保存・Undoに残す）。Groupにすると clipPath・親子リンク・AI生成など「キャンバス直下にある」前提の処理が壊れるため
- フォルダの行をクリック → 中身を `ActiveSelection` で選ぶ。そのままドラッグでまとめて動く。非表示の物は選ばない
- コマを含めてまとめるときは、コマの中の画像（`guids`）も自動で入れる
- コマと中の画像を一緒に動かすとき、`object:moving/scaling/rotating/modified` で `updateClipPath()` を呼び直して切り抜きを追随させる。`relinkToPanelUnderObject()` は、画像とそのコマが同じ選択に入っているときは所属を変えない
- レイヤーパネルでは `lfGroupLayerOrder()` が中身をいちばん手前の中身の位置へ寄せ、その前にフォルダの行を入れる
- DESU-X JSON の取り込み（`qanima-folder-import.js`）は、フキダシ・ウニフラ・ナレーション枠と文字を1つのフォルダにまとめる
- レイヤーパネルで行をドラッグして出し入れできる（`lfBindLayerDrag`）。落とし先の優先順：①コマの行・コマの中の絵の行 → そのコマへ入れる（`lfPutIntoPanel`：中心がコマの外ならコマの中心へ動かし、重ね順をコマより手前にして `moveSettings`＋`setGUID`）②フォルダの行・中の行 → そのフォルダへ ③それ以外・空き → コマからもフォルダからも出す（`releasePanelLink`）。コマ自体はコマに入れない
- キャンバスでドラッグしても所属のコマは変えない（`panel-manager.js` の `PANEL_RELINK_ON_CANVAS_DRAG=false` で object:modified の `relinkToPanelUnderObject` を止めている）。コマの外へ動かした絵は切り抜きの外になり見えなくなる。コマ間の移動はレイヤーパネルのドラッグだけ
- DESU-X JSON の取り込みは、コマごとのフォルダ「コマN」（コマ・中の画像・枠の中に収まる吹き出し＋文字＋文字の枠・画像・文字）を作る。はみ出す物・ぶち抜きはフォルダに入れない（割り当ては JSON の folder で指定する）
- DESU-X JSON の取り込みでは、コマのフォルダに入る吹き出しをそのコマへリンクする（`moveSettings`＋`setGUID`）。吹き出しはコマの形で切れ、枠の外へ出た分は見えない（文字が見えていればフキダシは枠で切れてよい）。レイヤーパネルで吹き出しをコマの行へドラッグしても同じになる
- フォルダのロック（`layerFolderLocked`）：解除ボタンで間違えて解かないためのもの。作った時はロック。ロック中は解除ボタンが効かない。中身の編集・移動・パネルでの出し入れは止めない。フォルダの行の鍵ボタンで切り替える
- DESU-X JSON の取り込みは、フォルダだけロック（コマも含めて中身はすべてロックなし）

## 最初のクリックは選ぶだけ（`js/fabric/click-select-first.js`）
- 選んでいない物を押してそのままドラッグしても動かない（誤操作防止）。もう一度押してドラッグすると動く
- `mouse:down:before` で選ばれていなければ、押している間だけ `lockMovementX/Y` を立て、`mouse:up` で元の値に戻す。履歴の自動コミット網に拾わせないよう、set() ではなく直接代入
- フォルダを選んで（中身をまとめて ActiveSelection で選んで）いるときに文字をダブルクリックすると、その文字だけを選び直して入力に入る（`click-select-first.js` の `mouse:dblclick`）。まとめて選んだままだとクリックがまとまりに吸われ、入力に入れないため。カーソルは `getSelectionStartFromPointer` で押した位置に置き、`_updateTextarea()` で隠しテキスト欄にも反映する
- 選んだ物はいちばん手前に描かれる（preserveObjectStacking=false）ので、選んでいる間だけ、選んだ物より上にあって重なる物を半透明（0.5）で上に重ねて描く（`click-select-first.js` の after:render。画面の描画だけ）。選んだ吹き出しの中の文字はそのままの濃さ
- ロックの警告（hintLockedLayer）は、入力中の文字・吹き出しの文字の枠・フォルダの中身では出さない（panel-manager.js の mouse:up）
- 下の物を選んでいるときに上の物を押したら、上の物を選ぶ（`click-select-first.js` で canvas.findTarget を包む）。fabric は選んだ物の範囲を押すと選んだ物を返すため。ハンドルを押したとき・上に選べる物が無いときは選んだ物のまま

## 文字の入力モーダル（`js/sidebar/text/text-edit-modal.js`）
- レイヤーパネルの文字・吹き出しの行に「文字編集」ボタン（edit_note）。押すと横書きの入力欄のモーダルが開き、反映すると文字を差し替える（縦書きの文字は縦書きのまま描かれる）。キャンバスで直接打つと縦書き・IMEで不安定になりやすいための入口
- 反映は text を差し替えて canvas の `text:changed` を出すだけ。吹き出しの大きさ合わせ・履歴は既存の text:changed の処理に任せる
- Ctrl+Enter で反映、Esc で閉じる（変換中の Enter・Esc は IME に渡す）。入力欄のキーはキャンバスのショートカットに届かないよう止める

# UIパターン

## DOM操作ユーティリティ（ui-util.js）
```javascript
const $=(id)=>document.getElementById(id);
hideById(id) / showById(id)
toggleVisibility(target)
selectedById(ids) / unSelectedById(id)
```

## EventDelegator（event-delegator.js）
document-levelのクリック委譲。`data-action`属性でハンドラを呼び分ける。
```html
<button data-action="flipHorizontally">Flip</button>
```
```javascript
EventDelegator.register('flipHorizontally',function(el,e){...});
```

## Toast通知（toast.js）
```javascript
createToast(title,messages,time=4000)
createToastError(title,messages,time=4000)
```
- 成功: `toast-nier`テーマ、エラー: `toast-dbd`テーマ
- Bootstrap Toast APIベース
- 本文は`textContent`で描く。外部APIの応答文がそのまま渡ることがあるためHTMLとして解釈させない
- ポインタが乗っている間はカウントダウンが止まり、`.toast-close`（×）で手動でも閉じられる。
  制御は`startProgressBar()`1か所にあるので、呼び出し側は何もしなくてよい
- `role`/`aria-live`はエラーなら`alert`/`assertive`、それ以外は`status`/`polite`
- **同時に見えるのは`TOAST_MAX_VISIBLE`枚まで**。溢れたら情報から先に閉じ、エラーは残す。
  右下に積み上がると右パネル下部（Width/Seed/Generate）が押せなくなるため
- **同じ内容は積まずに回数だけ増える**。判定キーは「エラーかどうか＋タイトル＋本文」で、
  一致したら`.toast-repeat`に`×N`を出して表示時間を取り直す。
  押すたびに新しい枚数が増える作りにしないこと
- 容器（`#sp-manga-toastContainer`）は`pointer-events:none`。余白部分のクリックは
  下の右パネルへ通る。トースト本体だけが`pointer-events:auto`

## 確認ダイアログ（js/ui/util/confirm-dialog.js）
元に戻せない操作の前に必ず通す。各所でモーダルをベタ書きすると
閉じ方（×・Esc・背景クリック）が揃わなくなるため、入口をここ1つにしている。
```javascript
var ok=await showConfirmDialog({
  titleKey:'confirmDeletePageTitle',
  message:i18next.t('confirmDeletePageBody',{page:1}),  // messageKeyでも可
  danger:true
});
if(!ok)return;
```
- ×・Esc・背景クリック・キャンセルはすべて「取り消し」に揃えてある
- `FocusTrap`でTab循環と閉じた後のフォーカス復帰も入る
- 初期フォーカスは誤操作を防ぐため取り消し側
- await後は状態が変わっている可能性があるため、対象の存在とインデックスを取り直す

3択以上が要るときは`choices`を渡す。戻り値は選ばれた`key`、取り消しは`false`。
```javascript
var r=await showConfirmDialog({
  titleKey:'projectLoadModeTitle',
  message:message,
  cancelKey:'projectLoadModeCancel',
  choices:[
    {key:'replace',textKey:'projectLoadModeReplace',secondary:true,danger:true},
    {key:'append', textKey:'projectLoadModeAppend'}
  ]
});
if(!r)return;            // ×・Esc・背景クリック・取り消し
if(r==='replace'){...}
```
- `choices`を渡さないときの戻り値（`true`/`false`）と見た目は変わらない。
  取り消しはどちらの形でも`false`なので、既存の`if(!ok)`判定はそのまま通る
- `secondary:true`は取り消しと同じ塗り＋アクセント枠。`danger:true`と併せると赤字になる。
  消す側の選択肢を主ボタンと同じ塗りにすると押し間違えるため、必ず`secondary`と併用する
- 消す選択肢はこのダイアログ1枚で完了させず、もう一段`showConfirmDialog()`を通す
  （例: `js/core/auto-save.js`の自動保存データ削除）

判断材料が文章だけでは足りないときは`content`にDOM要素を渡す。文字列は受け取らない
（HTML文字列を渡せるようにすると、翻訳文をそのまま差し込む使い方に流れる）。
```javascript
await showConfirmDialog({
  titleKey:'autoSaveRecoveryTitle',
  message:msg,
  content:buildRecoverySummary(metadata,pages),  // 呼び出し側が組んだ要素
  wide:true,                                     // 一覧や図を出す幅に広げる
  choices:[...]
});
```
- 中身のスタイルは呼び出し側のCSSに置く（例: `css/ui/recovery-dialog.css`）。
  `confirm-dialog.css`が持つのは`.confirm-dialog-content`の余白と`is-wide`の幅だけ
- ページ数のように件数が読めないものは、`content`側で`max-height`＋スクロールにする。
  ダイアログごと伸びるとボタンが画面外へ出る

## モーダル
HTML動的挿入＋CSSオーバーレイ。パターン:
- `position:fixed` + `rgba(0,0,0,0.6)` + backdrop blur
- z-index: `var(--z-modal)` / `var(--z-overlay)`
- レスポンシブ: `max-width:720px; width:90%; max-height:80vh`

## スライダー（custom-html-component.js）
```javascript
setupSlider(slider,classname,addButton=true)
```
スライダーにup/downボタンとラベルを自動付与。

**ラベルの原文と表示値は別の属性に持つ。**
- `data-i18n-label="キー"` … 翻訳キー。`updateContent()`と`applyLabelTranslations()`が
  ここから`data-label`へ訳を書く。**この2つだけが`data-label`の書き手**
- `data-label` … ラベルの原文（訳された文字列）
- `data-value-text` … 今の値（`：14`のように区切りごと）。`setupSlider()`だけが書く
- 表示は`.input-container::before`が`attr(data-label) attr(data-value-text)`で連結する

以前は`data-label`へ「ラベル：値」をまとめて上書きしていた。すると言語を切り替えても
次にスライダーの値が動いた瞬間に切替前の言語のラベルへ戻り、英語のまま固定された
（監査#21・#39）。**`data-label`に値を混ぜないこと。**

`aria-label`はスライダーとup/downボタンに付くが、これは`data-label`の変化を
`MutationObserver`で1か所で拾って取り直している。呼び出し側は何もしなくてよい。

`js/sidebar/sidebar-ui.js`の`addSlider()`のように`innerHTML`で作る場合も
`data-i18n-label`を必ず付ける。付けないと言語切替で取り残される。

## レイヤーパネル更新（layer-management.js）
`updateLayerPanel()`はデバウンス付き（60ms最小間隔）。
```
updateLayerPanel() → 60ms throttle → executeUpdate() → DOM全再構築
```
- GUID階層でネスト表示
- Material Designアイコンでレイヤー種別を識別
- プレビューサムネイル表示

**行は全体が選択のあたり判定。** 行のほとんどを名前の入力欄`.layer-name`が占め、
テキストレイヤーにはサムネイルも付かないため、入力欄がクリックを止めると押して選択
できる場所が行に残らない。入力欄は既定で`readOnly`にし、`mousedown`で
`preventDefault()`してフォーカスを取らせず、クリックは行の選択へ通す。

**名前の編集はダブルクリック。編集中かどうかはDOMに置かない。**
`executeUpdate()`は毎回`layerContent.innerHTML=""`で全部作り直すうえ、60msの
デバウンスで**遅れて**走ることもある。入力欄に状態を持たせると、編集を始めた直後の
作り直しでフォーカスごと消える。編集中の行は`layerNameEditGuid`（GUID）で覚え、
作り直しの最後に`beginLayerNameEdit()`で戻す。

そのための約束事が4つある。

- **dblclickは行ではなく`#layer-content`で受ける**（`onLayerNameDblclick`）。1回目の
  クリックで行が作り直されると2回のクリックの対象が別物になり、dblclickは行ではなく
  共通の祖先へ飛ぶ。対象から辿れないときは`elementFromPoint()`で引き直す。
  行に付けると、素早く2回押したときだけ動く不安定な操作になる
- **作り直し中の`blur`は編集終了と見なさない**（`layerPanelRebuilding`）。行ごと
  消えるときも`blur`は飛ぶ
- **終了は`blur`だけに頼らない**。Enter/Escapeからも`endLayerNameEdit()`を呼ぶ
- **作り直しの先頭で、フォーカスが名前欄から離れていたら編集を畳む。** 畳まないと
  `blur`を取り逃したときに作り直しのたびに名前欄がフォーカスを奪い続け、
  キャンバス上の文字入力ができなくなる

**表示する値と書き込む値を揃える。** テキストレイヤーの行は本文（`layer.text`）を
出しつつ入力は`layer.name`へ書いていたため、打った文字が作り直しのたびに本文へ
戻っていた。名前を付けるまでは`layer.name`を`layer.text`に同期させ、付けたら
`layer.nameEdited`を立てて同期を止める（`nameEdited`は`commonProperties`にある）。

## CSS変数（root.css）
```css
.dark-mode{
  --color-base:#212121;
  --color-secondary:#333333;
  --color-accent:#810000;
  --color-text-primary:#ffffff;
  --odd-layer:#262626;
  --even-layer:#2c2c2c;
  --layer-active-bg:#3a1a1a;
  --layer-active-border:#a03030;
  --btn-bg:rgba(255,255,255,0.07);
  --btn-hover-bg:rgba(255,255,255,0.15);
}
```

## i18n（i18next.js）
HTML属性での翻訳:
```html
<h3 data-i18n="keyName"></h3>
<input data-i18n-placeholder="keyName">
```
JS内:
```javascript
getText("keyName")  // i18next.t()のラッパー
```

`updateContent()`は`data-i18n`要素に対し`element.innerHTML = translation`するだけで、
**属性の翻訳には対応していない**。`data-i18n="[title]keyName"`のような記法は無効で、
キー文字列がそのまま本文に差し込まれ`material-icons`のリガチャが壊れる。
ツールチップは`data-tip`属性に置き、`addTooltipsByAttribute()`（tippy.js）で登録する:
```html
<i class="material-icons" data-tip="keyName">tune</i>
```
`setLanguage()`が`removeTooltips()`→再登録まで面倒を見るため、要素を増やしても
登録処理を書き足す必要はない。

### 後から差し込んだDOMへの翻訳適用
モーダルやフローティングウィンドウを`insertAdjacentHTML`等で後から追加した場合、
その中の`data-i18n`要素は起動時の`updateContent()`より後に生えるため未翻訳になる。
自前で翻訳を当てるときは以下を守る:

- **走査範囲を挿入したコンテナ配下に限定する**。`document.querySelectorAll('[data-i18n]')`
  で全体を走査すると、既に翻訳済みの他モジュールのUIまで巻き込んで上書きする。
- **`textContent`ではなく`innerHTML`を使う**。翻訳値には`&#128295;`のような
  HTML実体参照やタグが含まれるものがあり、`textContent`だとそれが文字列のまま表示される
  （`updateContent()`本体も`innerHTML`）。

```javascript
const root=$('fm-modalOverlay');
root.querySelectorAll('[data-i18n]').forEach(el=>{
el.innerHTML=i18next.t(el.getAttribute('data-i18n'));
});
```

## プリセット型サイドバーパネル（preset-panel.css）
「プリセットを選んで設定を調整する」パネル（効果・ペン・トーン・画像テキスト）の共通構造。
一覧の出し方が2通りある:

| 型 | 使うパネル | 理由 |
|----|-----------|------|
| 一覧をパネルに常時置く | 効果 | 押した後の挙動が4通りあり、グループ見出しで違いを示す必要がある |
| 今のプリセットだけ置く（`preset-current`） | ペン・トーン・画像テキスト | 一度に使うのは1つだけ。一覧を常時置くと設定が画面外へ押し出される |

### A. 一覧を常時置く型

```html
<div class="left_area preset-panel" id="..." style="display: none;">
  <div class="area-header preset-panel-header">
    <span class="pp-title" data-i18n="..."></span>
    <a class="pp-help" href="..." target="_blank" data-tip="help"><i class="material-icons">help_outline</i></a>
  </div>
  <div class="preset-panel-body">          <!-- ここだけがスクロールする -->
    <div class="preset-group-header">
      <span data-i18n="..."></span>
      <span class="preset-group-hint" data-i18n="..."></span>
    </div>
    <div class="preset-section">           <!-- 適用範囲が効く範囲を囲みで示す -->
      <div class="preset-list">
        <button class="preset-item">
          <span class="preset-item-name">
            <span data-i18n="..."></span>
            <i class="material-icons preset-item-mark" data-tip="...">tune</i>
          </span>
          <img class="preset-item-thumb" src="..." alt="">
        </button>
      </div>
    </div>
    <div id="..-settings"></div>           <!-- 一覧を消さず下に出す -->
  </div>
  <button class="preset-panel-foot" data-action="..."></button>
</div>
```

守る点:
- **一覧は1列**。2列にするとサムネイルが小さくなり、Color2BW系4種のような
  見た目でしか区別できないプリセットが判別不能になる
- **一覧に`max-height`を付けない**。パネル本体（`preset-panel-body`）だけを
  スクロールさせる。一覧側にも付けると二重スクロールになる
- **設定は一覧と入れ替えず下に出す**。入れ替えると他のプリセットへ切り替えられなくなる
- **押した後の挙動が違うものには`preset-item-mark`を付ける**
  （`tune`=設定してから適用 / `visibility`=プレビュー付き / `open_in_new`=別ウィンドウ）
- 適用範囲など「対象を選ぶUI」は、それが効く項目だけを含む`preset-section`の内側に置く
- 文字を入れてから実行する型（プロンプトパネル）は`preset-section`の中に
  `preset-field-label` / `preset-field-input` / `preset-check` /
  `preset-sub-button`（前段の操作） / `preset-apply-button`（主操作） /
  `preset-status`（実行中の表示）を並べる。適用範囲は効果と同じ
  `effect-scope-label` + `input-group-multi effect-scope-group`を使い、
  パネルごとに見た目を作り分けない
- **チェックボックスの`<label>`に`data-i18n`を付けない。** `updateContent()`が
  `innerHTML`ごと差し替えて`<input>`が消える。内側に`<span data-i18n>`を置く

### B. 今のプリセットだけ置く型（preset-panel.js）

```html
<div class="left_area preset-panel" id="tool-area" style="display: none;">
  <div class="area-header preset-panel-header">
    <span class="pp-title" data-i18n="side-label-pen"></span>
  </div>
  <button class="preset-current" id="penPresetCurrent"
          data-action="openPresetPicker" data-preset-kind="pen" data-tip="presetCurrentHintToggle">
    <span class="preset-current-row">
      <span class="preset-current-name" data-i18n="presetNotSelected"></span>
      <span class="preset-current-swap">
        <i class="material-icons">unfold_more</i><span data-i18n="presetChange"></span>
      </span>
    </span>
    <img class="preset-current-thumb" alt="" hidden>   <!-- 未選択の間は出さない -->
  </button>
  <div class="preset-panel-body" id="tool-settings"></div>   <!-- ここだけがスクロールする -->
</div>
```

一覧・見出し・サムネイルは`PRESET_PANELS`（`js/ui/preset-panel.js`）に1か所だけ持ち、
カードもピッカーも同じ定義から作る。項目を増やすときはここだけを直す。

守る点:
- **カードの更新は各マネージャが元から持つ「activeを付け外しする1か所」からだけ呼ぶ**
  （`switchPencilType` / `switchMangaTone` / `switchText2Ui`）。切り替え経路ごとに
  `presetPanelSetActive()`を書き足すと更新漏れになる。
  `clearPenActiveButton()`/`clearActiveToneButton()`は`presetPanelClearActive()`の入口として残す
  （`ModeManager.pencil.disable()`等、パネル外からも呼ばれるため）
- **使用中かどうかをカードに出す**（`.preset-current.is-active`）。一覧を畳んだ分、
  ここを省くと描画モードに入っているかがパネルから読み取れなくなる
- **未選択の間はプリセット名を出さない**（`presetNotSelected`）。最初の1件を
  既定として見せると、押していないものが選ばれているように誤認させる
- **選び直しの結果はボタン時代と同じ**。使用中のものをもう一度選べばペン／トーンは終了する。
  一覧を畳むとこれが見えなくなるため`data-tip`で示す

## プリセットピッカー（preset-picker.js）
項目数が多く`<select>`では選びにくい一覧をポップアップで選ばせる。
`<select>`を値の保持元として残したまま、見た目だけ差し替えるのが基本形:

```javascript
PresetPicker.openFromSelect($("glfxFilter"), getText("glfxFilterPickerTitle"));
```

`openFromSelect()`は`<option>`から一覧を組み立て、選択時に`select.value`へ代入して
`change`イベントを発火する。**既存のchangeハンドラがそのまま動く**ため、
項目を増やすときは`<select>`だけを直せばよい（一覧を二重に持たない）。

任意の一覧を出す場合:
```javascript
PresetPicker.open({
  title: getText("..."),
  items: [{value:"a", label:"A", hint:"説明"}],
  currentValue: "a",
  onPick: function(value){ /* ... */ }
});
```

閉じる操作は「×ボタン」「Escape」「ピッカーの外をクリック」の3つ。
外側クリックは`document`のmousedown（capture）1か所で判定する
（暗幕はパネルの右側しか覆っていないため、暗幕への`click`だけでは
サイドバー側のクリックを拾えない）。`pointerdown`ではなくmousedownなのは、
pointerdownの時点で暗幕を消すと直後のmousedownが下のキャンバスに届くため。

注意点:
- カードに表示中の名前は`<option>`のtextContentから写す。名前を別に持つと
  項目追加時の修正漏れになる
- 写した表示名は`updateContent()`の対象外なので、言語切替時に取り直す
  （`changeLanguage()`から`glfxSyncFilterCard()`を呼んでいる）
- 後から`innerHTML`で差し込んだ`data-i18n`要素は`applyLabelTranslations()`では
  翻訳されない（あちらは`data-i18n-label`専用）。`updateContent()`を呼ぶ

## アイコンのみのボタン
`<i class="material-icons">swap_horiz</i>`だけのボタンは、支援技術にリガチャ文字
（"swap_horiz"）がそのまま読み上げられる。名前は`addTooltipByElement()` /
`addTooltip()` / `addTooltipsByAttribute()`の中で`aria-label`と`title`が
同時に付くので、**ツールチップを登録すれば足りる**。個々のボタンに手で
`aria-label`を書くと必ず抜ける。

HTML側は`data-tip="翻訳キー"`を付けるだけでよい（`addTooltipsByAttribute()`が走査する）。
文型が同じで名前だけ変わるものは`data-tip-name`で`{{name}}`へ差し込む。

## フォーカス
`css/form.css`の`button{}`直後に`:focus-visible`があり、全ボタン・リンクに効く。
個別CSSで`outline:none`を書くときは、必ず枠線や影で代替を用意する。

## 永続化
| ストア | 用途 |
|--------|------|
| `localforage` | IndexedDB非同期ストレージ（SettingsRepository, auto-save等） |
| `localStorage` | 設定バックアップ、プロバイダ設定 |
- `SettingsRepository`: TTL付きget/set対応
- `localforage.createInstance({name:'xxx'})` で用途別インスタンス

### サイドバーの入力値（sidebar-ui.js）
`sidebarValueMap` → localStorageの`sidebarValues`。書き込みは
`saveValueMap(element)`（`element.id`と`element.value`）で、**保存されるのは
「設定の自動保存」がONのときだけ**。

入力要素を持たない値（フォント名など）は`saveValueMapByKey(key,value)`で同じ入れ物へ
入れる。`FontSelector`は`persist`を渡したインスタンスだけが`font:<targetId>`のキーで
保存し、次回起動時の既定になる。オブジェクトメニューのセレクタのように「選択中の
オブジェクトの書体」を映すものには持たせない（前回の選択で上書きされ対象と食い違う）。
復元時は`fontManager.existsFont()`で存在を確かめ、消えている書体名は表示しない
（無い書体名を出すと、実際には別の書体で描かれているのに気付けない）。

## ModeManager
操作モード切り替え: SELECT, FREEHAND, KNIFE, CROP, PANEL_EDIT, PEN各種, TONE各種
```javascript
ModeManager.getCurrent()
ModeManager.MODE.SELECT
```

### モードの入り口は必ず ModeManager.change() を通す
モードごとにフラグを直接書き換えると、`getCurrent()`が実態と食い違い、
案内文も「モード解除」ボタンも点かないモードが残る。入り口は各モードの
`enable()`（内部で`change()`が走る）に寄せ、`_enable()`は`change()`からだけ呼ぶ。

| モード | 入り口 | 実処理 | `change()`を通るか |
|--------|--------|--------|--------------------|
| ナイフ | `changeKnifeMode()` → `ModeManager.knife.toggle()` | `knife._enable` / `knife.disable` | 通る |
| トーン | `switchMangaTone(type)` → `ModeManager.change(type)` | `applyMangaTone` / `endMangaTone` | 通る |
| ペン | `switchPencilType(type)` → `ModeManager.change(type)` | `applyPencilType` / `endPencil` | 通る |
| コマ編集 | `ModeManager.edit.enable()` | `panel-manager.js` の `Edit()` | 通る |
| クロップ | `startCropMode()`（mode-change.js） | `startCropMode` | **通らない**（未対応） |
| 吹き出し | `sb*Button`のclick（speech-bubble-freehand.js） | `setDrawingMode` / `setSelectionMode` | **通らない**（未対応） |

「通らない」モードは`getCurrent()`が`'select'`のままで案内文も出ない。
解除だけは`clearAll()`が各`disable()`を呼ぶので効く。新しくモードを足すときは
必ず`change()`を通す側に作ること。

**入り切りのフラグは、モードAPIを呼ぶ「前」に読むこと。** `clearAll()`は各モードの
`disable()`を通ってフラグを落とすため、呼んだ「後」に`flag=!flag`とすると
OFFにしたつもりがONに戻る。判定結果を先に変数へ取ってから分岐する。

```javascript
var willEdit=!poly.edit;                 // 先に決める
if(willEdit){ModeManager.edit.enable();}else{ModeManager.clearAll();}
poly.edit=willEdit;
```

**モードごとの状態変数を他の用途と共有しない。** トーンは`nowTone`（今どのトーンか）に
描いた画像を入れていたため、同じトーンを選び直しても終了と判定されず二重に置かれていた。
画像は`nowToneImage`のようにその効果専用に持つ（`nowSnowTone` / `nowToneNoise`と同じ）。

**単独でも呼ばれる`disable()`は、抜けた状態まで揃える。** `ModeManager.knife.disable()`は
「ナイフだけ畳んで別モードへ移る」経路（`updateKnifeMode()`）から`clearAll()`を介さずに
呼ばれるため、`_current`を`SELECT`へ戻し案内文も消す。ここで`clearAll()`を使うと
呼び出し元が直前に入れた`currentMode`まで消える。

`change()`は先頭で`clearAll()`を呼ぶ。**コマ編集のように「入り口を呼んだ後に
自分で状態を組み立てる」モードは、組み立てる前に`enable()`を呼ぶこと**。
後から呼ぶと`clearAll()`が組み立て直後の状態を戻してしまう。

### モード中のロックは退避して戻す（`ModeManager.lock`）
コマは`selectable:false`で生まれる。モードに入るときに全件を一律に書き換えて
抜けるときに`selectable:true`へ戻すと、**ロックしていたコマまで動くようになる**。

```javascript
ModeManager.lock.apply({selectable:false})     // 書き換えるプロパティだけを退避してから適用
ModeManager.lock.restore()                     // 退避値へ戻し、退避を捨てる
ModeManager.lock.inherit(source,target)        // モード中に増えたものへ退避ごと引き継ぐ
```
- 退避はオブジェクトの`_modeLockBackup`に置く。退避が無いもの（モード中に増えたもの）は触らない
- 「退避が無ければ既定値」にしない。既定値へ倒すと元のロックが消える
- `clearAll()`の最後に`restore()`が走る。モード側で個別に書き戻さない
- `apply()`を重ねて呼んでも退避は最初の1回だけ取る。Shift中の一時解除のように
  モードの上からもう一度当てても、モードに入る前の値が残る
- **`excludeFromLayerPanel`が付くものは対象外**（ナイフの分割線・吹き出しの下描きと
  当たり判定用の矩形・切り抜き枠）。除外は`lock._isTarget()`の1か所にあるので
  呼び出し側に書かない。書かせると、書き忘れた経路で分割線や切り抜き枠が掴めるようになる
- 除外の判定は`apply()`にだけ置く。`restore()`は「退避が付いているものを戻す」だけにする。
  `restore()`でも除外を見ると、モード中にそのフラグが付いたオブジェクトの退避が残り続ける

モード中に生まれたオブジェクト（ナイフの分割で増えたコマなど）は退避を持たないため、
抜けても元へ戻らず兄弟とロック状態が食い違う。元になったオブジェクトから引き継ぐ:

```javascript
canvas.add(polygon1);                          // object:added がモードの値を当てる
ModeManager.lock.inherit(polygon,polygon1);    // 退避と今の値を分割元から引き継ぐ
```
`source`に退避が無い（＝モードの外）ときは引き継ぐものが無い。`selectable`は
呼び出し側が`source`から写す。ここで既定値を当てると元のロックが消える。
- **モードの中の一時解除（Shift押下中だけ選択可）で`restore()`を呼ばない。**
  戻す先はモードに入る前ではなくモード中の状態。`restore()`は退避ごと捨てるため、
  抜けるときに戻すものが無くなる。離したときはモード自身の状態を`apply()`で当て直す
  （`fabric-management.js`のShift、`speech-bubble-freehand.js`の`updateObjectSelectability()`）
- **一時解除で足すプロパティを増やさない。** モードが`{selectable}`だけを退避したなら
  一時解除も`{selectable}`だけにする。退避に無いプロパティは`restore()`で戻らない
- **モード中に作ったオブジェクトが既存のものと同じ扱いを受けるべきなら、
  退避も引き継がせる。** ナイフの分割で生まれるコマは分割元の`_modeLockBackup`を
  写している（`knife-split-engine.js`の`inheritPanelLockState()`）。
  写さないと、抜けたときに兄弟のコマだけ元のロックへ戻って食い違う

### キャンバス上の案内文（`#canvas-help-text`）
`ModeManager.help._defs`にモードと翻訳キーを1行足すだけで、
`change()`で出て`clearAll()`で消える。表示処理をモード側に書かない。

**例外は吹き出しの座標モードだけ。** 「4点以上打ってから始点をクリック」という
確定条件は打った点数で文言が変わるため、固定文の`_defs`では表せない。
`speech-bubble-freehand.js`の`updateFreehandPointHelpText()`が直接出し入れしている。
`_defs`にも登録すると同じ場所を2か所から書くことになるので、登録していない。

```javascript
_defs:{ knife:{key:'knifeHelpText',highlight:'Esc'} }
```
`highlight`は文中のその文字列を`.help-key`で強調する。**訳文に必ずその文字列を
含めること**（含まれない訳は強調されない）。案内文には「今どのモードか」
「何をすればよいか」「どう抜けるか」の3つを入れる。ヘッダーは1行しか
余裕が無いので短くする。

### 「モード解除(ESC)」ボタン
点灯条件は`ModeManager._current!==MODE.SELECT`だけで決める（`ModeManager.button`）。
モードごとに点け外しを書くと点かないモードが残る。

## 選択オブジェクトと各パネルの同期（object-control-sync.js）
同じ設定（不透明度・線幅・色・フォントサイズ）が複数のパネルに存在するため、
1箇所で変更した値を他へ反映しないと、次にそのパネルを触ったときに
**表示されている古い値へ飛ぶ**。

```javascript
syncObjectControls(activeObject)  // 共通コントロール・テキスト・コマ・吹き出し・画像テキストへ反映
```
- `selection:created` / `selection:updated` で呼ぶ
- いずれかのパネルで値を変更した直後にも呼ぶ
- jscolorのピッカーは`value`代入では見た目が変わらない。`picker.jscolor.fromString(色)`を使う

## 画像テキスト（text-2-manager.js / custom/）
パラメータ変更のたびにSVGをラスタライズして**オブジェクトを作り直す**。
そのままだと変形・重ね順・GUIDが失われるため、共通ヘルパーで引き継ぐ。

```javascript
const position=t2BeginReplace(nowT2XxxStr);   // 変形とindexを退避し履歴を抑止して削除
nowT2XxxStr=t2PlaceImageTextObject(img,'xxx',left,top);  // 退避した内容を適用し元のindexへ戻す
```

### 種類の足し方（汎用ドライバ）
`text-effect-presets.js`の`T2_EFFECT_PRESETS`に1件足すだけで、
`generic-text-effect.js`が生成・更新・削除・パラメータUIまで面倒を見る。

```javascript
"neon":{
region:T2_GLOW_REGION,          // フィルタ領域。発光やぼかしは既定だと切れる
padding:1,                       // SVGの余白（文字サイズに対する比）
colorInterpolation:"sRGB",       // 省略時はlinearRGB
ref:40,                          // 見本SVGのfont-size。省略時は20
light:{x:0.5,y:0.25,z:5},        // fePointLightの位置（幅/高さ/文字サイズに対する比）
params:[t2ColorParam("EffectColor1","#00ffff"),T2_PARAM_ROUGHNESS],
primitives:function(c){return [{type:"feTurbulence",attrs:{...}}];},  // フィルタの中身
defs:function(c){return [gradientやpattern];},
fill:function(c){return "url(#"+c.type+"-grad)";},   // 省略時は共通の塗り色
stroke:function(c){return {color:...,width:...};},
decorate:function(c){/* 採寸後。マスクや重ね描きを足す */}
}
```

そのあと必要なのは3つだけ:
1. `preset-panel.js`の`items`に`{value,labelKey:"imageTextName○○",hintKey:"imageTextDesc○○",img}`
2. 8言語に`imageTextName○○` / `imageTextDesc○○`（新しいパラメータ名も同様にキーになる）
3. `03_images/preset/text/t2_○○.svg`（見本画像）

`text-2-manager.js`のswitch文は`T2_LEGACY_EFFECTS`という1つの表になっている。
1種類1ファイルの旧実装（shadow等9種）だけがそこに載る。**新しい種類を足すときに
manager側を触る必要はない**。

守る点:
- **長さは`t2Len()`、周波数は`t2Freq()`を通す**。見本の値を直接書くと、
  文字サイズを変えただけで効果の粗さが別物になる（大きくすると細かい砂に見える）
- **`fePointLight`の座標は`light`で比率指定する**。ユーザー座標の固定値を書くと
  文字が大きいとき光源が文字の外に出て一切光らない
- **色は`params`に出す**。見本の色を直書きすると利用者が変えられない

### フォント
専用の`FontSelector`（`#fontT2Selector`）を`#text-area2-settings`の**外**に1つだけ置く。
中に入れると`switchText2Ui()`が走るたびにインスタンスとリスナーが積み上がる。

```javascript
document.addEventListener(T2_FONT_SELECTOR_ID,handler);  // FontSelectorはtargetId名のCustomEventを投げる
t2ApplySelectedFont();   // baseStylesDefault を書き換える唯一の場所
```
- 全種類が`baseStylesDefault`を読む。`createText2()`/`updateText2()`が
  組み立て直前に`t2ApplySelectedFont()`で最新にするので、種類ごとに取得を書かない
- **`<img>`で読むSVGはOSに入っているフォントしか名前解決できない**。
  `document.fonts`に足したFontFace（アップロードしたフォント）も外部URLのフォントも
  見えず、黙って別の字体で描かれる。`t2FontIsRasterizable()`で弾いて理由を出す
- フォント名はDOMの入力要素ではないため`t2CollectParams()`が明示的に足し、
  復元は`syncImageTextControls()`が`t2SetSelectedFontName()`で行う
- `collectUsedFontNames()`（`project-font.js`）も`imageTextParams`から拾う。
  拾わないと、そのフォントを画像テキストにしか使っていないプロジェクトで
  フォントが保存されない
- `imageTextType` / `imageTextParams` をオブジェクトに保存し`commonProperties`に含める
- 選択時は`syncImageTextControls()`がサイドバーを該当種類・値に戻し、
  以降の編集がそのオブジェクトに向くよう`t2_xxx_setCurrent()`を呼ぶ
- これがないと**直前に作った1つしか編集できない**

操作の分担:

| 操作 | 関数 | 結果 |
|------|------|------|
| 種類を選ぶ | `switchText2(type)` | 選択中の画像テキストがあればその現物を差し替え。無ければ設定を切り替えるだけ |
| 挿入する | `text2Insert()` | ここだけがキャンバスに1つ増やす |
| 値を変える | `updateText2()` | 編集対象（`t2GetCurrentObject()`）を作り直す。対象が無ければ何もしない |
| 種類→処理 | `t2GetEffect(type)` | 旧実装は`T2_LEGACY_EFFECTS`、それ以外は汎用ドライバを返す |

守る点:
- **「選ぶ」で増やさない**。選ぶたびに新規作成すると、既定位置(50,100)固定のため
  同じ場所に重なって増え、見た目が変わらないまま履歴とレイヤーだけが増える
- **`t2_xxx_deleteSvg()`はキャンバスから消さない**。組み立て用変数と
  `nowT2XxxStr`をnullにするだけ。現物を消すのは`t2BeginReplace()`
- **`imageTextParams`はDOMの入力要素から集める**（`t2CollectParams()`）。
  `sidebarValueMap`は利用者が触った項目しか持たないため、そこから集めると
  未変更の項目が欠け、別のオブジェクトを選び直したときに前の値が画面に残る
- **選び直しでは種類が同じでも必ず値を入れ替える**。`nowText2===type`のときに
  何もしないと、アアアを選んだあとイイイを選んでもアアアの値が表示され続ける
- **textareaの中身をHTMLに埋め込まない**。`addTextArea()`は翻訳された既定文
  専用で、利用者の入力を埋めると`</textarea>`を含む文字でDOMが壊れる。
  記憶した文字は`switchText2Ui()`が代入で戻す

## 外部ライブラリ
`file://`で動作させるため、実行に必要なライブラリは`third/`に同梱する。
CDN参照だとオフラインで読み込みに失敗し、jscolorなら色ピッカーが
ただのテキスト入力に化ける。
同梱済み: jscolor / tagify / stacktrace / chart.js / wordcloud / three.js
（Google Fontsとflag-iconsは未同梱。読み込めなくても代替表示で機能は動く）

## キャンバスの拡大縮小（canvas-manager.js）
`#canvas-container` に CSS の `transform: scale()` をかける方式。
fabric の `viewportTransform` は使っていない。

```
#resizable-container   overflow:auto   ← スクロールするのはこちら
└ #canvas-container    overflow:hidden ← transform:scale() をかける対象
  └ .canvas-container（fabric生成）
    └ #mangaImageCanvas
```

- **スクロール対象を間違えない。** `#canvas-container` は `overflow:hidden` なので
  `scrollLeft`/`scrollTop` を代入しても何も起きない。`getScrollContainer()` を使う
- **`transform-origin` は `top left`。** 中央基準にすると左と上にはみ出した分が
  スクロール範囲に入らず、端まで表示できなくなる
- 拡大縮小は `applyCanvasZoom(倍率)` に集約。表示中心を保つスクロール補正を行う
- `clientWidth`/`clientHeight` は transform の影響を受けない（レイアウト値）。
  `getBoundingClientRect()` は影響を受ける（表示値）

### 画面座標への変換
表示倍率は状態変数ではなく **DOMから実測** する。

```javascript
const scale=getCanvasDisplayScale();  // canvasRect.width / canvas.getWidth()
const screenX=canvasRect.left+logicalX*scale;
```
はみ出し判定は**ビューポート基準**で行う。キャンバス基準にすると、拡大時に
キャンバス右端が画面外にあってもクランプされず、メニューが画面外に出る。

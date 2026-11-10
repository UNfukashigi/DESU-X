# テキスト装飾プリセット

サイドバーの「テキスト」パネルにある `テキスト装飾`。選ぶと、選択中のテキストの
色・縁・発光・影・字間がまとめて変わる。横書き（`Textbox`）と縦書き
（`VerticalTextbox`）の両方に効く。

- 値表: `js/sidebar/text/text-decor-presets.js`
- 重ね方と適用: `js/sidebar/text/text-decor.js`
- 一覧UI: `js/ui/preset-panel.js` の `PRESET_PANELS.textDecor`

## なぜ層で描くのか

Fabricのテキストは塗り1色・縁1本・影1つしか持てない。日本語のテロップで標準的な
「本文＋細い縁＋外側の太い縁（または滲む発光）」も、アメコミのベタ影も、グリッチの
色ずれも、この3つでは作れない。同じ文字列を色と太さを変えて重ねて描く。

下から順に:

1. `ghosts` … 位置をずらして敷く層。ベタ影・色ずれ用。1件ごとに色・ずれ・太さ・ぼかしを持つ
2. `glow` … ずらさない外側の層。太い縁、またはぼかして発光
3. 本体 … `fill` と `stroke`（Fabricの標準プロパティ）

## 直しているのは fabric.Text.prototype の4か所だけ

`Textbox` も `IText` も `VerticalTextbox` も `fabric.Text` を継承していて、
`_render` / `getCompleteStyleDeclaration` / `toObject` のどれも上書きしていない。
だから `fabric.Text.prototype` を1回包めば全種類に効く。種類ごとに描画を書くと
片方だけ直し忘れる。

| 包む場所 | 目的 |
|---|---|
| `_render` | 本体を描く前に層を描く。層ごとに `fill`/`stroke`/`strokeWidth` を差し替えて元の描画処理をもう一度回す |
| `getCompleteStyleDeclaration` | 縦書きは入力した文字1つずつに `fill` を持つため、オブジェクト側だけ差し替えても層の色が変わらない。文字単位の値もここで上書きする |
| `toObject` | `textDecor` を保存に載せる |
| `_getCacheCanvasDimensions` | 層のぶんの余白をキャッシュへ足す |

## キャッシュの余白

Fabricはオブジェクトを一度キャッシュcanvasへ描いてから貼る。その大きさは
`width + strokeWidth` からしか決まらないため、外側の縁や色ずれはキャッシュの縁で
切られる。`textDecorPadding()` が層の到達距離を出し、`_getCacheCanvasDimensions` で
足している。

`objectCaching` を切っても切れなくなるが、**採らない**。Fabricは
`objectCaching` が有効なとき影を「合成後のシルエットに1枚」掛け、無効なときは
「1描画ごと」に掛ける。切ると影の見た目が変わる。

## 寸法は適用した時点の実寸で固定する

値表は全て `fontSize` に対する比で書くが、プリセットを適用した時点で実寸へ変換して
オブジェクトに書き込む。以後は絶対値で、**あとから文字サイズを変えても縁の太さは
追従しない**（作り直したいときはプリセットを選び直す）。

比のまま持って描画時に掛ければ追従はできるが、そうすると層だけが追従して
`strokeWidth`・影・字間（Fabricの標準プロパティで、既存のスライダーとピッカーが
直接触る）は追従せず、外側の縁だけ太って内側が細いという壊れ方をする。
どちらか片方に揃えるなら、既存UIと食い違わない絶対値側に揃える。

オブジェクトを拡大縮小した場合は層も一緒に拡大されるので破綻しない。

## プリセットが触るもの

| 触る | 置き場 |
|---|---|
| 塗り | `fill`（既存の「テキスト」色ピッカーと同じ） |
| 内側の細い縁 | `stroke` / `strokeWidth`（既存の「アウトライン」色とサイズ） |
| 影 | `shadow` |
| 字間 | `charSpacing` |
| 背景の帯 | 横書きは `backgroundColor`、縦書きは `textBackgroundColor`（既存の背景色ピッカーと同じ） |
| 外側の縁・発光・色ずれ | `textDecor`（このプリセット専用） |

既存のピッカーと同じプロパティへ入れているので、適用後もサイドバーから色を変えられる。
別の場所に持つとピッカーの表示と実際の見た目が食い違う。

`paintFirst` は縁がある種類で `stroke` にする。既定の `fill` は塗りの上に縁が重なるため、
縁を太くすると字画を食い潰して塗りの色が消える。

適用時に文字単位の `fill`/`stroke`/`strokeWidth`/`textBackgroundColor` は
`removeStyle()` で落とす。残すと本体だけ元の色のまま層だけ塗り替わって縁が破れる。

## 縁の太さは「外側に何px出るか」で書く

canvasのstrokeは線の中心が輪郭に乗るため、外側に `r` だけ出すには線幅 `2r` が要る。
値表には外側に出す量を書き、`tdStrokeWidth()` が変換する。

太さで見せたいときは `edge`（内側）ではなく `glow`（外側）を太くする。内側は字画を
侵食するため、極太書体や線の細い書体ほど早く塗りが消える。

## 見本画像はその場で作る

一覧に並べる見本は画像ファイルではなく、`textDecorThumb()` が実際の描画処理
（`fabric.StaticCanvas` ＋ `textDecorApply`）で毎回作る。別に描き起こすと見本と結果が
ずれ、しかも見本の方が嘘をついていることに誰も気付けない。

見本は「今選んでいるフォント」と「今の言語の見本文字」で描くので、キャッシュの鍵は
`種類|フォント|見本文字` の3つ。言語切替では `changeLanguage()` から
`textDecorRefreshCard()` を呼んでカードを作り直す（`updateContent()` は
`data-i18n` の要素しか見ないため、画像は対象外）。

## 罠: `initial.strokeWidth`

`resizeCanvas()` はキャンバスの再フィットのたびに、各オブジェクトの線幅を
`obj.initial.strokeWidth × 倍率` で計算し直す。`initial` はオブジェクトを追加した
時点で1回だけ記録され、その後の変更を追わない。

そのため線幅を変えても再フィットで元の太さへ巻き戻る。**履歴の復元も再フィットを
通るため、Undoした瞬間に縁だけ消える**という形で出る。プリセットに限らず、既存の
「アウトラインサイズ」スライダーでも同じことが起きていた。

線幅を意図して変えたら `refreshInitialStrokeWidth(obj)`
（`js/core/util/fabric-util.js`）で基準も更新する。呼んでいるのは
`textDecorApply()` と `changeStrokeWidthSize()` の2か所。

## 種類を増やすとき

1. `text-decor-presets.js` に1件足す（値は全て `fontSize` に対する比）
2. `js/ui/preset-panel.js` の `PRESET_PANELS.textDecor.items` に1行足す
3. `js/ui/third/base-translation/base-*.js` 8言語に `textDecorName*` と `textDecorDesc*` を足す

見本画像は自動で作られるので用意しなくてよい。

## 分かっていること

- フォントは変えない。同梱fontに`@font-face`が無いもの（`font/`のTrain One・Rampart One等）や
  CDN頼みのGoogle Fontsが多く、プリセットで書体を指定するとオフラインで黙って別の書体で描かれる
- 動き（fade・pop）は入れていない。静止画のため
- `canvas.toSVG()` は層を出力しない。層はcanvasの描画処理で作っているため。
  画像として書き出す経路（PNG/JPEG）はそのまま出る

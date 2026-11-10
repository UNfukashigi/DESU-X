// text-decor.js - テキスト装飾プリセットの適用と、文字を重ねて描く処理
//
// 値表は text-decor-presets.js。ここは「重ね方」と「サイドバーからの操作」を持つ。
//
// ## 直すのは fabric.Text.prototype の3か所だけ
// 横書きTextbox・IText・縦書きVerticalTextbox は全て fabric.Text を継承していて、
// _render / getCompleteStyleDeclaration / toObject をどれも上書きしていない。
// だから fabric.Text.prototype を1回包めば全種類に効く。種類ごとに描画を書くと
// 片方だけ直し忘れる。
//
// ## 層はキャッシュの外へはみ出す
// Fabricはオブジェクトを一度キャッシュcanvasへ描いてから貼る。その大きさは
// width + strokeWidth からしか決まらないため、外側の縁や色ずれはキャッシュの縁で
// 切られる。_getCacheCanvasDimensions で層のぶんの余白を足して防ぐ。
// キャッシュを止める手もあるが、影がFabricの仕様上「合成後の影1枚」から
// 「1描画ごとの影」に変わってしまうため取らない。

const TEXT_DECOR_PLAIN='plain';

// canvasのstrokeは線の中心が輪郭に乗る。外側にrだけ出すには線幅2rが要る
function tdStrokeWidth(reach) {
return reach*2;
}

function textDecorLayers(object) {
var decor=object.textDecor;
if (!decor) {
return null;
}
var layers=(decor.ghosts||[]).slice();
if (decor.glow) {
layers.push(decor.glow);
}
return layers.length ? layers : null;
}

// 本体の輪郭から外へ出る量。キャッシュに足す余白の計算に使う
function textDecorPadding(object) {
var layers=textDecorLayers(object);
if (!layers) {
return 0;
}
var pad=0;
layers.forEach(function (layer) {
var reach=Math.max(Math.abs(layer.dx||0),Math.abs(layer.dy||0))+layer.width+(layer.blur||0)*2;
if (reach>pad) {
pad=reach;
}
});
return pad;
}

(function () {
var proto=fabric.Text.prototype;
var baseRender=proto._render;
var baseStyleDeclaration=proto.getCompleteStyleDeclaration;
var baseToObject=proto.toObject;
var baseCacheDimensions=fabric.Object.prototype._getCacheCanvasDimensions;

proto._render=function (ctx) {
var layers=textDecorLayers(this);
if (layers) {
var scaling=this.getTotalObjectScaling();
var blurScale=(scaling.scaleX+scaling.scaleY)/2;
var savedFill=this.fill;
var savedStroke=this.stroke;
var savedStrokeWidth=this.strokeWidth;
for (var i=0;i<layers.length;i++) {
var layer=layers[i];
ctx.save();
// 層ごとに影を落とすと重なった数だけ影が濃くなる。影は本体の1枚だけに任せる
ctx.shadowColor='transparent';
ctx.shadowBlur=0;
ctx.shadowOffsetX=0;
ctx.shadowOffsetY=0;
if (layer.blur>0) {
// canvasのfilterは変換前のpxで効く。倍率を掛けないと拡大したときに
// 文字だけ大きくなってぼかしが相対的に細る
ctx.filter='blur('+(layer.blur*blurScale)+'px)';
}
ctx.translate(layer.dx||0,layer.dy||0);
this.__textDecorPass=layer;
this.fill=layer.color;
this.stroke=layer.color;
this.strokeWidth=tdStrokeWidth(layer.width);
this._setTextStyles(ctx);
this._renderText(ctx);
ctx.restore();
}
this.__textDecorPass=null;
this.fill=savedFill;
this.stroke=savedStroke;
this.strokeWidth=savedStrokeWidth;
}
baseRender.call(this,ctx);
};

// 縦書きは入力した文字1つずつに色を持たせるため、オブジェクト側の fill を
// 差し替えただけでは層の色が変わらない。文字単位の値もここで上書きする
proto.getCompleteStyleDeclaration=function (lineIndex,charIndex) {
var style=baseStyleDeclaration.call(this,lineIndex,charIndex);
var pass=this.__textDecorPass;
if (pass) {
style.fill=pass.color;
style.stroke=pass.color;
style.strokeWidth=tdStrokeWidth(pass.width);
}
return style;
};

// commonProperties（canvas.toJSON用）ではなくここで足す。複製は
// commonProperties を通らないため、そちらだけだとコピーで装飾が落ちる
proto.toObject=function (propertiesToInclude) {
return baseToObject.call(this,['textDecor'].concat(propertiesToInclude||[]));
};

proto._getCacheCanvasDimensions=function () {
var dims=baseCacheDimensions.call(this);
var pad=textDecorPadding(this);
if (pad<=0) {
return dims;
}
// dims はキャッシュcanvasの画素数で、オブジェクト座標1につき zoomX 画素
dims.x+=pad*2*dims.zoomX;
dims.y+=pad*2*dims.zoomY;
dims.width=dims.x+2;
dims.height=dims.y+2;
return dims;
};
})();

// 比の値を今の文字サイズの実寸へ変換して1件ぶんの層を作る。
// 以後は絶対値。文字サイズを変えても層は追従しない（選び直せば作り直される）
function textDecorBuild(key,preset,fontSize) {
if (key===TEXT_DECOR_PLAIN) {
return null;
}
var ghosts=(preset.ghosts||[]).map(function (ghost) {
return {
color: ghost.opacity===undefined ? ghost.color : tdRgba(ghost.color,ghost.opacity),
dx: ghost.dxRatio*fontSize,
dy: ghost.dyRatio*fontSize,
width: ghost.ratio*fontSize,
blur: (ghost.blurRatio||0)*fontSize
};
});
var glow=preset.glow ? {
color: preset.glow.color,
dx: 0,
dy: 0,
width: preset.glow.ratio*fontSize,
blur: (preset.glow.blurRatio||0)*fontSize
} : null;
return {key: key,ghosts: ghosts,glow: glow};
}

function textDecorApply(object,key) {
var preset=TEXT_DECOR_PRESETS[key];
if (!preset) {
textLogger.error('unknown text decor preset: '+key);
return;
}
var fontSize=object.fontSize;

// プリセットは全体の見た目。文字ごとの色指定が残っていると本体だけ元の色のまま
// 層だけ塗り替わって縁が破れる
object.removeStyle('fill');
object.removeStyle('stroke');
object.removeStyle('strokeWidth');
object.removeStyle('textBackgroundColor');

var band=preset.band ? tdRgba(preset.band.color,preset.band.opacity) : '';
var props={
strokeWidth: preset.edge ? tdStrokeWidth(preset.edge.ratio*fontSize) : 0,
// 既定の paintFirst は塗りが先で、縁が塗りの上へ重なって字画を食う。
// 縁を先に描けば太くしても塗りが残る
paintFirst: preset.edge ? 'stroke' : 'fill',
strokeLineJoin: 'round',
strokeLineCap: 'round',
charSpacing: Math.round((preset.spacingRatio||0)*1000),
shadow: preset.shadow ? new fabric.Shadow({
color: tdRgba(preset.shadow.color,preset.shadow.opacity),
blur: preset.shadow.blurRatio*fontSize,
offsetX: preset.shadow.ratio*fontSize,
offsetY: preset.shadow.ratio*fontSize
}) : null,
textDecor: textDecorBuild(key,preset,fontSize),
dirty: true
};
if (preset.fill) {
props.fill=preset.fill;
}
if (preset.edge) {
props.stroke=preset.edge.color;
}
// 背景の帯は既存の背景色ピッカーと同じプロパティへ入れる。別の所へ持つと
// ピッカーの表示と実際の帯が食い違う
if (isVerticalText(object)) {
props.textBackgroundColor=band;
} else {
props.backgroundColor=band;
}
object.set(props);
// 縁の太さはキャンバスの再フィットで initial から戻される。プリセットが決めた
// 太さを基準として書き戻さないと、Undoや画面幅の変化で縁だけ消える
refreshInitialStrokeWidth(object);
}

var nowTextDecor=TEXT_DECOR_PLAIN;

function textDecorTargets() {
var active=canvas.getActiveObject();
if (!active) {
return [];
}
if (active.type==='activeSelection') {
return active.getObjects().filter(function (object) {
return isText(object);
});
}
return isText(active) ? [active] : [];
}

// 新しく足すテキストにも同じ装飾を掛ける。createTextbox / 縦書きの追加から呼ぶ
function textDecorApplyToNew(object) {
if (nowTextDecor===TEXT_DECOR_PLAIN) {
return;
}
textDecorApply(object,nowTextDecor);
}

function switchTextDecor(key) {
nowTextDecor=key;
presetPanelSetActive('textDecor',key);
var targets=textDecorTargets();
if (targets.length===0) {
createToast(getText('textDecorPickerTitle'),getText('textDecorNoTarget'));
return;
}
targets.forEach(function (object) {
textDecorApply(object,key);
});
canvas.requestRenderAll();
updateTextControls(canvas.getActiveObject());
commitHistory();
}

// 見本の文字は言語ごとに違う。名前は data-i18n で切替時に更新されるが、
// 見本画像は対象外なので作り直す（changeLanguage から呼ぶ）。
// 何も掛かっていないカードを触ると、使用中でないものが使用中に見える
function textDecorRefreshCard() {
var card=$('textDecorPresetCurrent');
if (!card||!card.classList.contains('is-active')) {
return;
}
presetPanelSetActive('textDecor',nowTextDecor);
}

// 選択中のテキストが持っている装飾をカードに映す。updateTextControls から呼ぶ
function textDecorSyncPanel(object) {
// 見本は今のフォントで描く。フォント選択がまだ組み上がっていない間は描けないため、
// 別のフォントで描かずカードを次の選択まで触らない
if (!$('fm-selected-font-fontSelector')) {
textLogger.debug('text decor card: font selector is not ready');
return;
}
var key=object.textDecor&&object.textDecor.key ? object.textDecor.key : TEXT_DECOR_PLAIN;
nowTextDecor=key;
presetPanelSetActive('textDecor',key);
}

// 見本は画像で持たず、実際に使う描画器で都度作る。別に描き起こすと見本と
// 結果がずれ、しかも見本の方が嘘をついていることに誰も気付けない
var textDecorThumbCache={};

function textDecorThumb(key) {
var font=fontManager.getSelectedFont('fontSelector');
var sample=getText('textDecorSample');
// 書体と見本の文字はどちらも後から変わる。片方でも鍵から漏らすと、
// 言語やフォントを切り替えたときに古い見本が残る
var cacheKey=key+'|'+font+'|'+sample;
if (textDecorThumbCache[cacheKey]) {
return textDecorThumbCache[cacheKey];
}
var element=fabric.util.createCanvasElement();
var preview=new fabric.StaticCanvas(element,{
width: 260,
height: 88,
// 白い紙の上にも絵の上にも置かれる。白い字も黒い字も読める中間色を敷く
backgroundColor: '#b9b9b9',
renderOnAddRemove: false
});
var text=new fabric.Textbox(sample,{
left: 0,
top: 18,
width: 260,
fontSize: 44,
fontFamily: font,
textAlign: 'center',
fill: '#141414',
stroke: '#141414',
strokeWidth: 0
});
textDecorApply(text,key);
preview.add(text);
preview.renderAll();
textDecorThumbCache[cacheKey]=preview.toDataURL({format: 'png'});
preview.dispose();
return textDecorThumbCache[cacheKey];
}

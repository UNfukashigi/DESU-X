// generic-text-effect.js - 画像テキストの汎用ドライバ
// text-effect-presets.js の表1件からSVGを組み立て、ラスタライズしてキャンバスへ置く。
// 種類ごとに同じ130行を書き写すと、縦書きや余白の直しが1種類にしか入らないため、
// 種類ごとの差分は「フィルタの中身」「defs」「塗り」「縁取り」「採寸後の飾り」だけに絞る。

// 見本のSVGはfont-size 20で作られている。実際の文字サイズは1〜300まで変わるので、
// 長さは文字サイズに比例、周波数は反比例させないと、サイズを変えただけで
// 粗さが別物になる（大きくすると効果が細かい砂に見える）。
// 見本が別のサイズで作られている種類はpresetのrefで基準を上書きする
const T2_REF_FONT_SIZE=20;

const T2_DEFAULT_REGION={x:"-25%",y:"-25%",width:"150%",height:"150%"};
const T2_DEFAULT_PADDING=0.5;

function t2Len(sampleValue,context,multiplier){
return sampleValue*context.scale*(multiplier===undefined ? 1 : multiplier);
}

// baseFrequencyは"0.05"と"0 0.075"の両方の書き方があるため、空白区切りのまま扱う
function t2Freq(sampleValue,context,multiplier){
return String(sampleValue).trim().split(/\s+/).map(function(one){
return (parseFloat(one)/context.scale*(multiplier===undefined ? 1 : multiplier)).toFixed(5);
}).join(" ");
}

// feColorMatrixの係数など、色を数値として使うところ用。
// jscolorはrgba()形式で返すが、表の既定値は#rrggbbで書くため両方を受ける
function t2ParseColor(value){
var text=String(value).trim();
var rgba=text.match(/^rgba?\(([^)]+)\)$/i);
if(rgba){
var parts=rgba[1].split(",").map(function(one){return parseFloat(one);});
return {r:parts[0]/255,g:parts[1]/255,b:parts[2]/255,a:parts.length>3 ? parts[3] : 1};
}
var hex=text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
if(hex){
var digits=hex[1];
if(digits.length===3){
digits=digits[0]+digits[0]+digits[1]+digits[1]+digits[2]+digits[2];
}
return {
r:parseInt(digits.slice(0,2),16)/255,
g:parseInt(digits.slice(2,4),16)/255,
b:parseInt(digits.slice(4,6),16)/255,
a:1
};
}
textLogger.error("unsupported color value: "+text);
return {r:0,g:0,b:0,a:1};
}

// 影・マスク・縁取りのように同じ文字をもう一枚重ねる種類用。
// tspanにも塗りが入っているため、textだけ塗り替えても色が変わらない
function t2CloneTextPaint(textElement,fill,fillOpacity){
var clone=textElement.cloneNode(true);
clone.removeAttribute("filter");
setAttributes(clone,{"fill":fill,"fill-opacity":fillOpacity});
clone.querySelectorAll("tspan").forEach(function(tspan){
setAttributes(tspan,{"fill":fill,"fill-opacity":fillOpacity});
});
return clone;
}

// 編集中のオブジェクト。種類ごとに1つだけ持つ（レガシー実装のnowT2XxxStrと同じ役割）
const t2GenericCurrent={};

function t2GenericPreset(type){
var preset=T2_EFFECT_PRESETS[type];
if(!preset){
textLogger.error("unknown image text preset: "+type);
}
return preset;
}

// ---------------- パラメータ ----------------

function t2GenericReadParams(type){
var preset=t2GenericPreset(type);
var values={};
if(!preset||!preset.params){
return values;
}
preset.params.forEach(function(param){
var element=$(type+'-'+param.name);
if(!element){
// switchText2Ui()が先に走っているはずなので、無いのは表とUI生成のずれ
textLogger.error("image text param control not found: "+type+'-'+param.name);
values[param.name]=param.def;
return;
}
values[param.name]=param.kind==='slider' ? parseFloat(element.value) : element.value;
});
return values;
}

function t2GenericControlsHtml(type){
var preset=t2GenericPreset(type);
var html='';
if(!preset||!preset.params){
return html;
}
preset.params.forEach(function(param){
var id=type+'-'+param.name;
var value=sidebarValueMap.getOrDefault(id,param.def);
if(param.kind==='color'){
html+=addColor(id,param.name,value);
}else{
html+=addSlider(id,param.name,param.min,param.max,value,param.step);
}
});
return html;
}

function t2GenericControlElements(type){
var preset=t2GenericPreset(type);
if(!preset||!preset.params){
return [];
}
return preset.params.map(function(param){
return $(type+'-'+param.name);
});
}

// ---------------- 組み立て ----------------

function t2GenericBuildFilter(context){
var preset=context.preset;
if(!preset.primitives){
return null;
}
var filter=createSvgElement("filter");
var region=preset.region||T2_DEFAULT_REGION;
setAttributes(filter,{
"id":context.filterId,
"x":region.x,"y":region.y,"width":region.width,"height":region.height,
"filterUnits":"objectBoundingBox",
"color-interpolation-filters":preset.colorInterpolation||"linearRGB"
});
preset.primitives(context).forEach(function(primitive){
var children=primitive.children||(primitive.child ? [primitive.child] : []);
filter.appendChild(createFilterElement(primitive.type,primitive.attrs,children));
});
return filter;
}

// fePointLightの座標はユーザー座標なので、見本の値をそのまま使うと
// 文字が大きいときに光源が文字の外へ出て一切光らない。採寸後に置き直す
function t2GenericPlaceLights(context){
var light=context.preset.light;
if(!light||!context.bbox){
return;
}
context.svg.querySelectorAll("fePointLight").forEach(function(element){
setAttributes(element,{
x:context.bbox.x+context.bbox.width*light.x,
y:context.bbox.y+context.bbox.height*light.y,
z:context.common.fontSize*light.z
});
});
}

function t2GenericCreateSvg(type,left=50,top=100){
var preset=t2GenericPreset(type);
if(!preset){
return;
}
var common=t2ReadCommonInputs();
var context={
type:type,
preset:preset,
common:common,
params:t2GenericReadParams(type),
scale:common.fontSize/(preset.ref||T2_REF_FONT_SIZE),
filterId:type+"-t2filter",
svg:null,
defs:null,
textElement:null,
bbox:null
};

context.svg=createSvgElement("svg");
setAttributes(context.svg,{"id":type+"-t2svg","xmlns":svgHttp,"xml:space":"preserve"});
Object.assign(context.svg.style,{position:'absolute',visibility:'visible'});

context.defs=createSvgElement("defs");
context.svg.appendChild(context.defs);

var filter=t2GenericBuildFilter(context);
if(filter){
context.defs.appendChild(filter);
}
if(preset.defs){
preset.defs(context).forEach(function(node){
context.defs.appendChild(node);
});
}

context.textElement=createSvgElement("text");
t2ApplyTextContent(context.textElement,common,preset.fill ? preset.fill(context) : null);
if(filter){
context.textElement.setAttribute("filter","url(#"+context.filterId+")");
}
if(preset.stroke){
var stroke=preset.stroke(context);
setAttributes(context.textElement,{
"stroke":stroke.color,
"stroke-width":stroke.width,
"paint-order":"stroke"
});
}
context.svg.appendChild(context.textElement);

// getBBox()は描画ツリーに入っていないと使えないため一度だけ挿す
document.body.appendChild(context.svg);
context.bbox=t2FitSvgToText(context.svg,context.textElement,common.fontSize,
preset.padding===undefined ? T2_DEFAULT_PADDING : preset.padding);
t2GenericPlaceLights(context);
if(preset.decorate&&context.bbox){
preset.decorate(context);
}
document.body.removeChild(context.svg);

t2RenderAndPlace(context.svg,type,left,top,function(img){
t2GenericCurrent[type]=img;
});
}

// ---------------- text-2-manager.js から呼ばれる入口 ----------------

function t2GenericGetCurrent(type){
return t2GenericCurrent[type]||null;
}

function t2GenericSetCurrent(type,obj){
t2GenericCurrent[type]=obj;
}

// キャンバスからは消さない。現物を消すのはt2BeginReplace()だけ
function t2GenericDeleteSvg(type){
t2GenericCurrent[type]=null;
}

function t2GenericUpdateAll(type){
var position=t2BeginReplace(t2GenericCurrent[type]);
t2GenericCurrent[type]=null;
t2GenericCreateSvg(type,position.left,position.top);
}

function t2GenericEffect(type){
return {
create:function(left,top){t2GenericCreateSvg(type,left,top);},
update:function(){t2GenericUpdateAll(type);},
clear:function(){t2GenericDeleteSvg(type);},
setCurrent:function(obj){t2GenericSetCurrent(type,obj);},
getCurrent:function(){return t2GenericGetCurrent(type);},
controls:function(){return t2GenericControlsHtml(type);},
elements:function(){return t2GenericControlElements(type);}
};
}

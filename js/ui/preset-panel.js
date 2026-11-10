// preset-panel.js - ペン／トーン／画像テキスト／テキスト装飾の「今のプリセット」カード
//
// パネル幅は200px（狭い画面で140px）しかなく、一覧と設定を同じ縦列に並べると
// 一覧が場所を取って設定が画面外へ押し出される。一覧は選ぶときだけ
// PresetPickerで広く開き、パネルには今のプリセットだけを置く。
//
// カードの更新は各マネージャが元から持っている「activeボタンを付け外しする1か所」
// （applyPencilType / applyMangaTone / switchText2Ui）からだけ呼ぶ。
// 切り替え経路ごとに書き足すと更新漏れになる。
// ペンとトーンは pick から ModeManager.change() を通り、その中で apply*Type が呼ばれる。

var PRESET_PANELS={
pen: {
cardId: "penPresetCurrent",
titleKey: "penPickerTitle",
current: function () {return nowPencil;},
pick: function (value) {switchPencilType(value);},
items: [
{value: "Marker",labelKey: "Marker",hintKey: "penDescMarker",img: "03_images/preset/brush/Marker.webp"},
{value: "Ink",labelKey: "ink",hintKey: "penDescInk",img: "03_images/preset/brush/Ink.webp"},
{value: "Crayon",labelKey: "crayon",hintKey: "penDescCrayon",img: "03_images/preset/brush/Crayon.webp"},
{value: "Pencil",labelKey: "Pencil",hintKey: "penDescPencil",img: "03_images/preset/brush/Pencil.webp"},
{value: "OutlinePen",labelKey: "OutlinePen",hintKey: "penDescOutlinePen",img: "03_images/preset/brush/OutlinePen.webp"},
{value: "Circle",labelKey: "Circle",hintKey: "penDescCircle",img: "03_images/preset/brush/Circle.webp"},
{value: "Mosaic",labelKey: "Mosaic",hintKey: "penDescMosaic",img: "03_images/preset/brush/Mosaic1.webp"},
{value: "Eraser",labelKey: "Eraser",hintKey: "penDescEraser",img: "03_images/preset/brush/Eraser.webp"}
]
},
tone: {
cardId: "tonePresetCurrent",
titleKey: "tonePickerTitle",
current: function () {return nowTone;},
pick: function (value) {switchMangaTone(value);},
// labelKeyを"Tone"のような一般語にすると、他の用途の同名キーと取り合いになる。
// 実際にトーン5種はキーが8言語のどこにも無く、キー文字列がそのまま名前として出ていた。
// text2と同じくtoneName*で揃える
items: [
{value: "Tone",labelKey: "toneNameTone",hintKey: "toneDescTone",img: "03_images/preset/tone/Tone.webp"},
{value: "ToneNoise",labelKey: "toneNameToneNoise",hintKey: "toneDescToneNoise",img: "03_images/preset/tone/ToneNoise.webp"},
{value: "ToneSnow",labelKey: "toneNameToneSnow",hintKey: "toneDescToneSnow",img: "03_images/preset/tone/ToneSnow.webp"},
{value: "SpeedLine",labelKey: "toneNameSpeedLine",hintKey: "toneDescSpeedLine",img: "03_images/preset/tone/SpeedLine.webp"},
{value: "FocusingLine",labelKey: "toneNameFocusingLine",hintKey: "toneDescFocusingLine",img: "03_images/preset/tone/FocusingLine.webp"}
]
},
text2: {
cardId: "imageTextPresetCurrent",
titleKey: "imageTextPickerTitle",
current: function () {return nowText2;},
pick: function (value) {switchText2(value);},
// labelKeyを"shadow"のような一般語にすると、他の用途の同名キーと取り合いになり、
// 訳が無い種類はキー文字列がそのまま名前として出る。imageTextName*で揃える
items: [
{value: "shadow",labelKey: "imageTextNameShadow",hintKey: "imageTextDescShadow",img: "03_images/preset/text/t2_shadow.webp"},
{value: "wild",labelKey: "imageTextNameWild",hintKey: "imageTextDescWild",img: "03_images/preset/text/t2_wild.webp"},
{value: "scratch",labelKey: "imageTextNameScratch",hintKey: "imageTextDescScratch",img: "03_images/preset/text/t2_scratch.webp"},
{value: "broken",labelKey: "imageTextNameBroken",hintKey: "imageTextDescBroken",img: "03_images/preset/text/t2_broken.webp"},
{value: "cloud",labelKey: "imageTextNameCloud",hintKey: "imageTextDescCloud",img: "03_images/preset/text/t2_cloud.webp"},
{value: "layered",labelKey: "imageTextNameLayered",hintKey: "imageTextDescLayered",img: "03_images/preset/text/t2_layered.webp"},
{value: "mesh",labelKey: "imageTextNameMesh",hintKey: "imageTextDescMesh",img: "03_images/preset/text/t2_mesh.webp"},
{value: "thrill",labelKey: "imageTextNameThrill",hintKey: "imageTextDescThrill",img: "03_images/preset/text/t2_thrill.webp"},
{value: "zebra",labelKey: "imageTextNameZebra",hintKey: "imageTextDescZebra",img: "03_images/preset/text/t2_zebra.webp"},
{value: "aurora",labelKey: "imageTextNameAurora",hintKey: "imageTextDescAurora",img: "03_images/preset/text/t2_aurora.webp"},
{value: "water",labelKey: "imageTextNameWater",hintKey: "imageTextDescWater",img: "03_images/preset/text/t2_water.webp"},
{value: "void",labelKey: "imageTextNameVoid",hintKey: "imageTextDescVoid",img: "03_images/preset/text/t2_void.svg"},
{value: "destroy",labelKey: "imageTextNameDestroy",hintKey: "imageTextDescDestroy",img: "03_images/preset/text/t2_destroy.svg"},
{value: "quantum",labelKey: "imageTextNameQuantum",hintKey: "imageTextDescQuantum",img: "03_images/preset/text/t2_quantum.svg"},
{value: "rough",labelKey: "imageTextNameRough",hintKey: "imageTextDescRough",img: "03_images/preset/text/t2_rough.svg"},
{value: "warp",labelKey: "imageTextNameWarp",hintKey: "imageTextDescWarp",img: "03_images/preset/text/t2_warp.svg"},
{value: "toxic",labelKey: "imageTextNameToxic",hintKey: "imageTextDescToxic",img: "03_images/preset/text/t2_toxic.svg"},
{value: "crack",labelKey: "imageTextNameCrack",hintKey: "imageTextDescCrack",img: "03_images/preset/text/t2_crack.svg"},
{value: "drain",labelKey: "imageTextNameDrain",hintKey: "imageTextDescDrain",img: "03_images/preset/text/t2_drain.svg"},
{value: "virus",labelKey: "imageTextNameVirus",hintKey: "imageTextDescVirus",img: "03_images/preset/text/t2_virus.svg"},
{value: "pixel",labelKey: "imageTextNamePixel",hintKey: "imageTextDescPixel",img: "03_images/preset/text/t2_pixel.svg"},
{value: "beast",labelKey: "imageTextNameBeast",hintKey: "imageTextDescBeast",img: "03_images/preset/text/t2_beast.svg"},
{value: "cyber",labelKey: "imageTextNameCyber",hintKey: "imageTextDescCyber",img: "03_images/preset/text/t2_cyber.svg"},
{value: "electric",labelKey: "imageTextNameElectric",hintKey: "imageTextDescElectric",img: "03_images/preset/text/t2_electric.svg"},
{value: "neon",labelKey: "imageTextNameNeon",hintKey: "imageTextDescNeon",img: "03_images/preset/text/t2_neon.svg"},
{value: "emboss",labelKey: "imageTextNameEmboss",hintKey: "imageTextDescEmboss",img: "03_images/preset/text/t2_emboss.svg"},
{value: "metal",labelKey: "imageTextNameMetal",hintKey: "imageTextDescMetal",img: "03_images/preset/text/t2_metal.svg"},
{value: "frozen",labelKey: "imageTextNameFrozen",hintKey: "imageTextDescFrozen",img: "03_images/preset/text/t2_frozen.svg"},
{value: "stripe",labelKey: "imageTextNameStripe",hintKey: "imageTextDescStripe",img: "03_images/preset/text/t2_stripe.svg"},
{value: "circuit",labelKey: "imageTextNameCircuit",hintKey: "imageTextDescCircuit",img: "03_images/preset/text/t2_circuit.svg"},
{value: "chrome",labelKey: "imageTextNameChrome",hintKey: "imageTextDescChrome",img: "03_images/preset/text/t2_chrome.svg"}
]
},
textDecor: {
cardId: "textDecorPresetCurrent",
titleKey: "textDecorPickerTitle",
current: function () {return nowTextDecor;},
pick: function (value) {switchTextDecor(value);},
// 装飾は今のフォントに掛かって初めて姿が決まるため、貼れる見本画像が無い。
// 実際に描くのと同じ処理でその場で作る（js/sidebar/text/text-decor.js）
image: function (value) {return textDecorThumb(value);},
items: [
{value: "plain",labelKey: "textDecorNamePlain",hintKey: "textDecorDescPlain"},
{value: "standard",labelKey: "textDecorNameStandard",hintKey: "textDecorDescStandard"},
{value: "inverse",labelKey: "textDecorNameInverse",hintKey: "textDecorDescInverse"},
{value: "variety",labelKey: "textDecorNameVariety",hintKey: "textDecorDescVariety"},
{value: "pop",labelKey: "textDecorNamePop",hintKey: "textDecorDescPop"},
{value: "cute",labelKey: "textDecorNameCute",hintKey: "textDecorDescCute"},
{value: "horror",labelKey: "textDecorNameHorror",hintKey: "textDecorDescHorror"},
{value: "neon",labelKey: "textDecorNameNeon",hintKey: "textDecorDescNeon"},
{value: "cyber",labelKey: "textDecorNameCyber",hintKey: "textDecorDescCyber"},
{value: "comic",labelKey: "textDecorNameComic",hintKey: "textDecorDescComic"},
{value: "glitch",labelKey: "textDecorNameGlitch",hintKey: "textDecorDescGlitch"},
{value: "japanese",labelKey: "textDecorNameJapanese",hintKey: "textDecorDescJapanese"},
{value: "cinema",labelKey: "textDecorNameCinema",hintKey: "textDecorDescCinema"},
{value: "band",labelKey: "textDecorNameBand",hintKey: "textDecorDescBand"},
{value: "impact",labelKey: "textDecorNameImpact",hintKey: "textDecorDescImpact"},
{value: "streaming",labelKey: "textDecorNameStreaming",hintKey: "textDecorDescStreaming"}
]
}
};

// 見本画像。貼れる画像を持たない種類はその場で作る
function presetPanelItemImage(conf,item) {
if (item.img) {
return item.img;
}
return conf.image ? conf.image(item.value) : undefined;
}

function presetPanelFindItem(kind,value) {
var conf=PRESET_PANELS[kind];
var found=null;
conf.items.forEach(function (item) {
if (item.value===value) {
found=item;
}
});
return found;
}

// 選んだプリセットをカードに映し、使用中であることを示す。
// 名前は data-i18n を付け替えて入れるので、言語切替時の updateContent() が拾える
function presetPanelSetActive(kind,value) {
var conf=PRESET_PANELS[kind];
var card=$(conf.cardId);
if (!card) {
uiLogger.error("preset card not found: "+conf.cardId);
return;
}
var item=presetPanelFindItem(kind,value);
if (!item) {
uiLogger.error("unknown preset: "+kind+" / "+value);
return;
}
var name=card.querySelector(".preset-current-name");
name.dataset.i18n=item.labelKey;
name.textContent=getText(item.labelKey);
var thumb=card.querySelector(".preset-current-thumb");
thumb.src=presetPanelItemImage(conf,item);
thumb.hidden=false;
card.classList.add("is-active");
}

// 使用中の表示だけを落とす。どれを選んでいたかは残す
function presetPanelClearActive(kind) {
var card=$(PRESET_PANELS[kind].cardId);
if (!card) {
return;
}
card.classList.remove("is-active");
}

// 翻訳は開く直前に引く。言語切替後も開き直せば新しい言語で出る
function presetPanelOpenPicker(kind) {
var conf=PRESET_PANELS[kind];
if (!conf) {
uiLogger.error("unknown preset panel: "+kind);
return;
}
var items=conf.items.map(function (item) {
return {
value: item.value,
label: getText(item.labelKey),
hint: getText(item.hintKey),
img: presetPanelItemImage(conf,item)
};
});
PresetPicker.open({
title: getText(conf.titleKey),
items: items,
currentValue: conf.current(),
onPick: conf.pick
});
}

EventDelegator.register('openPresetPicker',function (el) {
presetPanelOpenPicker(el.dataset.presetKind);
});

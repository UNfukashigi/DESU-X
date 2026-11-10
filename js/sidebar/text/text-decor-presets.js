// text-decor-presets.js - テキスト装飾プリセットの値表
//
// Fabricのテキストは塗り1色・縁1本・影1つしか持てない。日本語のテロップで
// 標準的な「本文＋細い縁＋外側の太い縁（または滲む発光）」や、色ずれ・ベタ影は
// 同じ文字をずらして重ねることでしか作れない。重ね方は text-decor.js が持ち、
// ここは1件ぶんの値だけを持つ。
//
// ## 寸法は全て fontSize との比
// 縁の太さ・影のずれ・ぼかし・字間は「fontSizeに対する比」で書く。比で持てば
// 同じプリセットが7ptでも150ptでも同じ見た目になる。適用時に実寸へ変換され、
// 以後は絶対値として扱う（fontSizeを後から変えても縁は追従しない。
// 見た目を作り直したいときはプリセットを選び直す）。
//
// ## 縁の太さは「文字の外側に何px出るか」
// canvasのstrokeは線の中心が輪郭に乗るため、外側にrだけ出すには線幅2rが要る。
// 変換は text-decor.js の tdStrokeWidth() が行う。ここには外側に出す量を書く。
//
// ## 内側の縁を太くしない
// 太い縁で見せたいときは edge ではなく glow（外側の層）を太くする。edgeは
// 塗りの上へ重なるため、太くすると字画そのものを食い潰して塗りの色が消える。
// 極太書体や線の細い手書き書体ほど早く潰れる。

function tdRgba(hex,alpha) {
var value=hex.replace('#','');
var r=parseInt(value.substring(0,2),16);
var g=parseInt(value.substring(2,4),16);
var b=parseInt(value.substring(4,6),16);
return 'rgba('+r+','+g+','+b+','+alpha+')';
}

// 並び順がそのままピッカーの並び順になる。valueは保存される識別子なので、
// 並べ替えても既存のvalueの意味は変えないこと
const TEXT_DECOR_PRESETS={

// 装飾を全て外す。色と書体は今のまま残す
"plain":{},

"standard":{
fill:"#FFFFFF",
edge:{color:"#000000",ratio:0.11},
shadow:{color:"#000000",opacity:0.5,ratio:0.04,blurRatio:0.04}
},

"inverse":{
fill:"#141414",
edge:{color:"#FFFFFF",ratio:0.14},
// 白フチだけだと白い紙の上で輪郭が消える。外側に細い墨を1枚置くと形が残る
glow:{color:"#141414",ratio:0.03}
},

"variety":{
fill:"#FFE13F",
edge:{color:"#20160A",ratio:0.05},
glow:{color:"#FFFFFF",ratio:0.20},
shadow:{color:"#000000",opacity:0.38,ratio:0.06,blurRatio:0.05}
},

"pop":{
fill:"#FF8A1F",
edge:{color:"#3A1C00",ratio:0.07},
glow:{color:"#FFFFFF",ratio:0.24},
shadow:{color:"#3A1C00",opacity:0.31,ratio:0.06,blurRatio:0.05}
},

"cute":{
fill:"#FFFFFF",
edge:{color:"#FF5FA2",ratio:0.13},
glow:{color:"#FFFFFF",ratio:0.26},
shadow:{color:"#FF9CC6",opacity:0.31,ratio:0.05,blurRatio:0.06},
spacingRatio:0.02
},

"horror":{
fill:"#E6E2E2",
// 血色の滲みが見えるよう内側の墨は細く。暗すぎる赤は明るい絵の上でただの
// 黒い染みになるため、彩度と明度を上げてある
edge:{color:"#12080A",ratio:0.06},
glow:{color:"#B01414",ratio:0.26,blurRatio:0.13},
shadow:{color:"#000000",opacity:0.25,ratio:0.08,blurRatio:0.08},
spacingRatio:0.05
},

"neon":{
fill:"#FFFFFF",
edge:{color:"#0A3A4C",ratio:0.07},
glow:{color:"#25E0FF",ratio:0.20,blurRatio:0.14},
spacingRatio:0.05
},

"cyber":{
fill:"#F2E9FF",
edge:{color:"#2B0A4A",ratio:0.05},
glow:{color:"#B44BFF",ratio:0.16,blurRatio:0.09},
spacingRatio:0.07
},

"comic":{
fill:"#FFD23F",
edge:{color:"#111013",ratio:0.07},
glow:{color:"#FFFFFF",ratio:0.18},
// ぼかさず真後ろへずらす墨。印刷物のベタ影で、影1つでは色も距離も足りない
ghosts:[{color:"#111013",dxRatio:0.07,dyRatio:0.08,ratio:0.18}]
},

"glitch":{
fill:"#FFFFFF",
edge:{color:"#0A0A0F",ratio:0.04},
// 色ずれは左上へシアン・右下へマゼンタ。1色1方向しか持てない影では作れない
ghosts:[
{color:"#00E5FF",dxRatio:-0.05,dyRatio:-0.035,ratio:0.03},
{color:"#FF00A8",dxRatio:0.05,dyRatio:0.035,ratio:0.03}
],
spacingRatio:0.04
},

"japanese":{
fill:"#F5F0E6",
edge:{color:"#14100E",ratio:0.08},
// 朱は滲ませない。ぼかすとホラーと見分けが付かなくなる
glow:{color:"#A81F1F",ratio:0.14},
shadow:{color:"#14100E",opacity:0.25,ratio:0.05,blurRatio:0.04},
spacingRatio:0.08
},

"cinema":{
fill:"#F2F0EC",
// 劇場字幕は縁で囲わない。輪郭は最小限にして可読性は影で確保する。ただし
// 縁も影も削りすぎると明るい絵の上で消える
edge:{color:"#000000",ratio:0.06},
shadow:{color:"#000000",opacity:0.19,ratio:0.06,blurRatio:0.07},
spacingRatio:0.06
},

"band":{
fill:"#FFFFFF",
// 縁ではなく背景の帯。帯の上に縁を足しても濃くなるだけで輪郭は増えない
band:{color:"#0A0A0C",opacity:0.75},
spacingRatio:0.02
},

"impact":{
fill:"#FFFFFF",
edge:{color:"#C81428",ratio:0.07},
glow:{color:"#1A0508",ratio:0.20},
shadow:{color:"#000000",opacity:0.44,ratio:0.05,blurRatio:0.05}
},

"streaming":{
fill:"#FFFFFF",
// 海外の配信字幕は縁を持たない。可読性は「ぼかした影を斜め下へ落とす」で稼ぐ
edge:{color:"#000000",ratio:0.02},
ghosts:[{color:"#000000",opacity:0.4,dxRatio:0.02,dyRatio:0.05,ratio:0.06,blurRatio:0.10}]
}

};

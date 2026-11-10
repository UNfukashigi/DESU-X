// text-effect-presets.js - 画像テキストの種類定義
// generic-text-effect.js がこの表1件からSVGを組み立てる。
// 種類を足すときはここに1件足し、preset-panel.js の items と翻訳とサムネイルを足すだけでよい。
//
// 数値は見本SVG（font-size 20 基準。refで上書きした種類はその値が基準）の値をそのまま書き、
// 実際の文字サイズへの合わせ込みは t2Len()/t2Freq() が行う。
// 見本の値を直接書いておかないと、あとで見本と見比べられなくなる。

const T2_WIDE_REGION={x:"-40%",y:"-40%",width:"180%",height:"180%"};
const T2_GLOW_REGION={x:"-60%",y:"-60%",width:"220%",height:"220%"};

const T2_PARAM_ROUGHNESS={name:"Roughness",kind:"slider",min:0.1,max:3,step:0.1,def:1};
const T2_PARAM_STRENGTH={name:"Strength",kind:"slider",min:0,max:3,step:0.1,def:1};
const T2_PARAM_EDGE_WIDTH={name:"EdgeWidth",kind:"slider",min:0,max:3,step:0.1,def:1};
const T2_PARAM_PATTERN_SCALE={name:"PatternScale",kind:"slider",min:0.3,max:3,step:0.1,def:1};

function t2ColorParam(name,def){
return {name:name,kind:"color",def:def};
}

function t2CreatePattern(id,size,pathData,strokeColor,strokeWidth,opacity){
var pattern=createSvgElement("pattern");
setAttributes(pattern,{id:id,patternUnits:"userSpaceOnUse",width:size,height:size});
var path=createSvgElement("path");
var attrs={d:pathData,stroke:strokeColor,"stroke-width":strokeWidth,fill:"none"};
if(opacity!==undefined){
attrs["opacity"]=opacity;
}
setAttributes(path,attrs);
pattern.appendChild(path);
return pattern;
}

function t2CreateLinearGradient(id,colors){
var gradient=createSvgElement("linearGradient");
setAttributes(gradient,{id:id,x1:"0%",y1:"0%",x2:"100%",y2:"0%"});
colors.forEach(function(color,index){
var stop=createSvgElement("stop");
setAttributes(stop,{
offset:(index/(colors.length-1)*100).toFixed(2)+"%",
"stop-color":color
});
gradient.appendChild(stop);
});
return gradient;
}

// 中心が濃く外へ向かって消える円。オーロラの帯1本分
function t2CreateRadialGradient(id,color){
var gradient=createSvgElement("radialGradient");
setAttributes(gradient,{id:id,gradientUnits:"objectBoundingBox",cx:"50%",cy:"50%",r:"50%"});
var inner=createSvgElement("stop");
setAttributes(inner,{offset:"0","stop-color":color});
var outer=createSvgElement("stop");
setAttributes(outer,{offset:"100%","stop-color":color,"stop-opacity":"0"});
gradient.appendChild(inner);
gradient.appendChild(outer);
return gradient;
}

const T2_EFFECT_PRESETS={

// ---------------- 歪ませる ----------------

"void":{
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.07",c,c.params.Roughness),numOctaves:"3",result:"noise"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",in2:"noise",scale:t2Len(3,c,c.params.Strength)}},
{type:"feComponentTransfer",attrs:{},children:[
{type:"feFuncR",attrs:{type:"table",tableValues:"1 0 1"}},
{type:"feFuncG",attrs:{type:"table",tableValues:"0 1 0"}},
{type:"feFuncB",attrs:{type:"table",tableValues:"1 0 1"}}
]}
];
}
},

"quantum":{
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.03",c,c.params.Roughness),numOctaves:"5"}},
{type:"feColorMatrix",attrs:{values:"0 1 0 0 0, 1 0 0 0 0, 0 0 1 0 0, 0 0 0 1 0"}},
{type:"feBlend",attrs:{mode:"screen",in2:"SourceGraphic"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(2,c,c.params.Strength)}}
];
}
},

"destroy":{
region:T2_WIDE_REGION,
padding:0.7,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.05",c,c.params.Roughness),numOctaves:"2"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(5,c,c.params.Strength)}},
{type:"feGaussianBlur",attrs:{stdDeviation:t2Len(0.5,c)}}
];
}
},

"rough":{
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.05",c,c.params.Roughness),numOctaves:"2",result:"turbulence"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",in2:"turbulence",scale:t2Len(2,c,c.params.Strength),xChannelSelector:"R",yChannelSelector:"G"}}
];
}
},

"warp":{
region:T2_WIDE_REGION,
padding:1,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.01",c,c.params.Roughness),numOctaves:"10"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(15,c,c.params.Strength)}},
{type:"feColorMatrix",attrs:{values:"2 -1 0 0 0, -1 2 -1 0 0, 0 -1 2 0 0, 0 0 0 1 0"}},
{type:"feBlend",attrs:{mode:"multiply",in2:"SourceGraphic"}}
];
}
},

"toxic":{
region:T2_WIDE_REGION,
padding:0.8,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.03",c,c.params.Roughness),seed:"5",numOctaves:"8"}},
{type:"feColorMatrix",attrs:{values:"3 -1 0 0 0, 0 0 2 -0.5 0, -1 0 0 3 0, 0 0 0 1 0"}},
{type:"feComposite",attrs:{operator:"arithmetic",k1:"1.5",k2:"-0.5",k3:"0.5",k4:"0"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(10,c,c.params.Strength)}}
];
}
},

// ---------------- 削る・砕く ----------------

"crack":{
region:T2_WIDE_REGION,
padding:0.8,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH,T2_PARAM_EDGE_WIDTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.1",c,c.params.Roughness),numOctaves:"7"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(10,c,c.params.Strength)}},
{type:"feColorMatrix",attrs:{values:"2 -1 0 0 0, -1 2 -1 0 0, 0 -1 2 0 0, 0 0 0 0.5 0"}},
{type:"feMorphology",attrs:{operator:"dilate",radius:t2Len(0.5,c,c.params.EdgeWidth)}}
];
}
},

"drain":{
region:T2_WIDE_REGION,
padding:0.7,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH,T2_PARAM_EDGE_WIDTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.07",c,c.params.Roughness),numOctaves:"8"}},
{type:"feColorMatrix",attrs:{values:"0.3 0.3 0.3 0 0, 0.3 0.3 0.3 0 0, 0.3 0.3 0.3 0 0, 0 0 0 1 0"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(8,c,c.params.Strength)}},
{type:"feMorphology",attrs:{operator:"erode",radius:t2Len(0.3,c,c.params.EdgeWidth)}}
];
}
},

"virus":{
region:T2_WIDE_REGION,
padding:0.7,
params:[T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH,T2_PARAM_EDGE_WIDTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.4",c,c.params.Roughness),numOctaves:"3"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(5,c,c.params.Strength)}},
{type:"feColorMatrix",attrs:{values:"1 0 0 1 0, 0 0 1 0 0, 0 1 0 0 0, 0 0 0 1 0"}},
{type:"feMorphology",attrs:{operator:"erode",radius:t2Len(0.5,c,c.params.EdgeWidth)}}
];
}
},

"pixel":{
params:[T2_PARAM_STRENGTH,T2_PARAM_EDGE_WIDTH],
primitives:function(c){
return [
{type:"feComponentTransfer",attrs:{},children:[
{type:"feFuncR",attrs:{type:"discrete",tableValues:"0 0.25 0.5 0.75 1"}},
{type:"feFuncG",attrs:{type:"discrete",tableValues:"0 0.25 0.5 0.75 1"}},
{type:"feFuncB",attrs:{type:"discrete",tableValues:"0 0.25 0.5 0.75 1"}}
]},
{type:"feMorphology",attrs:{operator:"dilate",radius:t2Len(0.5,c,c.params.EdgeWidth)}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",scale:t2Len(2,c,c.params.Strength),xChannelSelector:"R",yChannelSelector:"G"}}
];
}
},

// ---------------- 色を塗り替える ----------------

"beast":{
params:[T2_PARAM_ROUGHNESS,t2ColorParam("EffectColor1","#cc0000")],
primitives:function(c){
// 見本は赤固定。選んだ色の比率でノイズを着色して同じ質感のまま色を変えられるようにする
var color=t2ParseColor(c.params.EffectColor1);
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.05",c,c.params.Roughness),numOctaves:"2"}},
{type:"feColorMatrix",attrs:{values:color.r+" 0 0 0 0, "+color.g+" 0 0 0 0, "+color.b+" 0 0 0 0, 0 0 0 1 0"}},
{type:"feComposite",attrs:{operator:"in",in2:"SourceGraphic"}}
];
}
},

"cyber":{
params:[t2ColorParam("EffectColor1","#00ffff"),t2ColorParam("EffectColor2","#ff00ff"),
T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.05",c,c.params.Roughness),numOctaves:"1",seed:"10",result:"noise"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",in2:"noise",scale:t2Len(3,c,c.params.Strength),xChannelSelector:"R",yChannelSelector:"G",result:"displace"}},
{type:"feFlood",attrs:{"flood-color":c.params.EffectColor1,result:"colorA"}},
{type:"feComposite",attrs:{in:"colorA",in2:"displace",operator:"in",result:"compA"}},
{type:"feFlood",attrs:{"flood-color":c.params.EffectColor2,result:"colorB"}},
{type:"feOffset",attrs:{in:"displace",dx:t2Len(1,c,c.params.Strength),result:"offset"}},
{type:"feComposite",attrs:{in:"colorB",in2:"offset",operator:"in",result:"compB"}},
{type:"feBlend",attrs:{in:"compA",in2:"compB",mode:"screen"}}
];
}
},

"electric":{
region:T2_WIDE_REGION,
padding:0.7,
params:[t2ColorParam("EffectColor1","#00ffff"),t2ColorParam("EffectColor2","#ff00ff"),
T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"turbulence",baseFrequency:t2Freq("0.05",c,c.params.Roughness),numOctaves:"2",seed:"5",result:"noise"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",in2:"noise",scale:t2Len(2,c,c.params.Strength),xChannelSelector:"R",yChannelSelector:"G",result:"displace"}},
{type:"feGaussianBlur",attrs:{in:"displace",stdDeviation:t2Len(0.5,c),result:"blur"}},
{type:"feFlood",attrs:{"flood-color":c.params.EffectColor1,"flood-opacity":"0.5",result:"floodA"}},
{type:"feFlood",attrs:{"flood-color":c.params.EffectColor2,"flood-opacity":"0.5",result:"floodB"}},
{type:"feComposite",attrs:{in:"floodA",in2:"blur",operator:"in",result:"compA"}},
{type:"feOffset",attrs:{in:"compA",dx:t2Len(-0.5,c,c.params.Strength),dy:"0",result:"offsetA"}},
{type:"feComposite",attrs:{in:"floodB",in2:"blur",operator:"in",result:"compB"}},
{type:"feOffset",attrs:{in:"compB",dx:t2Len(0.5,c,c.params.Strength),dy:"0",result:"offsetB"}},
{type:"feBlend",attrs:{in:"offsetA",in2:"offsetB",mode:"screen",result:"blend"}},
{type:"feComposite",attrs:{in:"blend",in2:"displace",operator:"over"}}
];
}
},

// ---------------- 光らせる ----------------

"neon":{
region:T2_GLOW_REGION,
padding:1,
colorInterpolation:"sRGB",
params:[t2ColorParam("EffectColor1","#00ffff"),
{name:"GlowSize",kind:"slider",min:0.2,max:4,step:0.1,def:1},
{name:"GlowOpacity",kind:"slider",min:0,max:1,step:0.05,def:0.7}],
primitives:function(c){
return [
{type:"feGaussianBlur",attrs:{stdDeviation:t2Len(0.8,c,c.params.GlowSize),result:"blur"}},
{type:"feComposite",attrs:{in:"SourceGraphic",in2:"blur",operator:"over"}},
{type:"feFlood",attrs:{"flood-color":c.params.EffectColor1,"flood-opacity":c.params.GlowOpacity,result:"glow"}},
{type:"feComposite",attrs:{in:"glow",in2:"blur",operator:"in",result:"softGlow"}},
{type:"feComposite",attrs:{in:"softGlow",in2:"SourceGraphic",operator:"over"}}
];
}
},

"emboss":{
light:{x:0.5,y:0.25,z:5},
params:[t2ColorParam("LightColor","#ffffff"),T2_PARAM_STRENGTH],
primitives:function(c){
return [
{type:"feGaussianBlur",attrs:{in:"SourceAlpha",stdDeviation:t2Len(1,c),result:"blur"}},
{type:"feSpecularLighting",attrs:{
in:"blur",surfaceScale:t2Len(5,c,c.params.Strength),specularConstant:"1",specularExponent:"20",
"lighting-color":c.params.LightColor,result:"specLight"
},child:{type:"fePointLight",attrs:{x:"0",y:"0",z:"0"}}},
{type:"feComposite",attrs:{in:"specLight",in2:"SourceGraphic",operator:"in",result:"specLightComp"}},
{type:"feComposite",attrs:{in:"SourceGraphic",in2:"specLightComp",operator:"arithmetic",k1:"0",k2:"1",k3:"1",k4:"0"}}
];
}
},

"metal":{
light:{x:0.5,y:0,z:10},
params:[t2ColorParam("EffectColor1","#ffffff"),t2ColorParam("EffectColor2","#cccccc"),
t2ColorParam("EffectColor3","#888888"),t2ColorParam("LightColor","#ffffff")],
defs:function(c){
return [t2CreateLinearGradient(c.type+"-grad",[
c.params.EffectColor2,c.params.EffectColor1,c.params.EffectColor3,
c.params.EffectColor2,c.params.EffectColor3,c.params.EffectColor1
])];
},
fill:function(c){
return "url(#"+c.type+"-grad)";
},
primitives:function(c){
return [
{type:"feGaussianBlur",attrs:{in:"SourceAlpha",stdDeviation:t2Len(0.5,c),result:"blur"}},
{type:"feSpecularLighting",attrs:{
in:"blur",surfaceScale:t2Len(5,c),specularConstant:"0.8",specularExponent:"20",
"lighting-color":c.params.LightColor,result:"specOut"
},child:{type:"fePointLight",attrs:{x:"0",y:"0",z:"0"}}},
{type:"feComposite",attrs:{in:"specOut",in2:"SourceGraphic",operator:"in",result:"specOut2"}},
{type:"feComposite",attrs:{in:"SourceGraphic",in2:"specOut2",operator:"arithmetic",k1:"0",k2:"1",k3:"1",k4:"0"}}
];
}
},

"water":{
// 見本がfont-size 40で作られているため基準を上書きする
ref:40,
region:T2_WIDE_REGION,
padding:0.8,
colorInterpolation:"sRGB",
params:[t2ColorParam("LightColor","#ffffff"),T2_PARAM_ROUGHNESS,T2_PARAM_STRENGTH],
light:{x:0.5,y:0.5,z:1},
primitives:function(c){
return [
{type:"feTurbulence",attrs:{type:"fractalNoise",baseFrequency:t2Freq("0.04 0.06",c,c.params.Roughness),numOctaves:"3",seed:"5",stitchTiles:"stitch",result:"turbulence"}},
{type:"feDisplacementMap",attrs:{in:"SourceGraphic",in2:"turbulence",scale:t2Len(15,c,c.params.Strength),xChannelSelector:"R",yChannelSelector:"G",result:"displacement"}},
{type:"feGaussianBlur",attrs:{in:"displacement",stdDeviation:t2Len(2,c),result:"blur1"}},
{type:"feSpecularLighting",attrs:{
in:"blur1",surfaceScale:t2Len(5,c),specularConstant:"1.5",specularExponent:"35",
"lighting-color":c.params.LightColor,result:"specularLighting"
},child:{type:"fePointLight",attrs:{x:"0",y:"0",z:"0"}}},
{type:"feComposite",attrs:{in:"specularLighting",in2:"displacement",operator:"in",result:"composite2"}},
{type:"feBlend",attrs:{mode:"screen",in:"composite2",in2:"SourceGraphic"}}
];
}
},

// ---------------- 模様・グラデーションで塗る ----------------

"frozen":{
params:[t2ColorParam("EffectColor1","#aaaaff"),t2ColorParam("EdgeColor","#ffffff"),
T2_PARAM_EDGE_WIDTH,T2_PARAM_PATTERN_SCALE],
defs:function(c){
var size=t2Len(10,c,c.params.PatternScale);
var half=size/2;
return [t2CreatePattern(c.type+"-pat",size,
"M0,"+half+" L"+size+","+half+" M"+half+",0 L"+half+","+size,
c.params.EffectColor1,t2Len(0.5,c),0.5)];
},
fill:function(c){
return "url(#"+c.type+"-pat)";
},
stroke:function(c){
return {color:c.params.EdgeColor,width:t2Len(0.5,c,c.params.EdgeWidth)};
}
},

"stripe":{
params:[t2ColorParam("EffectColor1","#000000"),t2ColorParam("EdgeColor","#ffffff"),
T2_PARAM_EDGE_WIDTH,T2_PARAM_PATTERN_SCALE],
defs:function(c){
var size=t2Len(4,c,c.params.PatternScale);
return [t2CreatePattern(c.type+"-pat",size,
"M0,0 L"+size+","+size,
c.params.EffectColor1,t2Len(1,c))];
},
fill:function(c){
return "url(#"+c.type+"-pat)";
},
stroke:function(c){
return {color:c.params.EdgeColor,width:t2Len(0.5,c,c.params.EdgeWidth)};
}
},

"circuit":{
params:[t2ColorParam("EffectColor1","#00ff00"),t2ColorParam("EdgeColor","#00ff00"),
T2_PARAM_EDGE_WIDTH,T2_PARAM_PATTERN_SCALE],
defs:function(c){
var size=t2Len(4,c,c.params.PatternScale);
var half=size/2;
return [t2CreatePattern(c.type+"-pat",size,
"M0,"+half+" L"+size+","+half+" M"+half+",0 L"+half+","+size,
c.params.EffectColor1,t2Len(0.5,c))];
},
fill:function(c){
return "url(#"+c.type+"-pat)";
},
stroke:function(c){
return {color:c.params.EdgeColor,width:t2Len(0.5,c,c.params.EdgeWidth)};
}
},

"chrome":{
params:[t2ColorParam("EffectColor1","#4285f4"),t2ColorParam("EffectColor2","#34a853"),
t2ColorParam("EffectColor3","#fbbc05"),t2ColorParam("EffectColor4","#ea4335"),
t2ColorParam("EdgeColor","#ffffff"),T2_PARAM_EDGE_WIDTH],
defs:function(c){
return [t2CreateLinearGradient(c.type+"-grad",[
c.params.EffectColor1,c.params.EffectColor2,c.params.EffectColor3,
c.params.EffectColor4,c.params.EffectColor1
])];
},
fill:function(c){
return "url(#"+c.type+"-grad)";
},
stroke:function(c){
return {color:c.params.EdgeColor,width:t2Len(0.3,c,c.params.EdgeWidth)};
}
},

// ---------------- 文字の後ろに別の絵を敷く ----------------

"aurora":{
// 見本がfont-size 160で作られているため基準を上書きする
ref:160,
params:[t2ColorParam("EffectColor1","#00b3b3"),t2ColorParam("EffectColor2","#b8cc52"),
t2ColorParam("EffectColor3","#b81fb8"),t2ColorParam("EffectColor4","#ff8533"),
t2ColorParam("EdgeColor","#000000")],
defs:function(c){
var blur=createFilterElement("filter",{id:c.type+"-blur"});
blur.appendChild(createFilterElement("feGaussianBlur",{stdDeviation:t2Len(3,c)+" "+t2Len(1,c)}));
var nodes=[blur];
[c.params.EffectColor1,c.params.EffectColor2,c.params.EffectColor3,c.params.EffectColor4]
.forEach(function(color,index){
nodes.push(t2CreateRadialGradient(c.type+"-g"+index,color));
});
return nodes;
},
decorate:function(c){
var bbox=c.bbox;
var maskId=c.type+"-mask";

// 帯を文字の幅いっぱいに並べる。
// 見本のrectには幅も高さも指定が無く、実際には一本も描かれていなかった
var band=createSvgElement("g");
setAttributes(band,{mask:"url(#"+maskId+")"});
var count=6;
var step=bbox.width/count;
for(var i=0;i<count;i++){
var rect=createSvgElement("rect");
setAttributes(rect,{
x:bbox.x+step*i-step*0.5,
y:bbox.y-bbox.height*0.25,
width:step*2,
height:bbox.height*1.5,
fill:"url(#"+c.type+"-g"+(i%4)+")"
});
band.appendChild(rect);
}

var mask=createSvgElement("mask");
setAttributes(mask,{
id:maskId,maskUnits:"userSpaceOnUse",
x:bbox.x-bbox.width,y:bbox.y-bbox.height,
width:bbox.width*3,height:bbox.height*3
});
var maskText=t2CloneTextPaint(c.textElement,"#ffffff",1);
maskText.setAttribute("filter","url(#"+c.type+"-blur)");
mask.appendChild(maskText);
c.defs.appendChild(mask);

var shadow=t2CloneTextPaint(c.textElement,"#000000",0.5);
setAttributes(shadow,{transform:"translate(0,"+t2Len(30,c)+")"});

var outline=t2CloneTextPaint(c.textElement,"none",1);
setAttributes(outline,{
stroke:c.params.EdgeColor,"stroke-width":t2Len(8,c),"stroke-opacity":"0.4"
});

// 元の文字はマスクと縁取りに写した後なので、そのまま残すと色が二重になる
c.svg.removeChild(c.textElement);
c.svg.appendChild(shadow);
c.svg.appendChild(band);
c.svg.appendChild(outline);
}
}

};

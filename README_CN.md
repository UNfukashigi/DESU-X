> **此文件夹是 DESU-X（Manga Editor Desu! 的修改版）。** 请参阅 [README.md](README.md) 和 [CHANGES_DESU-X.md](CHANGES_DESU-X.md)。以下为原工具的说明。

[English](https://github.com/new-sankaku/manga-editor-desu) |
[日本語](https://github.com/new-sankaku/manga-editor-desu/blob/main/README_JP.md) |
中文

# 漫画编辑器 Desu! 专业版

这是一款完全在浏览器中运行的免费漫画创作Web应用程序。无需安装，无需注册账号，应用本身也没有服务器端。

AI图像生成是**可选功能**——所有编辑功能均可独立使用。生成功能需要您自行准备并配置后端。

仅使用演示网站即可使用所有功能。
[网站：Desu!](https://new-sankaku.github.io/manga-editor-desu/)

<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/01_mainpage.webp" width="700">

---

## 快速开始

**演示网站（即开即用）**

[https://new-sankaku.github.io/manga-editor-desu/](https://new-sankaku.github.io/manga-editor-desu/)

**本地运行（速度更快）**
```
git clone https://github.com/new-sankaku/manga-editor-desu.git
cd manga-editor-desu
start index.html
```

---

## 文档

- [功能参考](https://new-sankaku.github.io/manga-editor-desu/html/docs/features.html) - 全部功能的详细说明
- [常见问题](https://new-sankaku.github.io/manga-editor-desu/html/docs/faq.html) - 安装、文件格式、隐私
- [AI后端设置指南](https://new-sankaku.github.io/manga-editor-desu/html/docs/ai-setup.html) - CORS设置、API密钥、工作流

---

## AI图像生成支持状况

支持6种服务，每种处理可以分别指定使用哪个服务。

| 服务 | 运行位置 | 支持的处理 | 所需配置 |
|---|---|---|---|
| ComfyUI | 本地 | 文生图 / 图生图 / 局部重绘 / 高清放大 / 去背景 / 视角重生成 | `--enable-cors-header` |
| RunPod ComfyUI | 云端 | 与ComfyUI相同 | Pod的URL |
| SD WebUI (A1111 / Forge) | 本地 | 文生图 / 图生图 / 去背景 / CLIP / DeepDanbooru / ADetailer | `--api --cors-allow-origins *` |
| Fal.ai | 云端 | 文生图 / 图生图 / 高清放大 / 去背景 | API密钥 |
| Grok (xAI) | 云端 | 语言模型处理 | API密钥 |
| Ollama | 本地 | 语言模型处理 | `OLLAMA_ORIGINS` |

ComfyUI随附的工作流支持 SD1.5 / SDXL / Flux / Z-Image-turbo / Qwen-Image。局部重绘和视角重生成仅支持ComfyUI。

---

## 主要功能展示

### 图像拖放
https://github.com/user-attachments/assets/7cf94e6c-fc39-4aed-a0a1-37ca70260fe4

### 对话气泡（模板）
https://github.com/user-attachments/assets/6f1dae5f-b50f-4b04-8875-f0b07111f2ab

### 图像提示助手
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/03_prompthelper.webp" width="700">

### 支持语言
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/02_trans.webp" height="400">

### 网格线 / 刀具模式
<div style="display: flex; align-items: flex-start;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/05_gridline.webp" height="350">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/06_knifemode.webp" height="350">
</div>

### 暗色模式
<div style="display: flex; align-items: flex-start;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/09_darkmode.webp" height="350">
</div>

### 混合模式示例
<div style="display: flex; align-items: flex-start;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/12_blend.webp" height="350">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/13_blend.webp" height="350">
</div>

### 特效
<div style="display: flex; align-items: flex-start;">
    <img src="https://new-sankaku.github.io/SP-MangaEditer-docs/04_gpix01.webp" height="350">
    <img src="https://new-sankaku.github.io/SP-MangaEditer-docs/04_gpix02.webp" height="350">
</div>

### 文本、对话气泡、笔工具
<div style="display: flex; align-items: flex-start;">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/08_speechbubble.webp" height="350">
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/07_font.webp" height="350">
</div>

---

<details>
<summary><strong>全部功能一览</strong></summary>

**页面与分格**
- **分格模板**：共69种（竖版41种、横版28种）
- **刀具工具**：沿鼠标绘制的线条分割分格，间距0〜75
- **分格编辑模式**：拖动顶点，将矩形变形为梯形等
- **图形分格**：正方形、竖长方形、横长方形、三角形、五边形、六边形、星形、心形
- **随机切割**：指定切割数量、倾斜角度和线条偏差进行随机分割
- **多页面创建**：一次创建2〜50个页面
- **页面管理**：底部缩略图栏可点击切换、拖动排序。Alt+←/→ 翻页
- **原稿尺寸**：以毫米指定。竖版、横版或自定义(1〜4096)
- **网格**：可调间距的吸附网格

**对话气泡与文本**
- **对话气泡**：48种，可设置线条色、背景色、透明度和线宽
- **自定义气泡**：通过坐标或徒手绘制。7种线条类型、平滑处理、圆角0〜15次
- **气泡合并**：重叠的自定义气泡通过多边形布尔运算合并为一个轮廓
- **文本**：竖排与横排、粗体、填充色、轮廓色、背景色，字号7〜150
- **字体**：156种，分为4个类别（对白70、特殊35、说明28、拟声23）
- **添加字体**：系统字体、Web字体URL、上传 `.ttf/.otf/.woff/.woff2`
- **项目字体保存**：记录所用字体并在加载时恢复
- **图像文本**：31种装饰样式（霓虹、镀铬、金属、电路、极光等）

**绘制与效果**
- **画笔**：8种（马克笔、墨水笔、蜡笔、铅笔、双重描边、圆形、马赛克、橡皮擦）
- **网点**：5种（半调网点、噪点、雪、速度线、集中线）
- **黑白转换**：6种，可应用于选中图像、当前页面或全部页面
- **滤镜**：15种（锐化蒙版、缩放模糊、点屏、六角像素化、墨水、色相/饱和度等）
- **混合模式**：25种，分为5个系列
- **发光**：为图像轮廓添加发光效果
- **变形**：旋转、缩放、倾斜、透明度、水平/垂直翻转、裁剪、上下左右显示限制

**图层与历史**
- **图层**：将图像、文本、分格作为图层管理。显示切换、移动锁定、顺序调整、单独下载
- **右键菜单**：变形、样式、分格、操作、显示限制、AI 六个分组
- **撤销/重做**：页面内不限次数（切换页面后历史记录清空）

**保存与导出**
- **项目保存/加载**：保存为 `DESU-Project.lz4`。加载支持 `.lz4` 和 `.zip`
- **自动保存**：间隔10〜600秒（默认60秒），下次启动时提示恢复
- **图像导出**：按原稿尺寸(mm)×DPI(默认300)输出PNG，也支持SVG
- **设置保存/加载/重置**

**AI生成**
- **文生图 / 图生图**：直接在分格内生成或转换
- **局部重绘**：绘制蒙版后重新生成该区域（仅ComfyUI）
- **视角生成**：通过3D相机控件从新角度重绘（仅ComfyUI）
- **高清放大 / 去背景**
- **角色分配**：为每种处理分别指定服务
- **ComfyUI工作流**：导入API格式工作流，可直接编辑节点输入值
- **任务队列**：每个服务可设置1〜10并发，图层上显示进度并可取消
- **提示词查找替换**：批量替换整个项目的提示词

**LLM联动**
- **故事转分格提示词**：从文章生成每个分格的提示词，可选择分格/页面/全部页面
- **角色与场景设定提取**：从故事中自动提取以保持一致性
- **分镜批量生成**：从已有分镜文本生成整页分格的提示词
- **图像转提示词**：读取图像并追加标签

**其他**
- **多语言支持**：英语、日语、韩语、法语、中文、俄语、西班牙语、**德语**（共8种语言）
- **仪表盘**：生成时间、时段活跃度、标签统计、词云、连续记录、目标、徽章、外部API费用估算。支持JSON/CSV导出
- **预设选择器**：从列表中搜索并选择画笔、网点、图像文本、GLFX滤镜
- **PWA安装 / 离线运行**
- **教程**：介绍各侧边栏面板的引导教程

</details>

---

## 数据处理说明

应用本身没有服务器，您创建的项目不会被上传。但以下两项会发送到外部：

1. **访问分析**：公开网站使用Google Analytics，会记录页面浏览和界面操作。
2. **云端AI服务**：若配置了 RunPod / Fal.ai / Grok，相关请求的提示词、故事或对白文本以及分格图像会发送至该服务。仅在本地使用 ComfyUI / SD WebUI / Ollama 时，生成处理完全在您的机器上完成。

页面加载时还会从 Google Fonts、cdnjs 和 unpkg 获取资源。

设置、API密钥、工作流、上传的字体、自动保存数据和使用统计保存在浏览器中（localStorage / IndexedDB）。**云服务的API密钥以明文保存**，请勿在公用电脑上输入。

---

# 安装
https://github.com/new-sankaku/manga-editor-desu.git
<img src="https://new-sankaku.github.io/SP-MangaEditer-docs/02_.webp" width="700">

## 如何贡献
- **错误报告**：如果您发现错误，请在[Issues](https://github.com/new-sankaku/manga-editor-desu/issues)中创建一个新问题，并在标题中包含**[Bug]**。
- **功能建议**：如果您有新功能的想法，请在[Issues](https://github.com/new-sankaku/manga-editor-desu/issues)中创建一个新问题，并在标题中包含**[Feature Request]**。
- **文档改进**：如果文档中有拼写错误或错误，请提交带有可能更正的拉取请求。如有必要，您也可以将其添加到[Issues](https://github.com/new-sankaku/manga-editor-desu/issues)中。

## 交流
如果您对项目有疑问或讨论，请在[Issues](https://github.com/new-sankaku/manga-editor-desu/issues)中发帖或加入[Discord](https://discord.gg/XCp7dyHj3N)服务器。

## 许可证
GNU General Public License v3.0

谢谢！

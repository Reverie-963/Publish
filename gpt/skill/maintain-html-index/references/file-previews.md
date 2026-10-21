# 文件类型与生成

## 运行

在可用 Python 运行时安装 `requirements.txt` 中的解析依赖；Codex 桌面优先先调用 `load_workspace_dependencies` 取得实际 Python 路径。Office 版面预览还需要 `soffice`（LibreOffice）和 `pdftoppm`（Poppler）；使用已安装工具，不在用户未授权时更改系统配置。Markdown 与代码配色使用本技能根目录的 Node 依赖，缺失时执行 `npm ci --ignore-scripts --no-audit --no-fund`。

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/maintain-html-index/scripts/build_folder_index.py" /absolute/folder
```

可选参数：`--title` 页面标题、`--name` 入口文件名、重复 `--exclude` 指定排除目录、`--include-originals` 显示原文重建稿、`--links /task/links.json` 加入已核实在线入口。

`--links` 示例：`[{"label":"课程页面","url":"https://example.org/course","folder":"在线入口"}]`。该文件是可选任务输入，不从文件名猜测在线链接。

整个文件夹（包括隐藏的 `.file-index/`）一起移动。浏览器直接打开入口，无需运行服务；需要实际 file:// 测试才能声称已验证本机离线交互。原件不修改，重复运行复用内容未变的成功预览。

## 类型支持

| 类型 | HTML 预览方式 | 边界 |
|---|---|---|
| MD | 可选择文本、表格、图片、目录与离线数学 | 不执行原文 HTML 脚本；缺失链接明确记录 |
| DOC/DOCX、RTF、ODT | 转换为 PDF 后逐页显示 | 静态版面；转换后的字体与复杂布局可能不同于原应用 |
| PPT/PPTX、ODP | 逐页幻灯片图像 | 不播放动画、交互及嵌入音视频 |
| PDF | 每页图像，保留页面顺序 | 不等同于 OCR；原 PDF 可另开 |
| XLSX/XLSM | 完整工作表表格、工作表导航、合并单元格及基本样式；图表/图片另附版面视图 | 不执行宏、不重算公式；无缓存时显示公式；数字展示以读取值为准，不承诺复现全部数字格式 |
| XLS、ODS | 打印版面逐页显示 | 受原工作簿打印区域影响 |
| CSV/TSV | HTML 表格 | 默认 UTF-8；编码不兼容时报错，不能乱码冒充成功 |
| PNG/JPEG/GIF/WebP/SVG | 图片预览 | GIF 保留源动画；SVG 作为图片加载 |
| BMP/TIFF | 转换成 PNG；多页 TIFF 分页 | 转换不覆盖原图 |
| MP3/WAV/OGG/M4A/FLAC | 浏览器音频播放器 | 实际编码须浏览器支持 |
| MP4/WebM/MOV/M4V/AVI | 浏览器视频播放器 | 容器不保证编码兼容；需实际播放检查 |
| TXT、JSON、YAML、代码（含 MATLAB `.m`）等 | 完整可选择文本；已知语言由 highlight.js 在生成阶段配色 | 不执行代码，未知语言保持纯文本；不使用在线依赖 |
| HTML | 受限 iframe 显示原页面 | 禁用原页面脚本和表单，复杂交互不保证可用 |
| ZIP | 压缩包文件清单 | 不解压、不执行内部文件 |
| 未知或损坏类型 | 说明限制并保留原件入口 | 不能标记为内容预览成功 |

## 文稿目录

目录统一复用阅读页的可收起左侧大纲，不另加顶部导航条。

- Markdown：按真实标题层级跳转；HTML：提取 `h1`–`h6`，在 `.file-index/` 内建立带锚点的副本，在保留 sandbox 的嵌入页中跳转。原文件、已有锚点和资源链接保留；网页目录标示最后选择的标题，不声称能跟踪受限嵌入页内部的滚动。
- PDF、DOC/DOCX、ODT、RTF、PPT/PPTX、ODP、XLS、ODS：保留逐页图像预览，优先以 PDF/转换结果中的书签命名各页，同页书签合并；没有书签的页显示页码。跳到对应页顶部，不冒充精确的段落定位；不凭正文猜标题。只列实际生成的页面，截断上限外的页不生成死链接。
- XLSX/XLSM：按工作表名称导航；有附加图表与打印版面时加入对应入口，点击自动展开。目录取代原先的内文工作表导航，避免重复。
- 多页 TIFF：按已生成图片的页码导航；单张图片、音视频、CSV/TSV、纯文本及无标题的网页等不强行制造章节。只有一个目标时省略目录图标，缩放控件仍保留。

验证可运行 `tests/check_outlines.py`（PDF 书签、截断、工作表、多页 TIFF、网页锚点与原件保护）和 `tests/check_outline_interactions.cjs ROOT`（需要 jsdom；跨类型跳转、打印区域展开、受限网页目录）。后者只验证 DOM 逻辑，不代替真实浏览器跳转与视觉检查。

每份预览显示自身必要限制，任务报告不承担“掩盖预览缺失”的作用。

默认单文件最多 200 页、200000 单元格、2000000 文本字节，可分别用 `--max-pages`、`--max-cells`、`--max-text-bytes` 调整。达到限制会明确提示部分预览或不生成，不能静默截断后宣称完整。转换超时/缺依赖时仍保留该文件的限制页，并在 `.file-index/manifest.json` 记录失败。

## 检查

- 对每种实际用到的类型至少检查一个样例，重点包括多页、图片、表格、公式、工作表和特殊路径。
- 测试无报告目录不产生报告；已有报告与其他 Markdown 一样被识别。
- 检查源 SHA 未变、重复构建结果稳定、增量能发现变化、不覆盖用户 HTML、损坏或未知类型仍可找到。
- 检查子目录进入、上一级、总索引和空目录，目录名导航与箭头折叠相互独立。
- 检查本地链接、资源、片段、嵌套目录、样式/字体；交互逻辑测试与真实浏览器视觉/播放测试分别说明。

## 可重复样例

`tests/generate_samples.py EMPTY_DIR --legacy` 生成本次测试使用的 34 个合成样例（33 种扩展名，含未知类型和损坏文件）。拒绝写入非空目录。除预览依赖外，样例制作还需要 python-docx、python-pptx、reportlab 和 ffmpeg；`--legacy` 需要 LibreOffice。全部内容是测试数据，不涉及用户课程资料。

用生成器构建样例索引后，可用 `tests/check_ui.cjs ROOT` 做 DOM 交互测试；需要在独立测试环境安装 jsdom 并通过 NODE_PATH 使其可见。这不会启动真实浏览器，不能用来证明视觉布局或音视频播放。

整页缩放与语法配色可运行 `tests/check_preview_interactions.cjs ROOT` 检查；与目录交互测试一样需要 jsdom。检查包含比例调整、复位、切页恢复、存储禁用、键盘快捷键、Ctrl 滚轮、Command 加双指滚动不缩放、普通滚动保留，以及高亮前后代码文本一致；真实浏览器排版与手势仍需单独核验。

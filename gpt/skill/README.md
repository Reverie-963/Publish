# GPT / Skill

当前安装在个人技能目录中的技能快照，包括自定义工作流和本地安装的通用技能。这里不代表所有内容均为原创；已有许可证和署名保留在各技能目录中。系统技能、插件缓存、运行依赖、账号配置和任务产物不包含在此集合。

| 技能 | 用途 |
|---|---|
| [maintain-html-index](maintain-html-index/SKILL.md) | 简洁折叠文件树、独立 HTML 阅读页与多格式预览 |
| [task-work-report](task-work-report/SKILL.md) | README 风格的简练报告，去重并醒目置顶待确认事项 |
| [translate-docs-to-markdown](translate-docs-to-markdown/SKILL.md) | 文档中文 Markdown 翻译与 HTML 阅读交付 |
| [moodle-course-archive](moodle-course-archive/SKILL.md) | Moodle 课程归档、增量补齐与条目对应 |
| [video-to-bilingual-markdown](video-to-bilingual-markdown/SKILL.md) | 带时间戳和截图的双语视频文稿 |
| [video-bgm-finder](video-bgm-finder/SKILL.md) | 视频背景音乐识别与证据记录 |
| [report-review-html](report-review-html/SKILL.md) | 双语报告审核与段落版本比较 |
| [pdf](pdf/SKILL.md) | PDF 读取、制作与版面检查 |
| [playwright](playwright/SKILL.md) | 浏览器自动化 |
| [sora](sora/SKILL.md) | Sora 视频工作流程 |
| [hatch-pet](hatch-pet/SKILL.md) | 宠物精灵图生成、组装与检查 |

## 安装与依赖

将所需技能的整个文件夹放到 `${CODEX_HOME:-$HOME/.codex}/skills/`；如存在同名技能，先对比并备份本地修改。自定义安装位置以会话实际提供的技能路径为准。

`translate-docs-to-markdown` 和 `moodle-course-archive` 共用 `maintain-html-index`，需并列安装。`video-to-bilingual-markdown` 同时使用索引技能和翻译技能。其他技能的外部工具、平台限制和运行条件见各自 `SKILL.md`；仅复制文件不代表相关服务已经配置。

索引技能的 HTML 生成工具使用 Node.js，首次使用时在 `maintain-html-index/` 内运行：

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

依赖版本由 `package-lock.json` 锁定，不需要把 `node_modules` 发布到仓库。

## 索引与报告独立

`maintain-html-index` 只扫描已有文件并生成预览，默认入口为 `00 - 文件索引.html`，配套内容集中在 `.file-index/`。索引为居中单栏文件树，文件夹名可进入子目录，箭头控制折叠；点击直接进入与目录同风格的平面阅读页，不套纸张卡片，文章目录通过低调的细线图标展开、收起；展开后停留在正文侧边，跳转章节时保持打开，并标出当前阅读位置，不使用左目录右预览布局。左侧工具区的单个无边框图标在有任何展开目录时收起全部，完全收起时才展开全部。Word、ODT、RTF、PPT、PDF、XLS、ODS 提供逐页版式预览，XLSX 提供工作表视图，其他类型见 [支持范围](maintain-html-index/references/file-previews.md)。索引与阅读页支持整页缩放，索引与文档的导航、缩放控件统一在左侧横向排列；竖屏工具栏贴顶，背景覆盖两侧留白；单击比例即可恢复 100%，小箭头展开调整，同一文件夹沿用比例；代码（含 MATLAB `.m`）使用离线语法配色且无底色边框，滚动条保持细浅色。Python 依赖见 `requirements.txt`；Office/PDF 版面转换需要 LibreOffice 和 Poppler。

`task-work-report` 按任务量和用户要求启用，按实际内容组织 README 风格报告，不设固定两段；避免语义重复，待确认的额外操作与影响决策的不确定事项醒目置顶。索引不会自动创建报告；报告已存在时才按普通文件生成预览。同一任务的后续修改更新原报告，整理为当前状态；独立任务或正式留档才新建。文章审核工具 `report-review-html` 保持独立用途。

默认交付纯离线 HTML，直接打开索引阅读，不启动后台服务、网页编辑或自动同步。修改原文件后按需运行一次增量生成，预览沿用现有布局、目录和缩放交互。

旧本机服务代码保留但停用，只有之后明确要求恢复服务时才使用。原 Markdown 阅读页脚本保留兼容入口。

## 验证范围

测试包含常见文档、旧版 Office、开放文档、表格、图片、音视频、文本、压缩包，以及未知和损坏样例。检查原件不变、本地链接、增量复用和无报告目录；界面逻辑采用 DOM 模拟。真实浏览器显示、音视频播放和本机 file:// 行为需要单独实测，不能由静态检查推断。

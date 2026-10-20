# GPT / Skill

当前安装在个人技能目录中的技能快照，包括自定义工作流和本地安装的通用技能。这里不代表所有内容均为原创；已有许可证和署名保留在各技能目录中。系统技能、插件缓存、运行依赖、账号配置和任务产物不包含在此集合。

| 技能 | 用途 |
|---|---|
| [maintain-html-index](maintain-html-index/SKILL.md) | 独立维护 HTML 索引、折叠树、相对链接与配套阅读页 |
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

## 索引拆分

索引规则、导航模板、展开状态脚本、阅读页样式、生成器和 Node 依赖集中在 `maintain-html-index`。调用方负责内容和资料对应关系，索引技能负责导航与链接校验。翻译技能保留旧生成脚本的兼容入口，避免已有调用失效。

报告继续沿用现有内容和渲染规则，本次不重做报告结构，也不迁移已有课程成果。

## 本次验证范围

10 个技能的结构校验通过。索引生成流程在临时样例中验证了公式、图片、重复标题锚点、中文路径、双语输出、旧脚本兼容、索引重复运行不变及 Markdown 原稿不变。未对全部技能的外部服务执行端到端测试，未把静态检查视为浏览器交互实测。

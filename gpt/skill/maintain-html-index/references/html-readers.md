# 旧 Markdown 阅读页接口

`scripts/build_html_readers.cjs` 保留已有同目录 `.md → .html` 的兼容调用，依赖由本技能 `package.json` 锁定。缺依赖时在技能根执行 `npm ci --ignore-scripts --no-audit --no-fund`。

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/maintain-html-index/scripts/build_html_readers.cjs" --root /absolute/folder --file "资料.zh.md"
```

重复 `--file` 限定变化文件；`--include-originals` 允许新建英文重建稿阅读页；`--manifest` 输出工作区校验记录。正文 MD 不改变，拒绝覆盖无生成标记的既有 HTML。公式在生成阶段用 KaTeX 渲染，本地复制字体与样式；标题锚点唯一，完整文章不拆页。

`--update-indexes` 只升级已有旧式树的链接和交互；新文件浏览器使用 `build_folder_index.py`。返回入口优先选择 `00 - 文件索引.html`，已有 `index.html` 作为兼容候选。报告没有特殊写作或创建流程，只有实际存在并被选中的 MD 才会渲染。

缺失图片、链接、片段和公式错误在机器记录中列出；验证记录不必另写任务报告。交付实际存在的阅读入口。

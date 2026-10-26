# 附件/图片筛选与上游编辑器换栈

日期：2026-10-26（Asia/Shanghai）。延续 `codex/upstream-audit-fixes` 上的首轮修复，补齐用户确认继续实施的两项功能。

## 附件与图片筛选

快速搜索新增「有附件」「有图片」按钮，可单独筛选，也可与文字、标签、日期、心情、Space、作者和 Saved Views 条件组合。选好后提交，取消搜索不会提前改变列表。筛选状态随 URL 保存，跳转页面后仍可恢复。

统一 CEL 字段：

| 表达式 | 含义 |
| --- | --- |
| `has_attachments` | 至少有一个绑定到该备忘的附件 |
| `has_image` | 正文包含 Markdown 图片，或者绑定了 MIME 类型为 `image/*` 的附件 |
| `has_attachments && !has_image` | 有文件，但没有图片 |
| `has_image && !has_attachments` | 正文有图片，没有绑定附件 |
| `!has_image` / `has_image == false` | 没有图片 |

两个字段在列表 API、MCP、Saved Views 及基于同一筛选引擎的统计查询中使用。MCP 描述、OpenAPI、前端类型和 Saved Views 示例已更新。

附件关系实时查询：绑定、移动和删除文件立即影响结果。正文图片由 Markdown AST 判断，普通链接、行内代码和代码块中的图片语法不会误判。图片 MIME 类型大小写不敏感；未绑定的上传不会匹配任何备忘。

存量内容通过 `payload_version = 1` 在后台分批重建；首次升级重建完成前，旧正文的图片标志可能尚未更新。按稳定 ID 分页，避免并发删除导致偏移分页漏行；重建写入要求正文仍与读取时一致，只更新标签和派生属性，保留心情、位置和更新时间。成功后记录版本；中断或写入失败会在下次启动重试。该变化不新增表列，不需要关系数据库 schema 迁移。

## 编辑器

编辑输入引擎已由 CodeMirror 6 切换到固定版本的 `@usememos/editor@26.10.27`，移除旧 CodeMirror 包和集成模块。新包无运行时依赖。

- 默认富文本编辑：标题、加粗、任务复选框、表格、图片块及上游 slash menu。
- Add 菜单新增「Markdown 模式」，可随时切换源码；切换保留正文和撤销历史，设备记住上次选择。
- 标签补全、嵌套标签匹配、emoji 补全、源码模式标签文本及任务列表操作。
- 保留 LifeDock 的常驻格式栏、专注模式、草稿缓存、上传占位符及失败重试、语音转写、心情、提醒、时间戳和 Space/可见性流程。
- 图片使用现有附件 URL 解析；HTML 预览沿用内容清洗与 iframe 白名单，包括上一轮加入的 Bilibili 支持。
- 编辑器在布局阶段挂载；外部内容更新等待中文输入法组合结束，避免打断输入。

已发表备忘继续使用现有阅读渲染流程，保留任务操作、隐私、脚注、链接卡片、图表和分享图片行为。本轮替换的是输入引擎；阅读流程仍用到的 Lezer Markdown 语法辅助模块予以保留。

实现接口说明见 [MemoEditor README](../web/src/components/MemoEditor/README.md)。

## 验证

已通过：

- `cd web && pnpm lint`。
- `cd web && pnpm test`：197 个文件、1,379 项通过。旧 CodeMirror 内部实现测试已替换为上游引擎的行为测试，因此与首轮修复的测试总数不同。
- `cd web && pnpm build`。
- `SKIP_MINIO_TESTS=1 go test -v -race -count=1 ./server/...`。
- `SKIP_MINIO_TESTS=1 go test -v -race -count=1 ./internal/...`。
- `SKIP_MINIO_TESTS=1 go test -v -count=1 ./store/...`：SQLite、MySQL、PostgreSQL 全部通过。
- 三种数据库另行验证重建保留心情、位置、更新时间，拒绝覆盖已变更正文，以及附件绑定/移动/删除后的筛选。
- proto 已按源文件重新生成，`buf lint`、`buf format --diff --exit-code`、`git diff --check` 通过。
- v0.36.4 发版前补充：Go 1.27.0 的 `go mod tidy` 无依赖差异，`golangci-lint v2.13.1` 检查通过；`go test -race ./cmd/... ./proto/...` 和 MCP 评测脚本的 4 项测试通过。

浏览器使用隔离测试数据库。已验证含中文、任务列表、标签、加粗的正文在源码与富文本之间切换，并保存成功；心情随备忘一起保存并反映在统计中。图片备忘与普通备忘分别保存，随后验证图片筛选及移动端布局。最终又在生产构建预览中完成输入、模式切换、保存和图片筛选复验，控制台无应用错误。

环境限制：固定 MinIO 镜像仍不可拉取，相关集成检查显式跳过，恢复镜像后需在不设置 `SKIP_MINIO_TESTS` 的环境重新执行上述 Go 命令。浏览器扩展未授予文件 URL 访问，自动文件选择被拒绝；未更改浏览器权限。文件粘贴、上传占位符、绑定与删除由前端和真实数据库测试覆盖，本次浏览器不声称已完成文件选择上传。

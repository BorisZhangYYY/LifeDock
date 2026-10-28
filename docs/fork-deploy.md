# Fork 版本安装与部署

本 fork 在官方 Memos 基础上增加了**心情模块**、**收支模块**、**提醒事项**（关联 Memo、站内通知和可选 SMTP 邮件通知）、**可见性策略**等个人生活平台功能。发布镜像仅推送至本 fork 的 GitHub Container Registry。

## 发布产物

| 产物 | 地址 |
|------|------|
| Docker 镜像 | `ghcr.io/boriszhangyyy/memos`（tag：`0.36.5` / `0.36` / `stable`） |
| 二进制 | [GitHub Releases](https://github.com/BorisZhangYYY/memos/releases)（linux/darwin/windows × amd64/arm64/armv7） |

## 方式一：Docker 部署（推荐）

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  ghcr.io/boriszhangyyy/memos:stable
```

打开 `http://localhost:5230` 注册第一个账号（自动成为管理员），然后在设置中关闭公开注册。

升级：`docker pull ghcr.io/boriszhangyyy/memos:stable && docker rm -f memos` 后按同样命令重新运行（数据在 `~/.memos` 卷中，不会丢失）。

## 方式二：二进制部署

从 [Releases](https://github.com/BorisZhangYYY/memos/releases) 下载对应平台压缩包：

```bash
tar -xzf memos_0.36.5_linux_amd64.tar.gz
./memos --data ~/memos-data --port 5230
```

## 方式三：源码构建

```bash
# 前端打包（必须，否则页面空白）
cd web && pnpm install && pnpm release
cd ..

# 构建单二进制
VERSION="$(git describe --tags --abbrev=0 | sed 's/^v//')"
COMMIT="$(git rev-parse --short HEAD)"
GOPROXY=https://goproxy.cn,direct go build \
  -ldflags="-X github.com/usememos/memos/internal/version.Version=${VERSION} -X github.com/usememos/memos/internal/version.Commit=${COMMIT}" \
  -o memos ./cmd/memos
./memos --data ~/memos-data --port 5230
```

## 数据目录

- 默认（本地裸跑）：启动命令的**当前工作目录**下的 `memos_prod.db`（SQLite）
- 建议始终用 `--data <目录>` 显式指定，启动时终端会打印 `Data directory:` / `Database:` 确认
- **迁移/备份 = 拷贝整个数据目录**（`memos_prod.db` 即全部数据：日记、心情、设置）
- 开发模式：`./scripts/run-dev-backend.sh --data ~/memos-test-data --port 8081`，前端 `cd web && pnpm dev`（:3001 代理到 :8081）

## 接入 Agent（MCP）

本 fork 自带 MCP 服务（`/mcp`，Streamable HTTP）。在 Claude Desktop 等客户端配置：

```json
{
  "mcpServers": {
    "memos": {
      "type": "http",
      "url": "http://<你的IP>:5230/mcp",
      "headers": { "Authorization": "Bearer <访问令牌>" }
    }
  }
}
```

访问令牌在网页「设置 → 我的账户 → 访问令牌」创建。Agent 即可通过 `memo_create_memo` 等工具自动记录日记、心情（`mood_level` 1-7 参数）。

默认 `/mcp` 提供完整的 56 个工具；笔记场景可改用 `/mcp?profile=notes`（27 个工具），生活管理可用 `/mcp?profile=personal`（37 个工具）。这只调整工具集合，不改变令牌所属账号的权限。每日记录与心情汇总优先使用 `user_get_activity_summary`；提醒历史与统计包含删除事项后保留的完成记录。

## 个人内容隐私

开启“保护个人看板”后，进入个人管理前会在当前页面验证账户密码，验证成功才跳转。密码错误或关闭弹窗都停留在原页；个人区内部切换模块无需重复输入，离开后再次进入需重新验证。刷新或直接打开个人地址时，先在首页验证，再进入原目标。

Memo 的模糊规则和是否需要账户密码，在「设置 → 标签」中独立配置。个人看板与标签 Memo 的解锁状态互不影响。此功能保护前端显示，不改变 Memo 的分享权限，也不对数据加密。

## 用户数据导出与导入

「设置 → 导出与导入」可下载当前账号的完整用户数据备份，包括 Memo、评论、附件、个人资料与设置、提醒清单与完成历史、收支账户与流水、心情历史及通知记录。未关联 Memo 的自有附件也会导出。新备份使用归档格式 1.2，仍可导入旧版 1.0/1.1 Memo 归档。

导入前可查看记录数量并选择保留、替换或创建副本。个人模块按整组处理，恢复失败时该组会回滚；资料与已有设置仅在选择替换时覆盖。账号密码、登录令牌、外部登录绑定和共享空间成员权限不参与迁移。备份可能包含个人信息和 Webhook 签名密钥，请妥善保管。

## 与官方版的差异

- **心情模块**：编辑器 Heart 按钮记录心情（1-7）；日历每日/月度平均心情标注；独立心情页面和历史统计；侧栏心情多选筛选；memo 卡片心情 emoji + 彩色边框；设置页「心情设置」自定义每档 emoji 和颜色
- **收支模块**：钱包、收入支出类型、转账和余额校准；独立收支页面展示当日数据和完整历史，顶部切换钱包与分类管理
- **提醒事项**：今天、计划、全部、旗标和已完成视图；独立提醒页面默认按列表展示全部事项，支持分组新增、列表设置、日期与时间、提前提醒、重复、优先级及关联 Memo
- **通知**：提醒事项支持站内通知；管理员可配置通用 SMTP 服务，将提醒同步发送到用户邮箱
- **可见性策略**：系统设置只保留一个公开访问开关；开启后允许 Public Memo 和匿名发现页，关闭后隐藏公开入口、禁止设置 Public 可见性，并引导访客登录
- **编辑与筛选**：上游富文本/Markdown 双模式编辑器，保留 LifeDock 心情、提醒、语音和附件流程；快速搜索支持「有附件」「有图片」，并可与其他条件组合
- **视频嵌入**：在备忘中粘贴可信平台的 iframe 代码即可显示播放器，新增 Bilibili 支持
- **OAuth2 登录**：已注释（个人平台使用密码登录）
- **镜像**：仅发布至 `ghcr.io/boriszhangyyy/memos`（不推送官方 Docker Hub / GHCR 仓库）

从 v0.36.3 升级到 v0.36.4 无需新增数据库表列。首次启动会在后台重建历史备忘的正文图片标志，完成后旧图片即可参与筛选；过程保留心情、位置及原更新时间。中断后会在下次启动重试。

## 删除与统计

- 提醒列表删除时连同其中事项一起删除，不迁移到默认列表。
- 提醒完成后进入“已完成”，可直接删除或一键清理；已有完成日期、名称、原列表及统计独立保留。没有任何完成历史的事项删除后不留统计；重复提醒保留已经发生的完成历史。
- 钱包可停用、恢复；停用后才可删除。删除后不再参与当前管理余额，历史流水与收支统计保留，流水中的原钱包名用删除线标识。
- 错误收支直接永久删除，并重新计算受影响的余额和统计；不会清空其他流水的数据。
- 新版不再提供提醒归档操作。移除“旧版归档”按钮；旧版已完成归档仍可在“已完成”中查看、删除或清空，完成统计保留。

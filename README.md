# TXT 小说阅读器

带账号与书架的 TXT 阅读器，数据存在**项目本地**（服务端 SQLite），换浏览器登录同一账号即可继续阅读。前端按**设计规范**使用 Vue 3 + TypeScript + Vite + Tailwind CSS + Ant Design Vue + Pinia + Vue Router。

## 功能

- **登录**：先登录再使用，数据按账号存储
- **书架**：上传的 TXT 存在服务端，书架列表显示「读到 xx%」，点书名从上次进度继续
- **阅读进度**：底部「阅读进度」为当前阅读位置百分比；自动保存，下次打开自动跳转
- **分页 / 普通模式**：顶部 📄 切换。普通模式为整本滚动；分页模式按页阅读，底部显示「第 x/y 页」和上一页/下一页
- **主题 / 字号 / 全屏**：与之前一致；全屏下按 Esc 退出
- **管理员**：默认账号 `admin` / `admin123`。管理员可见「管理」入口，可管理用户及其书架（增删改查）

## 使用

### 生产：构建后一体运行

```bash
pnpm install
pnpm run build    # 构建 frontend，输出到 frontend/dist
pnpm start        # 启动后端，托管 frontend/dist
```

浏览器打开 http://localhost:3000（或 http://local.bilibili.co:3000）。  
路由：`/login` 登录 → `/bookshelf` 书架（第一个卡片为「导入 TXT」）→ `/reader/:id` 阅读；管理员可见「管理」→ `/admin.html`。

### 开发：同时运行前后端

需要**两个终端**：

| 终端 | 命令 | 说明 |
|------|------|------|
| 1 | `pnpm start` | 后端 API，端口 3000 |
| 2 | `pnpm run dev:frontend` | 前端 Vite 开发服务器，端口 5173，代理 `/api` → 3000 |

开发时在浏览器访问 **http://localhost:5173** 进行调试（前端热更新，请求会转发到后端 3000）。

## 部署到线上（手机访问）

**云托管（电脑可关机）**：见 [docs/部署.md](docs/部署.md) — **Railway** 或 **Render（选 Docker 构建）**，连 GitHub、设 `SESSION_SECRET` 即可。  
**本机**：自家电脑 `pnpm start` + `cloudflared tunnel --url http://localhost:3000`，用出现的 `https://xxx.trycloudflare.com` 在手机打开。  
**学 Docker**：同文档里有「用 Docker 部署本项目（学习篇）」——Dockerfile 说明、本地 `docker build` / `docker run`、数据卷与常用命令。

## 数据存在哪

- **之前**：纯前端时书存在浏览器 IndexedDB，换浏览器就没了
- **现在**：书和进度存在**项目目录**下的 `server/data/novel-reader.db`（SQLite），与代码在同一台机器上；换浏览器只要登录同一账号，书架和进度都会在

## 管理员

- 仅**管理员账号**登录后能看到「管理」链接，进入 `admin.html`
- 管理员可：添加/编辑/删除用户；查看任意用户的书籍列表；删除任意用户的某本书
- 默认管理员：用户名 `admin`，密码 `admin123`（首次运行自动创建）

## 文件说明

- `frontend/` - Vue 3 前端（符合 `docs/前端设计.md`）
  - `src/views/` - 登录、书架、阅读页
  - `src/store/` - Pinia（user、app）
  - `src/api/` - 请求封装
  - `src/hooks/` - 阅读解析等
  - `public/admin.html` - 管理员页面（构建后为 `/admin.html`，仅管理员可访问）
- `server/index.js` - 服务端（Express + SQLite）
- `server/data/novel-reader.db` - 数据库（运行后自动生成）
- `docs/前端设计.md` - 前端设计规范

## 技术

- 前端：Vue 3 + TypeScript + Vite + Tailwind CSS + Ant Design Vue + Pinia + Vue Router
- 后端：Node.js + Express + sql.js，Session 登录，数据存 SQLite

# 中小学数学学习网站

面向中小学生的数学学习平台，包含两大核心功能：按知识点梳理的知识体系（树形导航、流式讲解、例题、练习测验），以及错题整理系统（拍照上传、OCR 识别、错误分析、相似题生成、FSRS 间隔复习直到完全掌握）。

支持手机浏览器、PWA 可安装、语音输入、图文交互，知识内容由大模型自动生成并缓存。

## 功能概览

### 知识体系模块
- LLM 生成数学知识点树（小学+初中），缓存到 PostgreSQL ltree
- 知识点核心简介、详细讲解（流式渲染）、例题、练习测验（交互式选择题）
- 知识点关联展示

### 错题整理模块
- 拍照上传（相机+相册，客户端压缩+EXIF 修复）
- OCR 三级回退：LLM 视觉 → Tesseract.js → 手动输入
- LLM 错误原因分析 + 解题思路 + 知识点标注
- LLM 生成相似选择题（基于常见错误的干扰项）
- FSRS 生命周期追踪（new → learning → review → relearning → mastered）
- 掌握度确认门控（3 道确认题全对 = 掌握）

### 其他
- 用户名+密码注册登录（Lucia 服务端会话，RBAC 角色）
- 移动端响应式 + 底部导航 + 安全区适配
- PWA 可安装 + Web Push 复习提醒
- 语音输入（MediaRecorder + 服务端 STT）

## 技术栈

- **框架**: Next.js 15 (App Router, standalone build)
- **语言**: TypeScript (strict mode)
- **数据库**: PostgreSQL 16 (ltree 扩展, Drizzle ORM)
- **认证**: Lucia (服务端会话, Argon2id, RBAC)
- **LLM**: Vercel AI SDK (createOpenAICompatible, streamText, generateObject + Zod)
- **FSRS**: ts-fsrs (间隔重复调度)
- **OCR**: Tesseract.js (客户端回退)
- **状态管理**: TanStack Query + Zustand
- **PWA**: @ducanh2912/next-pwa
- **测试**: Vitest (单元/集成) + Playwright (E2E)
- **部署**: Docker Compose (standalone + PostgreSQL + Caddy)

## 开发环境

### 前置要求

- Node.js 20+
- PostgreSQL 16+ (启用 ltree 扩展)
- npm 10+

### 快速开始

1. 克隆仓库：

```bash
git clone https://github.com/lijunhao731/school-learning-website.git
cd school-learning-website
npm install
```

2. 配置环境变量：

```bash
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL、LLM_API_KEY 等
```

3. 初始化数据库：

```bash
# 确保 PostgreSQL 运行并启用 ltree 扩展
npx drizzle-kit push
```

4. 启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

### Docker 开发环境

```bash
cp .env.example .env
docker compose up -d
# 应用: http://localhost:3000
# PostgreSQL: localhost:5432
```

## 生产部署

### Docker Compose 一键部署

```bash
# 1. 复制并编辑生产配置
cp .env.production.example .env.production
# 编辑 POSTGRES_PASSWORD、LLM_API_KEY、DOMAIN 等

# 2. 启动所有服务
docker compose -f docker-compose.prod.yml up -d --build

# 3. 验证服务状态
docker compose -f docker-compose.prod.yml ps
```

或使用部署脚本：

```bash
chmod +x deploy.sh
./deploy.sh
```

### 服务说明

| 服务 | 说明 |
|------|------|
| app | Next.js standalone 构建，监听 3000 端口 |
| postgres | PostgreSQL 16，ltree 扩展，持久化 volume |
| caddy | 自动 HTTPS 反向代理，`flush_interval -1` 支持 SSE 流式 |

### 健康检查

- App: `GET /api/health` → `{ "status": "ok" }`
- PostgreSQL: `pg_isready`
- Caddy: `GET :2019/metrics`

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | — |
| `LLM_API_KEY` | LLM 端点 API Key | — |
| `LLM_BASE_URL` | LLM 端点地址 | http://36.133.77.84:64025/v1 |
| `LLM_MODEL_PREFERRED` | 首选模型 | mm-l2 |
| `LLM_MODEL_FALLBACK` | 备选模型 | mm-l1 |
| `DOMAIN` | 生产域名（Caddy HTTPS） | localhost |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push 公钥 | — |
| `VAPID_PRIVATE_KEY` | Web Push 私钥 | — |

## 测试

```bash
# 单元/集成测试
npm run test

# E2E 测试（需先启动开发服务器）
npx playwright test

# TypeScript 类型检查
npx tsc --noEmit
```

## 项目结构

```
app/                    # Next.js App Router
  api/                  # API 路由 (auth, knowledge, mistakes, ocr, review, voice, push, dashboard, health)
  knowledge/[id]/       # 知识点详情页
  mistakes/             # 错题列表 + 详情 + 上传
  review/               # 复习会话
  dashboard/            # 学生仪表盘
components/             # React 组件 (quiz, mistake, review, knowledge, pwa, layout, notifications, ui)
lib/                    # 核心库 (auth, db, llm, mastery, ocr, notifications, stores, prompts)
db/                     # Drizzle schema + migrations
hooks/                  # 自定义 hooks (useVoiceInput)
e2e/                    # Playwright E2E 测试
__tests__/              # Vitest 单元/集成测试
```

## License

MIT

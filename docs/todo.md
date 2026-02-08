# TypeScript 迁移开发进度 TODO

> 关联文档：
> 2026-02-08 [TypeScript 转换规范](./typescript-migration-guide.md)
> 2026-02-08 [TypeScript 类型定义参考](./typescript-type-definitions.md)

## 进度图例

- `[x]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## 0. 启动与基线

- [x] 确认迁移基线（Node.js >= 18、pnpm、当前主分支状态）
- [x] 补齐 TypeScript 工具链与类型依赖（`typescript`、`tsup`、`@types/*`）
- [x] 创建并确认 `tsconfig.json`
- [x] 创建并确认 `tsup` 构建配置
- [x] 更新 `package.json` 的脚本（`build`、`dev`、`type-check`、`lint`）
- [x] 创建并确认 `.eslintrc.json`（含 `@typescript-eslint` 与 `import/order`）

## 1. 批次推进（按依赖顺序）

### Batch 1: 类型定义与基础工具

- [x] 创建 `src/types/` 类型定义文件（参照类型定义文档）
- [x] 转换 `src/utils/errors.ts`
- [x] 转换 `src/utils/logger.ts`
- [x] 转换 `src/utils/helpers.ts`
- [x] 转换 `src/utils/email-parser.ts`
- [x] 完成本批次质量检查（`pnpm type-check`、`pnpm lint`）

### Batch 2: 配置与数据层

- [x] 转换 `src/config/`（3 个文件）
- [x] 转换 `src/storage/database.ts`
- [x] 转换 `src/storage/migrations/`（4 个文件）
- [x] 模型迁移进度：已完成 `account`、`attachment`、`contact`、`contact_group`、`filter`、`folder`、`saved-search`、`signature`、`spam`、`tag`、`template`、`thread`、`email`（13/13）
- [x] 转换 `src/storage/models/`（13 个文件）
- [x] 完成本批次质量检查（`pnpm type-check`、`pnpm lint`）

### Batch 3: 协议客户端

- [x] 转换 `src/imap/`（2 个文件）
- [x] 转换 `src/smtp/`（2 个文件）
- [x] 完成本批次质量检查（`pnpm type-check`、`pnpm lint`）

### Batch 4: 业务逻辑

- [x] 转换 `src/accounts/`、`src/contacts/`、`src/threads/`、`src/filters/`
- [x] 转换 `src/spam/`、`src/templates/`、`src/signatures/`、`src/notifications/`
- [x] 转换 `src/import-export/`、`src/sync/`
- [x] 完成本批次质量检查（`pnpm type-check`、`pnpm lint`）

### Batch 5: CLI 层

- [x] 转换 `src/cli/utils/formatter.ts`
- [x] 转换 `src/cli/index.ts`
- [x] 转换 `src/cli/commands/`（24 个文件）
- [x] 完成本批次质量检查（`pnpm type-check`、`pnpm lint`）

### Batch 6: 入口与全局验证

- [x] 转换 `src/index.ts`
- [x] 执行全局类型检查（`pnpm type-check`）
- [x] 执行构建验证（`pnpm build`）
- [x] 验证 CLI 可执行（`node dist/index.js --help`）
- [x] 完成功能回归检查（关键命令、数据库操作、错误处理、日志输出）

## 2. 类型定义专项（`src/types/`）

### 2.1 文件组织

- [x] 创建 `src/types/index.ts`
- [x] 创建 `src/types/common.ts`
- [x] 创建 `src/types/database.ts`
- [x] 创建 `src/types/imap.ts`
- [x] 创建 `src/types/smtp.ts`
- [x] 创建 `src/types/config.ts`

### 2.2 领域类型覆盖

- [x] 实体与输入类型：Email/Account/Contact/Folder/Attachment/Tag/Signature/Template
- [x] 查询与分页类型：`PaginationOptions`、`EmailSearchQuery`、相关 Query/Input
- [x] 过滤器类型：`Filter`、`FilterCondition`、`FilterAction`、`FilterApplyResult`
- [x] 线程类型：`Thread`、`ThreadNode`、`ThreadRelationship`、`ThreadUpsertInput`
- [x] 垃圾邮件类型：`SpamRule`、`SpamCheckResult`
- [x] 协议与发送类型：`ImapConfig`、`ImapMessage`、`SmtpConfig`、`EmailSendData`
- [x] 配置与扩展类型：`AppConfig`、`GeneralConfig`、`ImportResult`、`ExportOptions`、`NotificationOptions`、`SavedSearch`、`ContactGroup`
- [x] 错误类型定义：`MailClientError` 及其子类

### 2.3 第三方类型声明

- [x] 安装可用 `@types`（`better-sqlite3`、`inquirer`、`nodemailer`、`mailparser`、`node-notifier`；`cli-table3`/`dotenv` 使用包内置类型）
- [x] 为 `node-imap` 创建 `src/types/node-imap.d.ts`
- [x] 校验所有第三方导入在 `tsc` 下可通过

## 3. 质量门禁（每批次 / 全量）

- [x] 严格模式下无类型错误（`strict`、`noImplicitReturns`、`noUnusedLocals`）
- [x] 无隐式 `any`（必要例外有注释说明）
- [x] 导入顺序与命名规范通过 ESLint 规则
- [x] 核心路径无回归（配置加载、收发邮件、同步、过滤、线程、CLI 输出）
- [x] 构建产物完整（`dist/*.js`、`dist/*.d.ts`、source map）

## 4. 收尾与发布准备

- [x] 备份原始 `.js` 源文件
- [x] 转换验证通过后清理 `src/` 中冗余 `.js` 文件
- [x] 更新 `.gitignore`（保留 `dist/`，忽略不再需要的源产物）
- [x] 更新文档：`README.md`、`AGENTS.md`
- [x] 更新 CI/CD：GitHub Actions 增加 `pnpm type-check` 与 `pnpm build`
- [x] 更新发布流程与包描述

## 5. 里程碑看板

| 里程碑 | 对应目标 | 状态 | 完成日期 | 备注 |
|---|---|---|---|---|
| M1 | 类型定义完成（Batch 1） | `[x]` | 2026-02-08 | Batch 1 完成并通过 type-check/lint/test/build |
| M2 | 数据层转换完成（Batch 2） | `[x]` | 2026-02-08 | 完成 config、storage/database、storage/migrations、storage/models（13个文件） |
| M3 | 协议层转换完成（Batch 3） | `[x]` | 2026-02-08 | 完成 src/imap/（client.ts、sync.ts）和 src/smtp/（client.ts、composer.ts） |
| M4 | 业务层转换完成（Batch 4） | `[ ]` | - | - |
| M5 | CLI 层转换完成（Batch 5） | `[ ]` | - | - |
| M6 | 全局类型检查零错误 | `[ ]` | - | - |
| M7 | 构建成功 | `[ ]` | - | - |
| M8 | 功能测试通过 | `[ ]` | - | - |
| M9 | 文档与 CI 更新完成 | `[ ]` | - | - |

## 6. 变更日志

- 2026-02-08: 初始化 `todo.md`，建立迁移任务与里程碑跟踪框架。
- 2026-02-08: 完成 Batch 1（`src/types/*` + `src/utils/*.ts`）并新增 Vitest 单测（14 个用例）。
- 2026-02-08: Batch 2 进展：完成 `config`、`storage/database`、`storage/migrations` 的 TS 迁移，并新增配置与数据库单测。
- 2026-02-08: Batch 2 继续推进：新增 6 个模型的 TS 版本（`attachment/folder/saved-search/signature/template/thread`）。
- 2026-02-08: Batch 2 继续推进：新增 `contact`、`contact_group` 的 TS 版本。
- 2026-02-08: Batch 2 继续推进：新增 `filter`、`spam`、`tag` 的 TS 版本。
- 2026-02-08: Batch 2 继续推进：新增 `account` 的 TS 版本（模型层剩余 `email`）。
- 2026-02-08: Batch 2 完成：新增 `email` 的 TS 版本，完成所有 13 个模型的 TS 迁移，通过 type-check 和 lint。
- 2026-02-08: Batch 3 完成：完成协议层 TS 迁移（`src/imap/client.ts`、`src/imap/sync.ts`、`src/smtp/client.ts`、`src/smtp/composer.ts`），通过 type-check。

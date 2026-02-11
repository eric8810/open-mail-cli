# Open Mail CLI - 重构任务清单

基于 Agent 定位文档和当前项目状态整理的任务清单，按照调研、设计、开发、测试阶段组织。

---

## 1. 输出格式优化（P0）

**需求**：为 Agent 提供友好的输出格式，支持 Markdown、JSON、HTML 等多种格式。

### 调研
- [x] 调研 CLI 输出格式最佳实践（Markdown 表格 vs JSON）
- [x] 调研其他 CLI 工具的格式化方案（gh, kubectl, docker）

### 设计
- [x] 设计统一的格式化接口（Formatter 抽象层）
- [x] 设计 Markdown 表格输出规范
- [x] 设计 JSON 输出结构规范
- [x] 设计类型系统（FormatMeta, FormatOptions）
- [x] 设计字段选择机制（--fields）

### 开发
- [x] 实现 Markdown 表格格式化器（`src/cli/formatters/markdown.ts`）
- [x] 实现 JSON 格式化器（`src/cli/formatters/json.ts`）
- [x] 支持 --format 参数切换格式
- [x] 实现简洁模式（--ids-only）（`src/cli/formatters/ids-only.ts`）
- [x] 格式化器支持范围标注（Showing X-Y）
- [x] 实现字段选择工具函数（`src/cli/utils/field-selection.ts`）
- [ ] 将字段选择集成到所有相关命令（list, search, read, thread）
- [ ] 实现 HTML 格式化器（邮件正文）

### 测试
- [x] 单元测试：Formatter 接口（`tests/cli/formatter.test.ts`）
- [x] 单元测试：字段选择功能（`tests/cli/field-selection.test.ts`，257 行，46 个测试用例）
- [ ] 集成测试：所有命令的格式输出
- [ ] 验证 Agent 解析 Markdown 表格的准确性

---

## 2. 内容长度管理（P0）

**需求**：避免输出超出 LLM 上下文窗口，提供合理的默认限制和分页机制。

### 设计
- [x] 设计默认限制策略（列表 20 条，正文不截断）
- [x] 设计分页参数规范（--limit, --offset, --page）
- [x] 设计范围标注格式

### 开发
- [x] 实现邮件列表默认限制
- [x] 实现分页工具函数（`src/cli/utils/pagination.ts` - parsePagination, calculateRange）
- [x] 统一所有命令的分页参数（list, search）
- [x] 输出中标注总数和当前范围
- [ ] 实现邮件正文默认截断（暂不需要）
- [ ] 实现 --full 参数（显示完整内容）

### 测试
- [x] 单元测试：分页函数（`tests/cli/pagination.test.ts`，161 行，24 个用例）
- [x] 测试各种长度的邮件列表
- [x] 测试分页功能
- [ ] 测试超长邮件正文的截断（暂不需要）

---

## 3. 事件系统与 Webhook（P0）

**需求**：新邮件到达时触发 Webhook 或自定义脚本，支持 Agent 自动化工作流。

### 调研
- [x] 调研 Webhook 实现方案（HTTP POST, 重试机制）
- [x] 调研事件系统架构（EventEmitter, 消息队列）
- [x] 调研其他邮件客户端的事件机制

### 设计
- [x] 设计事件模型（事件类型、事件数据结构）
- [ ] 设计 Webhook 配置格式
- [ ] 设计脚本触发机制
- [ ] 设计事件日志格式

### 开发
- [ ] 实现事件系统核心（EventEmitter 或自定义事件总线）
- [ ] 实现 Webhook 发送（HTTP POST）
- [ ] 实现脚本触发（--on-new-email）
- [ ] 支持多个 Webhook 配置
- [ ] 实现事件日志记录
- [ ] 实现 Webhook 重试机制
- [x] 桌面通知已实现（`src/notifications/manager.ts` - 支持过滤、批量通知）

### 测试
- [ ] 单元测试：事件发送
- [ ] 集成测试：Webhook 触发
- [ ] 测试脚本执行
- [ ] 测试重试机制

**备注**：当前仅有桌面通知功能，Webhook 和事件系统核心需要重新设计和实现。

---

## 4. 错误处理标准化（P0）

**需求**：统一错误码和错误消息格式，便于 Agent 处理错误。

### 设计
- [x] 设计退出码规范（0=成功, 1=错误, 2=参数错误, 3=网络错误, 4=认证错误, 5=权限错误）
- [x] 设计错误消息格式（JSON 和文本）
- [x] 设计错误分类体系

### 开发
- [x] 实现自定义错误类（`src/utils/errors.ts` - MailClientError, ConfigError, ConnectionError, AuthenticationError, SyncError, StorageError, ValidationError）
- [ ] 统一所有 CLI 命令的退出码使用
- [ ] 错误信息支持 JSON 格式输出（--format json 时）
- [ ] 重构所有命令的错误处理，确保使用自定义错误类

### 测试
- [ ] 测试各种错误场景的退出码
- [ ] 测试错误消息格式
- [ ] 集成测试：所有命令的错误处理

**备注**：错误类已定义，但需要在 CLI 命令中统一使用。

---

## 5. HTTP API 模式（P1）

**需求**：提供本地 HTTP Server，让 Agent 可以通过 HTTP API 访问邮件功能。

### 调研
- [x] 调研 Hono 框架特性和最佳实践
- [x] 调研 RESTful API 设计最佳实践
- [x] 调研本地访问限制方案（localhost only）
- [x] 调研 API 文档生成工具（OpenAPI）

### 设计
- [x] 设计 RESTful API 结构（路由、资源）
- [x] 设计本地访问限制机制（仅允许 127.0.0.1）
- [x] 设计 API 错误响应格式
- [x] 设计 API 文档规范（OpenAPI）

### 开发
- [x] 实现 HTTP Server 基础框架（基于 Hono，`src/api/server.ts`）
- [x] 实现邮件相关 API（`src/api/controllers/email.ts`, `src/api/routes/emails.ts`）
  - [x] GET /api/emails
  - [x] POST /api/emails（发送邮件）
  - [x] GET /api/emails/:id
  - [x] POST /api/emails/:id/mark-read
  - [x] POST /api/emails/:id/star
- [x] 实现账户管理 API（`src/api/controllers/account.ts`, `src/api/routes/accounts.ts`）
  - [x] GET /api/accounts
  - [x] GET /api/accounts/:id
  - [x] POST /api/accounts
- [x] 实现同步 API（`src/api/controllers/sync.ts`, `src/api/routes/sync.ts`）
  - [x] POST /api/sync
  - [x] GET /api/sync/status
- [x] 实现本地访问限制中间件（`src/api/middlewares/localhost.ts` - 仅允许 localhost）
- [x] 实现错误处理中间件（`src/api/middlewares/error.ts`）
- [x] 实现 Zod 请求验证（`src/api/schemas/`）
- [x] 生成 API 文档（Swagger UI + OpenAPI）
  - [x] OpenAPI JSON 文档：/api/openapi.json
  - [x] Swagger UI：/api/docs
- [x] 健康检查端点：/health

### 测试
- [ ] 单元测试：各 API 端点
- [ ] 集成测试：完整 API 流程
- [ ] 测试本地访问限制
- [ ] 性能测试：并发请求

**备注**：HTTP API 实现已完成，但测试覆盖不足。

---

## 6. Plugin 系统（P1）

**需求**：支持第三方插件扩展功能，提供灵活的扩展机制。

### 调研
- [x] 调研插件架构模式（Hook 系统, Event-driven）
- [x] 调研其他工具的插件系统（Webpack, Babel, ESLint）
- [x] **核心问题：确定应该暴露哪些内容给 Plugin**
  - 数据库访问？邮件模型？配置？
  - 内部 API？工具函数？
  - 事件系统？生命周期钩子？
- [x] **核心问题：确定 Plugin 可以做什么**
  - 修改邮件内容？添加自定义字段？
  - 扩展 CLI 命令？添加 API 端点？
  - 自定义邮件处理逻辑？触发外部服务？
- [x] 调研插件安全隔离方案（沙箱、权限控制）
- [x] 调研插件发现和加载机制

### 设计
- [ ] 设计 Plugin 接口规范（基于调研结果）
- [ ] 设计暴露给 Plugin 的 API 层级和权限
- [ ] 设计 Plugin 生命周期（init, load, unload）
- [ ] 设计 Plugin 配置格式
- [ ] 设计 Plugin 加载顺序和依赖管理
- [ ] 设计 Plugin Hook 点（哪些地方允许 Plugin 介入）
- [ ] 设计 Plugin 能力边界（明确 Plugin 可以做什么、不能做什么）

### 开发
- [ ] 实现 Plugin 加载器
- [ ] 实现 Plugin 生命周期管理
- [ ] 实现 Plugin 配置管理
- [ ] 实现 Plugin Hook 系统
- [ ] 开发官方 Plugin 示例

### 测试
- [ ] 单元测试：Plugin 加载和卸载
- [ ] 集成测试：Plugin 功能扩展
- [ ] 测试 Plugin 错误隔离
- [ ] 测试 Plugin 依赖管理

**备注**：调研已完成，设计和开发尚未开始。

---

## 7. 第三方邮箱服务集成（P1）

**需求**：支持集成第三方邮箱服务，为 Agent 创建专属邮箱。

### 调研
- [ ] 调研第三方邮箱服务 API（独立项目提供）
- [ ] 调研集成方案（API 调用, SDK）

### 设计
- [ ] 设计邮箱服务集成接口
- [ ] 设计配置格式
- [ ] 设计账户管理流程

### 开发
- [ ] 实现邮箱服务集成接口
- [ ] 实现配置管理
- [ ] 实现 Agent 专属邮箱账户管理

### 测试
- [ ] 集成测试：第三方服务连接
- [ ] 测试账户创建和管理

---

## 8. 数据提取与批量操作（P1）

**需求**：从邮件中提取结构化数据，支持批量操作。

### 调研
- [x] 调研邮件数据提取方案（正则表达式, 模板匹配）
- [ ] 调研批量操作事务机制

### 设计
- [ ] 设计数据提取规则格式
- [ ] 设计批量操作 API
- [ ] 设计事务支持机制

### 开发
- [ ] 实现数据提取 API
- [x] 增强邮件解析（支持更多格式 - `src/utils/email-parser.ts`）
- [ ] 实现批量操作 API（批量发送、标记、移动）
- [ ] 实现批量操作事务支持

### 测试
- [ ] 测试数据提取准确性
- [ ] 测试批量操作性能
- [ ] 测试事务回滚

---

## 9. 可靠性增强（P1）

**需求**：提供幂等性保证和错误重试机制，提高系统可靠性。

### 设计
- [ ] 设计幂等性实现方案（操作 ID, 状态检查）
- [ ] 设计重试策略（指数退避, 最大重试次数）
- [ ] 设计操作日志格式
- [ ] 设计冲突解决策略

### 开发
- [ ] 实现幂等性保证
- [ ] 实现错误重试机制
- [x] 实现操作日志记录（`src/utils/logger.ts` - 已支持）
- [ ] 实现冲突解决机制

### 测试
- [ ] 测试幂等性（重复操作）
- [ ] 测试重试机制
- [ ] 测试冲突场景

---

## 10. 文档和示例

### Agent 集成文档
- [ ] 编写 CLI 使用指南（面向 Agent）
- [ ] 编写 HTTP API 使用指南
- [ ] 编写输出格式说明
- [ ] 编写错误处理指南
- [ ] 编写最佳实践文档

### 示例代码
- [ ] Python Agent 集成示例
- [ ] JavaScript Agent 集成示例
- [ ] Claude Code 集成示例
- [ ] Cursor 集成示例

### 部署文档
- [x] Docker 部署指南（README.md 中有基础说明）
- [ ] 服务器部署指南
- [ ] CI/CD 集成指南
- [ ] 安全配置指南

---

## 11. 代码质量

### 重构
- [ ] 统一命令参数命名规范
- [ ] 统一错误处理模式（使用自定义错误类）
- [x] 提取公共逻辑到工具函数（field-selection, pagination, formatter）
- [ ] 优化数据库查询性能（添加索引、优化慢查询）

### 测试
- [ ] 单元测试覆盖率 > 80%（当前约 40%）
- [ ] 集成测试（CLI 命令）
- [ ] API 测试（HTTP Server）
- [ ] 性能测试

### 代码质量工具（已完成配置）
- [x] ESLint 配置（`.eslintrc.json`）
- [x] Prettier 配置（`.prettierrc`）
- [x] TypeScript 严格模式（`tsconfig.json`，target: ES2022, strict: true）
- [x] Husky Git hooks（`.husky/`）
- [ ] CI/CD 流程

---

## 当前测试覆盖情况

### 已存在的测试文件（15 个）
- [x] `tests/cli/field-selection.test.ts` - 字段选择功能（257 行）
- [x] `tests/cli/pagination.test.ts` - 分页功能（161 行）
- [x] `tests/cli/formatter.test.ts` - 格式化器
- [x] `tests/cli/index.test.ts` - CLI 入口
- [x] `tests/config/index.test.ts` - 配置管理
- [x] `tests/config/schema.test.ts` - 配置验证
- [x] `tests/filters/matcher.test.ts` - 过滤器匹配
- [x] `tests/imap/client.test.ts` - IMAP 客户端
- [x] `tests/smtp/composer.test.ts` - SMTP 邮件组合
- [x] `tests/storage/database.test.ts` - 数据库
- [x] `tests/threads/analyzer.test.ts` - 线程分析
- [x] `tests/utils/email-parser.test.ts` - 邮件解析
- [x] `tests/utils/errors.test.ts` - 错误类
- [x] `tests/utils/helpers.test.ts` - 工具函数
- [x] `tests/utils/logger.test.ts` - 日志

---

## 优先级排序

### 立即开始（本周）
1. ✅ 输出格式优化 - 调研、设计和开发（已完成）
2. ✅ 内容长度管理 - 设计和开发（已完成）
3. ✅ HTTP API 模式 - 设计和开发（已完成）
4. ✅ 错误处理 - 错误类定义（已完成）

### 近期完成（本月）
1. 错误处理标准化 - 统一 CLI 命令错误处理
2. 字段选择功能 - 集成到所有 CLI 命令
3. HTTP API 模式 - 补全测试
4. ✅ Plugin 系统 - 调研（已完成）

### 中期完成（下月）
1. 事件系统与 Webhook - 重新设计和开发
2. Plugin 系统 - 设计和开发
3. 测试覆盖率提升至 80%

### 长期规划（季度）
1. 第三方邮箱服务集成
2. 数据提取与批量操作
3. 可靠性增强（幂等性、重试机制）
4. 完整的文档和示例

---

## 已实现的核心功能总结

| 模块 | 状态 | 路径 |
|------|------|------|
| CLI 格式化器 | ✅ 完成 | `src/cli/formatters/` |
| 字段选择 | ✅ 完成 | `src/cli/utils/field-selection.ts` |
| 分页管理 | ✅ 完成 | `src/cli/utils/pagination.ts` |
| HTTP API Server | ✅ 完成 | `src/api/` |
| 错误类定义 | ✅ 完成 | `src/utils/errors.ts` |
| 桌面通知 | ✅ 完成 | `src/notifications/manager.ts` |
| 代码质量工具 | ✅ 完成 | `package.json` 脚本 |
| 测试框架 | ✅ 完成 | Vitest |

### 待完成的核心功能

| 模块 | 优先级 | 备注 |
|------|--------|------|
| 统一退出码 | P0 | 所有 CLI 命令使用标准化退出码 |
| 字段选择集成 | P0 | 将 --fields 参数应用到所有命令 |
| HTTP API 测试 | P1 | 补全 API 测试覆盖 |
| 事件系统核心 | P1 | 重新设计，替代当前通知系统 |
| Webhook 支持 | P1 | 新邮件触发 HTTP POST |
| Plugin 系统 | P2 | 完整设计和实现 |

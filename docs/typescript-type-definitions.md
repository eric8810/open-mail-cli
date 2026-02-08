# TypeScript 类型定义参考

## 文档信息

- **版本**: v1.0
- **创建日期**: 2026-02-08
- **项目**: mail-cli
- **说明**: 本文档定义了 TypeScript 转换过程中所有需要创建的类型，基于现有代码库中的实际数据结构

---

## 1. 类型定义文件组织

```
src/types/
├── index.ts          # 导出所有类型，主入口
├── database.ts       # 数据库相关类型
├── imap.ts           # IMAP 协议类型
├── smtp.ts           # SMTP 协议类型
├── config.ts         # 配置相关类型
└── common.ts         # 通用工具类型
```

---

## 2. 通用类型 (`types/common.ts`)

### 2.1 分页查询选项

```typescript
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}
```

---

## 3. 数据库类型 (`types/database.ts`)

> 注意：优先使用 `@types/better-sqlite3` 提供的类型。
> 以下仅定义库类型未覆盖的补充类型。

### 3.1 迁移接口

```typescript
export interface Migration {
  up(db: BetterSqlite3.Database): void;
  down(db: BetterSqlite3.Database): void;
}
```

---

## 4. 实体类型 (`types/index.ts`)

### 4.1 Email

```typescript
export interface Email {
  id: number;
  uid: number;
  messageId: string;
  folder: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  hasAttachments: boolean;
  isRead: boolean;
  isDraft: boolean;
  isDeleted: boolean;
  isSpam: boolean;
  isStarred: boolean;
  isImportant: boolean;
  priority: number;
  deletedAt: string | null;
  inReplyTo: string | null;
  references: string | null;
  threadId: number | null;
  accountId: number | null;
  flags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 EmailCreateInput

```typescript
export interface EmailCreateInput {
  uid: number;
  messageId: string;
  folder: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  bodyText?: string;
  bodyHtml?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  flags?: string[];
}
```

### 4.3 EmailSearchQuery

```typescript
export interface EmailSearchQuery extends PaginationOptions {
  keyword?: string;
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  folder?: string;
  dateFrom?: string;
  dateTo?: string;
  starred?: boolean;
  flagged?: boolean;
  unread?: boolean;
  hasAttachment?: boolean;
  noAttachment?: boolean;
  sizeMin?: number;
  sizeMax?: number;
  tag?: string;
  accountId?: number;
}
```

### 4.4 DraftSaveInput

```typescript
export interface DraftSaveInput {
  id?: number;
  uid?: number;
  messageId?: string;
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
}
```

### 4.5 Account

```typescript
export interface Account {
  id: number;
  email: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  isDefault: boolean;
  isEnabled: boolean;
  syncInterval: number;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
  password?: string;
}
```

### 4.6 AccountCreateInput

```typescript
export interface AccountCreateInput {
  email: string;
  displayName?: string;
  imapHost: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username?: string;
  password: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  syncInterval?: number;
}
```

### 4.7 Contact

```typescript
export interface Contact {
  id: number;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  photoPath: string | null;
  isFavorite: boolean;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.8 ContactCreateInput

```typescript
export interface ContactCreateInput {
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  photoPath?: string;
  isFavorite?: boolean;
  accountId?: number;
}
```

### 4.9 Folder

```typescript
export interface Folder {
  id: number;
  name: string;
  delimiter: string;
  flags: string[];
  lastSync: string | null;
  accountId: number | null;
  parentId: number | null;
  isFavorite: boolean;
  sortOrder: number;
  unreadCount: number;
  totalCount: number;
  createdAt: string;
}
```

### 4.10 FolderUpsertInput

```typescript
export interface FolderUpsertInput {
  name: string;
  delimiter?: string;
  flags?: string[];
  lastSync?: string;
  accountId?: number;
  parentId?: number;
  isFavorite?: boolean;
  sortOrder?: number;
}
```

### 4.11 Attachment

```typescript
export interface Attachment {
  id: number;
  emailId: number;
  filename: string;
  contentType: string;
  size: number;
  filePath: string;
  createdAt: string;
}
```

### 4.12 AttachmentCreateInput

```typescript
export interface AttachmentCreateInput {
  emailId: number;
  filename: string;
  contentType: string;
  size: number;
  filePath: string;
}
```

### 4.13 Tag

```typescript
export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.14 TagCreateInput

```typescript
export interface TagCreateInput {
  name: string;
  color?: string;
  description?: string;
  accountId?: number;
}
```

### 4.15 Signature

```typescript
export interface Signature {
  id: number;
  name: string;
  contentText: string;
  contentHtml: string;
  isDefault: boolean;
  accountEmail: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.16 SignatureCreateInput

```typescript
export interface SignatureCreateInput {
  name: string;
  contentText?: string;
  contentHtml?: string;
  isDefault?: boolean;
  accountEmail?: string;
}
```

### 4.17 Template

```typescript
export interface Template {
  id: number;
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  variables: string[];
  category: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.18 TemplateCreateInput

```typescript
export interface TemplateCreateInput {
  name: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  variables?: string[];
  category?: string;
  accountId?: number;
}
```

---

## 5. 过滤器类型

### 5.1 Filter

```typescript
export interface Filter {
  id: number;
  name: string;
  description: string | null;
  isEnabled: boolean;
  priority: number;
  matchAll: boolean;
  accountId: number | null;
  conditions: FilterCondition[];
  actions: FilterAction[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 FilterCondition

```typescript
export type FilterField =
  | 'from'
  | 'to'
  | 'subject'
  | 'body'
  | 'has_attachment'
  | 'size';

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than';

export interface FilterCondition {
  id: number;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export interface FilterConditionInput {
  field: FilterField;
  operator: FilterOperator;
  value: string;
}
```

### 5.3 FilterAction

```typescript
export type FilterActionType =
  | 'move_to_folder'
  | 'add_tag'
  | 'mark_read'
  | 'mark_starred'
  | 'delete'
  | 'forward';

export interface FilterAction {
  id: number;
  type: FilterActionType;
  value: string | null;
}

export interface FilterActionInput {
  type: FilterActionType;
  value?: string;
}
```

### 5.4 FilterCreateInput

```typescript
export interface FilterCreateInput {
  name: string;
  description?: string;
  isEnabled?: boolean;
  priority?: number;
  matchAll?: boolean;
  accountId?: number;
}
```

### 5.5 FilterApplyResult

```typescript
export interface FilterApplyResult {
  matched: boolean;
  filterId: number;
  filterName: string;
  actionsExecuted: FilterActionType[];
}
```

---

## 6. 线程类型

### 6.1 Thread

```typescript
export interface Thread {
  id: number;
  threadId: string;
  subject: string;
  firstMessageDate: string;
  lastMessageDate: string;
  messageCount: number;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 ThreadNode

```typescript
export interface ThreadNode {
  email: Email;
  children: ThreadNode[];
  depth: number;
}
```

### 6.3 ThreadRelationship

```typescript
export type ThreadDetectionMethod =
  | 'in-reply-to'
  | 'references'
  | 'subject-similarity';

export interface ThreadRelationship {
  emailId: number;
  parentId: number | null;
  confidence: number;
  method: ThreadDetectionMethod;
}
```

### 6.4 ThreadUpsertInput

```typescript
export interface ThreadUpsertInput {
  threadId: string;
  subject: string;
  firstMessageDate: string;
  lastMessageDate: string;
  messageCount: number;
  accountId?: number;
}
```

---

## 7. 垃圾邮件类型

### 7.1 SpamRule

```typescript
export interface SpamRule {
  id: number;
  name: string;
  type: string;
  pattern: string;
  score: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 SpamCheckResult

```typescript
export interface SpamCheckResult {
  isSpam: boolean;
  score: number;
  matchedRules: string[];
}
```

---

## 8. 协议类型 (`types/imap.ts`)

### 8.1 ImapConfig

```typescript
export interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
  tlsOptions?: {
    rejectUnauthorized: boolean;
  };
}
```

### 8.2 ImapMessage

```typescript
export interface ImapMessage {
  uid: number;
  attributes: ImapMessageAttributes;
  body?: string;
  headers?: string;
}

export interface ImapMessageAttributes {
  uid: number;
  flags: string[];
  date: Date;
  size: number;
}
```

### 8.3 ImapFetchOptions

```typescript
export interface ImapFetchOptions {
  bodies?: string | string[];
  struct?: boolean;
  markSeen?: boolean;
}
```

---

## 9. 协议类型 (`types/smtp.ts`)

### 9.1 SmtpConfig

```typescript
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}
```

### 9.2 EmailSendData

```typescript
export interface EmailSendData {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
}
```

### 9.3 EmailAttachment

```typescript
export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
}
```

---

## 10. 配置类型 (`types/config.ts`)

### 10.1 AppConfig

```typescript
export interface AppConfig {
  imap: ImapConfig;
  smtp: SmtpConfig;
  general: GeneralConfig;
  accounts?: AccountConfig[];
}
```

### 10.2 GeneralConfig

```typescript
export interface GeneralConfig {
  dataDir: string;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  defaultFolder: string;
  pageSize: number;
  dateFormat: string;
  syncInterval: number;
}
```

---

## 11. 导入导出类型

### 11.1 ImportResult

```typescript
export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}
```

### 11.2 ExportOptions

```typescript
export interface ExportOptions {
  format: 'eml' | 'mbox';
  folder?: string;
  outputPath: string;
  dateFrom?: string;
  dateTo?: string;
}
```

---

## 12. 通知类型

### 12.1 NotificationOptions

```typescript
export interface NotificationOptions {
  title: string;
  message: string;
  icon?: string;
  sound?: boolean;
}
```

---

## 13. 错误类型

```typescript
export class MailClientError extends Error {
  code: string;
  constructor(message: string, code?: string);
}

export class ConfigError extends MailClientError {}
export class ConnectionError extends MailClientError {}
export class AuthenticationError extends MailClientError {}
export class SyncError extends MailClientError {}
export class StorageError extends MailClientError {}
```

---

## 14. SavedSearch

```typescript
export interface SavedSearch {
  id: number;
  name: string;
  query: string;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 15. ContactGroup

```typescript
export interface ContactGroup {
  id: number;
  name: string;
  description: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 16. 第三方库类型声明

以下库需要创建 `.d.ts` 声明文件：

| 库名 | 是否有 `@types` | 处理方式 |
|------|----------------|----------|
| `better-sqlite3` | 有 (`@types/better-sqlite3`) | 直接安装使用 |
| `chalk` (v4) | 内置类型 | 直接使用 |
| `commander` | 内置类型 | 直接使用 |
| `inquirer` (v8) | 有 (`@types/inquirer`) | 安装使用 |
| `node-imap` | 无 | 需创建 `src/types/node-imap.d.ts` |
| `nodemailer` | 有 (`@types/nodemailer`) | 安装使用 |
| `mailparser` | 有 (`@types/mailparser`) | 安装使用 |
| `node-notifier` | 有 (`@types/node-notifier`) | 安装使用 |
| `cli-table3` | 有 (`@types/cli-table3`) | 安装使用 |
| `ora` (v5) | 内置类型 | 直接使用 |
| `dotenv` | 有 (`@types/dotenv`) | 安装使用 |

---

**文档结束**

# P1功能数据库Schema扩展说明

## 文档信息
- **版本**: v1.0
- **创建日期**: 2026-02-08
- **设计者**: Database Architect
- **状态**: 已完成

## 概述

本文档详细说明了P1优先级功能的数据库schema扩展设计。该扩展在P0功能的基础上，增加了标签系统、过滤规则、联系人管理、多账户支持、邮件线程等核心功能。

## 迁移文件

**文件路径**: `D:\code\mail\src\storage\migrations\003_p1_features.js`

---

## 1. 新增表结构

### 1.1 标签系统 (Tags System)

#### tags 表
存储用户自定义的邮件标签。

```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,           -- 标签名称（唯一）
  color TEXT DEFAULT '#808080',        -- 标签颜色（十六进制）
  description TEXT,                    -- 标签描述
  account_id INTEGER,                  -- 所属账户ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

**设计说明**:
- `name` 字段设置为 UNIQUE，确保标签名称不重复
- `color` 支持自定义颜色，默认为灰色
- 支持多账户，每个账户可以有独立的标签集

#### email_tags 表
邮件与标签的多对多关联表。

```sql
CREATE TABLE IF NOT EXISTS email_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL,           -- 邮件ID
  tag_id INTEGER NOT NULL,             -- 标签ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(email_id, tag_id)             -- 防止重复关联
);
```

**设计说明**:
- 使用多对多关系，一封邮件可以有多个标签
- UNIQUE 约束防止同一邮件重复添加相同标签
- CASCADE 删除确保数据一致性

---

### 1.2 过滤规则引擎 (Filter Rules Engine)

#### filters 表
存储邮件过滤规则的基本信息。

```sql
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                  -- 规则名称
  description TEXT,                    -- 规则描述
  is_enabled BOOLEAN DEFAULT 1,        -- 是否启用
  priority INTEGER DEFAULT 0,          -- 优先级（数字越大优先级越高）
  match_all BOOLEAN DEFAULT 1,         -- 匹配模式：1=全部匹配，0=任一匹配
  account_id INTEGER,                  -- 所属账户ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

**设计说明**:
- `priority` 字段用于控制规则执行顺序
- `match_all` 控制条件匹配逻辑（AND/OR）
- 支持启用/禁用规则而不删除

#### filter_conditions 表
存储过滤规则的条件（field, operator, value）。

#### filter_actions 表
存储过滤规则的动作（action_type, action_value）。

---

### 1.3 联系人管理、1.4 多账户支持、1.5 邮件线程

详细的表结构已在迁移文件中定义。

---

## 2. 扩展现有表

### 2.1 扩展 emails 表
新增: account_id, is_starred, is_important, priority

### 2.2 扩展 folders 表
新增: account_id, parent_id, is_favorite, sort_order, unread_count, total_count

---

## 3. 索引优化

为所有常用查询字段创建了索引，提高查询性能。

---

## 4. 默认数据

迁移脚本会自动插入5个默认标签：Important、Work、Personal、Follow Up、To Read。

---

## 5. 后续开发任务

需要创建以下Model文件：
1. src/storage/models/tag.js
2. src/storage/models/filter.js
3. src/storage/models/contact.js
4. src/storage/models/account.js
5. src/storage/models/thread.js

---

## 6. 设计亮点

1. 多账户架构 - 所有核心表都支持account_id
2. 灵活的过滤引擎 - 条件和动作分离
3. 完整的联系人系统 - 支持分组和收藏
4. 性能优化 - 为所有常用查询创建索引
5. 数据一致性 - 使用外键约束和CASCADE删除

---

**文档完成日期**: 2026-02-08
**设计者**: Database Architect (db-architect)

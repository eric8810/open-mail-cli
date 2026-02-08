# Database Schema Extension Summary

## Overview
This document summarizes the database schema extensions implemented for P0 features.

## Migration File
**File**: `src/storage/migrations/002_p0_features.js`

## Schema Changes

### 1. Extended `emails` Table
Added the following columns to support P0 features:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_draft` | BOOLEAN | 0 | Marks email as draft |
| `is_deleted` | BOOLEAN | 0 | Soft delete flag |
| `is_spam` | BOOLEAN | 0 | Spam flag |
| `in_reply_to` | TEXT | NULL | Message-ID of email being replied to |
| `references` | TEXT | NULL | Email reference chain for threading |
| `thread_id` | TEXT | NULL | Thread identifier |
| `deleted_at` | DATETIME | NULL | Timestamp of deletion |

### 2. New `signatures` Table
Stores email signatures for users.

```sql
CREATE TABLE signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content_text TEXT,
  content_html TEXT,
  is_default BOOLEAN DEFAULT 0,
  account_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. New `spam_rules` Table
Stores spam filtering rules.

```sql
CREATE TABLE spam_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. New `blacklist` Table
Stores blacklisted email addresses and domains.

```sql
CREATE TABLE blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  domain TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5. New `whitelist` Table
Stores whitelisted email addresses and domains.

```sql
CREATE TABLE whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes Created

### Email Table Indexes
- `idx_emails_is_draft` - For draft queries
- `idx_emails_is_deleted` - For trash queries
- `idx_emails_is_spam` - For spam queries
- `idx_emails_thread_id` - For thread queries
- `idx_emails_in_reply_to` - For reply chain queries

### Signature Table Indexes
- `idx_signatures_account` - For account-specific signatures
- `idx_signatures_is_default` - For default signature lookup

### Spam Table Indexes
- `idx_spam_rules_type` - For rule type queries
- `idx_spam_rules_enabled` - For enabled rules queries
- `idx_blacklist_email` - For blacklist email lookup
- `idx_blacklist_domain` - For blacklist domain lookup
- `idx_whitelist_email` - For whitelist email lookup
- `idx_whitelist_domain` - For whitelist domain lookup

## Default Data

The migration includes default spam rules:
1. Keyword-based rules for common spam terms (viagra, lottery, etc.)
2. Urgency-based rules (click here, act now, etc.)
3. Header-based rules (X-Spam-Flag detection)

## Model Files Created

### 1. `src/storage/models/signature.js`
Provides methods for signature management:
- `create(signatureData)` - Create new signature
- `findById(id)` - Find signature by ID
- `findAll(accountEmail)` - List all signatures
- `findDefault(accountEmail)` - Get default signature
- `update(id, data)` - Update signature
- `setAsDefault(id)` - Set signature as default
- `delete(id)` - Delete signature

### 2. `src/storage/models/spam.js`
Provides methods for spam management:
- **Rules**: `createRule()`, `findAllRules()`, `updateRule()`, `deleteRule()`
- **Blacklist**: `addToBlacklist()`, `removeFromBlacklist()`, `isBlacklisted()`, `getBlacklist()`
- **Whitelist**: `addToWhitelist()`, `removeFromWhitelist()`, `isWhitelisted()`, `getWhitelist()`

## Model Files Extended

### `src/storage/models/email.js`
Added methods for P0 features:

**Draft Management:**
- `findDrafts(options)` - Find all drafts
- `markAsDraft(id)` - Mark email as draft
- `unmarkAsDraft(id)` - Unmark draft (when sending)
- `countDrafts()` - Count draft emails

**Delete/Trash Management:**
- `markAsDeleted(id)` - Soft delete email
- `restoreDeleted(id)` - Restore deleted email
- `findDeleted(options)` - Find deleted emails
- `countDeleted()` - Count deleted emails
- `permanentlyDelete(id)` - Permanently delete email
- `emptyTrash()` - Empty trash

**Spam Management:**
- `markAsSpam(id)` - Mark as spam
- `unmarkAsSpam(id)` - Unmark spam
- `findSpam(options)` - Find spam emails
- `countSpam()` - Count spam emails

**Threading Support:**
- `findByThreadId(threadId, options)` - Find emails in thread
- `updateThreadMetadata(id, metadata)` - Update reply/forward metadata

**Updated `_formatEmail()` method** to include new fields:
- `isDraft`, `isDeleted`, `isSpam`
- `inReplyTo`, `references`, `threadId`
- `deletedAt`

## Migration Usage

To apply this migration:
```javascript
const database = require('./src/storage/database');
const migration = require('./src/storage/migrations/002_p0_features');

const db = database.getDb();
migration.up(db);
```

To rollback:
```javascript
migration.down(db);
```

**Note**: SQLite doesn't support DROP COLUMN, so rollback will only drop new tables, not remove columns from the emails table.

## Next Steps

The database schema is now ready for P0 feature implementation:
1. Reply/Forward functionality can use threading fields
2. Draft management can use draft flags
3. Delete/Trash can use soft delete flags
4. Spam filtering can use spam tables and flags
5. Signature management can use signatures table

## Files Created/Modified

**Created:**
- `src/storage/migrations/002_p0_features.js`
- `src/storage/models/signature.js`
- `src/storage/models/spam.js`

**Modified:**
- `src/storage/models/email.js` (extended with new methods)

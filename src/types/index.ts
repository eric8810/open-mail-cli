import type { PaginationOptions } from './common';

export * from './common';
export * from './config';
export * from './database';
export * from './imap';
export * from './smtp';

/**
 * Email persistence model.
 */
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

/**
 * Email create payload.
 */
export interface EmailCreateInput {
  uid: number;
  messageId: string;
  folder: string;
  accountId?: number;
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

/**
 * Email search query options.
 */
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

/**
 * Draft save input payload.
 */
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

/**
 * Email account model.
 */
export interface Account {
  id: number;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account create payload.
 */
export interface AccountCreateInput {
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
  username: string;
  password: string;
  isDefault?: boolean;
}

/**
 * Contact model.
 */
export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contact create payload.
 */
export interface ContactCreateInput {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  accountId?: number;
}

/**
 * Folder model.
 */
export interface Folder {
  id: number;
  name: string;
  path: string;
  delimiter: string | null;
  attributes: string[];
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Folder upsert payload.
 */
export interface FolderUpsertInput {
  name: string;
  path: string;
  delimiter?: string | null;
  attributes?: string[];
  accountId?: number;
}

/**
 * Attachment model.
 */
export interface Attachment {
  id: number;
  emailId: number;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  contentDisposition: string | null;
  path: string | null;
  createdAt: string;
}

/**
 * Attachment create payload.
 */
export interface AttachmentCreateInput {
  emailId: number;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  contentDisposition?: string;
  path?: string;
}

/**
 * Tag model.
 */
export interface Tag {
  id: number;
  name: string;
  color: string;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tag create payload.
 */
export interface TagCreateInput {
  name: string;
  color?: string;
  accountId?: number;
}

/**
 * Signature model.
 */
export interface Signature {
  id: number;
  name: string;
  contentText: string;
  contentHtml: string;
  isDefault: boolean;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Signature create payload.
 */
export interface SignatureCreateInput {
  name: string;
  contentText?: string;
  contentHtml?: string;
  isDefault?: boolean;
  accountId?: number;
}

/**
 * Template model.
 */
export interface Template {
  id: number;
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Template create payload.
 */
export interface TemplateCreateInput {
  name: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  accountId?: number;
}

/**
 * Supported fields in a filter condition.
 */
export type FilterField =
  | 'from'
  | 'to'
  | 'cc'
  | 'subject'
  | 'body'
  | 'folder'
  | 'hasAttachments'
  | 'isRead'
  | 'isStarred';

/**
 * Comparison operators in filter conditions.
 */
export type FilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'regex';

/**
 * Single filter condition.
 */
export interface FilterCondition {
  field: FilterField;
  operator: FilterOperator;
  value: string | boolean;
  caseSensitive?: boolean;
}

/**
 * Input payload for creating condition nodes.
 */
export type FilterConditionInput = FilterCondition;

/**
 * Supported filter action types.
 */
export type FilterActionType =
  | 'moveToFolder'
  | 'addTag'
  | 'markAsRead'
  | 'markAsStarred'
  | 'delete'
  | 'forward';

/**
 * Filter action.
 */
export interface FilterAction {
  type: FilterActionType;
  value?: string;
}

/**
 * Input payload for action nodes.
 */
export type FilterActionInput = FilterAction;

/**
 * Filter rule model.
 */
export interface Filter {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  matchAll: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter create payload.
 */
export interface FilterCreateInput {
  name: string;
  enabled?: boolean;
  priority?: number;
  matchAll?: boolean;
  conditions: FilterConditionInput[];
  actions: FilterActionInput[];
  accountId?: number;
}

/**
 * Filter execution result.
 */
export interface FilterApplyResult {
  matched: boolean;
  actionsExecuted: number;
  actionTypes: FilterActionType[];
}

/**
 * Thread model.
 */
export interface Thread {
  id: number;
  subject: string;
  normalizedSubject: string;
  rootEmailId: number | null;
  emailCount: number;
  participants: string[];
  lastActivityAt: string;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thread tree node.
 */
export interface ThreadNode {
  emailId: number;
  children: ThreadNode[];
  depth: number;
}

/**
 * Thread relation detection method.
 */
export type ThreadDetectionMethod =
  | 'message-id'
  | 'references'
  | 'in-reply-to'
  | 'subject';

/**
 * Relationship record between emails.
 */
export interface ThreadRelationship {
  parentEmailId: number;
  childEmailId: number;
  method: ThreadDetectionMethod;
  confidence: number;
}

/**
 * Thread upsert payload.
 */
export interface ThreadUpsertInput {
  subject: string;
  normalizedSubject: string;
  rootEmailId?: number | null;
  participants?: string[];
  accountId?: number;
}

/**
 * Spam rule model.
 */
export interface SpamRule {
  id: number;
  name: string;
  type: string;
  pattern: string;
  score: number;
  enabled: boolean;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Spam check output.
 */
export interface SpamCheckResult {
  isSpam: boolean;
  score: number;
  threshold: number;
  reasons: string[];
}

/**
 * Import operation result.
 */
export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Export options.
 */
export interface ExportOptions {
  format: 'eml' | 'mbox' | 'json';
  outputPath: string;
  folder?: string;
  dateFrom?: string;
  dateTo?: string;
  includeAttachments?: boolean;
}

/**
 * Notification payload.
 */
export interface NotificationOptions {
  title: string;
  message: string;
  icon?: string;
  sound?: boolean;
}

/**
 * Saved search model.
 */
export interface SavedSearch {
  id: number;
  name: string;
  query: string;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contact group model.
 */
export interface ContactGroup {
  id: number;
  name: string;
  description: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shared error shape for typed catch handling.
 */
export interface MailClientErrorType extends Error {
  code: string;
}

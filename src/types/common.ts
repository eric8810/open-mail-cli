/**
 * Shared utility types across modules.
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Shared key-value metadata payload.
 */
export type Metadata = Record<string, unknown>;

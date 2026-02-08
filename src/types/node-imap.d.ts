declare module 'node-imap' {
  import { EventEmitter } from 'node:events';

  export interface ImapMessageAttributes {
    uid: number;
    flags?: string[];
    date?: Date;
    struct?: unknown[];
    size?: number;
    envelope?: unknown;
    [key: string]: unknown;
  }

  export interface ImapFetchOptions {
    bodies?: string | string[];
    struct?: boolean;
    markSeen?: boolean;
    envelope?: boolean;
    size?: boolean;
  }

  export interface ImapBox {
    name: string;
    flags: string[];
    readOnly: boolean;
    uidvalidity?: number;
    uidnext?: number;
    permFlags?: string[];
    newKeywords?: boolean;
    persistentUIDs?: boolean;
    messages?: {
      total: number;
      new: number;
      unseen: number;
    };
  }

  export interface ImapMailbox {
    delimiter: string;
    attribs: string[];
    children?: { [key: string]: ImapMailbox };
  }

  export interface ImapConnectionConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    connTimeout?: number;
    authTimeout?: number;
    tlsOptions?: {
      rejectUnauthorized?: boolean;
    };
  }

  export interface ImapMessage extends EventEmitter {
    on(
      event: 'body',
      listener: (
        stream: NodeJS.ReadableStream,
        info: { which: string; size: number }
      ) => void
    ): this;
    on(
      event: 'attributes',
      listener: (attributes: ImapMessageAttributes) => void
    ): this;
    on(event: 'end', listener: () => void): this;
  }

  export interface ImapFetch extends EventEmitter {
    on(
      event: 'message',
      listener: (message: ImapMessage, seqno: number) => void
    ): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }

  export type MessageAttributes = ImapMessageAttributes;
  export type Box = ImapBox;
  export type Mailbox = ImapMailbox;
  export type FetchOptions = ImapFetchOptions;
  export type MessageBodyInfo = { which: string; size: number };

  class Imap extends EventEmitter {
    constructor(config: ImapConnectionConfig);

    connect(): void;
    end(): void;

    getBoxes(
      callback: (
        error: Error | null,
        boxes: { [key: string]: ImapMailbox }
      ) => void
    ): void;
    openBox(
      name: string,
      readOnly: boolean,
      callback: (error: Error | null, box: ImapBox) => void
    ): void;
    closeBox(
      autoExpunge: boolean,
      callback: (error: Error | null) => void
    ): void;

    search(
      criteria: unknown[],
      callback: (error: Error | null, uids: number[]) => void
    ): void;
    fetch(source: number[] | string, options?: ImapFetchOptions): ImapFetch;

    addFlags(
      uids: number | number[],
      flags: string[],
      callback?: (error: Error | null) => void
    ): void;
    delFlags(
      uids: number | number[],
      flags: string[],
      callback?: (error: Error | null) => void
    ): void;
    move(
      uids: number | number[],
      folderName: string,
      callback?: (error: Error | null) => void
    ): void;
    copy(
      uids: number | number[],
      folderName: string,
      callback?: (error: Error | null) => void
    ): void;
    addBox(folderName: string, callback?: (error: Error | null) => void): void;
    delBox(folderName: string, callback?: (error: Error | null) => void): void;
    renameBox(
      oldName: string,
      newName: string,
      callback?: (error: Error | null) => void
    ): void;
    expunge(callback?: (error: Error | null) => void): void;
    append(
      message: string,
      options: { mailbox: string; flags?: string[] },
      callback?: (error: Error | null) => void
    ): void;

    on(event: 'ready', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'end', listener: () => void): this;

    static parseHeader(rawHeader: string): Record<string, string[]>;
  }

  export = Imap;
}

import { formatDate, truncate } from '../../utils/helpers';
import type { Formatter, FormatMeta, FormatOptions } from './types';
import type { EmailData } from './email-data';
import {
  parseFieldSelection,
  selectFields,
  getDefaultFieldSelection,
  type FieldSelection,
} from '../utils/field-selection';

export class HTMLFormatter implements Formatter<EmailData> {
  formatList(
    data: EmailData[],
    meta: FormatMeta,
    options: FormatOptions
  ): string {
    if (!data || data.length === 0) {
      return '<p>No results found.</p>';
    }

    const selection = options.fields
      ? parseFieldSelection(options.fields)
      : getDefaultFieldSelection('list');

    const filteredData = data.map((item) => selectFields(item, selection));
    const fields = this.resolveFields(selection, filteredData[0]);

    const lines: string[] = [];

    const showing = meta.showing ? ` - Showing ${meta.showing}` : '';
    const title = meta.folder || 'Results';
    const unreadTotal = `${meta.unread ?? 0} unread, ${meta.total ?? data.length} total`;

    lines.push(`<h2>${this.escapeHtml(title)} (${unreadTotal})${showing}</h2>`);
    lines.push('<table>');
    lines.push('<thead><tr>');
    for (const field of fields) {
      lines.push(
        `<th>${this.escapeHtml(this.getFieldDisplayName(field))}</th>`
      );
    }
    lines.push('</tr></thead>');
    lines.push('<tbody>');

    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const original = data[i];
      lines.push('<tr>');
      for (const field of fields) {
        const value = this.formatFieldValue(field, item[field], original);
        lines.push(`<td>${value}</td>`);
      }
      lines.push('</tr>');
    }

    lines.push('</tbody>');
    lines.push('</table>');

    if (meta.totalPages) {
      lines.push(
        `<p>Page ${meta.page || 1} of ${meta.totalPages} (${meta.total} total emails)</p>`
      );
    }

    return lines.join('\n');
  }

  formatDetail(data: EmailData, options: FormatOptions): string {
    const selection = options.fields
      ? parseFieldSelection(options.fields)
      : getDefaultFieldSelection('detail');

    const filtered = selectFields(data, selection);

    const lines: string[] = [];
    lines.push('<div class="email-detail">');
    lines.push('<h2>Email Details</h2>');

    const fieldOrder = [
      'id',
      'from',
      'to',
      'cc',
      'bcc',
      'subject',
      'date',
      'isRead',
      'isStarred',
      'isFlagged',
      'attachments',
    ];

    lines.push('<dl>');
    for (const field of fieldOrder) {
      if (!(field in filtered)) continue;
      const value = filtered[field];
      if (value === undefined || value === null) continue;

      const label = this.getFieldDisplayName(field);
      let display: string;

      switch (field) {
        case 'isRead':
          display = value ? 'Read' : 'Unread';
          break;
        case 'isStarred':
        case 'isFlagged':
          if (!value) continue;
          display = 'Yes';
          break;
        case 'date':
          display = this.escapeHtml(
            typeof value === 'string' && (value as string).includes('T')
              ? String(value)
              : new Date(value as string | number | Date).toISOString()
          );
          break;
        case 'attachments':
          if (!Array.isArray(value) || value.length === 0) continue;
          display = `${value.length} attachment(s)`;
          break;
        default:
          display = this.escapeHtml(String(value));
      }

      lines.push(`<dt>${this.escapeHtml(label)}</dt>`);
      lines.push(`<dd>${display}</dd>`);
    }
    lines.push('</dl>');

    if ('bodyHtml' in filtered && filtered.bodyHtml) {
      lines.push('<div class="email-body">');
      lines.push(String(filtered.bodyHtml));
      lines.push('</div>');
    } else if ('bodyText' in filtered && filtered.bodyText) {
      lines.push('<div class="email-body">');
      lines.push(`<pre>${this.escapeHtml(String(filtered.bodyText))}</pre>`);
      lines.push('</div>');
    }

    lines.push('</div>');
    return lines.join('\n');
  }

  private resolveFields(
    selection: FieldSelection,
    sampleData: Partial<EmailData>
  ): string[] {
    return selection.include === '*'
      ? Object.keys(sampleData).filter((f) => !selection.exclude.includes(f))
      : selection.include;
  }

  private getFieldDisplayName(field: string): string {
    const displayNames: Record<string, string> = {
      id: 'ID',
      from: 'From',
      to: 'To',
      cc: 'CC',
      bcc: 'BCC',
      subject: 'Subject',
      date: 'Date',
      isRead: 'Status',
      isStarred: 'Starred',
      isFlagged: 'Flagged',
      hasAttachments: 'Attachments',
      folder: 'Folder',
      bodyText: 'Body',
      bodyHtml: 'HTML',
      threadId: 'Thread',
      accountId: 'Account',
    };
    return (
      displayNames[field] || field.charAt(0).toUpperCase() + field.slice(1)
    );
  }

  private formatFieldValue(
    field: string,
    value: unknown,
    _originalItem: EmailData
  ): string {
    if (value === undefined || value === null) return '';

    switch (field) {
      case 'isRead':
        return value ? 'Read' : 'Unread';
      case 'isStarred':
      case 'isFlagged':
      case 'hasAttachments':
        return value ? 'Yes' : 'No';
      case 'date':
        return this.escapeHtml(formatDate(value as string | Date));
      case 'bodyText':
      case 'bodyHtml':
        return this.escapeHtml(truncate(String(value), 50));
      default:
        if (typeof value === 'object') {
          return this.escapeHtml(JSON.stringify(value));
        }
        return this.escapeHtml(truncate(String(value), 50));
    }
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

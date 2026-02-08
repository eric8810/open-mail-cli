import analyzer from './analyzer';
import logger from '../utils/logger';

/**
 * Thread Builder
 * Builds thread trees from email relationships
 */
class ThreadBuilder {
  /**
   * Build thread tree from emails
   * Returns array of thread roots with nested children
   */
  buildThreads(emails, relationships) {
    if (!emails || emails.length === 0) {
      return [];
    }

    // Create email lookup map
    const emailMap = new Map();
    emails.forEach((email) => {
      emailMap.set(email.id, {
        ...email,
        children: [],
        depth: 0,
      });
    });

    // Create relationship lookup map
    const relationshipMap = new Map();
    relationships.forEach((rel) => {
      relationshipMap.set(rel.emailId, rel);
    });

    // Build parent-child relationships
    const roots = [];
    emails.forEach((email) => {
      const emailNode = emailMap.get(email.id);
      const rel = relationshipMap.get(email.id);

      if (rel && rel.parentId) {
        const parent = emailMap.get(rel.parentId);
        if (parent) {
          parent.children.push(emailNode);
          emailNode.depth = parent.depth + 1;
          emailNode.parentId = rel.parentId;
          emailNode.confidence = rel.confidence;
          emailNode.method = rel.method;
        } else {
          // Parent not found, treat as root
          roots.push(emailNode);
        }
      } else {
        // No parent, this is a root
        roots.push(emailNode);
      }
    });

    // Sort children by date
    const sortChildren = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => new Date(a.date) - new Date(b.date));
        node.children.forEach((child) => sortChildren(child));
      }
    };

    roots.forEach((root) => sortChildren(root));

    // Sort roots by most recent activity
    roots.sort((a, b) => {
      const aLatest = this._getLatestDate(a);
      const bLatest = this._getLatestDate(b);
      return new Date(bLatest) - new Date(aLatest);
    });

    logger.debug('Built threads', {
      totalEmails: emails.length,
      threadCount: roots.length,
    });

    return roots;
  }

  /**
   * Get latest date in thread (including children)
   */
  _getLatestDate(node) {
    let latest = node.date;

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const childLatest = this._getLatestDate(child);
        if (new Date(childLatest) > new Date(latest)) {
          latest = childLatest;
        }
      });
    }

    return latest;
  }

  /**
   * Get thread statistics
   */
  getThreadStats(thread) {
    const stats = {
      messageCount: 0,
      participants: new Set(),
      firstDate: thread.date,
      lastDate: thread.date,
      hasUnread: false,
      depth: 0,
    };

    const traverse = (node, currentDepth = 0) => {
      stats.messageCount++;
      stats.depth = Math.max(stats.depth, currentDepth);

      if (node.from) {
        stats.participants.add(node.from);
      }

      if (new Date(node.date) < new Date(stats.firstDate)) {
        stats.firstDate = node.date;
      }

      if (new Date(node.date) > new Date(stats.lastDate)) {
        stats.lastDate = node.date;
      }

      if (!node.isRead) {
        stats.hasUnread = true;
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => traverse(child, currentDepth + 1));
      }
    };

    traverse(thread);

    return {
      ...stats,
      participants: Array.from(stats.participants),
    };
  }

  /**
   * Flatten thread tree to array
   */
  flattenThread(thread) {
    const result = [];

    const traverse = (node) => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => traverse(child));
      }
    };

    traverse(thread);
    return result;
  }

  /**
   * Generate thread ID from root email
   */
  generateThreadId(rootEmail) {
    // Use message ID if available, otherwise use email ID
    if (rootEmail.messageId) {
      return `thread-${rootEmail.messageId}`;
    }
    return `thread-${rootEmail.id}`;
  }

  /**
   * Find thread by email ID
   */
  findThreadByEmailId(threads, emailId) {
    for (const thread of threads) {
      const found = this._findInThread(thread, emailId);
      if (found) {
        return thread;
      }
    }
    return null;
  }

  /**
   * Find email in thread tree
   */
  _findInThread(node, emailId) {
    if (node.id === emailId) {
      return node;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const found = this._findInThread(child, emailId);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }
}

export default new ThreadBuilder();

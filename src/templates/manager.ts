import templateModel from '../storage/models/template';
import logger from '../utils/logger';

/**
 * Template Manager
 * Manages email templates with variable substitution support
 */
class TemplateManager {
  /**
   * Create a new template
   */
  async create(options) {
    const {
      name,
      subject,
      text,
      html,
      variables,
      accountId,
      isEnabled = true,
    } = options;

    if (!name) {
      throw new Error('Template name is required');
    }

    if (!subject) {
      throw new Error('Template subject is required');
    }

    if (!text && !html) {
      throw new Error('Template content (text or html) is required');
    }

    const templateData = {
      name,
      subject,
      bodyText: text,
      bodyHtml: html,
      variables: variables || this._extractVariables(subject, text, html),
      accountId,
      isEnabled,
    };

    const id = templateModel.create(templateData);
    logger.info('Template created', { id, name });
    return id;
  }

  /**
   * Get template by ID
   */
  async getById(id) {
    return templateModel.findById(id);
  }

  /**
   * Get template by name
   */
  async getByName(name, accountId = null) {
    return templateModel.findByName(name, accountId);
  }

  /**
   * Get all templates
   */
  async getAll(accountId = null) {
    return templateModel.findAll(accountId);
  }

  /**
   * Update template
   */
  async update(id, options) {
    const template = templateModel.findById(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    const updateData = {};

    if (options.name !== undefined) {
      updateData.name = options.name;
    }

    if (options.subject !== undefined) {
      updateData.subject = options.subject;
    }

    if (options.text !== undefined) {
      updateData.bodyText = options.text;
    }

    if (options.html !== undefined) {
      updateData.bodyHtml = options.html;
    }

    if (options.variables !== undefined) {
      updateData.variables = options.variables;
    }

    if (options.accountId !== undefined) {
      updateData.accountId = options.accountId;
    }

    if (options.isEnabled !== undefined) {
      updateData.isEnabled = options.isEnabled;
    }

    const updated = templateModel.update(id, updateData);
    if (updated) {
      logger.info('Template updated', { id });
    }
    return updated;
  }

  /**
   * Delete template
   */
  async delete(id) {
    const template = templateModel.findById(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    const deleted = templateModel.delete(id);
    if (deleted) {
      logger.info('Template deleted', { id, name: template.name });
    }
    return deleted;
  }

  /**
   * Render template with variables
   */
  async render(templateId, variables = {}) {
    const template = await this.getById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.renderTemplate(template, variables);
  }

  /**
   * Render template object with variables
   */
  renderTemplate(template, variables = {}) {
    const defaultVars = {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      datetime: new Date().toLocaleString(),
    };

    const allVars = { ...defaultVars, ...variables };

    let renderedSubject = template.subject;
    let renderedText = template.bodyText || '';
    let renderedHtml = template.bodyHtml || '';

    Object.keys(allVars).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = allVars[key] || '';
      renderedSubject = renderedSubject.replace(regex, value);
      renderedText = renderedText.replace(regex, value);
      renderedHtml = renderedHtml.replace(regex, value);
    });

    return {
      subject: renderedSubject,
      text: renderedText,
      html: renderedHtml,
    };
  }

  /**
   * Extract variables from template content
   */
  _extractVariables(subject, text, html) {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set();

    const extractFromString = (str) => {
      if (!str) return;
      let match;
      while ((match = variableRegex.exec(str)) !== null) {
        variables.add(match[1]);
      }
    };

    extractFromString(subject);
    extractFromString(text);
    extractFromString(html);

    return Array.from(variables);
  }

  /**
   * Get template for email composition
   */
  async getForEmail(templateId, variables = {}) {
    return this.render(templateId, variables);
  }
}

module.exports = new TemplateManager();

import signatureModel from '../storage/models/signature';
import logger from '../utils/logger';

/**
 * Signature Manager
 * Manages email signatures with template variable support
 */
class SignatureManager {
  /**
   * Create a new signature
   */
  async create(options) {
    const {
      name,
      text,
      html,
      isDefault = false,
      accountEmail = null,
    } = options;

    if (!name) {
      throw new Error('Signature name is required');
    }

    if (!text && !html) {
      throw new Error('Signature content (text or html) is required');
    }

    const signatureData = {
      name,
      contentText: text,
      contentHtml: html,
      isDefault,
      accountEmail,
    };

    const id = signatureModel.create(signatureData);
    logger.info('Signature created', { id, name });
    return id;
  }

  /**
   * Get signature by ID
   */
  async getById(id) {
    return signatureModel.findById(id);
  }

  /**
   * Get all signatures
   */
  async getAll(accountEmail = null) {
    return signatureModel.findAll(accountEmail);
  }

  /**
   * Get default signature for an account
   */
  async getDefault(accountEmail = null) {
    return signatureModel.findDefault(accountEmail);
  }

  /**
   * Update signature
   */
  async update(id, options) {
    const signature = signatureModel.findById(id);
    if (!signature) {
      throw new Error(`Signature not found: ${id}`);
    }

    const updateData = {};

    if (options.name !== undefined) {
      updateData.name = options.name;
    }

    if (options.text !== undefined) {
      updateData.contentText = options.text;
    }

    if (options.html !== undefined) {
      updateData.contentHtml = options.html;
    }

    if (options.isDefault !== undefined) {
      updateData.isDefault = options.isDefault;
    }

    if (options.accountEmail !== undefined) {
      updateData.accountEmail = options.accountEmail;
    }

    const updated = signatureModel.update(id, updateData);
    if (updated) {
      logger.info('Signature updated', { id });
    }
    return updated;
  }

  /**
   * Set signature as default
   */
  async setDefault(id) {
    const result = signatureModel.setAsDefault(id);
    logger.info('Signature set as default', { id });
    return result;
  }

  /**
   * Delete signature
   */
  async delete(id) {
    const signature = signatureModel.findById(id);
    if (!signature) {
      throw new Error(`Signature not found: ${id}`);
    }

    const deleted = signatureModel.delete(id);
    if (deleted) {
      logger.info('Signature deleted', { id, name: signature.name });
    }
    return deleted;
  }

  /**
   * Process signature template variables
   */
  processTemplate(signature, variables = {}) {
    const defaultVars = {
      name: variables.name || '',
      email: variables.email || '',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    };

    const allVars = { ...defaultVars, ...variables };

    let processedText = signature.contentText || '';
    let processedHtml = signature.contentHtml || '';

    // Replace template variables
    Object.keys(allVars).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedText = processedText.replace(regex, allVars[key]);
      processedHtml = processedHtml.replace(regex, allVars[key]);
    });

    return {
      text: processedText,
      html: processedHtml,
    };
  }

  /**
   * Get signature for email composition
   * Returns processed signature with template variables replaced
   */
  async getForEmail(accountEmail = null, variables = {}) {
    const signature = await this.getDefault(accountEmail);
    if (!signature) {
      return null;
    }

    return this.processTemplate(signature, variables);
  }
}

module.exports = new SignatureManager();

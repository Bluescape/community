const apiClient = require('./apiClient');
const config = require('./config');
const logger = require('./logger');

class MessageSender {
  constructor() {
    this.endpoint = `${config.api.url}/workspaces/${config.workspace.id}/chat-messages`;
  }

  /**
   * Creates the message payload structure expected by Bluescape API
   */
  createMessagePayload(text) {
    return {
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Sends an acknowledgement message for processing requests
   */
  async acknowledgeImageProcessing() {
    return this.sendMessage('Processing Image Request...');
  }

  async acknowledgeDocumentProcessing() {
    return this.sendMessage('Processing Document Request...');
  }

  async acknowledgeVideoProcessing() {
    return this.sendMessage('Processing Video Request...');
  }

  /**
   * Sends a message when the asset type is not supported
   */
  async sendUnsupportedAssetMessage() {
    return this.sendMessage('Only image and document assets are supported for AI processing currently');
  }

  /**
   * Generic method to send a message to the chat
   */
  async sendMessage(text) {
    try {
      logger.debug('Sending chat message', { textLength: text.length });
      const payload = this.createMessagePayload(text);
      const response = await apiClient.post(this.endpoint, payload);
      logger.info('Chat message sent', { textLength: text.length });
      return response;
    } catch (error) {
      logger.error('Failed to send message', error);
      throw error;
    }
  }
}

module.exports = new MessageSender();

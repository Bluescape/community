const logger = require('./logger');
const config = require('./config');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates if a message is a new AI request (starts with @triggerWord)
 * and extracts relevant information
 */
class MessageValidator {
  constructor() {
    this.triggerPattern = new RegExp(`^@${escapeRegExp(config.triggerWord)}(?:\\s+|$)`, 'i');
  }

  /**
   * Checks if a message is new and meant for AI processing
   * Messages starting with @ are requests to AI
   * AI responses never start with @, so we ignore those
   * Note: taggedElementId can be null - we just check if message starts with @triggerWord
   */
  isNewMessage(messageText, taggedElementId) {
    if (!messageText) {
      logger.debug('Message validation failed - no text content');
      return {
        isValid: false,
      };
    }

    const match = messageText.match(this.triggerPattern);
    
    if (!match) {
      logger.debug('Message does not start with configured trigger word - skipping', {
        triggerWord: `@${config.triggerWord}`,
        messageLength: messageText.length,
      });
      return {
        isValid: false,
      };
    }

    logger.debug('AI request detected (may be missing tagged element)', {
      triggerWord: `@${config.triggerWord}`,
      hasTaggedId: !!taggedElementId,
    });

    return {
      isValid: true,
      triggerWord: config.triggerWord,
      messageText,
      requestText: messageText.replace(this.triggerPattern, '').trim(),
      taggedElementId,
    };
  }

  /**
   * Extracts message content from the Bluescape API response
   * Returns { text, taggedElementId } if both are present
   * Returns { text, taggedElementId: null } if only text is present (user message without tag)
   * Returns null if no text content
   */
  extractMessageContent(apiResponse) {
    try {
      logger.debug('extractMessageContent called');
      const messageData = apiResponse.results?.[0];
      if (!messageData) {
        logger.debug('No message data in response');
        return null;
      }

      logger.debug('Message data found', { hasContent: !!messageData.content });
      const messageId = messageData.id || messageData.messageId || messageData._id || null;
      const content = messageData.content?.content?.[0]?.content;
      if (!content) {
        logger.debug('No content array in message');
        return null;
      }

      logger.debug('Content array found', { contentLength: content.length });
      
      const textContent = content.find(item => item.type === 'text');
      const objectContent = content.find(item => item.type === 'objectpicker');

      logger.debug('Search results', { hasTextContent: !!textContent, hasObjectContent: !!objectContent });
      logger.debug('Content items types:', { types: content.map(item => item.type) });
      
      if (!textContent) {
        logger.debug('Message has no text content - skipping');
        return null;
      }

      // If no objectpicker, still return the message text for chat-only requests.
      const result = {
        messageId,
        text: textContent.text,
        taggedElementId: objectContent?.attrs?.id || null,
      };
      
      if (result.taggedElementId) {
        logger.info('Message content extracted successfully', { hasTaggedElement: true });
      }
      
      return result;
    } catch (error) {
      logger.error('Error extracting message content', error);
      return null;
    }
  }
}

module.exports = new MessageValidator();

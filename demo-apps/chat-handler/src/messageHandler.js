const apiClient = require('./apiClient');
const config = require('./config');
const logger = require('./logger');
const messageValidator = require('./messageValidator');
const graphQLClient = require('./graphQLClient');
const messageSender = require('./messageSender');
const aiClient = require('./aiClient');

class MessageHandler {
  constructor() {
    this.pollEndpoint = `${config.api.url}/workspaces/${config.workspace.id}/chat-messages?pageSize=1`;
    this.lastProcessedMessageId = null;
  }

  /**
   * Polls the chat endpoint for the latest message
   */
  async pollForNewMessages() {
    try {
      logger.debug('Polling endpoint', { endpoint: this.pollEndpoint });
      const response = await apiClient.get(this.pollEndpoint);
      if (!response?.results?.length) {
        logger.debug('Poll response had no messages');
      }
      return response;
    } catch (error) {
      logger.error('Failed to poll messages', error);
      return null;
    }
  }

  /**
   * Processes a single message: validates, optionally fetches asset, and sends acknowledgement
   */
  async processMessage(messageContent) {
    try {
      logger.debug('processMessage called');
      
      // First validate message (check if it starts with the configured trigger word)
      const validation = messageValidator.isNewMessage(
        messageContent.text,
        messageContent.taggedElementId
      );

      if (!validation.isValid) {
        logger.debug('Message is not an AI trigger request - ignoring');
        return null;
      }

      if (messageContent.messageId && messageContent.messageId === this.lastProcessedMessageId) {
        logger.debug('Message was already processed - skipping', { messageId: messageContent.messageId });
        return null;
      }

      if (messageContent.messageId) {
        this.lastProcessedMessageId = messageContent.messageId;
      }

      logger.info('Processing AI request', {
        triggerWord: `@${validation.triggerWord}`,
        hasTaggedElement: !!validation.taggedElementId,
        requestLength: validation.requestText.length,
      });

      let assetInfo = null;
      if (validation.taggedElementId) {
        logger.debug('Fetching asset info', { elementId: validation.taggedElementId });
        assetInfo = await graphQLClient.getElementAsset(validation.taggedElementId);
        logger.debug('Got asset info', { assetType: assetInfo.assetType });
      }

      logger.debug('Routing message', {
        triggerWord: `@${validation.triggerWord}`,
        requestType: assetInfo ? 'asset' : 'chat',
        assetType: assetInfo?.assetType,
      });
      await this.routeMessage(assetInfo, validation.requestText);

      return {
        messageId: messageContent.messageId,
        triggerWord: validation.triggerWord,
        requestType: assetInfo ? 'asset' : 'chat',
        assetType: assetInfo?.assetType,
        assetUrl: assetInfo?.assetUrl,
        messageText: validation.requestText,
      };
    } catch (error) {
      logger.error('Error processing message', error);
      return null;
    }
  }

  /**
   * Routes message handling based on request/asset type and sends acknowledgement
   */
  async routeMessage(assetInfo, requestText) {
    const assetType = assetInfo?.assetType || null;

    logger.debug('Routing message', { requestType: assetInfo ? 'asset' : 'chat', assetType });

    try {
      // Create a user-friendly asset type name
      const assetTypeName = {
        chat: 'Chat',
        image: 'Image',
        document: 'Document',
        video: 'Video',
      }[assetType || 'chat'] || 'Unknown';

      if (assetInfo && assetType !== 'image' && assetType !== 'document') {
        logger.debug('Handling unsupported asset type');
        await messageSender.sendUnsupportedAssetMessage();
        return;
      }

      await this.processWithOpenAI(assetInfo, requestText, assetTypeName);

      logger.info('Message acknowledged', { requestType: assetInfo ? 'asset' : 'chat', assetType });
    } catch (error) {
      logger.error('Failed to route message', error);
      throw error;
    }
  }

  async processWithOpenAI(assetInfo, requestText, assetTypeName) {
    const service = 'openai';
    const serviceName = 'OpenAI';

    await messageSender.sendMessage(`Processing ${assetTypeName} with ${serviceName}...`);

    try {
      const responseText = await aiClient.processRequest({
        prompt: requestText,
        assetInfo,
      });
      const chatResponse = this.formatAIResponse(serviceName, responseText);
      await messageSender.sendMessage(chatResponse);

      logger.info('AI response sent', {
        service,
        responseLength: responseText.length,
      });

      return responseText;
    } catch (error) {
      logger.error('AI processing failed', error);
      await messageSender.sendMessage(`${serviceName} could not process the ${assetTypeName}. Please check the application logs.`);
      return null;
    }
  }

  formatAIResponse(serviceName, responseText) {
    const prefix = `${serviceName}: `;
    const maxLength = Math.max(config.ai.chatResponseMaxChars - prefix.length, 100);
    const trimmedResponse = responseText.length > maxLength
      ? `${responseText.substring(0, maxLength - 3)}...`
      : responseText;

    return `${prefix}${trimmedResponse}`;
  }

  /**
   * Main polling and processing loop
   * This is called every 15 seconds by the scheduler
   */
  async handlePollingCycle() {
    try {
      logger.debug('Starting polling cycle');
      const pollResponse = await this.pollForNewMessages();

      if (!pollResponse || !pollResponse.results || pollResponse.results.length === 0) {
        logger.debug('No new messages in poll');
        return;
      }

      logger.debug('Message(s) found', { count: pollResponse.results.length });

      // Extract message content
      const messageContent = messageValidator.extractMessageContent(pollResponse);

      if (!messageContent) {
        logger.debug('No extractable message content in response');
        return;
      }

      // Process the message
      const result = await this.processMessage(messageContent);

      if (result) {
        logger.info('Message processed successfully', {
          triggerWord: `@${result.triggerWord}`,
          requestType: result.requestType,
          assetType: result.assetType,
        });
      }
    } catch (error) {
      logger.error('Error in polling cycle', error);
    }
  }
}

module.exports = new MessageHandler();

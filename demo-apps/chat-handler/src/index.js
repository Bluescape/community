const config = require('./config');
const logger = require('./logger');
const messageHandler = require('./messageHandler');

class App {
  constructor() {
    this.isRunning = false;
    this.isPolling = false;
    this.pollingInterval = null;
  }

  /**
   * Validates configuration before starting
   */
  validateConfig() {
    const required = ['WORKSPACE_ID', 'OPENAI_API_KEY'];
    const missing = [];

    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (config.api.authMode.toLowerCase() === 'oauth') {
      if (!process.env.CLIENT_ID) missing.push('CLIENT_ID');
      if (!process.env.CLIENT_SECRET) missing.push('CLIENT_SECRET');
    } else if (config.api.authMode.toLowerCase() === 'jwt' && !process.env.JWT_TOKEN) {
      missing.push('JWT_TOKEN');
    }

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (!/^[a-z0-9_-]+$/i.test(config.triggerWord)) {
      throw new Error('TRIGGER_WORD must be a single word containing only letters, numbers, underscores, or hyphens. Do not include spaces.');
    }

    logger.info('Configuration validated');
    logger.info('Current settings', {
      logLevel: config.logging.level,
      bluescapeAuthMode: config.api.authMode,
      oauthClientConfigured: !!(config.api.clientId && config.api.clientSecret),
      triggerWord: `@${config.triggerWord}`,
      workspaceId: config.workspace.id,
      pollInterval: config.polling.interval,
      httpTimeout: config.http.timeoutMs,
      openAIConfigured: !!config.ai.openai.apiKey,
      openAIBaseUrl: config.ai.openai.baseUrl,
      openAIApiMode: config.ai.openai.apiMode,
    });
  }

  /**
   * Starts the polling loop
   */
  start() {
    try {
      this.validateConfig();
      this.isRunning = true;

      logger.info('Starting Bluescape Chat Handler', {
        workspaceId: config.workspace.id,
        triggerWord: `@${config.triggerWord}`,
        pollInterval: `${config.polling.interval / 1000}s`,
        maxRetries: config.retry.maxRetries,
      });

      logger.info('Running first polling cycle immediately...');
      
      setImmediate(() => this.runPollingCycle('initial'));

      this.pollingInterval = setInterval(() => this.runPollingCycle(), config.polling.interval);

      logger.info('Chat handler started successfully');
    } catch (error) {
      logger.error('Failed to start chat handler', error);
      process.exit(1);
    }
  }

  async runPollingCycle(label = 'polling') {
    if (this.isPolling) {
      logger.warn('Skipping polling cycle because the previous cycle is still running', { label });
      return;
    }

    this.isPolling = true;
    try {
      await messageHandler.handlePollingCycle();
    } catch (error) {
      logger.error(`Error in ${label} cycle`, error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Stops the polling loop and cleans up
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isRunning = false;
    logger.info('Chat handler stopped');
  }

  /**
   * Handles graceful shutdown
   */
  setupGracefulShutdown() {
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });
  }
}

const app = new App();

if (require.main === module) {
  app.setupGracefulShutdown();
  app.start();
}

module.exports = app;

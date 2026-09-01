const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class ApiClient {
  constructor() {
    this.maxRetries = config.retry.maxRetries;
    this.retryDelay = config.retry.delayMs;
    this.oauthToken = null;
    this.oauthTokenExpiresAt = 0;
    this.oauthTokenRequest = null;
  }

  async getHeaders() {
    const accessToken = await this.getAccessToken();

    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getAccessToken() {
    if (config.api.authMode.toLowerCase() === 'jwt') {
      if (!config.api.jwtToken) {
        throw new Error('JWT_TOKEN is not configured');
      }

      return config.api.jwtToken;
    }

    if (config.api.authMode.toLowerCase() !== 'oauth') {
      throw new Error(`Unsupported BLUESCAPE_AUTH_MODE "${config.api.authMode}". Use "oauth" or "jwt".`);
    }

    const refreshWindowMs = 60 * 1000;
    if (this.oauthToken && Date.now() < this.oauthTokenExpiresAt - refreshWindowMs) {
      return this.oauthToken;
    }

    if (!this.oauthTokenRequest) {
      this.oauthTokenRequest = this.requestOAuthToken()
        .finally(() => {
          this.oauthTokenRequest = null;
        });
    }

    return this.oauthTokenRequest;
  }

  async requestOAuthToken() {
    if (!config.api.clientId || !config.api.clientSecret) {
      throw new Error('CLIENT_ID and CLIENT_SECRET are required when BLUESCAPE_AUTH_MODE=oauth');
    }

    const params = new URLSearchParams({ grant_type: 'client_credentials' });
    if (config.api.oauthScope) {
      params.set('scope', config.api.oauthScope);
    }

    try {
      const response = await axios.post(config.api.oauthTokenUrl, params.toString(), {
        timeout: config.http.timeoutMs,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: config.api.clientId,
          password: config.api.clientSecret,
        },
      });

      if (!response.data?.access_token) {
        throw new Error('OAuth token response did not contain access_token');
      }

      const expiresInSeconds = Number(response.data.expires_in) || 300;
      this.oauthToken = response.data.access_token;
      this.oauthTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
      return this.oauthToken;
    } catch (error) {
      const statusCode = error.response?.status;
      const providerMessage = error.response?.data?.error_description
        || error.response?.data?.error
        || error.response?.data?.message;

      logger.error('Bluescape OAuth token request failed', { statusCode, providerMessage });
      throw new Error(`Bluescape OAuth token request failed${statusCode ? ` with HTTP ${statusCode}` : ''}${providerMessage ? `: ${providerMessage}` : ''}`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request(method, url, data = null, retryCount = 0) {
    const requestStart = Date.now();
    try {
      const requestConfig = {
        method,
        url,
        headers: await this.getHeaders(),
      };

      if (data) {
        requestConfig.data = data;
      }

      const timeoutMs = config.http.timeoutMs;
      logger.debug(`HTTP request starting`, { method, url, retryCount, hasAuth: !!requestConfig.headers.Authorization, timeoutMs });
      
      const response = await axios({
        ...requestConfig,
        timeout: timeoutMs,
      });
      
      const elapsed = Date.now() - requestStart;
      logger.debug('HTTP request completed', { method, statusCode: response.status, elapsedMs: elapsed });
      return response.data;
    } catch (error) {
      const elapsed = Date.now() - requestStart;
      const statusCode = error.response?.status;
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const errorMessage = isTimeout ? 'Request timeout' : (error.response?.data?.message || error.message);
      const errorDetails = {
        method,
        url,
        error: errorMessage,
        statusCode,
        retryCount,
        isTimeout,
        elapsedMs: elapsed,
      };
      
      if (method === 'GET' && retryCount < this.maxRetries && this.shouldRetry(error)) {
        logger.warn(`API request failed, retrying (${retryCount + 1}/${this.maxRetries})`, errorDetails);
        await this.sleep(this.retryDelay);
        return this.request(method, url, data, retryCount + 1);
      }

      logger.error(`API request failed after ${this.maxRetries} retries`, { ...errorDetails, stack: error.stack });
      throw error;
    }
  }

  shouldRetry(error) {
    const statusCode = error.response?.status;

    if (!statusCode) {
      return true;
    }

    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
  }

  async get(url) {
    logger.debug('HTTP GET request starting', { url });
    try {
      const result = await this.request('GET', url);
      logger.debug('HTTP GET request completed');
      return result;
    } catch (error) {
      logger.error('HTTP GET request failed', error);
      throw error;
    }
  }

  async post(url, data) {
    logger.debug('HTTP POST request starting', { url });
    try {
      const result = await this.request('POST', url, data);
      logger.debug('HTTP POST request completed');
      return result;
    } catch (error) {
      logger.error('HTTP POST request failed', error);
      throw error;
    }
  }
}

module.exports = new ApiClient();

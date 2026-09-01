require('dotenv').config();

function normalizeTriggerWord(value) {
  return String(value || 'llm').trim().replace(/^@+/, '').toLowerCase() || 'llm';
}

module.exports = {
  api: {
    url: process.env.BLUESCAPE_API_URL || 'https://elementary.apps.us.bluescape.com/api/v3',
    jwtToken: process.env.JWT_TOKEN,
    authMode: process.env.BLUESCAPE_AUTH_MODE || (process.env.CLIENT_ID && process.env.CLIENT_SECRET ? 'oauth' : 'jwt'),
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    oauthTokenUrl: process.env.OAUTH_TOKEN_URL || 'https://api.apps.us.bluescape.com/v3/oauth2/token',
    oauthAuthorizeUrl: process.env.OAUTH_AUTHORIZE_URL || 'https://api.apps.us.bluescape.com/v3/oauth2/authorize',
    oauthScope: process.env.OAUTH_SCOPE,
  },
  triggerWord: normalizeTriggerWord(process.env.TRIGGER_WORD),
  workspace: {
    id: process.env.WORKSPACE_ID,
  },
  polling: {
    interval: parseInt(process.env.POLL_INTERVAL || '15', 10) * 1000, // Convert to milliseconds
  },
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    delayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  },
  http: {
    timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '10000', 10), // 10 second default
  },
  ai: {
    maxAssetBytes: parseInt(process.env.AI_MAX_ASSET_BYTES || '25000000', 10),
    chatResponseMaxChars: parseInt(process.env.AI_CHAT_RESPONSE_MAX_CHARS || '3500', 10),
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
      apiMode: process.env.OPENAI_API_MODE || 'responses',
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
      maxOutputTokens: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '800', 10),
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

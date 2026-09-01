# Bluescape Chat Handler

A native Node.js application that replaces the n8n workflow for handling Bluescape chat messages and sending them to OpenAI.

## Overview

This application:
- Polls the Bluescape chat endpoint every 15 seconds
- Validates messages that start with the configured trigger word, for example `@llm`
- Retrieves tagged asset information via GraphQL when a message includes a tagged element
- Sends plain chat messages, and supported tagged image/document assets, to OpenAI
- Sends AI responses back to the chat
- Runs on Ubuntu via PM2 process manager

## Architecture

```
Index.js (Scheduler)
    ↓
MessageHandler (Orchestration)
    ├→ Poll for Messages (REST API)
    ├→ Validate Message (Check for @<TRIGGER_WORD>)
    ├→ Fetch Asset Info when tagged (GraphQL)
    ├→ Process with AIClient (OpenAI Responses API)
    └→ Send AI Response (REST API)
```

## Project Structure

```
.
├── src/
│   ├── index.js              # Main entry point with scheduler
│   ├── config.js             # Configuration management
│   ├── logger.js             # Logging utility
│   ├── apiClient.js          # HTTP client with retry logic
│   ├── aiClient.js           # OpenAI client
│   ├── messageValidator.js   # Message validation
│   ├── graphQLClient.js      # GraphQL client for asset retrieval
│   ├── messageSender.js      # Chat message sender
│   └── messageHandler.js     # Main orchestration logic
├── package.json              # Dependencies
├── ecosystem.config.js       # PM2 configuration
├── .env.example              # Environment variables template
└── README.md
```

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn
- PM2 (for production deployment)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your configuration:**
   ```env
   BLUESCAPE_AUTH_MODE=oauth
   CLIENT_ID=your_client_id
   CLIENT_SECRET=your_client_secret
   OAUTH_TOKEN_URL=https://api.apps.us.bluescape.com/v3/oauth2/token
   OAUTH_AUTHORIZE_URL=https://api.apps.us.bluescape.com/v3/oauth2/authorize
   BLUESCAPE_API_URL=https://elementary.apps.us.bluescape.com/api/v3
   WORKSPACE_ID=your_workspace_id
   POLL_INTERVAL=15
   MAX_RETRIES=3
   RETRY_DELAY_MS=1000
   TRIGGER_WORD=llm
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_API_MODE=responses
   ```

4. **Run in development mode:**
   ```bash
   npm run dev
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BLUESCAPE_AUTH_MODE` | `oauth` when client credentials are set, otherwise `jwt` | Bluescape authentication mode: `oauth` or `jwt` |
| `CLIENT_ID` | required for OAuth | Bluescape OAuth client ID |
| `CLIENT_SECRET` | required for OAuth | Bluescape OAuth client secret |
| `OAUTH_TOKEN_URL` | `https://api.apps.us.bluescape.com/v3/oauth2/token` | OAuth client-credentials token endpoint |
| `OAUTH_AUTHORIZE_URL` | `https://api.apps.us.bluescape.com/v3/oauth2/authorize` | OAuth authorization endpoint; not used by the client-credentials flow |
| `OAUTH_SCOPE` | unset | Optional OAuth scope |
| `JWT_TOKEN` | required for JWT mode | JWT token for Bluescape API authentication |
| `BLUESCAPE_API_URL` | `https://elementary.apps.us.bluescape.com/api/v3` | Bluescape API endpoint |
| `WORKSPACE_ID` | required | Bluescape workspace ID |
| `POLL_INTERVAL` | `15` | Polling interval in seconds |
| `MAX_RETRIES` | `3` | Maximum retry attempts for API calls |
| `RETRY_DELAY_MS` | `1000` | Delay between retries in milliseconds |
| `TRIGGER_WORD` | `llm` | Word users type after `@` to invoke AI processing. Set `llm` for `@llm` |
| `OPENAI_API_KEY` | required | OpenAI API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base URL. Set this to your self-hosted `/v1` endpoint |
| `OPENAI_API_URL` | unset | Alias for `OPENAI_BASE_URL` if that name is preferred |
| `OPENAI_API_MODE` | `responses` | API dialect. Use `responses` for `/v1/responses`, or `chat_completions` for `/v1/chat/completions` |
| `OPENAI_MODEL` | `gpt-5.6` | OpenAI model used by the Responses API |
| `OPENAI_TIMEOUT_MS` | `30000` | Timeout for OpenAI requests |
| `OPENAI_MAX_OUTPUT_TOKENS` | `800` | Maximum output tokens for OpenAI responses |
| `AI_MAX_ASSET_BYTES` | `25000000` | Maximum downloaded asset size sent to AI |
| `AI_CHAT_RESPONSE_MAX_CHARS` | `3500` | Maximum AI response length posted to Bluescape chat |
| `LOG_LEVEL` | `info` | Logging level: debug, info, warn, error |

## Deployment on Ubuntu with PM2

### 1. Install PM2 globally

```bash
sudo npm install -g pm2
```

### 2. Setup on your Ubuntu server

```bash
# Clone repository
git clone <your-repo-url> /opt/bluescape-chat-handler
cd /opt/bluescape-chat-handler

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit with your configuration
```

### 3. Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Monitor logs
pm2 logs bluescape-chat-handler

# Show status
pm2 status

# Stop the application
pm2 stop bluescape-chat-handler

# Restart the application
pm2 restart bluescape-chat-handler
```

### 4. Enable PM2 startup on boot

```bash
# Generate startup script
pm2 startup

# Execute the output command (PM2 will tell you the exact command)
# Usually something like:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save current PM2 process list
pm2 save
```

### 5. Monitoring and Logs

```bash
# View real-time logs
pm2 logs bluescape-chat-handler

# View specific log file
tail -f pm2-logs/out.log
tail -f pm2-logs/error.log

# Setup log rotation (optional but recommended)
pm2 install pm2-logrotate
```

## How It Works

### Message Flow

1. **Polling**: Every 15 seconds, the app polls the Bluescape chat endpoint for the latest message
2. **Validation**: Message text is checked to see if it starts with the configured trigger word
3. **Asset Retrieval**: If a tagged element is present, the tagged element's asset information is fetched via GraphQL
4. **Processing Notice**: A "Processing..." message is sent back to chat
5. **AI Request**: Plain messages are sent as chat; images are sent inline, while document assets are uploaded to OpenAI and referenced by file ID
6. **Response**: The AI response is posted back to the Bluescape chat

### Message Format

Messages must start with the configured trigger word:
```
@llm summarize this
@llm summarize this tagged image/document
```

A tagged element is optional. The default trigger word is `llm`, so users type `@llm`. Set `TRIGGER_WORD` to change the word after `@`.

### Response Messages

The app automatically sends processing and result messages:
- **Plain chat**: "Processing Chat with OpenAI..." followed by "OpenAI: ..."
- **Image/Document**: "Processing Image/Document with OpenAI..." followed by "OpenAI: ..."
- **Video/Other**: "Only image and document assets are supported for AI processing currently"

## Logging

All output is logged to stdout/stderr and captured by PM2:

```
[2026-08-18T14:30:00.000Z] [INFO] Polling for new messages...
[2026-08-18T14:30:01.234Z] [DEBUG] Message validation failed - no text content
[2026-08-18T14:30:02.567Z] [INFO] Processing AI request { triggerWord: '@llm', hasTaggedElement: false, requestLength: 25 }
```

### Log Levels

- `debug`: Detailed information for development
- `info`: General informational messages
- `warn`: Warning messages
- `error`: Error messages

Set via `LOG_LEVEL` environment variable.

## Retry Logic

- Retries idempotent GET requests after network failures, HTTP 408/429, and server errors up to `MAX_RETRIES` times (default: 3)
- Retries idempotent GET requests after network failures, HTTP 408/429, and server errors up to `MAX_RETRIES` times (default: 3)
- Waits `RETRY_DELAY_MS` milliseconds between retries (default: 1000)
- Configurable via environment variables

## Future Enhancements

The app is structured to easily add:
1. **Additional OpenAI request modes**: Extend `src/aiClient.js` for more OpenAI-compatible workflows
2. **Video Processing**: Extract frames/transcripts before sending to a model
3. **Asset Caching**: Cache frequently accessed assets
4. **Advanced Routing**: Route based on workspace, user, or other metadata
5. **Metrics & Monitoring**: Integration with Prometheus, CloudWatch, etc.
6. **Database**: Store message history and audit logs

## Troubleshooting

### App won't start
- Check that `.env` file exists and has all required variables
- Verify the configured OAuth client credentials or JWT token is valid
- Check PM2 logs: `pm2 logs bluescape-chat-handler`

### API calls failing
- Verify the configured OAuth client credentials or JWT token is valid and has access to the workspace
- Check workspace ID is correct
- Review API endpoint URL
- Check network connectivity to Bluescape servers

### OpenAI flow returns HTTP 400
- Check the startup log for `openAIBaseUrl` and `openAIApiMode`
- Use `OPENAI_API_MODE=responses` when the provider supports `/v1/responses`
- Use `OPENAI_API_MODE=chat_completions` when a self-hosted OpenAI-compatible provider only supports `/v1/chat/completions`
- Review logs for `providerMessage`; the app logs summarized request metadata without logging the API key

### High memory usage
- PM2 will auto-restart if exceeding 500MB (configurable in ecosystem.config.js)
- Monitor with: `pm2 monit`

### Messages not being processed
- Verify messages start with `@<TRIGGER_WORD>`, for example `@llm`
- If using a tagged element, check that the element has a downloadable image or document asset
- Review logs with `pm2 logs`

## Development Tips

### Local Testing with Watch Mode
```bash
npm run dev
```

### Testing Message Processing
Create a message in Bluescape chat:
```
@llm What are three ways to summarize this project?
@llm Process this image
```
The app should post a processing message within 15 seconds, then post the OpenAI response. The second example sends the tagged asset only if an element is tagged.

### Debugging
Set `LOG_LEVEL=debug` in `.env` for detailed logs:
```env
LOG_LEVEL=debug
```

## License

ISC

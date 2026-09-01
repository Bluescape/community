const axios = require('axios');
const FormData = require('form-data');
const { URL } = require('url');
const config = require('./config');
const logger = require('./logger');

class AIClient {
  constructor() {
    this.openAIBaseUrl = config.ai.openai.baseUrl.replace(/\/$/, '');
    this.openAIEndpoints = {
      responses: `${this.openAIBaseUrl}/responses`,
      chat_completions: `${this.openAIBaseUrl}/chat/completions`,
    };
  }

  async processRequest({ prompt, assetInfo = null }) {
    return this.processWithOpenAI({ prompt, assetInfo });
  }

  async processWithOpenAI({ prompt, assetInfo = null }) {
    if (!config.ai.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    let asset = null;
    if (assetInfo) {
      if (!assetInfo.assetUrl) {
        throw new Error('Tagged asset does not have a downloadable URL');
      }

      if (!['image', 'document'].includes(assetInfo.assetType)) {
        throw new Error(`OpenAI processing is not implemented for ${assetInfo.assetType} assets`);
      }

      asset = await this.downloadAsset(assetInfo);

      if (assetInfo.assetType !== 'image') {
        asset.fileId = await this.uploadAsset(asset);
      }
    }

    const apiMode = this.normalizeApiMode(config.ai.openai.apiMode);

    if (apiMode === 'chat_completions') {
      return this.processWithOpenAIChatCompletions({ prompt, assetInfo, asset });
    }

    if (apiMode !== 'responses') {
      throw new Error(`Unsupported OPENAI_API_MODE "${config.ai.openai.apiMode}". Use "responses" or "chat_completions".`);
    }

    return this.processWithOpenAIResponses({ prompt, assetInfo, asset });
  }

  async processWithOpenAIResponses({ prompt, assetInfo = null, asset = null }) {
    const content = [
      {
        type: 'input_text',
        text: this.buildPrompt(prompt, assetInfo),
      },
    ];

    if (assetInfo) {
      if (assetInfo.assetType === 'image') {
        content.push({
          type: 'input_image',
          image_url: asset.dataUrl,
          detail: 'auto',
        });
      } else {
        content.push({
          type: 'input_file',
          file_id: asset.fileId,
        });
      }
    }

    logger.info('Sending request to OpenAI', {
      model: config.ai.openai.model,
      apiMode: 'responses',
      endpoint: this.openAIEndpoints.responses,
      requestType: assetInfo ? 'asset' : 'chat',
      assetType: assetInfo?.assetType,
      assetBytes: asset?.bytes,
      assetMimeType: asset?.mimeType,
    });

    const response = await this.postOpenAI(this.openAIEndpoints.responses, {
      model: config.ai.openai.model,
      instructions: this.buildInstructions(assetInfo),
      input: [
        {
          role: 'user',
          content,
        },
      ],
      max_output_tokens: config.ai.openai.maxOutputTokens,
    });

    const outputText = this.extractOpenAIText(response.data);
    if (!outputText) {
      throw new Error('OpenAI returned no text output');
    }

    return outputText;
  }

  async processWithOpenAIChatCompletions({ prompt, assetInfo = null, asset = null }) {
    if (assetInfo && assetInfo.assetType !== 'image') {
      throw new Error('OPENAI_API_MODE=chat_completions currently supports image assets only. Use OPENAI_API_MODE=responses for document assets.');
    }

    const userMessage = {
      role: 'user',
      content: assetInfo
        ? [
          {
            type: 'text',
            text: this.buildPrompt(prompt, assetInfo),
          },
          {
            type: 'image_url',
            image_url: {
              url: asset.dataUrl,
              detail: 'auto',
            },
          },
        ]
        : this.buildPrompt(prompt, assetInfo),
    };

    logger.info('Sending request to OpenAI-compatible chat completions endpoint', {
      model: config.ai.openai.model,
      apiMode: 'chat_completions',
      endpoint: this.openAIEndpoints.chat_completions,
      requestType: assetInfo ? 'asset' : 'chat',
      assetType: assetInfo?.assetType,
      assetBytes: asset?.bytes,
      assetMimeType: asset?.mimeType,
    });

    const response = await this.postOpenAI(this.openAIEndpoints.chat_completions, {
      model: config.ai.openai.model,
      messages: [
        {
          role: 'system',
          content: this.buildInstructions(assetInfo),
        },
        userMessage,
      ],
      max_tokens: config.ai.openai.maxOutputTokens,
    });

    const outputText = this.extractChatCompletionText(response.data);
    if (!outputText) {
      throw new Error('OpenAI-compatible chat completions endpoint returned no text output');
    }

    return outputText;
  }

  async postOpenAI(endpoint, payload) {
    try {
      return await axios.post(endpoint, payload, {
        timeout: config.ai.openai.timeoutMs,
        headers: {
          Authorization: `Bearer ${config.ai.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      const statusCode = error.response?.status;
      const providerMessage = this.extractProviderErrorMessage(error.response?.data);

      logger.error('OpenAI request failed', {
        statusCode,
        providerMessage,
        request: this.summarizeOpenAIRequest(endpoint, payload),
      });

      if (statusCode) {
        throw new Error(`OpenAI request failed with HTTP ${statusCode}${providerMessage ? `: ${providerMessage}` : ''}`);
      }

      throw error;
    }
  }

  buildInstructions(assetInfo = null) {
    if (assetInfo) {
      return 'You are helping a Bluescape workspace user inspect a tagged canvas asset. Answer the user request directly and concisely.';
    }

    return 'You are helping a Bluescape workspace user in chat. Answer the user request directly and concisely.';
  }

  buildPrompt(prompt, assetInfo = null) {
    const trimmedPrompt = (prompt || '').trim();
    const request = trimmedPrompt || (assetInfo
      ? 'Describe this asset and call out the most important details.'
      : 'The user sent the trigger word without an additional message. Ask what they would like help with.');

    if (!assetInfo) {
      return request;
    }

    return [
      `User request: ${request}`,
      `Tagged asset type: ${assetInfo.assetType}`,
      assetInfo.assetFormat ? `Tagged asset format: ${assetInfo.assetFormat}` : null,
    ].filter(Boolean).join('\n');
  }

  async downloadAsset(assetInfo) {
    const assetUrl = this.validateAssetUrl(assetInfo.assetUrl);
    const unauthenticated = await this.tryDownloadAsset(assetUrl, {});

    if (unauthenticated.status < 400) {
      return this.toAssetPayload(unauthenticated, assetInfo, assetUrl);
    }

    if (![401, 403].includes(unauthenticated.status)) {
      throw new Error(`Asset download failed with HTTP ${unauthenticated.status}`);
    }

    if (!this.isTrustedAssetHost(assetUrl)) {
      throw new Error('Asset download requires authorization from a trusted Bluescape host');
    }

    logger.debug('Retrying asset download with Bluescape authorization', {
      status: unauthenticated.status,
    });

    const authenticated = await this.tryDownloadAsset(assetUrl, {
      Authorization: `Bearer ${await apiClient.getAccessToken()}`,
    });

    if (authenticated.status >= 400) {
      throw new Error(`Asset download failed with HTTP ${authenticated.status}`);
    }

    return this.toAssetPayload(authenticated, assetInfo, assetUrl);
  }

  async tryDownloadAsset(assetUrl, headers) {
    try {
      const response = await axios.get(assetUrl, {
        responseType: 'arraybuffer',
        timeout: config.http.timeoutMs,
        maxContentLength: config.ai.maxAssetBytes,
        headers,
        validateStatus: () => true,
      });

      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
        throw new Error(`Asset exceeds AI_MAX_ASSET_BYTES (${config.ai.maxAssetBytes})`);
      }

      throw error;
    }
  }

  async uploadAsset(asset) {
    const form = new FormData();
    form.append('file', asset.buffer, {
      filename: asset.filename,
      contentType: asset.mimeType,
    });
    form.append('purpose', 'user_data');

    try {
      const response = await axios.post(`${this.openAIBaseUrl}/files`, form, {
        timeout: config.ai.openai.timeoutMs,
        maxBodyLength: config.ai.maxAssetBytes,
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${config.ai.openai.apiKey}`,
        },
      });

      if (!response.data?.id) {
        throw new Error('OpenAI file upload returned no file ID');
      }

      return response.data.id;
    } catch (error) {
      const statusCode = error.response?.status;
      const providerMessage = this.extractProviderErrorMessage(error.response?.data);
      logger.error('OpenAI asset upload failed', { statusCode, providerMessage });

      if (statusCode) {
        throw new Error(`OpenAI asset upload failed with HTTP ${statusCode}${providerMessage ? `: ${providerMessage}` : ''}`);
      }

      throw error;
    }
  }

  toAssetPayload(downloadResponse, assetInfo, assetUrl) {
    const buffer = Buffer.from(downloadResponse.data);

    if (buffer.length > config.ai.maxAssetBytes) {
      throw new Error(`Asset exceeds AI_MAX_ASSET_BYTES (${config.ai.maxAssetBytes})`);
    }

    const mimeType = this.detectMimeType(downloadResponse.headers, assetInfo, buffer);
    if (assetInfo.assetType === 'image' && !this.isSupportedImageMimeType(mimeType)) {
      throw new Error(`Could not determine a supported image MIME type for tagged asset. Detected "${mimeType}".`);
    }

    const base64 = buffer.toString('base64');

    return {
      bytes: buffer.length,
      buffer,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      filename: this.detectFilename(downloadResponse.headers, assetInfo, assetUrl, mimeType),
      mimeType,
    };
  }

  detectMimeType(headers, assetInfo, buffer = null) {
    const headerMime = this.normalizeMimeType(headers['content-type']);
    const formatMime = this.detectMimeTypeFromFormat(assetInfo.assetFormat);
    const magicMime = this.detectMimeTypeFromBytes(buffer);

    if (headerMime && !this.isGenericBinaryMimeType(headerMime)) {
      return headerMime;
    }

    if (formatMime) {
      return formatMime;
    }

    if (magicMime) {
      return magicMime;
    }

    return 'application/octet-stream';
  }

  detectMimeTypeFromFormat(assetFormat) {
    const format = this.normalizeAssetFormat(assetFormat);
    const mimeByFormat = {
      csv: 'text/csv',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      gif: 'image/gif',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      md: 'text/markdown',
      pdf: 'application/pdf',
      png: 'image/png',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      webp: 'image/webp',
    };

    return mimeByFormat[format] || null;
  }

  detectMimeTypeFromBytes(buffer) {
    if (!buffer || buffer.length < 4) {
      return null;
    }

    if (buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a) {
      return 'image/png';
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    const firstFour = buffer.subarray(0, 4).toString('ascii');
    if (firstFour === 'GIF8') {
      return 'image/gif';
    }

    if (buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }

    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return 'application/pdf';
    }

    return null;
  }

  normalizeMimeType(mimeType) {
    return mimeType?.split(';')?.[0]?.trim()?.toLowerCase() || null;
  }

  normalizeAssetFormat(assetFormat) {
    return (assetFormat || '')
      .toLowerCase()
      .replace(/^image\//, '')
      .replace(/^application\//, '')
      .replace(/^x-/, '');
  }

  isGenericBinaryMimeType(mimeType) {
    return ['application/octet-stream', 'binary/octet-stream', 'octet-stream'].includes(mimeType);
  }

  isSupportedImageMimeType(mimeType) {
    return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mimeType);
  }

  detectFilename(headers, assetInfo, assetUrl, mimeType) {
    const contentDisposition = headers['content-disposition'];
    const dispositionMatch = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);

    if (dispositionMatch?.[1]) {
      return decodeURIComponent(dispositionMatch[1]);
    }

    const pathname = new URL(assetUrl).pathname;
    const urlFilename = pathname.split('/').filter(Boolean).pop();
    if (urlFilename && urlFilename.includes('.')) {
      return urlFilename;
    }

    const format = (assetInfo.assetFormat || '').toLowerCase();
    const extensionByMime = {
      'application/pdf': 'pdf',
      'image/gif': 'gif',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'text/csv': 'csv',
      'text/markdown': 'md',
      'text/plain': 'txt',
    };

    const extension = format || extensionByMime[mimeType] || 'bin';
    return `bluescape-${assetInfo.elementId || 'asset'}.${extension}`;
  }

  extractOpenAIText(responseData) {
    if (typeof responseData?.output_text === 'string') {
      return responseData.output_text.trim();
    }

    const textParts = [];
    for (const outputItem of responseData?.output || []) {
      for (const contentItem of outputItem.content || []) {
        if (contentItem.type === 'output_text' && contentItem.text) {
          textParts.push(contentItem.text);
        } else if (contentItem.type === 'text' && contentItem.text) {
          textParts.push(contentItem.text);
        } else if (contentItem.type === 'refusal' && contentItem.refusal) {
          textParts.push(contentItem.refusal);
        }
      }
    }

    return textParts.join('\n').trim();
  }

  extractChatCompletionText(responseData) {
    return responseData?.choices
      ?.map(choice => choice.message?.content || choice.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  extractProviderErrorMessage(responseData) {
    if (!responseData) {
      return null;
    }

    if (typeof responseData === 'string') {
      return responseData;
    }

    return responseData.error?.message
      || responseData.message
      || responseData.detail
      || null;
  }

  summarizeOpenAIRequest(endpoint, payload) {
    return {
      endpoint,
      model: payload.model,
      hasInstructions: !!payload.instructions,
      hasInput: !!payload.input,
      messageCount: payload.messages?.length,
      maxOutputTokens: payload.max_output_tokens,
      maxTokens: payload.max_tokens,
    };
  }

  validateAssetUrl(assetUrl) {
    const parsed = new URL(assetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Asset URL must be http or https');
    }

    return parsed.toString();
  }

  isTrustedAssetHost(assetUrl) {
    const assetHostname = new URL(assetUrl).hostname.toLowerCase();
    const apiHostname = new URL(config.api.url).hostname.toLowerCase();

    return assetHostname === apiHostname || assetHostname.endsWith('.bluescape.com');
  }

  normalizeApiMode(apiMode) {
    return (apiMode || 'responses')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');
  }
}

module.exports = new AIClient();

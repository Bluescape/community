const apiClient = require('./apiClient');
const config = require('./config');
const logger = require('./logger');

class GraphQLClient {
  constructor() {
    this.endpoint = `${config.api.url.replace('/api/v3', '')}/graphql`;
  }

  /**
   * Retrieves asset information for a given element ID
   * Returns asset type (image, document, video, or other) and URL
   */
  async getElementAsset(elementId) {
    const query = `
      query GetElement($workspaceId: String!, $elementId: String!) {
        elements(
          workspaceId: $workspaceId
          id: $elementId
        ) {
          id
          ...on Image {
            asset {
              imageFormat
              url
            }
          }
          ...on Document {
            asset {
              documentFormat
              url
            }
          }
          ...on Video {
            asset {
              videoFormat
              url
            }
          }
        }
      }
    `;

    try {
      logger.debug('Fetching asset info via GraphQL', { elementId });
      const response = await apiClient.post(this.endpoint, {
        query,
        variables: {
          workspaceId: config.workspace.id,
          elementId,
        },
      });
      
      if (response.errors) {
        logger.error('GraphQL error', { errors: response.errors });
        throw new Error(`GraphQL error: ${response.errors.map(e => e.message).join(', ')}`);
      }

      const result = this.parseAssetResponse(response.data);
      logger.debug('Asset type determined', { assetType: result.assetType });
      return result;
    } catch (error) {
      logger.error('Failed to fetch asset', error);
      throw error;
    }
  }

  /**
   * Parses the GraphQL response to extract asset type and URL
   */
  parseAssetResponse(data) {
    const element = data?.elements?.[0];
    
    if (!element) {
      logger.warn('Element not found in GraphQL response');
      return {
        assetType: 'unknown',
        assetUrl: null,
      };
    }

    const asset = element.asset;
    if (!asset) {
      logger.info('Element has no asset', { elementId: element.id });
      return {
        assetType: 'unknown',
        assetUrl: null,
      };
    }

    let assetType = 'unknown';
    let assetFormat = null;
    if (asset.imageFormat) {
      assetType = 'image';
      assetFormat = asset.imageFormat;
    } else if (asset.documentFormat) {
      assetType = 'document';
      assetFormat = asset.documentFormat;
    } else if (asset.videoFormat) {
      assetType = 'video';
      assetFormat = asset.videoFormat;
    }

    logger.debug('Asset parsed', { elementId: element.id, assetType, assetFormat, hasUrl: !!asset.url });

    return {
      assetType,
      assetFormat,
      assetUrl: asset.url,
      elementId: element.id,
    };
  }
}

module.exports = new GraphQLClient();

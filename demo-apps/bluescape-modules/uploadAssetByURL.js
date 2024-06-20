/**
 * @license
 * Copyright 2022 Thought Stream, LLC dba Bluescape
 * Permission is hereby granted, free of charge, to any person obtaining a copy 
 * of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
 * subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS 
 * OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
*/

import runGraphqlRequest, { runRestRequest } from './bluescapeApis.js';
import { getMutationValuesGraphql, getUploadValuesRest } from './uploadUtils.js';

/**
    * Checks upload by URL ingestion status.
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    *  
    * @param {Object} functionParams - Object with the parameters of the request to run
    * @param {string} functionParams.workspaceId - Workspace Id of workspace where the asset will be uploaded
    * @param {string} functionParams.newElementId - ID of the new element that was created by the upload
    *  
    * @returns {Object} Object with the values to return
    * @returns {boolean} object.isUploadSuccessful - true if the upload finished with a successful status, false if not
    * @returns {string} object.errorMessage - Error message in case the upload was not successful 
*/
export async function checkUrlUploadIngestionStatusGraphql(bluescapeApiParams, functionParams) {

    let isUploadFinished = false;
    let errorMessage = `The object was not uploaded correctly, the upload operation timed out.`; // Default value
    let isUploadSuccessful = false;

    const queryGetElementIngestionStatus = `query getElementIngestionStatus( $workspaceId: String! $elementId: String!) {
        elements(workspaceId: $workspaceId,  id: $elementId) {
          ... on Video {
            ingestionState
            traits
          }
          ... on Document {
            ingestionState
            traits
          }
          ...on Image {
            ingestionState
            traits
          }
          
        }
      }`

    const elementVariables = {
        'workspaceId': functionParams.workspaceId,
        'elementId': functionParams.newElementId
    }

    const requestParamsCheckIngestionStatus = {
        'requestQuery': queryGetElementIngestionStatus,
        'requestVariables': elementVariables
    }

    // Example of failure for file too big:
    // "data": {
    //     "elements": [
    //       {
    //         "ingestionState": "complete_failure",
    //         "traits": {
    //           "http://bluescape.dev/zygote/v1/searchTitle": "testVideo.mp4",
    //           "http://bluescape.dev/zygote/v1/title": "testVideo.mp4",
    //           "http://bluescape.dev/zygote/v1/thumbExt": "png",
    //           "http://bluescape.dev/zygote/v1/originalUrl": "https://s3.amazonaws.com/webclienttest.bluescape.com/share/big_images_videos/bad-lands.192.4Mb.mp4",
    //           "http://bluescape.dev/zygote/v1/ext": "mp4",
    //           "http://bluescape.dev/zygote/v1/ingestionState": {
    //             "http://bluescape.dev/zygote/v1/ingestionState/timestamp": 1643759202120,
    //             "http://bluescape.dev/zygote/v1/ingestionState/stage": "complete_failure",
    //             "http://bluescape.dev/zygote/v1/ingestionState/errorCode": "ASSET_PROCESSING_UNSUPPORTED_SIZE",
    //             "http://bluescape.dev/zygote/v1/ingestionState/errorMessage": "Video size greater than maximum"
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }

    // This check will end up because of success or failure on the upload
    do {

        try {

            const checkIngestionStatus = await runGraphqlRequest(bluescapeApiParams, requestParamsCheckIngestionStatus);

            const ingestionStatusData = checkIngestionStatus?.['data']?.['data']?.['elements']?.[0] ?? undefined;

            if (ingestionStatusData) {

                // ingestionStatusData Values:
                // processing
                // complete_success
                // complete_failure
                // transferring
                const ingestionStatusValue = ingestionStatusData.ingestionState;

                if (ingestionStatusValue.match('success')) {
                    isUploadFinished = true;
                    isUploadSuccessful = true;
                } else if (ingestionStatusValue.match('failure')) {
                    isUploadFinished = true;
                    // Get the error message, to return it
                    const traitsData = ingestionStatusData['traits'];

                    errorMessage = traitsData?.['http://bluescape.dev/zygote/v1/ingestionState']?.['http://bluescape.dev/zygote/v1/ingestionState/errorMessage'] ?? undefined;

                } else {
                    // Still processing the upload, pause and query again            
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                return (false, 'Error reading ingestion status from API response');
            }
        } catch (error) {
            return (false, error?.message ?? error);
        }


    } while (!isUploadFinished);

    const functionReturnValues = {
        'isUploadSuccessful': isUploadSuccessful,
        'errorMessage': errorMessage
    }

    return functionReturnValues;
}

/**
    * Uploads an asset by URL to the specified (x,y) position
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    *    
    * @param {Object} assetToUploadData - Object containing the data for the asset to upload by URL:
    * @param {string} assetToUploadData.workspaceId - Workspace Id where the asset will be uploaded
    * @param {string} assetToUploadData.assetURL - URL of the asset to upload
    * @param {Object} assetToUploadData.assetDimensions - Object with width and height of the asset to upload
    * @param {number} assetToUploadData.assetDimensions.width - Width of the asset
    * @param {number} assetToUploadData.assetDimensions.height - Height of the asset
    * 
    * @param {string} assetToUploadData.assetType - Type of the asset to upload 
    * @param {string} assetToUploadData.assetExtension - Extension of the asset to upload 
    * @param {string} assetToUploadData.assetTitle - Title of the asset to upload 
    * @param {string} assetToUploadData.canvasId - ID of the Canvas where we will upload the asset
    * @param {number} assetToUploadData.x - x coordinate for position where the asset will be uploaded
    * @param {number} assetToUploadData.y - y coordinate for position where the asset will be uploaded 
    * 
    * @returns {Object} Object with the data for the asset attempted to be uploaded and the result of the upload process
    * @returns {Object} object.newAsset - object containing data for the asset that was attempet to be uploaded
    * @returns {('video'|'image'|'document')} object.newAsset.[assetType] - Type of the newly created asset: 'video', 'image' or 'document'. It contains the id of the created element in the workspace 
    * @returns {string} object.newAsset.[assetType].id - Id of the newly created element
    * @returns {Object} object.newAsset.uploadResult - oject with data for the result of the upload process
    * @returns {('success'|'failure)} object.newAsset.uploadResult.result - result of the upload process: 'success' or 'failure'
    * @returns {string} object.newAsset.uploadResult.assetPath - path or full URL of the asset
*/

export default async function uploadAssetByUrlIntoCanvasGraphql(bluescapeApiParams, assetToUploadData) {

    // The coordinates in 'transform' are absolute coordinates in the workspace
    const assetCreationInputParams = {
        "workspaceId": assetToUploadData.workspaceId,
        "input": {
            "sourceUrl": assetToUploadData.assetURL,
            "transform": {
                "x": assetToUploadData.x,
                "y": assetToUploadData.y
            },
            "width": assetToUploadData.assetDimensions.width,
            "height": assetToUploadData.assetDimensions.height,
            "title": assetToUploadData.assetTitle
        }
    };

    const mutationValuesParams = {
        'assetType': assetToUploadData.assetType,
        'assetExtension': assetToUploadData.assetExtension,
        'assetCreationParams': assetCreationInputParams
    }

    // Add the specific fields for each mutation
    const mutationValues = await getMutationValuesGraphql(mutationValuesParams);
    const mutationName = mutationValues.mutationName;
    const createInputType = mutationValues.createInputType;
    const assetCreationParams = mutationValues.assetCreationParams;

    const assetCreationMutation = `mutation createNewAsset($workspaceId: String!, $input: ${createInputType}!){
        ${mutationName}(workspaceId: $workspaceId, input: $input) {
            __typename            
            ${assetToUploadData.assetType.toLowerCase()} {id}

        }
    }`

    const requestParamsCreateAndUploadAsset = {
        'requestQuery': assetCreationMutation,
        'requestVariables': assetCreationParams
    }

    console.log(`  Starting upload of: ${assetToUploadData.assetURL}`);
    const assetCreationRequest = await runGraphqlRequest(bluescapeApiParams, requestParamsCreateAndUploadAsset);

    if (assetCreationRequest.status === 200) {

        // Check ingestion Status, to verify if the asset uploaded correctly or reported an upload error 
        const newElementId = assetCreationRequest?.['data']?.['data']?.[`create${assetToUploadData.assetType}`]?.[assetToUploadData.assetType.toLowerCase()]?.['id'] ?? undefined;

        if (!newElementId) throw `Could not get the newElementId value for ${assetToUploadData.assetURL}`;

        // using shorthand notation for 'newElementId': newElementId -> newElementId
        const checkUrlUploadParams = {
            'workspaceId': assetToUploadData.workspaceId,
            newElementId
        }

        const ingestionStatusCheckValues = await checkUrlUploadIngestionStatusGraphql(bluescapeApiParams, checkUrlUploadParams);
        const isUploadSuccessful = ingestionStatusCheckValues.isUploadSuccessful;
        const errorMessage = ingestionStatusCheckValues.errorMessage;

        const uploadResult = {
            'newAsset': {
                [assetToUploadData.assetType]: {
                    "id": newElementId
                },
                'uploadResult': {}
            }
        };

        if (isUploadSuccessful === true) {
            console.log(`  Finished successful upload of ${assetToUploadData.assetURL}`);

            // Label the upload as a sucess
            uploadResult.newAsset.uploadResult = {
                'result': 'success',
                'assetPath': assetToUploadData.assetURL
            }

        } else {
            console.error(`  Failure uploading this asset: ${assetToUploadData.assetURL}. Error reported: ${errorMessage}`);

            // Label the upload as a failure
            uploadResult.newAsset.uploadResult = {
                'result': 'failure',
                'assetPath': assetToUploadData.assetURL
            }

        }

        return uploadResult;
    }

    return assetCreationRequest.data;
}

/** 
    * Checks upload by URL ingestion status,using REST APIs
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    *    
    * @param {Object} functionParams - Object with the parameters of the request to run
    * @param {string} functionParams.workspaceId - Workspace Id where we are uploading assets
    * @param {string} functionParams.newElementId - ID of the new element that was created by the upload
    * 
    * @returns {Object} Object with the results of the function execution  
    * @returns {Boolean} object.isUploadSuccessful - true if the upload finished with a successful status, false if not
    * @returns {string} object.errorMessage - Error message in case the upload was not successful 
*/
export async function checkUrlUploadIngestionStatusRest(bluescapeApiParams, functionParams) {

    let isUploadFinished = false;
    let errorMessage = `The object was not uploaded correctly, the upload operation timed out.`; // Default value
    let isUploadSuccessful = false;

    const requestParamsCheckIngestionStatus = {
        'apiEndpoint': `/workspaces/${functionParams.workspaceId}/elements/${functionParams.newElementId}`,
        'requestMethod': 'GET',
        'dataLoad': {}
    }

    // Example of failure for file too big:
    // "data": {
    //     "elements": [
    //       {
    //         "ingestionState": "complete_failure",
    //         "traits": {
    //           "http://bluescape.dev/zygote/v1/searchTitle": "testVideo.mp4",
    //           "http://bluescape.dev/zygote/v1/title": "testVideo.mp4",
    //           "http://bluescape.dev/zygote/v1/thumbExt": "png",
    //           "http://bluescape.dev/zygote/v1/originalUrl": "https://s3.amazonaws.com/webclienttest.bluescape.com/share/big_images_videos/bad-lands.192.4Mb.mp4",
    //           "http://bluescape.dev/zygote/v1/ext": "mp4",
    //           "http://bluescape.dev/zygote/v1/ingestionState": {
    //             "http://bluescape.dev/zygote/v1/ingestionState/timestamp": 1643759202120,
    //             "http://bluescape.dev/zygote/v1/ingestionState/stage": "complete_failure",
    //             "http://bluescape.dev/zygote/v1/ingestionState/errorCode": "ASSET_PROCESSING_UNSUPPORTED_SIZE",
    //             "http://bluescape.dev/zygote/v1/ingestionState/errorMessage": "Video size greater than maximum"
    //           }
    //         }
    //       }
    //     ]
    //   }
    // }

    do {
        const checkIngestionStatus = await runRestRequest(bluescapeApiParams, requestParamsCheckIngestionStatus);

        const ingestionStatusData = checkIngestionStatus?.['data']?.['data'] ?? undefined;

        if (ingestionStatusData) {

            // ingestionStatusData Values:
            // processing
            // complete_success
            // complete_failure
            // transferring
            const ingestionStatusValue = ingestionStatusData.ingestionState;

            if (ingestionStatusValue.match('success')) {
                isUploadFinished = true;
                isUploadSuccessful = true;
            } else if (ingestionStatusValue.match('failure')) {
                isUploadFinished = true
                // Get the error message, to return it
                const traitsData = ingestionStatusData['traits'];

                errorMessage = traitsData?.['http://bluescape.dev/zygote/v1/ingestionState']?.['http://bluescape.dev/zygote/v1/ingestionState/errorMessage'] ?? undefined;

            } else {
                // Still processing the upload, pause and query again            
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            return (false, 'Error reading ingestion status from API response');
        }

    } while (!isUploadFinished);

    const functionReturnValues = {
        'isUploadSuccessful': isUploadSuccessful,
        'errorMessage': errorMessage
    }

    return functionReturnValues;
}

/** 
    * Returns the values for the zygote's asset format type, for REST APIs
    * @param {Object} functionParams - Object with the parameters of the request to run
    * @param {string} functionParams.assetType - Type of the asset to upload
    * @param {string} functionParams.assetExtension - Extension of the asset to upload
    * @param {Object} functionParams.zygoteBody - Object with the zygote properties
    *  
    * @returns {Object} zygoteBody - Modified zygoteBody object, with the new <assetType> format value
*/
export async function getZygoteValuesRest(functionParams) {

    const zygoteValues = functionParams;
    switch (zygoteValues.assetType) {
        case 'Image':
            zygoteValues.zygoteBody.imageFormat = zygoteValues.assetExtension
            break
        case 'Document':
            zygoteValues.zygoteBody.documentFormat = zygoteValues.assetExtension
            break
        case 'Video':
            zygoteValues.zygoteBody.videoFormat = zygoteValues.assetExtension
            break
        default:
            console.error(`Asset type "${zygoteValues.assetType}" is not recognized, check its name.`)
    }

    return zygoteValues.zygoteBody;

}

/*
    * Uploads an asset by URL, to the position (x,y) using REST APIs
    * @param bluescapeApiParams: object containing the data for executing Bluescape APIs:
    *   {
    *       token: Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    *       apiPortal: URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    *       apiVersion: Version of the APIs to be executed, e.g.: "v3"
    *   } 
    * @param assetToUploadData: object containing the data for the asset to upload by URL:
    *   { 
    *       workspaceId: workspace Id where the asset will be uploaded
    *       assetURL : URL of the asset to upload
    *       assetData : object with width and height of the asset to upload
    *       assetType : type of the asset to upload 
    *       assetExtension : extension of the asset to upload 
    *       assetTitle : title of the asset to upload 
    *       canvasId : ID of the Canvas where we will upload the asset
    *       x : X coordinate for position where the asset will be uploaded
    *       y : Y coordinate for position where the asset will be uploaded
    *   }
    * @returns assetCreationRequest.data : object with the result from the API call to upload the asset
*/
export async function uploadAssetByUrlIntoCanvasRest(bluescapeApiParams, assetToUploadData) {

    // Generic zygote for upload by URL
    const zygoteBodyInputParams = {
        'type': assetToUploadData.assetType,
        'title': assetToUploadData.assetTitle,
        'transform': {
            'x': assetToUploadData.x,
            'y': assetToUploadData.y,
            'scale': 1
        },
        'sourceUrl': assetToUploadData.assetURL,
        'width': assetToUploadData.assetData.width,
        'height': assetToUploadData.assetData.height,
    };

    const uploadValuesParams = {
        'assetType': assetToUploadData.assetType,
        'assetExtension': assetToUploadData.assetExtension,
        'assetCreationParams': zygoteBodyInputParams
    }

    const zygoteBody = await getUploadValuesRest(uploadValuesParams);



    // // Add the specific fields for the upload of each type of asset
    // switch (assetToUploadData.assetType) {
    //     case 'Image':
    //         zygoteBodyInputParams.imageFormat = assetToUploadData.assetExtension;
    //         break
    //     case 'Document':
    //         zygoteBodyInputParams.documentFormat = assetToUploadData.assetExtension;
    //         break
    //     case 'Video':
    //         zygoteBodyInputParams.videoFormat = assetToUploadData.assetExtension;
    //         break
    //     default:
    //         console.error(`Asset type "${zygoteBody.assetType}" is not recognized, check its name.`)
    // }

    const requestParamsCreateAndUploadAsset = {
        'apiEndpoint': `/workspaces/${assetToUploadData.workspaceId}/elements`,
        'requestMethod': 'POST',
        'dataLoad': zygoteBody
    }

    console.log(` Starting upload of: ${assetToUploadData.assetURL}`);
    const assetCreationRequest = await runRestRequest(bluescapeApiParams, requestParamsCreateAndUploadAsset);

    if (assetCreationRequest.status === 200) {

        // Check ingestion Status, to verify if the asset uploaded correctly or reported an upload error 
        const newElementId = assetCreationRequest?.['data']?.['data']?.[assetToUploadData.assetType.toLowerCase()]?.['id'] ?? undefined;

        if (!newElementId) throw `Could not get the newElementId value for ${assetToUploadData.assetURL}`;

        // using shorthand notation for 'newElementId': newElementId -> newElementId
        const checkUrlUploadParams = {
            'workspaceId': assetToUploadData.workspaceId,
            newElementId
        }

        const ingestionStatusCheckValues = await checkUrlUploadIngestionStatusRest(bluescapeApiParams, checkUrlUploadParams);

        const uploadResult = {
            'newAsset': {
                [assetToUploadData.assetType]: {
                    "id": newElementId
                },
                'uploadResult': {}
            }
        };

        if (ingestionStatusCheckValues.isUploadSuccessful === true) {
            console.log(`  Finished successful upload of ${assetToUploadData.assetURL}`);

            // Label the upload as a sucess
            uploadResult.newAsset.uploadResult = {
                'result': 'success',
                'assetPath': assetToUploadData.assetURL
            }
        } else {
            console.error(`  Failure uploading ${assetToUploadData.assetURL}. Error reported: ${ingestionStatusCheckValues.errorMessage}`);

            // Label the upload as a failure
            uploadResult.newAsset.uploadResult = {
                'result': 'failure',
                'assetPath': assetToUploadData.assetURL
            }

        }

        return uploadResult;
    }

    return assetCreationRequest.data;
}


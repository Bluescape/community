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
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

/**
    * STEP 2 of upload from local: upload the asset into the storage system (S3)
    * @param {Object} functionParams - Object containing the data for executing Bluescape APIs:
    * @param {Object} functionParams.uploadData - Object with the credentials to upload the asset into the storage system: 
    * @param {Object} functionParams.uploadData.fields - Object with signed URL fields for the upload to S3
    * @param {string} functionParams.uploadData.url - Url for the S3 upload
    * @param {string} functionParams.assetFullPath - Full path to the asset to upload
    * 
    * @returns {Object} Object with the response body of the API call for the upload to the bucket 
*/

async function uploadToBucket(functionParams) {

    // return new Promise(function (resolve, reject) {

    let dataForm = new FormData();
    dataForm.append('key', functionParams.uploadData.fields.key);
    dataForm.append('bucket', functionParams.uploadData.fields.bucket);
    dataForm.append('X-Amz-Algorithm', functionParams.uploadData.fields['X-Amz-Algorithm']);
    dataForm.append('X-Amz-Credential', functionParams.uploadData.fields['X-Amz-Credential']);
    dataForm.append('X-Amz-Date', functionParams.uploadData.fields['X-Amz-Date']);
    dataForm.append('Policy', functionParams.uploadData.fields.Policy);
    dataForm.append('X-Amz-Signature', functionParams.uploadData.fields['X-Amz-Signature']);
    dataForm.append('file', fs.createReadStream(functionParams.assetFullPath),
        { knownLength: fs.statSync(functionParams.assetFullPath).size }
    );

    const uploadServiceURL = functionParams.uploadData.url;

    const uploadAnswer = await axios.post(uploadServiceURL, dataForm, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            ...dataForm.getHeaders(),
            'Content-Length': dataForm.getLengthSync(),
        },
    })

    return uploadAnswer;

}

/**
    * STEP 3 of upload from local: links the uploaded asset to the zygote created in step 1 using GraphQL APIs. 
    * If an error happened in step 2, then add error to the mutation to make the zygote display error message and Cancel button
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    * 
    * @param {Object} processData - object with the data to process in this function:
    * @param {string} processData.workspaceId - Workspace Id of workspace where the asset will be uploaded
    * @param {string} processData.newElementId - ID of the new element that was created by the upload
    * @param {number} processData.errorStatusCode - Error status ID to report (can be empty)
    * @param {string} processData.errorMessage - Error message to report (can be empty)
    *  
    * @returns {boolean} true or triggers error message
*/

async function linkUploadedAssetToZygoteGraphql(bluescapeApiParams, processData) {

    const linkZygoteParams = {
        'workspaceId': processData.workspaceId,
        'uploadId': processData.newElementId
    }

    let errorDataToReport = '';

    if (processData.errorStatusCode !== '') {
        errorDataToReport = `
            errorCode: "${processData.errorStatusCode}",
            errorMessage: "${processData.errorMessage}"
        `
    }

    const linkZygoteMutation = `mutation linkUploadToZygote($workspaceId: String! $uploadId: String!) {
        processAsset( workspaceId:$workspaceId id:$uploadId input:{ ${errorDataToReport}
        })
    }`

    const requestParamsLinkZygote = {
        'requestQuery': linkZygoteMutation,
        'requestVariables': linkZygoteParams
    }

    // This mutation is boolean, returns true (run correctly) or false (issue happened when running the mutation)
    const requestAnswer = await runGraphqlRequest(bluescapeApiParams, requestParamsLinkZygote);
    const requestAnswerValue = requestAnswer?.data?.data?.processAsset ?? false;
    if (requestAnswerValue !== true) {
        throw new Error(`Error in linkUploadedAssetToZygote for element ID ${processData.newElementId}`);
    }

    return true;
}

/** 
    * Uploads asset from local drive into a Canvas using GraphQL APIs.
    * STEP 1 of the upload from local process.
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    *   
    * @param {Object} assetToUploadData - object containing the data for the asset to upload from the local system
    * @param {string} assetToUploadData.workspaceId - Workspace Id of workspace where the asset will be uploaded
    * @param {string} assetToUploadData.assetFullPath - full path to the asset to upload     
    * @param {Object} assetToUploadData.assetData - object with width and height of the asset to upload
    * @param {string} assetToUploadData.assetType - type of the asset to upload
    * @param {string} assetToUploadData.assetExtension - extension of the asset to upload
    * @param {string} assetToUploadData.assetTitle - title of the asset to upload 
    * @param {string} assetToUploadData.canvasId - ID of the Canvas where we will upload the asset
    * @param {number} assetToUploadData.x - x coordinate for position where the asset will be uploaded
    * @param {number} assetToUploadData.y - y coordinate for position where the asset will be uploaded
    * 
    * @returns {Object} Object with the data for the asset attempted to be uploaded and the result of the upload process
    * @returns {Object} object.newAsset - object containing data for the asset that was attempted to be uploaded
    * @returns {string} object.newAsset.[assetType] - Type of the newly created asset: 'video', 'image' or 'document'. It contains the id of the created element in the workspace 
    * @returns {string} object.newAsset.[assetType].id - Id of the newly created element
    * @returns {Object} object.newAsset.uploadResult - object with data for the result of the upload process
    * @returns {string} object.newAsset.uploadResult.result - result of the upload process: 'success' or 'failure'
    * @returns {string} object.newAsset.uploadResult.assetPath - path or full URL of the asset
*/

export default async function uploadAssetFromLocalIntoCanvasGraphql(bluescapeApiParams, assetToUploadData) {

    // The coordinates in 'transform' are absolute coordinates in the workspace
    const assetCreationInputParams = {
        'workspaceId': assetToUploadData.workspaceId,
        'input': {
            'title': assetToUploadData.assetTitle,
            'filename': assetToUploadData.assetTitle,
            'transform': {
                'x': assetToUploadData.x,
                'y': assetToUploadData.y
            },
            'width': assetToUploadData.assetDimensions.width,
            'height': assetToUploadData.assetDimensions.height,
        }
    };

    const mutationValuesParams = {
        'assetType': assetToUploadData.assetType,
        'assetExtension': assetToUploadData.assetExtension,
        'assetCreationParams': assetCreationInputParams
    }

    const mutationValues = await getMutationValuesGraphql(mutationValuesParams);
    const mutationName = mutationValues.mutationName;
    const createInputType = mutationValues.createInputType;
    const assetCreationParams = mutationValues.assetCreationParams;

    const assetCreationMutation = `mutation createNewAssetFromLocal($workspaceId: String!, $input: ${createInputType}!){
        newAsset: ${mutationName}(workspaceId: $workspaceId, input: $input) {
            __typename       
            content{ uploadId url fields}   
            ${assetToUploadData.assetType.toLowerCase()} {id width height ingestionState}

        }
    }`

    const requestParamsCreateZygote = {
        'requestQuery': assetCreationMutation,
        'requestVariables': assetCreationParams
    }

    /* The Upload from local drive is a 3 steps process:
        1: Create a zygote or placeholder in the workspace. This process returns signed URLs to upload the asset to S3
        2: Use the signed URLs to upload the asset, form your local drive, to S3 
        3: Link the workspace zygote to the upload to S3. This steps depends on the uploadto S3 result:
            A) If the upload to S3 is successful, link the zygote to the uploaded asset in S3: the upload has finished successfully. 
            B) If the upload to S3 failed, then link the sygite with the uploaded asset to S3, passing the error message.
                - The zygote in hte workdpace will display an error message and a "Cancel" button to remove the zygote. 
                - Otherwise the zygote will display an "uploading" message until it times out 
    */

    // UPLOAD FROM LOCAL - STEP 1/3 : Create zygote (placeholder) for the asset in the workspace
    const createZygoteAnswer = await runGraphqlRequest(bluescapeApiParams, requestParamsCreateZygote);

    const zygoteData = createZygoteAnswer.data.data;
    const newObjectID = zygoteData?.['newAsset']?.['content']?.['uploadId'];

    const zygoteUploadCredentials = zygoteData?.['newAsset']?.['content'];

    const paramsForUploadToBucket = {
        'uploadData': zygoteUploadCredentials,
        'assetFullPath': assetToUploadData.assetFullPath
    }

    const uploadResult = {
        'newAsset': {
            [assetToUploadData.assetType]: {
                'id': newObjectID
            },
            'uploadResult': {}
        }
    };

    try {
        // UPLOAD FROM LOCAL - STEP 2/3 : upload your asset to the storage container
        const step2Answer = await uploadToBucket(paramsForUploadToBucket);

        if (step2Answer.status === 204) {
            const processData = {
                "workspaceId": assetToUploadData.workspaceId,
                "newElementId": newObjectID,
                "errorStatusCode": '',
                "errorMessage": ''

            }
            // UPLOAD FROM LOCAL - STEP 3/3 : if step 2/3 is successful, link the uploaded asset to the zygote (placeholder)
            linkUploadedAssetToZygoteGraphql(bluescapeApiParams, processData);
            console.log(`  Upload successfully finished for ${assetToUploadData.assetFullPath}`);

            // Label the upload as a sucess
            uploadResult.newAsset.uploadResult = {
                'result': 'success',
                'assetPath': assetToUploadData.assetFullPath
            }

        } else {
            throw `   Error uploading ${assetToUploadData.assetFullPath}. Response status: ${response.status}`
        }

        return uploadResult;
    } catch (error) {
        const errorStatus = error?.response?.status ?? 'Status code not returned';
        var errorMessage = error?.response?.data ?? error?.message;

        // Remove characters that can break the GraphQL requests, e.g: double quotes
        if (errorMessage.match(/"/)) {
            errorMessage = errorMessage.replace(/\"/ig, "'").replace(/\n/, '');
        }

        console.error(`  uploadfrom Local Drive. Failure uploading ${assetToUploadData.assetFullPath} . Error reported: ${errorMessage}`);

        // UPLOAD FROM LOCAL - STEP 3/3 : if step 2/3 fails, link the uploaded asset to the zygote (placeholder) with an error message

        // Send error to the last step, for the zygote to display an error message and "Cancel" button,
        // so it does have to wait for a timeout for the "uploading" status
        const processData = {
            'workspaceId': assetToUploadData.workspaceId,
            'newElementId': newObjectID,
            'errorStatusCode': errorStatus,
            'errorMessage': errorMessage
        }
        linkUploadedAssetToZygoteGraphql(bluescapeApiParams, processData);

        // Label the upload as a failure
        uploadResult.newAsset.uploadResult = {
            'result': 'failure',
            'assetPath': assetToUploadData.assetFullPath
        }

        return uploadResult;
    };
}

/** 
    * STEP 3 of upload from local: links the uploaded asset to the zygote created in step 1
    * If an error happened in step 2, add error to the mutation, to make the zygote display error message and Cancel button
    * 
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    * 
    * @param {Object} processData - object with the data to process in this function:
    * @param {string} processData.workspaceId - Workspace Id of workspace where the asset will be uploaded
    * @param {string} processData.newElementId - ID of the new element that was created by the upload
    * @param {number} processData.errorStatusCode - error status ID to report (can be empty)
    * @param {string} processData.errorMessage - error message to report (can be empty)
    * 
    * @returns true or triggers error message
*/

async function linkUploadedAssetToZygoteRest(bluescapeApiParams, processData) {

    let errorDataToReport = {};

    if (processData.errorStatusCode !== '') {
        errorDataToReport = {
            'errorCode': processData.errorStatusCode.toString(),
            'errorMessage': `${processData.errorMessage}`
        }
    }

    const requestParamsLinkZygote = {
        'apiEndpoint': `/workspaces/${processData.workspaceId}/assets/uploads/${processData.newElementId}`,
        'requestMethod': 'PUT',
        'dataLoad': errorDataToReport
    }

    await runRestRequest(bluescapeApiParams, requestParamsLinkZygote)
        .then(answer => {
            if (answer !== undefined) {
                var statusRequest = answer.status;
                if (statusRequest == 204) {
                    return true;
                }
            }
        })
        .catch(error => {
            console.error(`Error in linkUploadedAssetToZygoteREST for element ID ${processData.newElementId} `)
            console.error("status:", error.errorStatusCode);
            console.error(`PUT call Error: ${JSON.stringify(error, null, '   ')}`);
        });

    return true;
}

/** 
    * Uploads asset from local drive into a Canvas, using REST APIs
    * @param {Object}bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    * 
    * @param {Object} assetToUploadData - Object containing the data for the asset to upload from the local system:
    * @param {string} assetToUploadData.workspaceId - Workspace Id of workspace where the asset will be uploaded
    * @param {string} assetToUploadData.assetFullPath - Full path to the asset to upload     
    * @param {Object} assetToUploadData.assetData - Object with width and height of the asset to upload
    * @param {number} assetToUploadData.assetData.width - Width of the asset
    * @param {number} assetToUploadData.assetData.height - Height of the asset
    * @param {string} assetToUploadData.assetType - Type of the asset to upload
    * @param {string} assetToUploadData.assetExtension - Extension of the asset to upload
    * @param {string} assetToUploadData.assetTitle - Title of the asset to upload 
    * @param {string} assetToUploadData.canvasId - Id of the Canvas where we will upload the asset
    * @param {number} assetToUploadData.x : X coordinate for position where the asset will be uploaded
    * @param {number} assetToUploadData.y : Y coordinate for position where the asset will be uploaded
    * 
    * @returns {Object} API execution response body, the data of the created zygote for the upload of the asset)
*/

export async function uploadAssetFromLocalIntoCanvasRest(bluescapeApiParams, assetToUploadData) {

    // UPLOAD FROM LOCAL - STEP 1/3 : Create zygote (placeholder) for the asset in the workspace

    const assetCreationInputParams = {
        'type': assetToUploadData.assetType,
        'title': assetToUploadData.assetTitle,
        'transform': {
            'x': assetToUploadData.x,
            'y': assetToUploadData.y,
            'scale': 1
        },
        'width': assetToUploadData.assetData.width,
        'height': assetToUploadData.assetData.height,
        'filename': assetToUploadData.assetTitle
    };

    const uploadValuesParams = {
        'assetType': assetToUploadData.assetType,
        'assetExtension': assetToUploadData.assetExtension,
        'assetCreationParams': assetCreationInputParams
    }

    const zygoteBody = await getUploadValuesRest(uploadValuesParams);

    const requestParamsCreateZygote = {
        'apiEndpoint': `/workspaces/${assetToUploadData.workspaceId}/elements`,
        'requestMethod': 'POST',
        'dataLoad': zygoteBody
    }

    const zygoteResponse = await runRestRequest(bluescapeApiParams, requestParamsCreateZygote);

    // This is the same value as data.image.id
    const newObjectId = zygoteResponse?.data?.data?.content?.uploadId;

    const zygoteUploadCredentials = zygoteResponse?.data?.data?.content;

    // UPLOAD FROM LOCAL - STEP 2/3 : upload your asset to the storage container
    const paramsForUploadToBucket = {
        'uploadData': zygoteUploadCredentials,
        'assetFullPath': assetToUploadData.assetFullPath,
        'assetType': assetToUploadData.assetType,
        'assetExtension': assetToUploadData.assetExtension
    }

    const uploadResult = {
        'newAsset': {
            [assetToUploadData.assetType]: {
                "id": newObjectId
            },
            'uploadResult': {}
        }
    };

    try {
        // UPLOAD FROM LOCAL - STEP 2/3 : upload your asset to the storage container
        const step2Answer = await uploadToBucket(paramsForUploadToBucket);
        if (step2Answer.status === 204) {
            const processData = {
                "workspaceId": assetToUploadData.workspaceId,
                "newElementId": newObjectId,
                "errorStatusCode": '',
                "errorMessage": ''

            }
            // UPLOAD FROM LOCAL - STEP 3/3 : if step 2/3 is successful, link the uploaded asset to the zygote (placeholder)
            linkUploadedAssetToZygoteRest(bluescapeApiParams, processData);
            console.log(`  Upload successfully finished for ${assetToUploadData.assetFullPath}`);

            // Label the upload as a sucess
            uploadResult.newAsset.uploadResult = {
                'result': 'success',
                'assetPath': assetToUploadData.assetFullPath
            }

        } else {
            throw `   Error uploading ${assetToUploadData.assetFullPath}. Response status: ${response.status}`
        }

        return uploadResult;
    } catch (error) {
        const errorStatus = error?.response?.status ?? 'Status code not returned';
        var errorMessage = error?.response?.data ?? error?.message;

        // Remove characters that can break the GraphQL requests, e.g: double quotes
        if (errorMessage.match(/"/)) {
            errorMessage = errorMessage.replace(/\"/ig, "'").replace(/\n/, '');
        }

        console.error(`  uploadfrom Local Drive. Failure uploading ${assetToUploadData.assetFullPath} . Error reported: ${errorMessage}`);

        // UPLOAD FROM LOCAL - STEP 3/3 : if step 2/3 fails, link the uploaded asset to the zygote (placeholder) with an error message

        // Send error to the last step, for the zygote to display an error message and "Cancel" button,
        // so it does have to wait for a timeout for the "uploading" status
        const processData = {
            'workspaceId': assetToUploadData.workspaceId,
            'newElementId': newObjectId,
            'errorStatusCode': errorStatus,
            'errorMessage': errorMessage
        }
        linkUploadedAssetToZygoteRest(bluescapeApiParams, processData);

        // Label the upload as a failure
        uploadResult.newAsset.uploadResult = {
            'result': 'failure',
            'assetPath': assetToUploadData.assetFullPath
        }

        return uploadResult;
    };
}


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

import ffprobe from 'ffprobe-client';
import probe from 'probe-image-size';
import fs from 'fs';
import { runRestRequest } from '../bluescape-modules/bluescapeApis.js';


/**
    * Gets the dimensions (width and height) of the asset to upload: image or video.
    * For the videos, it needs ffprobe to be installed (please see details in README).
    * @param {Object} functionParams - object with the parameters of the request to run
    * @param {string} functionParams.uploadMethod - uplaod method: URL or LOCAL
    * @param {string} functionParams.assetType - type of the asset to upload
    * @param {string} functionParams.canvasElement - object with the properties of the canvas, also stores the next asset insertion (x,y) coordinates
    * @param {string} functionParams.assetLocation - URL or full path to the asset to upload
    * @param {string} functionParams.ffprobePath - Path to local install of ffprobe
    * @param {number} functionParams.defaultWidth - default width
    * @param {number} functionParams.defaultHeight - deafult height
    * 
    * @return {Object} object with the values to return
    * @return {number} object.assetWidth - calculated width of the asset to upload 
    * @return {number} object.assetHeight - calculated height of the asset to upload  
*/
export async function getAssetDimensions(functionParams) {

    let assetWidth;
    let assetHeight;

    if (functionParams.assetType === 'Video') {
        try {
            const probeInfo = await probeVideoDimensions(functionParams.ffprobePath, functionParams.assetLocation);
            assetWidth = probeInfo.width;
            assetHeight = probeInfo.height;

        } catch (error) {
            console.error(`ERROR: Error trying to get dimensions for video. Asset: ${functionParams.assetLocation}`);
            console.error(error);
        }
    } else {

        if (functionParams.uploadMethod === 'LOCAL') {
            if (functionParams.assetType === 'Image') {
                const readFileSyncData = fs.readFileSync(functionParams.assetLocation);
                const fileData = probe.sync(readFileSyncData);

                assetHeight = fileData.height;
                assetWidth = fileData.width;
            }

        } else { // URL upload

            if (functionParams.assetType === 'Image') {
                const fileInUrlData = await probe(functionParams.assetLocation);
                assetHeight = fileInUrlData.height;
                assetWidth = fileInUrlData.width;
            }
        }
    }

    const functionReturnValues = {
        'assetFileFullPath': functionParams.assetLocation,
        'assetDimensions': {
            'width': assetWidth ?? functionParams.defaultWidth,
            'height': assetHeight ?? functionParams.defaultHeight
        },
        ...functionParams
    }

    return functionReturnValues
}

/**
    * Returns the values for the mutation to create the asset, and the modified set of parameters for that mutation using GraphQL APIs.
    * @param {Object} functionParams - Object containing the data for this function: 
    * @param {string} functionParams.assetType - Type of the asset to upload
    * @param {string} functionParams.assetExtension - Extension of the asset to upload
    * @param {Object} functionParams.assetCreationParams - Parameters for the mutation
    * 
    * @returns {Object} Object with the values to return
    * @returns {string} object.mutationName - Name of the mutation to execute, it depends on type of asset to upload
    * @returns {string} object.createInputType - Type to assign to the creation parameters, it depends on type of asset to upload
    * @returns {Object} object.assetCreationParams - Object with modified set of parameters, it depends on type of asset to upload
*/

export async function getMutationValuesGraphql(functionParams) {
    let mutationName = '';
    let createInputType = '';

    switch (functionParams.assetType) {
        case 'Image':
            mutationName = 'createImage';
            createInputType = 'CreateImageInput';
            functionParams.assetCreationParams.input.imageFormat = functionParams.assetExtension;
            break
        case 'Document':
            mutationName = 'createDocument';
            createInputType = 'CreateDocumentInput';
            functionParams.assetCreationParams.input.documentFormat = functionParams.assetExtension;
            break
        case 'Video':
            mutationName = 'createVideo';
            createInputType = 'CreateVideoInput';
            functionParams.assetCreationParams.input.videoFormat = functionParams.assetExtension;
            break
        default:
            console.error(`Asset type "${functionParams.assetType}" is not recognized, check its name.`);
    }

    const functionReturnValues = {
        'mutationName': mutationName,
        'createInputType': createInputType,
        'assetCreationParams': functionParams.assetCreationParams
    }

    return functionReturnValues;
}

/**
    * Validates the extension of the asset to upload (URL or full path to file), to check if it is one of the allowed ones
    * @param {array} assetsArray - array of assets to inspect
    * 
    * @returns {array} array of valid assets. Each element is and array of objects containing: fileName, assetType, assetExtension. These values
    *  will be used to create the requests for the assets upload: 
    * @returns {string} arrayElement.assetName - name of the asset
    * @returns {string} arrayElement.assetType - type of the asset to upload: 'Image', 'Document' or 'Video'
    * @returns {string} arrayElement.assetExtension - extension of the asset to upload
    * @returns {string} arrayElement.assetLocation - name of the asset, used later
*/
export async function filterAndPreProcessAssets(assetsArray) {

    let listOfValidFiles = [];
    const fileExtensionRegex = /\.[a-zA-Z0-9]+$/;

    for (let assetName of assetsArray) {
        // const assetName = assetsArray[i];

        // Assumption: the type is the extension of the filename, it is the last part of the URL: '.jpg', '.docx', '.pdf'
        if (assetName.match(fileExtensionRegex)) {
            const assetExtension = assetName.match(fileExtensionRegex)[0].toLowerCase().substring(1);

            // Check the extension against allowed types for upload
            const imageTypeRegex = /(jpeg|jpg|gif|png|tiff|tif)/;
            const documentTypeRegex = /(doc|docx|ppt|pptx|xls|xlsx|pdf)/;
            const videoTypeRegex = /(mp4|mov|m4v)/;

            let assetType = '';
            if (assetExtension.match(imageTypeRegex)) {
                assetType = 'Image';
            } else if (assetExtension.match(documentTypeRegex)) {
                assetType = 'Document';
            } else if (assetExtension.match(videoTypeRegex)) {
                assetType = 'Video';
            } else {
                console.error(`ERROR: extension ".${assetExtension}" is not an allowed format to upload for this asset: ${assetName}`)
            }

            // Using shorthand notation: "assetName": assetName, -> assetName
            // Same for assetType and assetExtension
            if (assetType !== '') {
                const fileData = {
                    assetName,
                    assetType,
                    assetExtension,
                    'assetLocation': assetName
                }

                // Add the asset to the list of valid assets
                listOfValidFiles.push(fileData);
            }
        }
    }

    return listOfValidFiles;
}

/**
    * Get width and height of video provided by URL or local, without having to upload the full video to the workspace.
    * @param {string} ffprobePath - Path to the local install of ffprobe
    * @param {string} urlOrFilename - URL or filename of the video asset to analyze
    * 
    * @returns {number} width - width of the video asset 
    * @returns {number} height - height of the video asset 
*/
export async function probeVideoDimensions(ffprobePath, urlOrFilename) {

    // Adapted from:
    // https://github.com/noblesamurai/get-media-dimensions/blob/c4c6e2e68db1da9d627fe64fb30a0c7912b59596/src/video.js

    // The BSD License
    //
    // Copyright (c) 2020, Andrew Harris
    //
    // All rights reserved.
    //
    // Redistribution and use in source and binary forms, with or without modification,
    // are permitted provided that the following conditions are met:
    //
    // * Redistributions of source code must retain the above copyright notice, this
    //   list of conditions and the following disclaimer.
    //
    // * Redistributions in binary form must reproduce the above copyright notice, this
    //   list of conditions and the following disclaimer in the documentation and/or
    //   other materials provided with the distribution.
    //
    // * Neither the name of the copyright holder nor the names of its
    //   contributors may be used to endorse or promote products derived from
    //   this software without specific prior written permission.
    //
    // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
    // ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
    // WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
    // DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
    // ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    // (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    // LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
    // ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
    // SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

    const metadata = await ffprobe(urlOrFilename, { path: ffprobePath });
    const stream = metadata.streams.find(s => s.codec_type === 'video');
    if (!stream) throw new Error('video stream not found');

    const { rotation, side_data_list: sideDataList = [] } = stream;
    const { rotation: sideDataRotation } = sideDataList.find(sideData => sideData.rotation) || {};
    const rot = rotation || sideDataRotation || 0
    const { width, height, duration = (metadata.format && metadata.format.duration) || 0 } = stream;

    if (duration <= 0) {
        console.log('Duration was not found correctly for the video. Metadata: ', metadata);
        throw new Error(`Duration (${duration}) of video ('${urlOrFilename}') was calculated to be zero or less or not found at all. It may exist on another property or is an invalid video. See logs for metadata.`);
    }

    return Math.abs(rot % 180) === 90
        ? { width: height, height: width }
        : { width, height };
}

/**
    * Calculates the (x,y) coordinate for where the asset will be positioned. This position depends on:
    * - position of last asset
    * - width and height of the asset 
    *
    * @param {Object} functionParams - object containing the data for the execution of this funtion-
    * @param {Object} functionParams.assetData - object with width and height of the asset to upload
    * @param {number} functionParams.assetData.width - width of the asset
    * @param {number} functionParams.assetData.height - height of the asset  
    * @param {Object} functionParams.canvasElement - object with the properties of the canvas, also stores the next asset insertion (x,y) coordinates
    * @param {string} functionParams.canvasElement.id - Canvas Id
    * @param {number} functionParams.canvasElement.canvasX - X position of the Canvas
    * @param {number} functionParams.canvasElement.canvasY - Y position of the Canvas
    * @param {number} functionParams.canvasElement.insertX - X position to upload the next asset
    * @param {number} functionParams.canvasElement.insertY - Y position to upload the next asset
    * @param {number} functionParams.canvasElement.horizontalSpacing - Horizontal spacing between assets
    * @param {number} functionParams.canvasElement.verticalSpacing - Vertical spacing between assets
    * @param {number} functionParams.canvasElement.maximumHeightInRow - Maximum heigh of tallest element in the virtual row where we are adding assets
    * @param {number} functionParams.canvasElement.canvasNewHeight - Height of the canvas after extendid it to accomodate new assets
    * @param {number} functionParams.canvasElement.canvasInitialWidth - Canvas width
    * @param {number} functionParams.canvasElement.canvasInitialHeight - Canvas inititla height at the coment it is created,
    * @param {number} functionParams.canvasElement.topCanvasSpacing - Spacing from the top of the canvas to the first row of assets
    * @param {string} functionParams.canvasId - Id of the Canvas where we will upload the asset
    *   
    * @returns {Object} Object with the values to return
    * @returns {number} object.x - X coordinate for position where the asset will be uploaded
    * @returns {number} object.y - Y coordinate for position where the asset will be uploaded
    * @returns {Object} object.canvasElement - Canvas element with modified values, next point of insertion and canvas height
    * @returns {string} object.canvasElement.id - Canvas Id
    * @returns {number} object.canvasElement.canvasX - X position of the Canvas
    * @returns {number} object.canvasElement.canvasY - Y position of the Canvas
    * @returns {number} object.canvasElement.insertX - X position to upload the next asset
    * @returns {number} object.canvasElement.insertY - Y position to upload the next asset
    * @returns {number} object.canvasElement.horizontalSpacing - Horizontal spacing between assets
    * @returns {number} object.canvasElement.verticalSpacing - Vertical spacing between assets
    * @returns {number} object.canvasElement.maximumHeightInRow - Maximum heigh of tallest element in the virtual row where we are adding assets
    * @returns {number} object.canvasElement.canvasNewHeight - Height of the canvas after extendid it to accomodate new assets
    * @returns {number} object.canvasElement.canvasInitialWidth - Canvas width
    * @returns {number} object.canvasElement.canvasInitialHeight - Canvas inititla height at the coment it is created,
    * @returns {number} object.canvasElement.topCanvasSpacing - Spacing from the top of the canvas to the first row of assets
*/
export async function getPositionForAssetInCanvasGraphql(functionParams) {
    try {
        // These values are calculated as relative positioning to the top-left corner of the Canvas
        let x = functionParams.canvasElement.insertX;
        let y = functionParams.canvasElement.insertY;
        let maximumHeightInRow = functionParams.canvasElement.maximumHeightInRow;

        const assetActualHeight = functionParams.assetData.height;
        const assetActualWidth = functionParams.assetData.width;

        // Check if the asset fits (by width) in the canvas' next point to add the asset.
        // If not, start a new row
        if (x + assetActualWidth > functionParams.canvasElement.canvasInitialWidth) {
            // New row is needed  
            y += functionParams.canvasElement.verticalSpacing + functionParams.canvasElement.maximumHeightInRow;
            x = functionParams.canvasElement.horizontalSpacing;
            maximumHeightInRow = assetActualHeight;

            functionParams.canvasElement.insertX = x + functionParams.canvasElement.horizontalSpacing + assetActualWidth;

        } else {
            functionParams.canvasElement.insertX += functionParams.canvasElement.horizontalSpacing + assetActualWidth;
        }

        // Check for the the "tallest image in the row", to not overlap it in the next row
        maximumHeightInRow = assetActualHeight > maximumHeightInRow ? assetActualHeight : maximumHeightInRow;
        functionParams.canvasElement.maximumHeightInRow = maximumHeightInRow;

        // Check if we need to extend the canvas' bottom to add more assets into the Canvas
        if (y + assetActualHeight > functionParams.canvasElement.canvasNewHeight) {
            // We need to expand Canvas, the bottom, by expanding its height (to make it extend its bottom)

            functionParams.canvasElement.canvasNewHeight += (y + assetActualHeight) - (functionParams.canvasElement.canvasNewHeight) + functionParams.canvasElement.verticalSpacing;

        }

        // Update coordinates for the next asset
        functionParams.canvasElement.insertY = y;

        const functionReturnValues = {
            'x': x,
            'y': y,
            'canvasElement': functionParams.canvasElement
        }

        return functionReturnValues;
    }
    catch (error) {
        console.error('ERROR: getPositionForAssetInCanvas');
        console.error(error?.message ?? error);
    }
}

/** 
    * Calculates the (x,y) coordinate for where the asset will be positioned into an Existing Canvas. 
    * This position depends on:
    * - position of last asset
    * - width and height of the asset 
    * Based on this current asset, it calculates the insertion point for the next asset (insertX,insertY)
    * 
    * @param {Object} functionParams - Object containing the data for the execution of this funtion:
    * @param {Object} functionParams.assetData - Object with width and height of the asset to upload
    * @param {number} functionParams.assetData.width - Asset width 
    * @param {number} functionParams.assetData.height - Asset Height
    * @param {Object} functionParams.canvasElement - Object with the properties of the canvas, also stores the next asset insertion (x,y) coordinates
    * @param {string} functionParams.canvasElement.id - Canvas Id
    * @param {number} functionParams.canvasElement.canvasX - X position of the Canvas
    * @param {number} functionParams.canvasElement.canvasY - Y position of the Canvas
    * @param {number} functionParams.canvasElement.insertX - X position to upload the next asset
    * @param {number} functionParams.canvasElement.insertY - Y position to upload the next asset
    * @param {number} functionParams.canvasElement.horizontalSpacing - Horizontal spacing between assets
    * @param {number} functionParams.canvasElement.verticalSpacing - Vertical spacing between assets
    * @param {number} functionParams.canvasElement.maximumHeightInRow - Maximum height of tallest element in the virtual row where we are adding assets
    * @param {number} functionParams.canvasElement.canvasInitialWidth - Canvas width
    * 
    * @returns {Object} functionReturnValues - Object with the values to return:
    * @returns {number} functionReturnValues.x - X coordinate for position where the asset will be uploaded
    * @returns {number} functionReturnValues.y - Y coordinate for position where the asset will be uploaded
    * @returns {Object} functionReturnValues.canvasElement - Canvas element with modified values: next point of insertion and canvas height
    *  
*/
export async function getPositionForAssetInCanvasRest(functionParams) {
    try {
        let x = functionParams.canvasElement.insertX;
        let y = functionParams.canvasElement.insertY;
        let maximumHeightInRow = functionParams.canvasElement.maximumHeightInRow;

        const assetActualHeight = functionParams.assetData.height;
        const assetActualWidth = functionParams.assetData.width;

        // Check if the asset fits (by width) in the insertion point. If is does not fit, then start a new row
        // We are usign absolute coordinates.
        if (x + assetActualWidth > functionParams.canvasElement.canvasInitialWidth + functionParams.canvasElement.canvasX) {
            // New row is needed  
            y += functionParams.canvasElement.verticalSpacing + functionParams.canvasElement.maximumHeightInRow;
            x = functionParams.canvasElement.canvasX + functionParams.canvasElement.horizontalSpacing;
            maximumHeightInRow = assetActualHeight;

            functionParams.canvasElement.insertX = x + functionParams.canvasElement.horizontalSpacing + assetActualWidth;

        } else {
            functionParams.canvasElement.insertX += functionParams.canvasElement.horizontalSpacing + assetActualWidth;
        }

        // Check for the "tallest image in the row", to not overlap it in the next row
        maximumHeightInRow = assetActualHeight > maximumHeightInRow ? assetActualHeight : maximumHeightInRow;
        functionParams.canvasElement.maximumHeightInRow = maximumHeightInRow;

        // Update coordinates for next asset
        functionParams.canvasElement.insertY = y;

        // (x,y) is the insertion point for this asset, and (insertX,insertY) is the insertion point for the next asset
        const functionReturnValues = {
            x,
            y,
            'canvasElement': functionParams.canvasElement
        }

        return functionReturnValues;
    }
    catch (error) {
        console.error('ERROR running getPositionForAssetInCanvasREST');
        console.error(error?.stack ?? error.stack);
        console.error(error?.message ?? error);
    }
}

/** 
    * Calculates the Y coordinate to start the upload of new assets into the existing canvas, 
    * this based on the elements within the Canvas: finds the one closer to the bottom of the Canvas.
    * and adds its height. This way the new assets will not overlap on top of the existing elements in the Canvas.
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs:
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
  
    * @param {Object} functionParams - Object containing the data for the execution of this funtion:
    * @param {string} functionParams.workspaceId - Workspace Id where we are uploading assets
    * @param {Object} functionParams.canvasId - ID of the Canvas where we will upload the asset
    * @param {Object} functionParams.canvasYCoordinate - Y coordinate of the canvas. It is the starting point for the position of the elements in the canvas
    * @param {Object} functionParams.verticalSpacing - Vertical spacing to separate the bottom of lowest element in the Canvas from the new assets to be uploaded.
    *  
    * @returns {number} Y coordinate to start uploading new assets into the existing Canvas. 
*/
export async function getYCoordinateToUploadNewAssets(bluescapeApiParams, functionParams) {
    let maxY = functionParams.canvasYCoordinate; // To handle the case of empty canvas

    // Get list of elements currently in the Canvas
    const getElementsInCanvasParams = {
        'apiEndpoint': `/workspaces/${functionParams.workspaceId}/elements?canvas=${functionParams.canvasId}`,
        'requestMethod': 'GET',
        'dataLoad': {}
    }

    const getElementsInCanvasAnswer = await runRestRequest(bluescapeApiParams, getElementsInCanvasParams)

    const listOfElements = getElementsInCanvasAnswer?.data?.data;

    if (listOfElements) {
        // We are looking for the highest value of Y, 
        // then we will use the canvas X (plus a horizontal spacing) to start adding new elements
        for (let elementToReview of listOfElements) {

            // We need to calculate the bottom Y coordinate of each element: transform Y + boundingbox.height
            const elementBottomY = elementToReview.transform.y + elementToReview.boundingBox.height;

            if (elementBottomY >= maxY) {
                maxY = elementBottomY;
            }
        }

        let startingY = maxY;

        return startingY

    } else {
        throw `Error getting list of elements for in Canvas for getYCoordinateToUploadNewAssets : ${getElementsInCanvasAnswer.error}`;
    }

}

/** 
    * Returns the values for the REST Request Body to create the asset's zygote
    * @param {Object} functionParams - Object containing the data for this function: 
    * @param {('Image'|'Document'|'Video')} functionParams.assetType - Type of the asset to upload
    * @param {string} functionParams.assetExtension - Extension of the asset to upload
    * @param {Object} functionParams.assetCreationParams - Parameters for the mutation
    *  
    * @returns {Object} functionParams.assetCreationParams - Modified set of parameters, it depends on type of asset to upload 
*/
export async function getUploadValuesRest(functionParams) {

    switch (functionParams.assetType) {
        case 'Image':
            functionParams.assetCreationParams.imageFormat = functionParams.assetExtension
            break
        case 'Document':
            functionParams.assetCreationParams.documentFormat = functionParams.assetExtension
            break
        case 'Video':
            functionParams.assetCreationParams.videoFormat = functionParams.assetExtension
            break
        default:
            console.error(`Asset type "${functionParams.assetType}" is not recognized, check its name.`)
    }

    return functionParams.assetCreationParams

}

/** 
    * Gets the dimensions (width and height) of the asset to upload inside an existing Canvas.
    * If the asset is wider than the canvas, the asset width is changed to fit within the canvas.
    * @param {Object} functionParams - Object with parameters to run the function
    * @param {('URL'|'LOCAL')} functionParams.uploadMethod - Upload method: URL or LOCAL
    * @param {('Video'|'Image'|'Document')} functionParams.assetType - Type of the asset to upload
    * @param {Object} functionParams.canvasElement - Object with the properties of the canvas, also stores the next asset insertion (x,y) coordinates
    * @param {string} functionParams.assetLocation - URL or full path to the asset to upload
    * @param {string} functionParams.ffprobePath - Path to local install of ffprobe
    * @param {Object} functionParams.defaultAssetDimensions - Object with the default dimensions
    * @param {number} functionParams.defaultAssetDimensions.DEFAULT_ASSET_WIDTH - Default width
    * @param {number} functionParams.defaultAssetDimensions.DEFAULT_ASSET_HEIGHT - Default height
    *
    * @return {Object} functionReturnValues - Object with the values to return
    * @return {number} functionReturnValues.assetWidth - Calculated width of the asset to upload 
    * @return {number} functionReturnValues.assetHeight - Calculated height of the asset to upload  
    * @return {string} functionReturnValues.assetFileFullPath - Asset full path
    * @return {Object} functionReturnValues...values - Parameters passed in 'functionParams'
*/
export default async function getAssetDimensionsInsideExistingCanvas(functionParams) {

    let assetWidth;
    let assetHeight;

    if (functionParams.assetType === 'Video') {
        try {
            const probeInfo = await probeVideoDimensions(functionParams.ffprobePath, functionParams.assetLocation);
            assetWidth = probeInfo.width;
            assetHeight = probeInfo.height;

        } catch (error) {
            console.error(`ERROR: Error trying to get dimensions for video. Asset: ${functionParams.assetLocation}`);
            console.error(error);
        }
    } else {

        if (functionParams.uploadMethod === 'LOCAL') {
            if (functionParams.assetType === 'Image') {
                const readFileSyncData = fs.readFileSync(functionParams.assetLocation);
                const fileData = probe.sync(readFileSyncData);

                assetHeight = fileData.height;
                assetWidth = fileData.width;
            }

        } else { // URL upload

            if (functionParams.assetType === 'Image') {
                const fileInUrlData = await probe(functionParams.assetLocation);
                assetHeight = fileInUrlData.height;
                assetWidth = fileInUrlData.width;
            }
        }
    }

    // Check if asset will fit in Canvas. If not, resize it to make it fit
    if (assetWidth > functionParams.canvasElement.canvasInitialWidth - (functionParams.canvasElement.horizontalSpacing * 2)) {
        // Asset is too wide, change display width
        const originalWidth = assetWidth;
        assetWidth = functionParams.canvasElement.canvasInitialWidth - (functionParams.canvasElement.horizontalSpacing * 2);

        // We also need to change height, or the zygote will be a tall and narrow rectangle,
        //  the asset will be centered on the very tall height within the zygote, this is a waste of available space.
        const newScale = assetWidth / originalWidth;
        assetHeight = parseInt(assetHeight * newScale);
    }

    const functionReturnValues = {
        'assetFileFullPath': functionParams.assetLocation,
        'assetWidth': assetWidth ?? functionParams.defaultAssetDimensions.DEFAULT_ASSET_WIDTH,
        'assetHeight': assetHeight ?? functionParams.defaultAssetDimensions.DEFAULT_ASSET_HEIGHT,
        ...functionParams
    }

    return functionReturnValues
}

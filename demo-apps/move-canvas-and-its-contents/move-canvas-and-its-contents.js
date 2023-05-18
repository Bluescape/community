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
/**
 * Node.js Javascript
 * Purpose:
 *      Moves a Canvas and all of its contained elements to the nearest
 *      available space to the left, right, above, or below its current
 *      position.
 * 
 * Requirements:
 *      To install all the required libraries, run 'npm install' in both
 *      this folder and the ../bluescape-modules folder.
 * 
 * Usage:
 *      node move-canvas-and-its-contents --token=<token> --workspaceId=<Id of workspace> --canvasId=<Id of canvas to move> [ --direction=<direction to move> ]
 * 
 * Notes:
 *      To obtain a token you can follow the instructions in the Application
 *      Authorization Guide found in the Developer Portal:
 *          https://api.apps.us.bluescape.com/docs/page/app-auth
 * 
 *      Both the Workspace Id and Canvas Id can be obtained from the URL displayed
 *      in the browser. When you open a workspace the Id is the first value
 *      following the domain. For example, this URL includes the Workspace Id
 *      "abcd1234abcd1234abcd":
 * 
 *      https://api.apps.us.bluescape.com/abcd1234abcd1234abcd
 * 
 *      Similarly, by clicking on a canvas (on the border, in order to select it)
 *      within the workspace, the url will change to include the Canvas Id. In
 *      this example, the Canvas Id is "wxyz7890wxyz7890wxyz7890":
 * 
 *      https://api.apps.us.bluescape.com/abcd1234abcd1234abcd?objectId=wxyz7890wxyz7890wxyz7890
 * 
 *      The direction parameter supports values of "up", "down", "left" and "right".
 *      It will default to "right" if not specified.
 * 
 *      Brush Strokes contained within a canvas can be successfully moved once.
 *      Moving the canvas again will result in the Brush Stroke moving as if it
 *      were still at its original position (ie, prior to the first move). This
 *      is a known issue that should be resolved by an upcoming change to the
 *      Brush Strokes feature.
 */

import Yargs from "yargs";
import runGraphqlRequest from '../bluescape-modules/bluescapeApis.js';

// App Parameters
const args = Yargs(process.argv.slice(2)).argv;
const apiPortalUrl = 'https://api.apps.us.bluescape.com';
const apiVersion = 'v3';
const token = args.token ?? '<SET_TOKEN>';
const workspaceId = args.workspaceId ?? '<SET_WORKSPACE_ID>';
const canvasId = args.canvasId ?? '<SET_CANVAS_ID>';
const direction = args.direction ?? 'right';

// Object to store the parameters for Bluescape API execution 
const bluescapeApiParams = {
    'token': token,
    'apiPortalUrl': apiPortalUrl,
    'apiVersion': apiVersion
}

/**
 * Main Function
 * Moves the canvas and all its elements to a new position in the workspace.
 */
async function runMoveCanvasAndContentsApp() {

    try {
        validateMandatoryArgs();

        // Retrieve the canvas and its elements
        const canvas = await getCanvasWithElementsById();
        console.log(`Current location: ${JSON.stringify(canvas.boundingBox)}`);

        // Find a new space to move the canvas to
        const newLocation = await findNewLocation(canvas);
        console.log(`New location: ${JSON.stringify(newLocation)}`);

        // Move the canvas and all its elements
        await moveCanvasAndContents(canvas, newLocation);
        console.log(`Move complete.`);
    }
    catch (error) {
        const buildErrorMessage = (e) => 
            `${e?.message ?? e} ${e?.extensions?.statusCode ? "(Status code: " + e.extensions.statusCode + ")" : ""}`;

        if (Array.isArray(error)) {
            console.error(`${error.length == 1 ? "An error" : "Errors"} occurred while processing:`);
            for (const err of error) {
                console.error(buildErrorMessage(err));
            }
        }
        else {
            console.error(`An error occurred while processing: ${buildErrorMessage(error)}`);
        }
    }
 }

/**
 * Validates that mandatory arguments were supplied.
 */
function validateMandatoryArgs() {
    if (!token || token === "<SET_TOKEN>") {
        throw new ReferenceError("The token argument is required.");
    }

    if (!workspaceId || workspaceId === "<SET_WORKSPACE_ID>") {
        throw new ReferenceError("The workspaceId argument is required.");
    }

    if (!canvasId || canvasId === "<SET_CANVAS_ID>") {
        throw new ReferenceError("The canvasId argument is required.");
    }

    if (direction !== "right" && direction !== "left" && direction !== "up" && direction !== "down") {
        throw new ReferenceError("The direction argument must be one of 'right', 'left', 'up', or 'down'.");
    }
}

/**
 * Retrieves the canvas specified in the arguments.
 * @returns Canvas object with id, name, and boundingBox properties.
 */
async function getCanvasWithElementsById() {
    // Build query to retrieve canvas info
    let query = `query getCanvases {
        elements(workspaceId: "${workspaceId}", id: "${canvasId}") {
            ... on Canvas {
                id
                name
                __typename
                boundingBox {
                    x y width height
                }
                transform {
                    x y    
                }
            }
        }
    }`;
    
    // Execute the query
    const canvasResponse = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
    const canvases = canvasResponse?.data?.data?.elements ?? null;

    if (!canvases) {
        const errors = canvasResponse?.data?.errors;
        if (errors && Array.isArray(errors)) {
            throw new Error(errors.map((e) => e?.message ?? e + "\r\n"));
        }
    }
    else if (canvases && canvases.length !== 1) {
        throw new Error(`There is no canvas with Id "${canvasId}" in workspace "${workspaceId}"`);
    }

    console.log("Retrieved canvas");
    const canvas = canvases[0];

    // Build query to retrieve canvas contents
    // We want the bounding box of all elements, plus the start and end
    // points of Line elements when they are not connected to another
    // element.
    query = `query getCanvasContents {
        elements (workspaceId: "${workspaceId}", canvasId: "${canvasId}") {
            id
            __typename
            boundingBox {
                x y
            }

            transform {
                x y
            }

            ... on Line {
                start {
                    __typename
                    ... on AbsoluteLinePoint {
                        x y
                    }
                }
                end {
                    __typename
                    ... on AbsoluteLinePoint {
                        x y
                    }
                }
            }
        }
    }`;

    // Execute the query
    const elementsResponse = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
    canvas.elements = elementsResponse?.data?.data?.elements;
    console.log("Retrieved contained elements");

    return canvas;
}

/**
 * Finds a new location for the canvas based on its size and the desired
 * direction of movement.
 * @param {*} canvas The canvas to move.
 * @returns A Box describing the new location.
 */
async function findNewLocation(canvas) {
    const box = canvas.boundingBox;

    // Build query  to find a new location
    const query = `query findNewLocation {
        findAvailableArea (
            workspaceId: "${workspaceId}"
            proposedArea: { x: ${box.x}, y: ${box.y}, width: ${box.width}, height: ${box.height}}
            direction: ${direction}) {
                x y width height
            }
        }`;
    
    // Execute the query
    const response = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
    return response.data.data.findAvailableArea;
}

/**
 * Move the specified Canvas and its contents to the new location.
 * @param {*} canvas A Canvas element.
 * @param {*} newLocation A Box indicating where the Canvas should be moved.
 */
async function moveCanvasAndContents(canvas, newLocation) {
    // Calculate the x and y shift
    const xDiff = newLocation.x - canvas.boundingBox.x;
    const yDiff = newLocation.y - canvas.boundingBox.y;

    // Move the canvas to the new location
    console.log("Moving canvas");
    await move(canvas, xDiff, yDiff);

    // Move all contained elements
    for (const element of canvas.elements) {
        console.log(`Moving ${element.__typename}`);
        if (element.__typename === "Line") {
            await moveLine(element, xDiff, yDiff);
        }
        else if (element.__typename === "Stroke") {
            await moveStroke(element, xDiff, yDiff);
        }
        else {
            await move(element, xDiff, yDiff);
        }
    }
}

/**
 * Moves a Line element based on the supplied relative coordinates.
 * One or both ends of a Line may be disconnected from other objects
 * and need to be specifically set. Line ends that are connected to
 * another object will be automatically moved with that object.
 * @param {*} element A Line element.
 * @param {*} xDiff The difference in position along the x axis.
 * @param {*} yDiff The difference in position along the y axis.
 */
async function moveLine(element, xDiff, yDiff) {
    // Calculate the new line start, if an absolute point
    let newStart = null;
    if (element.start.__typename === "AbsoluteLinePoint") {
        const newX = element.start.x + xDiff;
        const newY = element.start.y + yDiff;
        newStart = `start: { absolute: { x: ${newX}, y: ${newY} } }`;
    }

    // Calculate the new line end, if an absolute point
    let newEnd = null;
    if (element.end.__typename === "AbsoluteLinePoint") {
        const newX = element.end.x + xDiff;
        const newY = element.end.y + yDiff;
        newEnd = `end: { absolute: { x: ${newX}, y: ${newY} } }`;
    }

    // If either start or end is an absolute point, then update the line
    if (newStart || newEnd) {
        // Build mutation to move the line
        let mutation = `mutation moveLine {
            updateLine (
                workspaceId: "${workspaceId}"
                id: "${element.id}",
                input: {`;
        
        if (newStart) {
            mutation += `
            ${newStart}`;
        }

        if (newEnd) {
            mutation += `
            ${newEnd}`;
        }

        mutation += `
                }
            ) {
                id
            }
        }`;

        await runGraphqlRequest(bluescapeApiParams, { requestQuery: mutation});
    }
}

/**
 * Moves a Stroke element based on the supplied relative coordinates.
 * Other elements use absolute coordinates, thus Strokes must be handled separately.
 * @param {*} element A Stroke element.
 * @param {*} xDiff The difference in position along the x axis.
 * @param {*} yDiff The difference in position along the y axis.
 */
async function moveStroke(element, xDiff, yDiff) {
    // Create the transform argument using relative coordinates
    const transform = `{ x: ${xDiff}, y: ${yDiff} }`;

    // Build mutation to move the stroke
    const mutation = `mutation moveStroke {
        updateStroke (
            workspaceId: "${workspaceId}"
            id: "${element.id}",
            input: {
                transform: ${transform}
            }
        ) {
            id
        }
    }`;
    
    await runGraphqlRequest(bluescapeApiParams, { requestQuery: mutation });
}

/**
 * Moves an element.
 * @param {*} element The element to move.
 * @param {*} xDiff The difference in position along the x axis.
 * @param {*} yDiff The difference in position along the y axis.
 */
async function move(element, xDiff, yDiff) {
    // Construct the name of the mutation based on the type of element
    const action = `update${element.__typename}`;

    console.log('move element = ', element.__typename)
    // Calculate the new location
    const newX = element.transform.x + xDiff;
    const newY = element.transform.y + yDiff;
    const transform = `{ x: ${newX}, y: ${newY} }`;

    // Build mutation to move the element
    const mutation = `mutation moveElement {
        ${action} (
            workspaceId: "${workspaceId}"
            id: "${element.id}",
            input: {
                transform: ${transform}
            }
        ) {
            id
        }
    }`;
    await runGraphqlRequest(bluescapeApiParams, { requestQuery: mutation });
}

// Run the app
runMoveCanvasAndContentsApp();

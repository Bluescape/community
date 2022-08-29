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
 *      Retrieves the text from all notes in a workspace and writes them to a text
 *      file in either CSV or JSON format. The scope of the workspace to be 
 *      considered can be optionally restricted to a particular canvas.
 * 
 * Requirements:
 *      To install all the required libraries, run 'npm install' in both this folder
 *      and the ../bluescape-modules folder.
 * 
 * Usage:
 *      node get-all-sticky-notes --token=<token> --workspaceId=<Id of workspace> --outputTo=<path/fileName to write to> [--canvasId=<Id of canvas>] [--outputFormat=<CSV | JSON>]
 * 
 * Notes:
 *      To obtain a token you can follow the instructions in the Application
 *      Authorization Guide found in the Developer Portal:
 *          https://api.apps.us.bluescape.com/docs/page/app-auth
 * 
 *      Both the Workspace Id and Canvas Id can be obtained from the URL displayed
 *      in the browser. When you open a workspace the Id is the first value
 *      following the domain. For example, this URL includes the Workspace Id
 *      "bbKg00aNOelot2SkYno0":
 * 
 *      https://api.apps.us.bluescape.com/bbKg00aNOelot2SkYno0
 * 
 *      Similarly, by clicking on a canvas (on the border, in order to select it)
 *      within the workspace, the url will change to include the Canvas Id. In
 *      this example, the Canvas Id is "6222582a29201a64eec2dae1":
 * 
 *      https://api.apps.us.bluescape.com/bbKg00aNOelot2SkYno0?objectId=6222582a29201a64eec2dae1
 * 
 *      The outputFormat parameter will default to CSV if not specified.
 */

import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import Yargs from "yargs";
import runGraphqlRequest from '../bluescape-modules/bluescapeApis.js';

// App Parameters
const args = Yargs(process.argv.slice(2)).argv;
const apiPortalUrl = 'https://api.apps.us.bluescape.com';
const apiVersion = 'v3';
const token = args.token ?? '<SET_TOKEN>';
const workspaceId = args.workspaceId ?? '<SET_WORKSPACE_ID>';
const outputTo = args.outputTo ?? '<SET_PATH_AND_NAME_OF_FILE>';
const canvasId = args.canvasId;
const outputFormat = args.outputFormat?.toUpperCase() ?? "CSV";

// Object to store the parameters for Bluescape API execution 
const bluescapeApiParams = {
    'token': token,
    'apiPortalUrl': apiPortalUrl,
    'apiVersion': apiVersion
}

/**
 * Main Function
 * Retrieves all sticky note text and writes it to a file.
 */
async function runExportAllStickyNoteText() {

    try {
        validateMandatoryArgs();

        // Retrieve the workspace
        const workspace = await getWorkspaceById();

        // Retrieve the canvas, if specified
        let canvas = null;
        if (canvasId) {
            canvas = await getCanvasById();
        }

        // Build query to retrieve all Shapes and LegacyNotes from the workspace
        let query = `query getNoteElements {
            elements(
                workspaceId: "${workspaceId}"
                type: [Shape, LegacyNote]
                `;
        
        // Limit to the canvas, if specified
        if (canvas) {
            query += `canvasId: "${canvasId}"`;
        }
        
        query += `) {
            __typename
            ... on Shape {
                    kind
                    ShapeText: text
                }
            ... on LegacyNote {
                    LegacyText: text
                }
            }
        }`;

        // Execute the query
        const response = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
        const elements = response.data.data.elements;

        await writeNotesToFile(workspace, canvas, elements);
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

    if (!outputTo || outputTo === "<SET_PATH_AND_NAME_OF_FILE>") {
        throw new ReferenceError("The outputTo argument is required.");
    }

    if (outputFormat !== "CSV" && outputFormat !== "JSON") {
        throw new ReferenceError("The outputFormat argument must be either 'CSV' or 'JSON'.");
    }
}

/**
 * Retrieves the workspace specified in the arguments.
 * @returns Workspace object with id and name properties.
 */
async function getWorkspaceById() {
    // Build query to retrieve workspace info
    const query = `query getWorkspace {
        workspace(workspaceId: "${workspaceId}") {
            id
            name
        }
    }`;

    // Execute the query
    const response = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
    return response.data.data.workspace;
}

/**
 * Retrieves the canvas specified in the arguments.
 * @returns Canvas object with id and name properties.
 */
async function getCanvasById() {
    // Build query to retrieve canvas info
    const query = `query getCanvases {
        elements(workspaceId: "${workspaceId}", id: "${canvasId}") {
            ... on Canvas {
                id
                name
            }
        }
    }`;
    
    // Execute the query
    const response = await runGraphqlRequest(bluescapeApiParams, { requestQuery: query });
    const canvases = response?.data?.data?.elements ?? null;

    if (canvases && canvases.length !== 1) {
        throw new Error(`There is no canvas with Id "${canvasId}" in workspace "${workspaceId}"`);
    }

    return canvases[0];
}

/**
 * Creates the file containing all note text.
 * @param {*} workspace The workspace that the notes belong to.
 * @param {*} canvas The canvas that the notes belong to (optional).
 * @param {*} noteElements The notes retrieved from the workspace / canvas.
 */
async function writeNotesToFile(workspace, canvas, noteElements) {

    if (outputFormat == "CSV") {
        writeNotesToCsv(workspace, canvas, noteElements);
    }
    else if (outputFormat == "JSON") {
        await writeNotesToJson(workspace, canvas, noteElements);
    }
    else {
        console.log("Invalid output format specified.");
    }
}

/**
 * Creates a CSV file containing all note text.
 * @param {*} workspace The workspace that the notes belong to.
 * @param {*} canvas The canvas that the notes belong to (optional).
 * @param {*} noteElements The notes retrieved from the workspace / canvas.
 */
function writeNotesToCsv(workspace, canvas, noteElements) {

    // Shape the data for ouput
    const data = noteElements.map((noteElement) => {
        let note = {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            canvasId: canvas?.id,
            canvasName: canvas?.name
        };

        let noteText = "";
        if (noteElement.__typename == "Shape" && noteElement.kind == "StickySquare") {
            noteText = noteElement.ShapeText;
        }
        else if (noteElement.__typename == "LegacyNote" ) {
            noteText = noteElement.LegacyText;
        }

        note.text = noteText;
        return note;
    }).filter(note => note.text != "");

    const csvWriter = createObjectCsvWriter({
        path: outputTo,
        header: [
            { id: "workspaceId", title: "Workspace Id" },
            { id: "workspaceName", title: "Workspace Name" },
            { id: "canvasId", title: "Canvas Id" },
            { id: "canvasName", title: "Canvas Name" },
            { id: "text", title: "Note" }
        ]
    });

    csvWriter.writeRecords(data)
        .then(() => console.log("The CSV file was written successfully."));
}

/**
 * Creates a text file containing all note text in JSON format.
 * @param {*} workspace The workspace that the notes belong to.
 * @param {*} canvas The canvas that the notes belong to (optional).
 * @param {*} noteElements The notes retrieved from the workspace / canvas.
 */
async function writeNotesToJson(workspace, canvas, noteElements) {

    // Shape the data for ouput
    let data = {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        canvasId: canvas?.id,
        canvasName: canvas?.name,
        notes: []
    };

    for (const noteElement of noteElements) {
        let noteText = "";
        if (noteElement.__typename == "Shape" && noteElement.kind == "StickySquare") {
            noteText = noteElement.ShapeText;
        }
        else if (noteElement.__typename == "LegacyNote" ) {
            noteText = noteElement.LegacyText;
        }

        if (noteText) {
            data.notes.push(noteText);
        }
    }

    const json = JSON.stringify(data);

    fs.writeFile(outputTo, json, 'utf8', (err) => { 
        if (err) throw err;
        console.log("The JSON file was written successfully.");
    });
}

// Run the export
runExportAllStickyNoteText();

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

import axios from 'axios';
import axiosRetry from 'axios-retry';

/**
    * Runs GraphQL request.
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs.
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    * 
    * @param {Object} requestParams - Object with the parameters of the request to run 
    * @param {string} requestParams.requestQuery - GraphQL query or mutation to run
    * @param {string} requestParams.requestVariables - Variables for the GraphQL query or mutation
    * @param {string} [requestParams.timeout] - Timeout to set, in milliseconds (OPTIONAL)
    *   
    * @returns {Object} Object with the answer of the GraphqQL query or mutation execution.
*/
export default async function runGraphqlRequest(bluescapeApiParams, requestParams) {

    const maxRetries = 3;

    axiosRetry(axios, {
        retries: maxRetries, // number of retries
        retryDelay: () => {
            return axiosRetry.exponentialDelay; // time interval between retries
        },
        retryCondition: (error) => {
            // if retry condition is not specified, by default idempotent requests are retried
            return axiosRetry.isNetworkOrIdempotentRequestError(error);
        },
    });

    let requestAnswer;

    const requestValues = {
        method: "post",
        url: `${bluescapeApiParams.apiPortalUrl}/${bluescapeApiParams.apiVersion}/graphql`,
        headers: {
            "Authorization": "Bearer " + bluescapeApiParams.token,
            'Content-Type': 'application/json'
        },
        data: {
            query: requestParams.requestQuery,
            variables: requestParams.requestVariables
        },
        timeout: requestParams?.timeout ?? 0
    }

    // Set a reasonable timeout
    try {
        const startTime = new Date();
        requestAnswer = await axios(requestValues);
        const endTime = new Date();
        console.log(`[[DEBUG]] GraphQL API execution time (ms): ${ endTime - startTime}`,
        {
            query: requestParams.requestQuery,
            variables: requestParams.requestVariables
        });
    } catch (error) {
        console.error(`runGraphqlRequest error: ${error}`);
        console.error(`API call failed with status code: ${error?.response?.status ?? 'NOT AVAILABLE'} after ${maxRetries} retry attempts`);
        throw error.response?.data?.errors ?? error;
    }

    return requestAnswer;
}

/** 
    * Runs REST API request
    * @param {Object} bluescapeApiParams - Object containing the data for executing Bluescape APIs.
    * @param {string} bluescapeApiParams.token -  Access Token (oauth2 token, see https://api.apps.us.bluescape.com/docs/page/app-auth)
    * @param {string} bluescapeApiParams.apiPortalUrl - URL to the portal to execute the APIs, e.g. "https://api.apps.us.bluescape.com/api"
    * @param {string} bluescapeApiParams.apiVersion - Version of the APIs to be executed, e.g.: "v3". Current version: v3
    * 
    * @param {Object} requestParams - Object with the parameters of the request to run. 
    * @param {string} requestParams.apiEndpoint - Path of the API to execute, e.g.: "/workspaces/${workspaceId}/elements/${newElementId}", note the starting "/"
    * @param {string} requestParams.requestMethod - REST method to execute: POST, GET, PUT, PATCH, etc.
    * @param {string} requestParams.dataLoad - Data for the request body, or "{}"
    * @param {string} [requestParams.timeout] - Timeout to set, in milliseconds (OPTIONAL)
    *  
    * @returns {Object} Object with the answer of the REST query execution.
*/
export async function runRestRequest(bluescapeApiParams, requestParams) {

    const maxRetries = 3

    axiosRetry(axios, {
        retries: maxRetries, // number of retries
        retryDelay: (retryCount) => {
            console.log(`retry attempt: ${retryCount}`);
            return axiosRetry.exponentialDelay; // time interval between retries
        }
        ,
        retryCondition: (error) => {
            // if retry condition is not specified, by default idempotent requests are retried
            return axiosRetry.isNetworkOrIdempotentRequestError(error);
        },
    });

    const requestValues = {
        url: `${bluescapeApiParams.apiPortalUrl}/${bluescapeApiParams.apiVersion}${requestParams.apiEndpoint}`,
        method: requestParams.requestMethod,
        headers: {
            'Authorization': "Bearer " + bluescapeApiParams.token,
            'Content-Type': 'application/json'
        },
        data: requestParams.dataLoad,
        timeout: requestParams?.timeout ?? 0
    };

    let requestAnswer;
    try {
        const startTime = new Date();
        requestAnswer = await axios(requestValues);
        const endTime = new Date();
        console.log(`[[DEBUG]] REST API execution time (ms): ${ endTime - startTime}`,
        {
            query: requestParams.requestQuery,
            variables: requestParams.requestVariables
        });
    } catch (error) {
        console.error(`REST API execution error: ${error}`);
        console.error(`API call failed with status code: ${error?.response?.status ?? 'NOT AVAILABLE'} after ${maxRetries} retry attempts`);
        throw error.response?.data?.errors ?? error;
    }

    return requestAnswer;
}

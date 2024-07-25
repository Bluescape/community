import ws from 'ws';
import axios from 'axios';
import { createClient } from 'graphql-ws';
import { JWT_TOKEN } from './api_token.js'; // read the JWT Token from a file
const WS_URL = 'wss://elementary.apps.us.bluescape.com/graphql';
const WORKSPACE_ID = "<workspaceId>";

const observer = {
    error(e) {
        console.log('Observer.error', e);
    },
    next(eventData) {
        console.log('Observer.next');
        // log the eventData object
        console.dir(eventData, { depth: null });
        //
        //
        // LOOK FOR POWER_UPS: analyzeImage -- THEN SEND WEBHOOK
        if (eventData.data.item.__typename === "RawCommand" &&
            eventData.data.item.data[5].type === "traits" &&
            eventData.data.item.data[5].traits[0]?.hasOwnProperty("http://bluescape.dev/ws/ac/mostRecentActionRequest") &&
            eventData.data.item.data[5].traits[0]["http://bluescape.dev/ws/ac/mostRecentActionRequest"]["@id"] === "analyzeImage") {
                axios({
                    method: "POST",
                    url: 'https://webhook.site/webhookabcd1234/'
                        + "?act=image_analysis"
                        + "&ws=" + eventData.data.item.workspaceId
                        + "&eid=" + eventData.data.item.data[2]
                        + "&et=" + eventData.data.item.data[5].type
                        + "&aid=" + eventData.data.item.actorId
                        + "&txt=IMAGE_ANALYSIS"
                }).then(response => {
                    console.log(response);
                }).catch(err => {
                    console.log(err);
                });
                console.log("====================================\n         WEBHOOK SENT:          \n====================================\n"
                    + 'https://webhook.site/webhookabcd1234/'
                    + "?act=image_analysis"
                    + "&ws=" + eventData.data.item.workspaceId
                    + "&eid=" + eventData.data.item.data[2]
                    + "&et=" + eventData.data.item.data[5].type
                    + "&aid=" + eventData.data.item.actorId
                    + "&txt=IMAGE_ANALYSIS"
                    + "\n====================================")
        }
        //
        //
        // LOOK FOR POWER_UPS: createMap -- THEN SEND WEBHOOK
        if (eventData.data.item.__typename === "RawCommand" &&
            eventData.data.item.data[5].type === "traits" &&
            eventData.data.item.data[5].traits[0]?.hasOwnProperty("http://bluescape.dev/ws/ac/mostRecentActionRequest") &&
            eventData.data.item.data[5].traits[0]["http://bluescape.dev/ws/ac/mostRecentActionRequest"]["@id"] === "createMap") {
                axios({
                    method: "POST",
                    url: 'https://webhook.site/webhookabcd1234/'
                        + "?act=mapboxdirectsearch"
                        + "&ws=" + eventData.data.item.workspaceId
                        + "&eid=" + eventData.data.item.data[2]
                        + "&et=" + eventData.data.item.data[5].type
                        + "&aid=" + eventData.data.item.actorId
                        + "&txt=MAPBOXDIRECTSEARCH"
                }).then(response => {
                    console.log(response);
                }).catch(err => {
                    console.log(err);
                });
                console.log("====================================\n         WEBHOOK SENT:          \n====================================\n"
                    + 'https://webhook.site/webhookabcd1234/'
                    + "?act=mapboxdirectsearch"
                    + "&ws=" + eventData.data.item.workspaceId
                    + "&eid=" + eventData.data.item.data[2]
                    + "&et=" + eventData.data.item.data[5].type
                    + "&aid=" + eventData.data.item.actorId
                    + "&txt=MAPBOXDIRECTSEARCH"
                    + "\n====================================")
        }
        //
        // LOOK FOR REACTIONS THEN SEND WEBHOOK
        //
        else if (eventData.data.item.data[4] == "create") {
            if (eventData.data.item.data[5].type == "reaction") {
                // REACTION = "QUESTION"
                if (eventData.data.item.data[5].token == "u+003f") {
                    axios({
                        method: "POST",
                        url: 'https://webhook.site/webhookabcd1234/'
                            + "?act=video_transcribe"
                            + "&ws=" + eventData.data.item.workspaceId
                            + "&eid=" + eventData.data.item.data[2]
                            + "&et=" + eventData.data.item.data[5].type
                            + "&aid=" + eventData.data.item.actorId
                            + "&txt=" + encodeURIComponent(eventData.data.item.data[5].token)
                    }).then(response => {
                        console.log(response);
                    }).catch(err => {
                        console.log(err);
                    });
                    console.log("====================================\n         WEBHOOK SENT:          \n====================================\n"
                        + 'https://webhook.site/webhookabcd1234/'
                        + "?act=video_transcribe"
                        + "&ws=" + eventData.data.item.workspaceId
                        + "&eid=" + eventData.data.item.data[2]
                        + "&et=" + eventData.data.item.data[5].type
                        + "&aid=" + eventData.data.item.actorId
                        + "&txt=" + encodeURIComponent(eventData.data.item.data[5].token)
                        + "\n====================================")
                }
                // REACTION = "THUMBS UP"
                else if (eventData.data.item.data[5].token == "u+1f44d") {
                    axios({
                        method: "POST",
                        url: 'https://webhook.site/webhookabcd1234/'
                            + "?act=map_targets"
                            + "&ws=" + eventData.data.item.workspaceId
                            + "&eid=" + eventData.data.item.data[2]
                            + "&et=" + eventData.data.item.data[5].type
                            + "&aid=" + eventData.data.item.actorId
                            + "&txt=" + encodeURIComponent(eventData.data.item.data[5].token)
                    }).then(response => {
                        console.log(response);
                    }).catch(err => {
                        console.log(err);
                    });
                    console.log("====================================\n         WEBHOOK SENT:          \n====================================\n"
                        + 'https://webhook.site/webhookabcd1234/'
                        + "?act=map_targets"
                        + "&ws=" + eventData.data.item.workspaceId
                        + "&eid=" + eventData.data.item.data[2]
                        + "&et=" + eventData.data.item.data[5].type
                        + "&aid=" + eventData.data.item.actorId
                        + "&txt=" + encodeURIComponent(eventData.data.item.data[5].token)
                        + "\n====================================")
                }
            };
        }
    },
    complete() {
        console.log('Observer.complete');
    }
}
function subscribe(query, variables) {
    const client = createClient({
        url: WS_URL,
        webSocketImpl: ws,
        connectionParams: () => {
            return {
                Authorization: `Bearer ${JWT_TOKEN}`
            }
        },
    });
    client.subscribe({ query, variables }, observer);
}
// Set the subscription
subscribe(`subscription($workspaceId: String!) {
  item: rawHistory(workspaceId: $workspaceId) {
      __typename
      workspaceId
      actorId
      actorType
      data
    }
}`, {
    workspaceId: WORKSPACE_ID
});
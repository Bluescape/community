# Listen for workspace events with a subscription
In order to respond to events in a Bluescape workspace, you'll need to open a GraphQL subscription.

This sample code will create a web-socket listener that logs each event and returns an "eventData" object from the API.  Then it checks the eventData for emoji reactions or PowerUPs and calls an appropriate web-hook accordingly.  You can use your own service, a low-code service like n8n, or https://webhook.site to test the functionality.

## Requirements

Run `npm install` to install all the needed libraries.
Run `node workspace-listener-subscription.js` to execute the listener.

## Contact us

If you have any questions or comments, please contact us in our [Bluescape Community site](https://community.bluescape.com/c/developer/14).
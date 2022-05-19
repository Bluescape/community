# Modules for the Bluescape App

These are node modules the Demos App uses to create a new Canvas and upload assets to it (from local drive or by URL), resizing the Canvas if more space is needed to accommodate the assets we are uploading.

## You can use this modules in your own apps

These modules can be used independently of this Demo App. You can re-use them to implement your own applications. See the description of each module, and then the documentation in each module, to see how to use them.

## Requirements

If you are going to use these modules independently of the Demo App, remember to install the libraries the modules need. 
Run `npm install` to install all the needed libraries.

## Modules in this folder

Module | Functionality| Main functions
---|---|---
bluescapeApis.js|Run GraphQl or REST Bluescape APIs|- **runGraphqlRequest**: run a Bluescape GraphQL request<br/>- **runRestRequest**: run a Bluescape REST request
layoutAssetsInGrid|Upload assets into a new Canvas, in a grid display|- **layoutImagesInGrid**: Calculates a grid display for the list off assets to upload, calculates the required space for the new Canvas to contain all those elements, verifies if there is an empty area to create the Canvas (or finds one) and crates the new Canvas and uploads the assets.
uploadAssetByURL.js|Upload and asset into a Canvas by using a URL to the asset|- **uploadAssetByUrlIntoCanvasGraphql**: Uploads the asset provided by the URL into a specific canvas, in the specified (x,y) position<br/>- **checkUrlUploadIngestionStatusGraphql**: Check the ingestion status of an asset uploaded by URL, to determine if its upload has finished or not 
uploadAssetFromLocal.js|Upload and asset into a Canvas from your local drive|- **uploadAssetFromLocalIntoCanvas**: <br />- Uploads the asset provided from the path in your local system, into a specific Canvas, in the specified (x,y) position. Also crates zygote for asset to be uploaded (step 1/3)<br />- **uploadToBucket**: (step 2/3) upload the asset to a specified storage bucket<br/>- **linkUploadedAssetToZygote**: (step 3/3), links the asset uploaded into the storage bucket to the zygote in the workspace. The upload is finished.
uploadUtils.js|Several utilities to make easier the upload of assets into a Canvas or workspace|- **getAssetDimensions**: Gets the dimensions (width and height) of the specified image or video<br />- **getMutationValues**: Gets the values to be used in GraphQL for the specific mutations for the upload of images, videos or documents. <br />- **filterAndPreProcessAssets**: filters the list of URLs of files, excluding assets that cannot be uploaded because they are not in the allowed list of files to be uploaded into a workspace<br />- **probeVideoDimensions**: Get the dimensions (width and height) of a video provided by URL<br/>- **getPositionForAssetInCanvas**: Get the (x,y) position for where to upload the asset, this based on the tentative insertion point, the width and height of the asset, and the height and width of the Canvas where the asset is being uploaded into.

## Contact us

If you have any question or comments, please contact us in our [Bluescape Community site](https://community.bluescape.com/).

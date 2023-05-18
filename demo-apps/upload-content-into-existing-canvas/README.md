## What are we doing here?

This demo app will upload assets (Images, Videos or Documents) into an existing Canvas, automatically adding the assets without overlapping over the content already present in the Canvas. If more space is needed for the assets, the Canvas' bottom will be expanded to make space for the new assets.

## This demo app is implemented using REST APIs

This demo app uses REST APIs on each of the steps to obtain information about the Canvas and for the upload of the assets.

### How is the content displayed in the new Canvas?

- The assets will be added below the bottom of the element closest to the bottom of the Canvas. 
- The assets will be positioned on horizontal rows, from left to right, adding new assets to the right of the last one.
  - If the new asset does not have enough space in the current row, it will be added to a new row starting at the left border of the Canvas. 
  - If there is no more space in the Canvas for the new assets, the Canvas will be extended down, maintaining its original width.
- If an asset is wider than the width of the canvas, the the asset's display will be scaled down to fir the width of the canvas.

### What content can be uploaded?

- The content to upload can be: Images, Videos and Documents.
- The actual dimensions (width and height) of the Images and Videos does not have to be provided, they will be extracted from the assets at upload time.

### What is the source of the assets to be uploaded?

- LOCAL: you can specify a local path in your drive from where the assets will be uploaded.
- URL: You can specify a list of URL links pointing to each asset you want to be uploaded.

## Requirements

### How to install required node libraries

Run `npm install` to install all the needed libraries, in this folder and in the `bluescape-modules` folder.

### ffbprobe

When uploading content by URL, the app can upload and display the videos with their actual width and height. To do this, you will need to have `ffprobe` installed in your system. 

**IMPORTANT**: If you do not have `ffprobe` installed and its path set in the demo app, a default width and height will be assigned to the videos.

1. Go to https://www.npmjs.com/package/ffprobe-static#version-notes for getting the right version of `ffprobe` to be installed in your system.
1. You need to set the path to your local install of `ffprobe` in the `ffprobePath` variable in the demo app.

## What are the main steps to be performed?

- Calculate the position where the assets will be uploaded, below the  bottom of the element closest to the bottom on the Canvas. 
- Upload content into the Canvas, by URL or from local drive: images, documents or videos.
- If the Canvas does not have space for the new content, the Canvas size is increased, expanding its bottom to fit the new content.

## Steps to follow

1. Pick a workspace and a canvas to which you want to add new assets.
1. Provide the values to run the script
    - In the demo app:
        - Go to the `// DEMO APP PARAMETERS` section
        - Set the values of the placeholders with this syntax: `<value-to-set>`. E.g.: `<SET_WORKSPACE_ID>` for the actual workspace Id.
    - By Command line. 
        - These values overwrite any value hardcoded in the app code:
        - Command line parameters to use:
        ```
        --uploadmethod=[URL|LOCAL]
        --pathtofiles='<PATH-TO-CONTENT-TO-UPLOAD>'
        --assetstouploadbyurl='URL-1|URL-2|URL-3' 
        --token=<ACCESS-TOKEN>
        --worksdpaceid=<SET_WORKSPACE_ID> 
        --canvasid='<CANVAS_ID>'
        ```  
        - Example for upload by URL:
        ```
         --uploadmethod=URL
         --assetstouploadbyurl='https://s3.amazonaws.com/webclienttest.bluescape.com/share/images/landscape.jpg|https://s3.amazonaws.com/webclienttest.bluescape.com/share/images/18.jpg'
        ```
        - Example for upload from local drive:
        ```
        --uploadmethod=LOCAL
        --pathtofiles='/Users/littlejohnny/assets/to-upload/'
        ```
1. Run the script
   - If you hardcoded the required values in the demo app, then run the demo app: 
     - `node upload-content-into-existing-canvas.REST.js` 
   - If you want to pass command line parameters, the run `node upload-content-into-existing-canvas.REST.js [command line parameters]`
     - examples (IDs are provided as reference only):
       - Upload from local drive, into workspace `WTQHcY3tVb67fycvtpn9`, and canvas ID `61eefd83be12b83490fa10db` 
         - sample execution call:
            ```
            node upload-content-into-existing-canvas.REST.js --token=<<SET-TOKEN-HERE> --pathtofiles='/Users/vladimirsanchez/temp/docs/other/' --uploadmethod=LOCAL --workspaceid=WTQHcY3tVb67fycvtpn9 --canvasid=61eefd83be12b83490fa10db 
            ```
       - Upload by URL, into workspace `WTQHcY3tVb67fycvtpn9`, and canvas ID `61eefd83be12b83490fa10db`:
         - sample execution call:
            ```
            node upload-content-into-existing-canvas.REST.js --token=<<SET-TOKEN-HERE> --uploadmethod=LOCAL --assetstouploadbyurl='https://s3.amazonaws.com/webclienttest.bluescape.com/share/images/landscape.jpg|https://s3.amazonaws.com/webclienttest.bluescape.com/share/images/18.jpg' --workspaceid=WTQHcY3tVb67fycvtpn9 --canvasid=61eefd83be12b83490fa10db
            ```



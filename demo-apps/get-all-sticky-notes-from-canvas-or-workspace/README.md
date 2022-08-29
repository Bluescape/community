# Get Sticky Notes
One great use case for Bluescape is to have a brainstorming session, and use sticky notes to write down comments or ideas. Sometimes this produces a large number of Sticky Notes and reading them one by one may be a little slow.

This app will retrieve the text from all sticky notes in the Workspace or in a specific Canvas and output the results to a file in either comma separated value (CSV) or Javascript Object Notation (JSON) format.

## Requirements

Run `npm install` to install all the needed libraries.
## Details
In this application, you will get all the Sticky Notes from a workspace. Please keep in mind that for the purpose of the APIs, there are 2 types of Sticky Notes:
1. Legacy Sticky Notes: notes created by API or in the workspace before Release 21.01.1
    - These are identified by getting a list of elements with the filter `type=LegacyNote`
2. Sticky Notes: the current Notes. 
    - These are Shapes
    - They have a specific field to identify them: `'kind': 'sticky-rectangle'`

## Contact us

If you have any questions or comments, please contact us in our [Bluescape Community site](https://community.bluescape.com/c/developer/14).
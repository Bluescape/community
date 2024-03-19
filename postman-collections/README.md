This folder contains a set of Postman Collections that exemplify the use of the Bluescape REST and GraphQL APIs for the current v3 version of the APIs.

# Contents of this folder
File | Description| Comments
---|---|---
[v3_REST_APIs.postman_collection.json](./v3_REST_APIs.postman_collection.json)|Collection with examples for v3 REST APIs|
[v3_graphQL_APIs.postman_collection.json](./v3_graphQL_APIs.postman_collection.json)|Collection with examples for GraphQL APIs|
[production.bluescape.com.postman_environment.json](./production.bluescape.com.postman_environment.json)|Environmental variables for the Bluescape Production environment|These variables will be used for the generation of Access Tokens and for storing results used in some examples of APIs.

# Interesting examples

## Interesting examples - GraphQL

Case|Type of API|Description|Request name
---|---|---|---
Upload an image from your local drive|GraphQL|Learn how to upload an image from your local drive in 3 steps|v3 graphQL Public > GraphQL mutations >  Image Upload from disk
Upload a Video using URL|GraphQL|Lear how to upload a Video into the workspace using a URL pointing to the video you want to upload.|v3 graphQL Public > GraphQL mutations > mutation: createVideo with URL
Batching GraphQL queries or mutations|GraphQL|Learn how to brach queries or mutation and then execute them in 1 call.|v3 graphQL Public > GraphQL mutations > mutation: createShape batch
Get the list of your workspaces|GraphQL|List the workspaces you can access|v3 graphQL Public > ISAM - workspace admin > ISAM - getMyWorkspaces 


## Interesting examples - REST

Case|Type of API|Description|Request name
---|---|---|---
Upload an image from your local drive|REST|Learn how to upload an image from your local drive in 3 steps|v3 REST APIs > imageUpload from local >  Image Upload from disk
Upload a Video using URL|REST|Lear how to upload a Video into the workspace using a URL pointing to the video you want to upload.|v3 REST APIs > workspace content APIs > create Video from URL
Get the list of your workspaces|REST|List the workspaces you can access|v3 REST APIs > ISAM/Management > get user workspaces 



# Instructions

## How to import the Collections into Postman

You can easily import the graphQL or REST collections with the Postman Collection import button

![importCollection](https://user-images.githubusercontent.com/593911/169601250-f1ec453f-a7e3-4889-8891-78d82e576657.png)

for more information:
https://learning.postman.com/docs/getting-started/importing-and-exporting-data/

## How to import the GraphQL schema

1. If you are using the graphQL collection, you can use the "Auto Fetch" to get the schema from the server (preferred method) or you can import a schema version manually by creating an API and importing your desired graphQL schema version

Auto Fetch:
   <img width="1407" alt="image" src="https://github.com/Bluescape/community/assets/593911/f3797efd-3563-4c27-b273-bd8abbd96e67">

For manually adding specific graphQL schema version:

![importGraphQLschema](https://user-images.githubusercontent.com/593911/169601434-92ab0916-8366-4f07-8481-fa4ee050f9eb.png)

2. Once you have imported the graphQL schema, you will need to select the schema in the graphQL calls in the colleciton
![selectGraphQLschema](https://user-images.githubusercontent.com/593911/169603378-e6d671f8-1e31-4c9e-a4bd-3f8ff81d6271.png)


## How to import the environmental variables

Import the environment variables file: production.bluescape.com.postman_environment.json

![importEnvironmentVariables](https://user-images.githubusercontent.com/593911/169611084-49e3a3fb-7d6e-4af8-9b85-8246ae5363dd.png)



## How to generate the Access Tokens to execute the APIs

### Prerequisites 

You will need to crate an Application in Bluescape.
Please follow the instructions about [how to create an Application]([https://api.apps.us.bluescape.com/docs/page/app-auth#appendices](https://community.bluescape.com/t/v3-api-application-authorization-with-pkce/3695))


### How to generate the Access Token in Postman

You can quickly create a bearer token in postman by using the "Authorization" tab for a given API 

Steps:
1. You will need to create a Bluescape Application with the postman Callback Url: https://oauth.pstmn.io/v1/callback

![postmanApplication](https://github.com/Bluescape/community/assets/593911/72e98171-e7a0-42d5-bfa4-8a0d5e6ecc6b)


3. Go to the "Authroization" tab for a given API
4. Type is OAuth 2.0
5. Grant Type is "Authorization Code"
6. Enter the clientID, clientSecret, and scope as environment variables from the Application created in step 1
7. Hit "Get New Access Token" after completing previous steps

![postmanBearerTokenCreation](https://github.com/Bluescape/community/assets/593911/9db81b6d-e853-4637-aef7-bbf1d2054f28)


# Contact us

Let us know your questions, comments and ideas in our [Bluescape Community site](https://community.bluescape.com/c/developer/14).


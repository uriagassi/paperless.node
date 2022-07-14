![screenshot](images/screenshot.png)
# paperless.node

An alternative to Evernote specifically intended for indexing scanned paperwork/PDFs/mail in a private and trust-no-one
architecture.

## Introduction

Following my [blogpost from 2012](https://uri.agassi.co/2012/09/29/going-paperless-using-evernote/) about using Evernote
for indexing your paperless office, Evernote has changed their service to lend itself less and less to my needs. That,
with other shortcomings of their solution (like a single gigantic blob to hold my private notebook, which taxed my
backup system), I've decided to write my own version using a [.Net desktop
solution](https://dev.azure.com/uriagassi/Paperless).

This is a new web implementation, meant to be deployed on your local machine, or in your local intra network. It uses
the same concepts, but is cleaner, leaner, and more available to non-Microsoft-centric machines.

# Getting Started

## Deployment
The easiest way to use this application, is to install it locally on your machine

1. Install [Node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install/)
2. Clone this repo locally
3. Build the server

```console
paperless.node:~$ yarn install
paperless.node:~$ yarn build
```        
4. Run the Setup Wizard

```console
paperless.node:~$ yarn setup_wizard 
```

     Fill up the location where you want your database to be in. You can skip the rest of the wizard for now.
5. Run the server
```console
paperless.node:~$ yarn start_prod
```

You can now see your database by going to http://localhost:3000

# Basic Operation

At this basic level, you can add notes by clicking the "Add Note" button. You can change the title of the added note,
its "Create Date" and add tags.

When you are done - click the `Archive` button, and it will be moved to the Archive Notebook.

Rinse and Repeat.

# Integrations

You might want to better integrate a few more tools to your paperless work-flow. Currently - there are two main tools
you can integrate into the paperless.node - your Scanner, and your Gmail.

## Scanner

Most scanners scan to a JPG or a PDF, and sends the file to a folder on your disk.

You can configure paperless.node to "listen" to that folder, show you when there are files on it, and if you press the
"Import" button - will automatically add those files to the `Inbox`, and delete them from the scanner folder.

To do that, in the `setup_wizard` configure the scanner folder:

```console {highlight="context:/path,1"}
paperless.node:~$ yarn setup_wizard
What path should the DB be in? [~/paperless]
What path should the files waiting from the scanner be in? [~/importToPaperless] /path/to/my/awsome/scanner
```
To use this feature look for the scanner button on the upper right command bar ![scanner](/images/scanner.svg), if there
are new scanned files in that folder, you will see a bubble with the number of pending files. Pressing the button will
import every file in the folder into its own new note, and delete it from the scanner folder.

## Gmail
When you get mail you want to index in paperless.node, or perhaps there is a digital file you want to add, but the
server is not reachable (you are on mobile, or in your work computer), it could be very convenient if you could simply
send this mail/file straight to the server.

You can do it by assigning a label to this mail, and tell paperless.node to import all mail items that contain that
label.

Since this is an open source project, and does not include its own app_api, the integration with Gmail entails a few
steps:

### Step 1: Obtain a credentials.json file from Google Cloud
1. [Create a new GCP Project](https://developers.google.com/workspace/guides/create-project)
2. [Enable Gmail APIs](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
3. [Create an OAuth Client ID](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id)
    1. In the `Authorized JavaScript Origins` enter the root of the Paperless Server (as long as you are running it
       locally - it should be `http://localhost:3000`)
    2. In the `Authorized redirect URIs` enter the same value you've set in the previous step, but with the `/gmail`
       path (i.e. `http://localhost:3000/gmail`)
4. Download the OAuth Client
    1. ![](images/download_oauth.png)
5. Put it in a safe location, accessible for the paperless.node server to read

### Step 2: Configure the paperless.node server
1. Run `yarn setup_wizard` again
2. Skip what you've already entered (press Enter to skip)
3. Enter your newly downloaded credentials location when asked `Where is your credentials.json file?`
4. You can customize the labels to be used by the server, or leave them as the default `Paperless` and
   `Paperless/Archived`(for the processed files)
5. Restart the server.

### Step 3: Prepare your Gmail Account
1. Add the labels you indicated above to your account in the [Settings](https://mail.google.com/mail/#settings/labels)
2. (Optional): [Add `Filters`](https://mail.google.com/mail/#settings/filters) that will automatically set relevant
   threads to be uploaded into the server by assigning the `Paperless` label to them. (My favorite is to automatically
   Archive and assign the `Paperless` label to all mail sent to `<my_address>+paperless@gmail.com`, which enables me to
   "send" new notes straight to the paperless server - see
   [here](https://support.google.com/a/users/answer/9308648?hl=en) for details about that magic if you were not aware of
   it)
3. To test that integration was successful - label one or more threads with the new `Paperless` label.

### Step 4: Authorize the Server to connect to your account
1. In the app you will see now an envelope icon in the upper right corner. When you click it, you will be able to
`Login`. Press that option, and you will be prompted to authorize the server to read your mail and modify your labels
(remember that you are authorizing _your own_ api key, so you are not granting anyone any permission to do anything
beyond that)
2. You should now be able to see a number bubble near the envelope icon, showing how many pending mail items are there,
waiting to be imported to your server. Press `Import...` to import them
3. Note that nothing is deleted in your gmail account - processed mail have their `Paperless` removed, and
`Paperless/Archived` added, so you can retrace these items if anything does not go according to plan.

# Security Concerns
As long as the server listens only to the local machine, you can use it locally like any other desktop application, and
it is as safe as any desktop application. _This is the recommended way to use it_.

If, however, you want to leverage its web-innes, to allow you to use it from remote locations as well - be aware that
you are creating an attack vector to your most important documents!

To do it safely - there are a couple of things you should do to contain this attack vector.

## HTTPS
First and foremost - you need to make sure the server accepts only HTTPS connections. To do that, you would need to
obtain an [ssl certificate](http://www.steves-internet-guide.com/ssl-certificates-explained/) which matches the URL your
server will serve from. Put the cert.pem and key.pem in a place where the server can read them.

Once you do that, run `yarn setup_wizard` again, and skip to the `Do you want to run HTTPS?` question. Type `Y`, and
then you will be requested to point the server to your `key.pem` and `cert.pem`.

Restart the server - it would now listen to `https://localhost:3000`. If you have integrated Gmail - remember to change
the Origin and Redirect URIs (in the Gmail OAuth configuration, and in the `setup_wizard` configuration)

## Authentication
Serving HTTPS will keep away snoops from looking at your requests and responses, but it won't prevent anyone from
connecting to your server themselves. The way to keep them away, is to only allow authenticated users (ones that you
authorized to use the server) to actually get to it. I have not implemented a full authentication and authorization
system.

I have, however, created a pluggable system, where you can easily implement an authorization middleware and wire it into
the server. I have also implemented a reference implementation which integrates with Synology's NAS [SSO
Server](https://kb.synology.com/en-ph/DSM/help/SSOServer/sso_server_desc), which is oAuth-like system, and will allow
any of the NAS users to be authorized to use the server.

If you are lucky enough to have a Synology NAS, and you are willing to use my implementation - all you need to do is
follow the instructions to create an Application and wire it back to the paperless.node server using the `yarn
setup_wizard` by answering Yes to `Do you want to use Synology SSO?`, and fill the requested information.

Otherwise - I would strongly recomment either to implement your own robust authentication, or reconsider opening it to
external connections - with Gmail integration, you can do most of the remote archiving by sending mail to yourself, and
leave the indexing to when you are home.

Also, if you implement a robust authentication (either by integrating with another SSO system, or building a [standalone
one](https://www.section.io/engineering-education/how-to-build-authentication-api-with-jwt-token-in-nodejs/)) - consider
contributing it to the source code via a Pull Request :)

## Server Outside Traffic
Once you've handled both considerations above, you can direct the server to listen to outside traffic. Again run `yarn
setup_wizard` and skip to `Is this server going to be used outside this computer?`, which you can now answer `Y`. You
will get a warning to make sure you really intended to do that, and if you reiterate your response, the server will be
configured to listen to `0.0.0.0`, and you would be able to reach it from outside the computer.

Assuming you will no longer query the server from `https://localhost:3000`, but from some other domain, remember to fix
all the registered redirect URIs from the previous sections before attempting to use them.

![screenshot](images/screenshot.png)
# paperless.node

An alternative to Evernote specifically intended for indexing scanned paperwork/PDFs/mail in a private and trust-no-one architecture.

## Introduction

Following my [blogpost from 2012](https://uri.agassi.co/2012/09/29/going-paperless-using-evernote/) about using Evernote for indexing
your paperless office, Evernote has changed their service to lend itself less and less to my needs. That, with other shortcomings of
their solution (like a single gigantic blob to hold my private notebook, which taxed my backup system), I've decided to write my own
version using a [.Net desktop solution](https://dev.azure.com/uriagassi/Paperless).

This is a new web implementation, meant to be deployed on your local machine, or in your local intra network. It uses the same concepts,
but is cleaner, leaner, and more available to non-Microsoft-centric machines.

# Getting Started

## Deployment
The easiest way to use this application, is to install it locally on your machine

1. Install [Node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install/)
2. Clone this repo locally
3. Build the app
        
        paperless.node$ yarn install
        
411. Run the Setup Wizard

        paperless.node$ yarn setup_wizard 
        
     Fill up the location where you want your database to be in. You can skip the rest of the wizard for now.
5. Run the app

        paperless.node$ yarn prod
        
        (or for windows)
        C:\paperless.node>yarn windows_start

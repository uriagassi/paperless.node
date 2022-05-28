(function() {
  const fs = require('fs');
  const config = require('config');
  const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
  const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
  const TOKEN_PATH = 'token.json';
  module.exports.start = function (app, config, db) {
    app.get('/api/mail/auth', (req, res) => {
       withCreds(content => {
        authenticate(content, req.query.access_token, res)
      })
    })

    app.get('/api/mail/pending', (req, res) => {
      authorize(res, (gmail, auth) => {
        gmail.users.labels.list({userId: 'me'}, (err, r) => {
          if (err) {
            console.log(err)
            if (err.code == 401) {
              return getNewToken(auth, res)
            }
            return r.status(500).json(r)
          }
          let mainLabel = r.data.labels.find(l => l.name == 'Paperless')
          gmail.users.threads.list({userId: 'me', labelIds: [mainLabel.id]}, (err, r) => {
            if (err) {
              return res.status(500).json(r)
            }
            res.json({pendingThreads: r.data.threads.length})
            })
        })
      })
    })

  }

  function withCreds(callback) {
    fs.readFile(config.get('mail.credentials'), (err, content) => {
      callback(JSON.parse(content))
    });
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(res, callback) {
    withCreds(credentials => {
      const {client_secret, client_id, redirect_uris} = credentials.web;
      const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, config.get('mail.redirect_uri'));

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, res);
        oAuth2Client.setCredentials(JSON.parse(token));
        const gmail = google.gmail({version: 'v1', auth: oAuth2Client});
        callback(gmail, oAuth2Client);
      });
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   */
  function getNewToken(oAuth2Client, res) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    res.json({authenticate: authUrl})
  }

  function authenticate(credentials, code, res) {
    e.log(code)
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return res.status(401).json({'Error retrieving access token': err});
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return res.status(401).json(err);
      });
      res.json('OK')
    });
  }

  /**
   * Lists the labels in the user's account.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
})()

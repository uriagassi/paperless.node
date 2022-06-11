(function() {
  const fs = require('fs');
  const {google} = require('googleapis');
  const escape = require('escape-html');
  const mime = require('mime-types');
  const md5 = require('md5');
  const path = require('path')

// If modifying these scopes, delete token.json.
  const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.labels', 'https://www.googleapis.com/auth/gmail.modify'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
  const TOKEN_PATH = 'token.json';
  module.exports.start = function (app, config, notes, att) {
    app.get('/api/mail/auth', (req, res) => {
      withCreds(content => {
        authenticate(content, req.query.access_token, res)
      })
    })

    app.get('/api/mail/pending', (req, res) => {
      authorize(res, (gmail, auth) => {
        gmail.users.getProfile({userId: 'me'}, (err, r) => {
          if (err) {
            console.log(err)
            return res.status(err.code ?? 500).json(
              {authenticate: getNewToken(auth)})
          }
          let emailAddress = r.data.emailAddress
          gmail.users.labels.list({userId: 'me'}, (err, r) => {
            let mainLabel = r.data.labels.find(l => l.name == config.get('mail.pendingLabel'))
            if (mainLabel) {
              gmail.users.threads.list(
                {
                  userId: 'me',
                  labelIds: [mainLabel.id],
                  includeSpamTrash: false
                },
                (err, r) => {
                  if (err) {
                    return res.status(500).json(r)
                  }
                  res.json({
                    pendingThreads: r.data.threads?.length || 0,
                    emailAddress: emailAddress
                  })
                })
            } else {
              res.json({
                pendingThreads: 0,
                emailAddress: emailAddress
              })
            }
          })
        })
      })
    })

    app.post('/api/mail/import', (req, res) => {
      authorize(res, (gmail, auth) => {
        gmail.users.labels.list({userId: 'me'}, (err, labelRecords) => {
          let mainLabel = labelRecords.data.labels.find(l => l.name == config.get('mail.pendingLabel'))
          let doneLabel = labelRecords.data.labels.find(
            l => l.name == config.get('mail.doneLabel'))
          gmail.users.threads.list(
            {
              userId: 'me',
              labelIds: [mainLabel.id],
              includeSpamTrash: false,
            },
            (err, r) => {
              if (err) {
                return res.status(500).json(r)
              }
              const numOfNotes = 10
              const partialThreads = r.data.threads.slice(0, numOfNotes);
              let note = importMessages(gmail, req.user_name, partialThreads, [mainLabel.id],
                [doneLabel.id], labelRecords.data.labels)
              note.then((r1) => {
                console.log(r1)
                res.json({
                  pendingThreads: r.data.threads.length - partialThreads.length,
                })
              })
            })
        })
      })
    })

    function importMessages(gmail, user_name, threads, pendingLabels, doneLabels, allLabels)  {
      return new Promise(resolve => {
        if (!threads[0]) {
          resolve("OK")
        } else {
          importMessage(gmail, user_name, threads[0], pendingLabels, doneLabels, allLabels).then(() =>
            importMessages(gmail, user_name, threads.slice(1), pendingLabels, doneLabels, allLabels)).then(() => resolve("OK"))
        }
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
      if (config.has('mail.supported') && !config.get('mail.supported')) {
        res.status(402).json({notSupported: true})
        return
      }
      withCreds(credentials => {
        const {client_secret, client_id, redirect_uris} = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
          client_id, client_secret, config.get('mail.redirect_uri'));

        // Check if we have previously stored a token.
        fs.readFile(TOKEN_PATH, (err, token) => {
          if (err) {
            console.log(err)
            res.status(500).json(
              {authenticate: getNewToken(oAuth2Client)})
            return;
          }
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
    function getNewToken(oAuth2Client) {
      return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
    }

    function authenticate(credentials, code, res) {
      const {client_secret, client_id, redirect_uris} = credentials.web;
      const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return res.status(401).json(
          {'Error retrieving access token': err});
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return res.status(401).json(err);
        });
        res.json('OK')
      });
    }

    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    function importMessage(gmail, username, thread, pendingLabels, doneLabels, labels) {
      return new Promise((resolve, reject) =>  {
      gmail.users.threads.get({userId: "me", id: thread.id}, (err, thread) => {
        console.log(err)
        const message = thread.data?.messages?.[thread.data?.messages?.length - 1];
        if (message == null || doneLabels.find(
          l => message.labelIds.includes(l))) {
          gmail.users.messages.modify({
            removeLabelIds: pendingLabels,
            userId: "me",
            id: message.id
          })
          resolve("not imported")
          return
        }
        return messageToNote(gmail, username, message, labels).then(note => {
          notes.insertNote({
            createTime: note.createTime,
            title: note.title ?? "(no subject)",
            noteData: note.noteData,
            updateBy: username
          }, note.attachments, note.tags).then(() => {
            gmail.users.messages.modify({
              addLabelIds: doneLabels,
              removeLabelIds: pendingLabels,
              userId: "me",
              id: message.id
            })

            resolve("OK");
          });
        })
      })
      });
    }

    function messageToNote(gmail, username, message, labels) {
      let note = {
        attachments: [],
        title: "(no subject)",
        tags: []
      };
      message.labelIds.forEach(label => {
        console.log(label)
         let l = labels.find(x => x.id == label);
        console.log(l)
         if (l.type === "user" && l.name != config.get('mail.pendingLabel'))
           note.tags.push(l.name);
      })
      if (config.get('mail.importedTag')) {
         note.tags.push(config.get('mail.importedTag'));
      }

      //loop through the headers to get from,date,subject, body
      message.payload.headers.forEach(mParts => {
        switch (mParts.name) {
          case "Date":
            note.createTime = new Date(mParts.value).toISOString().replace(/T.*/, '');
            break
          case "From":
            note.noteData = `<div class='paperless-email-import-from'>From: ${escape(
              mParts.value)}</div>`;
            break
          case "Subject":
            if (mParts.value) {
              note.title = mParts.value;
            }
        }
      })
      if (message.payload.parts) {
        let last = undefined
        message.payload.parts.forEach(p => {
          if (last) {
            last = last.then(() => processPart(gmail, message, note, p));
          } else {
            last = processPart(gmail, message, note, p)
          }

        })
        return last
      } else {
        return processPart(gmail, message, note, message.payload);
      }
    }

    function processPart(gmail, message, note, part) {
      return new Promise(resolve => {
        if (part.filename) {
          let attId = part.body.attachmentId;
          return gmail.users.messages.attachments.get(
            {userId: "me", messageId: message.id, id: attId},
            (err, attachPart) => {
              let data = fromBase64ForUrlString(attachPart.data);
              let attachment = {
                fileName: part.filename,
                mime: part.mimeType,
                hash: md5(data),
                size: attachPart.data.size
              };
              console.log(attachment)
              if (attachment.mime
                === "application/octet-stream") attachment.mime = mime.lookup(
                attachment.fileName);
              att.setUniqueFilename(attachment, config)
              console.log(`writing file ${attachment.uniqueFilename}`)
              fs.writeFileSync(
                path.join(attachmentsDir, attachment.uniqueFilename), Buffer.from(data))
              note.attachments.push(attachment);
              note.noteData += att.getHtmlForAttachment(attachment);
              resolve(note);
            })
        } else {
          let data = null;
          if (part.mimeType === "text/html") {
            data = fromBase64ForUrlString(part.body);
          } else if (part.parts) {
            let subpart = undefined;
            if ((subpart = part.parts.find(i => i.mimeType === "text/html"))) {
              data = fromBase64ForUrlString(subpart.body);
            } else if ((subpart = part.parts.find(
              i => i.mimeType === "text/plain"))) {
              data = fromBase64ForUrlString(subpart.body);
            }
          }
          if (data) {
            note.noteData += `<div class='paperless-email-text'>${Buffer.from(
              data, 'utf-8')}</div>`;
          }
          resolve(note)
        }
      })
    }

    function fromBase64ForUrlString(base64ForUrlInput) {
      return Buffer.from(base64ForUrlInput.data, 'base64url')
    }
  }
})()

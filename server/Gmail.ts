import fs from "fs";
import {gmail_v1, google} from "googleapis";
import escape from "escape-html";
import mime from "mime-types";
import md5 from "md5";
import path from "path";
import {Express, Response} from "express";
import {Notes, Note} from "./Notes.js";
import {Attachment, Attachments} from "./Attachment.js";
import config from "config";
import {OAuth2Client} from "google-auth-library";

export class Gmail {
  // If modifying these scopes, delete token.json.
  SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.labels', 'https://www.googleapis.com/auth/gmail.modify'];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  TOKEN_PATH = 'token.json';
  private notes: Notes;
  private att: Attachments;
  private readonly credentials : Credentials = JSON.parse(fs.readFileSync(config.get('mail.credentials')).toString());

  constructor(notes: Notes, att: Attachments) {
    this.notes = notes;
    this.att = att;
  }

  listen(app: Express) {
    app.get('/api/mail/auth', (req, res) => {
        this.authenticate(req.query.access_token as string, res)
    })

    app.get('/api/mail/pending', (req, res) => {
      this.authorize(res, (gmail, auth) => {
        gmail.users.getProfile({userId: 'me'}, (err, r) => {
          if (err) {
            console.log(err)
            return res.status(500).json(
                {authenticate: this.getNewToken(auth)})
          }
          let emailAddress = r!.data.emailAddress
          gmail.users.labels.list({userId: 'me'}, (err, r) => {
            let mainLabel = r?.data.labels?.find(l => l.name == config.get('mail.pendingLabel'))
            if (mainLabel) {
              gmail.users.threads.list(
                  {
                    userId: 'me',
                    labelIds: [mainLabel.id!],
                    includeSpamTrash: false
                  },
                  (err, r) => {
                    if (err) {
                      return res.status(500).json(r)
                    }
                    res.json({
                      pendingThreads: r?.data.threads?.length || 0,
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
      this.authorize(res, gmail => {
        gmail.users.labels.list({userId: 'me'}, (err, labelRecords) => {
          let mainLabel = labelRecords?.data.labels?.find(l => l.name == config.get('mail.pendingLabel'))
          let doneLabel = labelRecords?.data.labels?.find(
              l => l.name == config.get('mail.doneLabel'))
          if (mainLabel) {
            gmail.users.threads.list(
                {
                  userId: 'me',
                  labelIds: [mainLabel.id!],
                  includeSpamTrash: false,
                },
                (err, r) => {
                  if (err) {
                    return res.status(500).json(r)
                  }
                  const numOfNotes = 10
                  const partialThreads = r?.data.threads?.slice(0, numOfNotes) ?? [];
                  let note = this.importMessages(gmail, req.user_name!, partialThreads, mainLabel!.id!,
                      doneLabel?.id, labelRecords!.data.labels!)
                  note.then((r1) => {
                    console.log(r1)
                    res.json({
                      pendingThreads: (r?.data.threads?.length ?? 0) - partialThreads.length,
                    })
                  })
                })
          }
        })
      })
    })
  }

  importMessages(gmail: gmail_v1.Gmail, user_name: string, threads: {id?: string | null}[], pendingLabel: string, doneLabel: string|undefined|null, allLabels: gmail_v1.Schema$Label[]) {
    return new Promise(resolve => {
      if (!threads[0]) {
        resolve("OK")
      } else {
        this.importMessage(gmail, user_name, threads[0], pendingLabel, doneLabel, allLabels).then(() =>
            this.importMessages(gmail, user_name, threads.slice(1), pendingLabel, doneLabel, allLabels)).then(() => resolve("OK"))
      }
    })
  }

  authorize(res: Response, callback: (arg0: gmail_v1.Gmail, arg1: OAuth2Client) => any) {
      if (config.has('mail.supported') && !config.get('mail.supported')) {
        res.status(402).json({notSupported: true})
        return
      }
        const {client_secret, client_id } = this.credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
          client_id, client_secret, config.get('mail.redirect_uri'));

        // Check if we have previously stored a token.
        fs.readFile(this.TOKEN_PATH, (err, token) => {
          if (err) {
            console.log(err)
            res.status(500).json(
              {authenticate: this.getNewToken(oAuth2Client)})
            return;
          }
          oAuth2Client.setCredentials(JSON.parse(token.toString()));
          const gmail = google.gmail({version: 'v1', auth: oAuth2Client});
          callback(gmail, oAuth2Client);
        });
    }

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     */
    getNewToken(oAuth2Client: OAuth2Client) {
      return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
      });
    }

    authenticate(code: string, res: Response) {
      const {client_secret, client_id} = this.credentials.web;
      const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, config.get('mail.redirect_uri'));
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return res.status(401).json(
          {'Error retrieving access token': err});
        oAuth2Client.setCredentials(token!);
        // Store the token to disk for later program executions
        fs.writeFile(this.TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return res.status(401).json(err);
        });
        res.json('OK')
      });
    }

    attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    importMessage(gmail: gmail_v1.Gmail, username:string, thread: {id?: string | null | undefined}, pendingLabel: string, doneLabel: string | null | undefined, labels: gmail_v1.Schema$Label[]) {
      return new Promise(resolve =>  {
      gmail.users.threads.get({userId: "me", id: thread.id!}, (err, threadData) => {
        console.log(err)
        const message = threadData?.data?.messages?.[threadData.data?.messages?.length - 1];
        if (message == null || doneLabel && message.labelIds?.includes(doneLabel)) {
          gmail.users.threads.modify({
            requestBody: {
              removeLabelIds: [pendingLabel]
            },
            userId: "me",
            id: thread.id!
          })
          resolve("not imported")
          return
        }
        this.messageToNote(gmail, username, message, labels).then((note: ExtendedNote) => {
          const doneLabels:string[] = []
          if (doneLabel) doneLabels.push(doneLabel)
          this.notes.insertNote({
            createTime: note.createTime,
            title: note.title ?? "(no subject)",
            noteData: note.noteData,
            updateBy: username
          }, note.attachments, note.tags).then(() => {
            gmail.users.threads.modify({
              requestBody: {
                addLabelIds: doneLabels,
                removeLabelIds: [pendingLabel]
              },
              userId: "me",
              id: thread.id!
            })

            resolve("OK");
          });
        })
      })
      });
    }

    messageToNote(gmail:gmail_v1.Gmail, username:string, message: gmail_v1.Schema$Message, labels: gmail_v1.Schema$Label[]) : Promise<ExtendedNote> {
      let note = {
        attachments: [],
        title: "(no subject)",
        tags: [],
        updateBy: username,
        createTime: '',
        noteData: ''
      } as ExtendedNote;
      message.labelIds?.forEach(label => {
        console.log(label)
         let l = labels.find(x => x.id == label);
        console.log(l)
         if (l && l.type === "user" && l.name != config.get('mail.pendingLabel'))
           note.tags.push(l.name!);
      })
      if (config.get('mail.importedTag')) {
         note.tags.push(config.get('mail.importedTag'));
      }

      //loop through the headers to get from,date,subject, body
      message.payload?.headers?.forEach(mParts => {
        switch (mParts.name) {
          case "Date":
            note.createTime = new Date(mParts.value!).toISOString().replace(/T.*/, '');
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
      if (message.payload?.parts) {
        let last: Promise<ExtendedNote>|undefined = undefined
        message.payload.parts.forEach(p => {
          if (last) {
            last = last.then(() => this.processPart(gmail, message, note, p));
          } else {
            last = this.processPart(gmail, message, note, p)
          }

        })
        return last!
      } else {
        return this.processPart(gmail, message, note, message.payload!);
      }
    }

    processPart(gmail: gmail_v1.Gmail, message: gmail_v1.Schema$Message, note: ExtendedNote, part: gmail_v1.Schema$MessagePart) : Promise<ExtendedNote> {
      return new Promise(resolve => {
        if (part.filename) {
          let attId = part.body?.attachmentId!;
          return gmail.users.messages.attachments.get(
            {userId: "me", messageId: message.id!, id: attId},
            (err, attachPart) => {
              if (attachPart) {
                let data = this.fromBase64ForUrlString(attachPart.data);
                let attachment = {
                  fileName: part.filename!,
                  mime: part.mimeType!,
                  hash: md5(data),
                  size: attachPart.data.size??0
                } as Attachment;
                console.log(attachment)
                if (attachment.mime
                    === "application/octet-stream") attachment.mime = mime.lookup(
                    attachment.fileName!) || "application/octet-stream";
                this.att.setUniqueFilename(attachment)
                console.log(`writing file ${attachment.uniqueFilename!}`)
                fs.writeFileSync(
                    path.join(this.attachmentsDir, attachment.uniqueFilename!), Buffer.from(data))
                note.attachments.push(attachment);
                note.noteData += this.att.getHtmlForAttachment(attachment);
              }
                resolve(note);
            })
        } else {
          let data:Buffer|null = null;
          if (part.mimeType === "text/html") {
            data = this.fromBase64ForUrlString(part.body!);
          } else if (part.parts) {
            let subpart : gmail_v1.Schema$MessagePart | undefined;
            if ((subpart = part.parts.find(i => i.mimeType === "text/html"))) {
              data = this.fromBase64ForUrlString(subpart.body!);
            } else if ((subpart = part.parts.find(
              i => i.mimeType === "text/plain"))) {
              data = this.fromBase64ForUrlString(subpart.body!);
            }
          }
          if (data) {
            note.noteData += `<div class='paperless-email-text'>${data.toString()}</div>`;
          }
          resolve(note)
        }
      })
    }

  fromBase64ForUrlString(base64ForUrlInput: gmail_v1.Schema$MessagePartBody) {
      return Buffer.from(base64ForUrlInput.data!, 'base64url')
    }
}

interface Credentials {
  web: {client_secret:string, client_id:string}
}

interface ExtendedNote extends Note {
  attachments: Attachment[],
  tags: string[]
}

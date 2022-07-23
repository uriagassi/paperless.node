import fs from "fs";
import { gmail_v1, google } from "googleapis";
import escape from "escape-html";
import mime from "mime-types";
import md5 from "md5";
import path from "path";
import { Express, RequestHandler, Response } from "express";
import { Notes, Note } from "./Notes.js";
import { NamedAttachment, Attachments, Attachment } from "./Attachment.js";
import config from "config";
import { OAuth2Client } from "google-auth-library";
import { GaxiosPromise } from "googleapis-common";
import rateLimit from "express-rate-limit";

export class Gmail {
  // If modifying these scopes, delete token.json.
  SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.modify",
  ];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  TOKEN_PATH = "token.json";
  private notes: Notes;
  private att: Attachments;
  private readonly credentials: Credentials = JSON.parse(
    fs.readFileSync(config.get("mail.credentials")).toString()
  );
  private csrfProtection: RequestHandler;

  constructor(notes: Notes, att: Attachments, csrfProtection: RequestHandler) {
    this.notes = notes;
    this.att = att;
    this.csrfProtection = csrfProtection;
  }

  listen(app: Express) {
    app.get(
      "/api/mail/auth",
      rateLimit({
        windowMs: 10 * 60_000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many gmail requests - throttling",
      }),
      (req, res) => {
        this.authenticate(req.query.access_token as string, res);
      }
    );

    app.get(
      "/api/mail/pending",
      rateLimit({
        windowMs: 2 * 60_000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many gmail requests - throttling",
      }),
      async (_req, res) => {
        try {
          const gmail = await this.authorize(res);

          const {
            data: { emailAddress },
          } = await gmail.users.getProfile({ userId: "me" });
          const { mainLabel } = await this.getLabelData(gmail);

          if (mainLabel) {
            const {
              data: { threads },
            } = await gmail.users.threads.list({
              userId: "me",
              labelIds: [mainLabel],
              includeSpamTrash: false,
            });

            res.json({
              pendingThreads: threads?.length || 0,
              emailAddress: emailAddress,
            });
          } else {
            res.json({
              pendingThreads: 0,
              emailAddress: emailAddress,
            });
          }
        } catch (err) {
          console.log(err);
          return res.status(500).json(err);
        }
      }
    );

    app.post(
      "/api/mail/import",
      this.csrfProtection,
      rateLimit({
        windowMs: 10 * 60_000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many gmail requests - throttling",
      }),
      async (req, res) => {
        try {
          const gmail = await this.authorize(res);
          const { mainLabel, doneLabel, labels } = await this.getLabelData(
            gmail
          );
          if (mainLabel && labels) {
            const {
              data: { threads },
            } = await gmail.users.threads.list({
              userId: "me",
              labelIds: [mainLabel],
              includeSpamTrash: false,
            });

            const numOfNotes = 10;
            const messages =
              threads?.slice(0, numOfNotes).map((thread) => {
                if (thread.id)
                  return gmail.users.threads.get({
                    userId: "me",
                    id: thread.id,
                  });
              }) || [];
            for (const message of messages) {
              if (message) {
                await this.importMessage(
                  gmail,
                  req.user_name ?? "",
                  message,
                  mainLabel,
                  doneLabel,
                  labels
                );
              }
            }
            res.json({
              pendingThreads: (threads?.length ?? 0) - messages.length,
            });
          }
        } catch (err) {
          console.log(err);
          return res.status(500).json(err);
        }
      }
    );
  }

  async getLabelData(gmail: gmail_v1.Gmail) {
    const {
      data: { labels: raw_labels },
    } = await gmail.users.labels.list({ userId: "me" });
    const labels: { [id: string]: string } = {};
    if (raw_labels) {
      const pendingLabelName = config.get("mail.pendingLabel");
      const doneLabelName = config.get("mail.doneLabel");
      let mainLabel: string | null = null;
      let doneLabel: string | null = null;
      for (const { id, name, type } of raw_labels) {
        if (name && id) {
          if (name == pendingLabelName) {
            mainLabel = id;
          } else if (name == doneLabelName) {
            doneLabel = id;
          } else if (type === "user") {
            labels[id] = name;
          }
        }
      }
      return { mainLabel, doneLabel, labels };
    }
    return { mainLabel: null, doneLabel: null, labels };
  }

  async authorize(res: Response) {
    if (config.has("mail.supported") && !config.get("mail.supported")) {
      res.status(402).json({ notSupported: true });
      return Promise.reject(null);
    }
    const { client_secret, client_id } = this.credentials.web;
    const auth = new google.auth.OAuth2(
      client_id,
      client_secret,
      config.get("mail.redirect_uri")
    );

    try {
      // Check if we have previously stored a token.
      const token = fs.readFileSync(this.TOKEN_PATH);
      auth.setCredentials(JSON.parse(token.toString()));
      return google.gmail({ version: "v1", auth });
    } catch (err) {
      console.log(err);
      return Promise.reject({ authenticate: this.getNewToken(auth) });
    }
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   */
  getNewToken(auth: OAuth2Client) {
    return auth.generateAuthUrl({
      access_type: "offline",
      scope: this.SCOPES,
    });
  }

  authenticate(code: string, res: Response) {
    const { client_secret, client_id } = this.credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      config.get("mail.redirect_uri")
    );
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return res.status(401).json({ "Error retrieving access token": err });
      if (token) oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(this.TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return res.status(401).json(err);
      });
      res.json("OK");
    });
  }

  attachmentsDir = config.get("paperless.baseDir") + "/attachments/";

  async importMessage(
    gmail: gmail_v1.Gmail,
    username: string,
    thread: GaxiosPromise<gmail_v1.Schema$Thread>,
    pendingLabel: string,
    doneLabel: string | null | undefined,
    labels: { [id: string]: string }
  ) {
    const {
      data: { messages },
    } = await thread;
    const message = messages?.[messages?.length - 1];
    if (message == null) {
      return "not imported";
    }
    if (doneLabel && message.labelIds?.includes(doneLabel)) {
      await gmail.users.threads.modify({
        requestBody: {
          removeLabelIds: [pendingLabel],
        },
        userId: "me",
        id: message.threadId ?? "",
      });
      return "not imported";
    }
    const note = await this.messageToNote(gmail, username, message, labels);
    const doneLabels = doneLabel ? [doneLabel] : [];
    this.notes.insertNote(
      {
        createTime: note.createTime,
        title: note.title ?? "(no subject)",
        noteData: note.noteData,
        updateBy: username,
      },
      note.attachments,
      note.tags
    );
    await gmail.users.threads.modify({
      requestBody: {
        addLabelIds: doneLabels,
        removeLabelIds: [pendingLabel],
      },
      userId: "me",
      id: message.threadId ?? "",
    });

    return "OK";
  }

  async messageToNote(
    gmail: gmail_v1.Gmail,
    username: string,
    message: gmail_v1.Schema$Message,
    labels: { [id: string]: string }
  ): Promise<ExtendedNote> {
    const note = {
      attachments: [],
      title: "(no subject)",
      tags: message.labelIds?.map((l) => labels[l]).filter((n) => !!n) || [],
      updateBy: username,
      createTime: "",
      noteData: "",
    } as ExtendedNote;

    if (config.get("mail.importedTag")) {
      note.tags.push(config.get("mail.importedTag"));
    }

    //loop through the headers to get from,date,subject, body
    message.payload?.headers?.forEach((mParts) => {
      switch (mParts.name) {
        case "Date":
          try {
            note.createTime = new Date(mParts.value ?? 0)
              .toISOString()
              .replace(/T.*/, "");
          } catch (err) {
            console.log(
              `could not parse date ${mParts.value} - falling back on received`
            );
          }
          break;
        case "From":
          note.noteData = `<div class='paperless-email-import-from'>From: ${escape(
            mParts.value
          )}</div>`;
          break;
        case "Subject":
        case "subject":
          if (mParts.value) {
            note.title = mParts.value;
          }
          break;
        case "Received":
          if (!note.createTime && mParts.value) {
            const dateString = mParts.value.split(";")[1].trim();
            note.createTime = new Date(dateString)
              .toISOString()
              .replace(/T.*/, "");
          }
      }
    });
    if (message.payload?.parts) {
      for (const p of message.payload.parts) {
        await this.processPart(gmail, message, note, p);
      }
    } else if (message.payload) {
      await this.processPart(gmail, message, note, message.payload);
    }
    return note;
  }

  async processPart(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message,
    note: ExtendedNote,
    part: gmail_v1.Schema$MessagePart
  ) {
    if (part.filename && part.body?.attachmentId && message.id) {
      const {
        data: { data, size },
      } = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: message.id,
        id: part.body.attachmentId,
      });

      if (data) {
        const binaryData = this.fromBase64ForUrlString(data);
        const attachment = {
          fileName: part.filename,
          mime: part.mimeType,
          hash: md5(binaryData),
          size: size ?? 0,
        } as Attachment;
        if (attachment.mime === "application/octet-stream")
          attachment.mime =
            mime.lookup(attachment.fileName) || "application/octet-stream";
        const named = this.att.setUniqueFilename(attachment);
        console.log(`writing file ${named.uniqueFilename}`);
        fs.writeFileSync(
          path.join(this.attachmentsDir, named.uniqueFilename),
          Buffer.from(binaryData)
        );
        note.attachments.push(named);
        note.noteData += this.att.getHtmlForAttachment(named);
      }
    } else {
      let data: Buffer | null = null;
      if (part.mimeType === "text/html" && part.body?.data) {
        data = this.fromBase64ForUrlString(part.body.data);
      } else if (part.parts) {
        let subpart: gmail_v1.Schema$MessagePart | undefined;
        if (
          (subpart = part.parts.find((i) => i.mimeType === "text/html"))?.body
            ?.data
        ) {
          data = this.fromBase64ForUrlString(subpart.body.data);
        } else if (
          (subpart = part.parts.find((i) => i.mimeType === "text/plain"))?.body
            ?.data
        ) {
          data = this.fromBase64ForUrlString(subpart.body.data);
        }
      }
      if (data) {
        note.noteData += `<div class='paperless-email-text'>${data.toString()}</div>`;
      }
    }
  }

  fromBase64ForUrlString(data: string) {
    return Buffer.from(data, "base64url");
  }
}

interface Credentials {
  web: { client_secret: string; client_id: string };
}

interface ExtendedNote extends Note {
  attachments: NamedAttachment[];
  tags: string[];
}

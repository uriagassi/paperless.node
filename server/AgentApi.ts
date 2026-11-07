import { Express, Request, Response } from "express";
import { marked } from "marked";
import config from "config";
import fs from "fs";

const DOC_URL = new URL("../docs/agent-api.md", import.meta.url);
const PLACEHOLDER = "{BASE_URL}";
const MARKDOWN = "text/markdown";

let docSource: string | undefined;
const readDoc = () => (docSource ??= fs.readFileSync(DOC_URL, "utf-8"));

function originOf(candidate: string): string | undefined {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

const configuredBaseUrl = () =>
  config.has("server.publicBaseUrl")
    ? config.get<string>("server.publicBaseUrl")
    : undefined;

export function baseUrl(
  req: Pick<Request, "host" | "protocol">,
  publicBaseUrl = configuredBaseUrl()
): string {
  const configured = publicBaseUrl && originOf(publicBaseUrl);
  if (configured) return configured;
  return req.host ? (originOf(`${req.protocol}://${req.host}`) ?? "") : "";
}

export function renderAgentApiMarkdown(base: string): string {
  return readDoc().split(PLACEHOLDER).join(base);
}

const page = (body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>paperless.node Agent API</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem}
pre{background:#8881;padding:.75rem;overflow-x:auto}code{font-family:ui-monospace,monospace}
table{border-collapse:collapse}td,th{border:1px solid #8886;padding:.25rem .5rem;text-align:left}
blockquote{margin-left:0;padding-left:1rem;border-left:4px solid #8886}
</style></head><body>${body}</body></html>`;

export function registerAgentApiRoutes(app: Express) {
  const serve = (forceMarkdown: boolean) => (req: Request, res: Response) => {
    const markdown = renderAgentApiMarkdown(baseUrl(req));
    res.vary("Accept");
    const wantsMarkdown =
      forceMarkdown || req.accepts(["html", MARKDOWN]) === MARKDOWN;
    if (wantsMarkdown) {
      res.type(`${MARKDOWN}; charset=utf-8`).send(markdown);
    } else {
      res.type("html").send(page(marked.parse(markdown, { async: false })));
    }
  };
  app.get("/agent-api", serve(false));
  app.get("/agent-api.md", serve(true));
}


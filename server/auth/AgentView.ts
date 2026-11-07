import { Request } from "express";

export function agentNoteListRow(row: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { attachments, ...rest } = row as { attachments?: string };
  return rest;
}

export function agentNoteAttachments(req: Request, attachments: { id: number }[]) {
  return req.level === "agent"
    ? attachments.map(({ id }) => ({ id }))
    : attachments;
}

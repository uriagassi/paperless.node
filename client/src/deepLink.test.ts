import { describe, expect, it, vi } from "vitest";
import { resolveDeepLink } from "./deepLink";
import type { Notebook, Tag } from "./ServerAPI";

const inbox = { key: 1, name: "Inbox", kind: "notebook", type: "I" } as unknown as Notebook;
const taxes = { key: 2, name: "Taxes", kind: "notebook" } as unknown as Notebook;
const tag = { key: 2, name: "taxes", kind: "tag" } as unknown as Tag;
const data = { notebooks: [inbox, taxes], tags: [tag] };

describe("resolveDeepLink", () => {
  it("keeps full share links working without loading the note", async () => {
    const loadNote = vi.fn();
    expect(
      await resolveDeepLink("?noteId=7&folderKind=tag&folderKey=2", data, loadNote)
    ).toEqual({ folder: tag, noteId: 7 });
    expect(
      await resolveDeepLink("?noteId=7&folderKind=notebook&folderKey=2", data, loadNote)
    ).toEqual({ folder: taxes, noteId: 7 });
    expect(loadNote).not.toHaveBeenCalled();
  });

  it("resolves the note's own notebook for /?noteId=X", async () => {
    const loadNote = vi.fn().mockResolvedValue({ notebookId: 2 });
    expect(await resolveDeepLink("?noteId=7", data, loadNote)).toEqual({
      folder: taxes,
      noteId: 7,
    });
    expect(loadNote).toHaveBeenCalledWith(7);
  });

  it("selects nothing when the note is missing or the fetch fails", async () => {
    expect(await resolveDeepLink("?noteId=7", data, async () => undefined)).toEqual({});
    expect(
      await resolveDeepLink("?noteId=7", data, async () => {
        throw new Error("boom");
      })
    ).toEqual({});
  });

  it("ignores links without a valid noteId", async () => {
    const loadNote = vi.fn();
    expect(await resolveDeepLink("", data, loadNote)).toEqual({});
    expect(await resolveDeepLink("?noteId=abc", data, loadNote)).toEqual({});
  });
});

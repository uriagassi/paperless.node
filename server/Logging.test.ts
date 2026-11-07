import { describe, expect, it } from "vitest";
import { Console } from "console";
import { Writable } from "stream";
import type { Request } from "express";
import { installLogging, roleLabel } from "./Logging.js";

const req = (level: string, user_name: string) =>
  ({ level, user_name }) as unknown as Request;

describe("roleLabel", () => {
  it("sanitizes names so they cannot forge log lines or break the label", () => {
    expect(roleLabel(req("user", "evil]\n[agent:root"))).toBe("user:evil_agent:root");
    expect(roleLabel(req("user", "a  b\tc"))).toBe("user:a_b_c");
  });

  it("has no label before auth has set an identity", () => {
    expect(roleLabel({ level: "user" } as unknown as Request)).toBeUndefined();
  });
});

describe("lines outside a request", () => {
  it("are formatted exactly as console-stamp does by default", () => {
    (console as { Console?: unknown }).Console ??= Console;
    const capture = (install: (c: Console, out: Writable) => void) => {
      let text = "";
      const out = new Writable({
        write(chunk, _e, done) {
          text += chunk.toString();
          done();
        },
      });
      const c = new Console(out);
      install(c, out);
      c.log("Server listening on http://0.0.0.0:3000");
      return text.replace(/\[\d[^\]]*\]/, "[ts]");
    };
    const stamped = capture((c, out) => installLogging(c, out));
    expect(stamped).toBe("[ts] [LOG]   Server listening on http://0.0.0.0:3000\n");
  });
});

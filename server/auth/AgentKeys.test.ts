import { describe, expect, it } from "vitest";
import { AgentKeys } from "./AgentKeys.js";

describe("AgentKeys", () => {
  it("matches a plaintext key to its agent name", () => {
    const keys = AgentKeys.fromConfig([{ name: "alice", key: "s3cret" }]);
    expect(keys.match("s3cret")).toBe("alice");
  });

  it("matches a hashed key to its agent name", () => {
    const keys = AgentKeys.fromConfig([
      { name: "bob", keyHash: AgentKeys.hash("s3cret") },
    ]);
    expect(keys.match("s3cret")).toBe("bob");
  });

  it("rejects unknown and empty tokens", () => {
    const keys = AgentKeys.fromConfig([{ name: "alice", key: "s3cret" }]);
    expect(keys.match("nope")).toBeUndefined();
    expect(keys.match("")).toBeUndefined();
  });

  it("allows no agents when nothing is configured", () => {
    expect(AgentKeys.fromConfig(undefined).match("anything")).toBeUndefined();
  });

  it.each([
    ["missing name", [{ key: "k" }]],
    ["missing key", [{ name: "a" }]],
    ["empty key", [{ name: "a", key: "" }]],
    ["both key and keyHash", [{ name: "a", key: "k", keyHash: AgentKeys.hash("k") }]],
    ["malformed keyHash", [{ name: "a", keyHash: "abc" }]],
    ["duplicate name", [{ name: "a", key: "k1" }, { name: "a", key: "k2" }]],
    ["duplicate key", [{ name: "a", key: "k" }, { name: "b", key: "k" }]],
  ])("fails startup on %s", (_label, entries) => {
    expect(() => AgentKeys.fromConfig(entries)).toThrow();
  });
});

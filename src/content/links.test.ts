import { describe, expect, it } from "vitest";
import { messageFiles } from "../../tests/message-files";
import { LINK_GROUPS } from "./links";

const languages = Object.values(messageFiles) as (typeof import("../../messages/en.json"))[];
const all = LINK_GROUPS.flatMap((g) => g.links);

describe("spec 0019: useful links data", () => {
  it("AC-4: every group has links, and ids and addresses are unique", () => {
    for (const group of LINK_GROUPS) expect(group.links.length, group.id).toBeGreaterThan(0);
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    expect(new Set(all.map((l) => l.href)).size).toBe(all.length);
  });

  it("AC-3: every link is a plain https address", () => {
    for (const link of all) {
      const url = new URL(link.href);
      expect(url.protocol, link.href).toBe("https:");
      expect(url.username + url.password, link.href).toBe("");
    }
  });

  it("AC-2, AC-4: every link and group has a title or description in every language", () => {
    for (const messages of languages) {
      for (const link of all) expect(messages.links.items[link.id].trim(), link.id).not.toBe("");
      for (const group of LINK_GROUPS) expect(messages.links.groups[group.id].trim(), group.id).not.toBe("");
    }
  });

  it("AC-2: names are shown as written, so none is empty or a sentence", () => {
    for (const link of all) {
      expect(link.name.trim(), link.id).not.toBe("");
      expect(link.name.length, link.id).toBeLessThan(50);
    }
  });
});

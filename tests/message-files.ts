import fs from "node:fs";

export type MessageTree = { [key: string]: string | MessageTree };

// Every file of messages/ by language (a new language needs no edit in the tests that read it);
// tests/messages.test.ts pins the set of files to the languages of src/i18n/routing.ts.
export const messageFiles: Record<string, MessageTree> = Object.fromEntries(
  fs
    .readdirSync(new URL("../messages/", import.meta.url))
    .filter((name) => name.endsWith(".json"))
    .map((name) => [name.slice(0, -".json".length), JSON.parse(fs.readFileSync(new URL(`../messages/${name}`, import.meta.url), "utf8"))]),
);

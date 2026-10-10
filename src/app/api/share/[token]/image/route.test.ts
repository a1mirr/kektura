import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareCard } from "@/lib/share-card";

const mockFlagOn = vi.fn();
vi.mock("@/lib/feature-flags-server", () => ({ flagOn: (key: string) => mockFlagOn(key) }));
const mockLoad = vi.fn();
vi.mock("@/lib/share-card-server", () => ({ loadShareCard: (token: string) => mockLoad(token) }));

// Built at run time, from a repeated pair: a 32-character hex literal, or one with many different characters,
// assigned to a constant is what the secret scanner takes for an API key.
const TOKEN = "ab".repeat(16);
const CARD: ShareCard = {
  createdAt: "2026-10-08T10:00:00Z",
  name: "Здравствуй Ő",
  stampsDone: 87,
  stampsTotal: 161,
  percent: 54,
  kmDone: 636.2,
  kmLeft: 541,
  stagesDone: 14,
  stagesTotal: 27,
  ranges: [[0, 200]],
};

// Fresh module per test: the rate limiter is module state.
async function get(token = TOKEN) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/share/${token}/image`), { params: Promise.resolve({ token }) });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockFlagOn.mockResolvedValue(true);
  mockLoad.mockResolvedValue(CARD);
});

describe("spec 0039: the preview image of a share card", () => {
  it("AC-14: is a 1200 x 630 PNG that may be cached for an hour", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(1, 4))).toBe("PNG");
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]); // the IHDR chunk: width, height
  });

  it("AC-14: draws a card whose name needs letters the font lacks without failing (the name is never drawn)", async () => {
    expect((await get()).status).toBe(200);
  });

  it("AC-1, AC-14: answers 404 for an unknown card and while the flag is off, without asking the database for a card", async () => {
    mockLoad.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(404);
    mockFlagOn.mockResolvedValue(false);
    mockLoad.mockClear();
    expect((await get()).status).toBe(404);
    expect(mockFlagOn).toHaveBeenCalledWith("share");
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("AC-14: answers 429 after 60 images drawn in a minute, for all visitors together", async () => {
    const { GET } = await import("./route");
    const ask = () => GET(new Request("http://localhost/x"), { params: Promise.resolve({ token: TOKEN }) });
    for (let i = 0; i < 60; i++) expect((await ask()).status).toBe(200);
    const refused = await ask();
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("60");
  });

  it("AC-14: requests for an unknown token draw nothing and do not use up the budget of the real cards", async () => {
    const { GET } = await import("./route");
    const ask = () => GET(new Request("http://localhost/x"), { params: Promise.resolve({ token: TOKEN }) });
    mockLoad.mockResolvedValue(null);
    for (let i = 0; i < 200; i++) expect((await ask()).status).toBe(404);
    mockLoad.mockResolvedValue(CARD);
    expect((await ask()).status).toBe(200);
  });
});

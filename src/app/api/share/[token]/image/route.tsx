import { ImageResponse } from "next/og";
import { flagOn } from "@/lib/feature-flags-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { shareMapPaths } from "@/lib/share-card";
import { loadShareCard } from "@/lib/share-card-server";
import { TRAIL_ROUTE } from "@/lib/share-route";

// Under /api, so the proxy and the language routing leave it alone.
//
// It carries only the trail's name, the percentage and two numbers: the font of `ImageResponse` has no Cyrillic, so
// no word that needs a translation (and no display name) is drawn. Wording lives in the page's tags (title,
// description).

const BLUE = "#2563eb";
const GREY = "#d6d3d1";
const NOT_FOUND = () => new Response("Not found", { status: 404 });

// Drawing an image costs more than a page: one budget for all the images drawn, which no honest use comes near.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await flagOn("share"))) return NOT_FOUND();
  const card = await loadShareCard(token);
  if (!card) return NOT_FOUND();
  // Only a drawn image is charged: an unknown token costs a lookup, not a drawing, so it cannot use up the budget.
  if (!limiter.allow("images")) return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });

  const map = shareMapPaths(TRAIL_ROUTE, card.ranges, 560);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#f8fafc", padding: 60 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 500 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: BLUE }}>Országos Kéktúra</div>
          <div style={{ display: "flex", fontSize: 190, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, marginTop: 20 }}>{card.percent}%</div>
          <div style={{ display: "flex", width: 500, height: 18, borderRadius: 9, background: GREY, marginTop: 10 }}>
            <div style={{ display: "flex", width: (500 * card.percent) / 100, height: 18, borderRadius: 9, background: BLUE }} />
          </div>
          <div style={{ display: "flex", fontSize: 48, color: "#334155", marginTop: 36 }}>{`${card.stampsDone} / ${card.stampsTotal}`}</div>
          <div style={{ display: "flex", fontSize: 48, color: "#334155", marginTop: 8 }}>{`${Math.round(card.kmDone)} km`}</div>
        </div>
        <div style={{ display: "flex", marginLeft: 40, width: 560, height: map.height }}>
          <svg width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`}>
            <path d={map.trail} fill="none" stroke={GREY} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            {map.walked && <path d={map.walked} fill="none" stroke={BLUE} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
      </div>
    ),
    // A card never changes, but it can be deleted: an hour is long enough for the messenger and short enough for that.
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

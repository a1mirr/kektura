export type LinkId =
  | "kekturaHu"
  | "kekturaStages"
  | "stageTable"
  | "mtsz"
  | "wikipedia"
  | "menetrendek"
  | "hungaromet"
  | "turistautak"
  | "osm"
  | "heyjoe"
  | "etteremhet";

export type LinkGroupId = "trail" | "planning" | "community";

export type UsefulLink = { id: LinkId; name: string; href: string };

export const LINK_GROUPS: { id: LinkGroupId; links: UsefulLink[] }[] = [
  {
    id: "trail",
    links: [
      { id: "kekturaHu", name: "kektura.hu", href: "https://www.kektura.hu" },
      { id: "kekturaStages", name: "kektura.hu/okt-szakaszok", href: "https://www.kektura.hu/okt-szakaszok" },
      {
        id: "stageTable",
        name: "okt_szakasz_adatok.pdf",
        href: "https://turistaterkepek.hu/kekturahu/tablazatok/okt_szakasz_adatok.pdf",
      },
      { id: "mtsz", name: "mtsz.org", href: "https://www.mtsz.org" },
      { id: "wikipedia", name: "National Blue Trail (Wikipedia)", href: "https://en.wikipedia.org/wiki/National_Blue_Trail" },
    ],
  },
  {
    id: "planning",
    links: [
      { id: "menetrendek", name: "menetrendek.hu", href: "https://menetrendek.hu" },
      { id: "hungaromet", name: "met.hu", href: "https://www.met.hu" },
      { id: "turistautak", name: "turistautak.hu", href: "https://www.turistautak.hu" },
      { id: "osm", name: "OpenStreetMap", href: "https://www.openstreetmap.org" },
    ],
  },
  {
    id: "community",
    links: [
      { id: "heyjoe", name: "heyjoe.hu", href: "https://heyjoe.hu" },
      { id: "etteremhet", name: "etteremhet.hu", href: "https://www.etteremhet.hu" },
    ],
  },
];

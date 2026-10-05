# Third-party data

The MIT licence in [`LICENSE`](LICENSE) covers the source code of this repository. It does **not** cover the
following data files, which were built from third-party sources and stay with their owners. They are in the
repository so that the app runs; do not assume you may reuse them elsewhere, and ask their owners before you do.

| Files | Source |
| --- | --- |
| `supabase/seed.sql`, `public/data/okt-route.json`, `public/data/okt-route-detail.json`, `public/data/okt-hops.json`, `scripts/data/okt-stages.json` | The official stamping places, route and stage table of the Országos Kéktúra, published by MTSZ (Magyar Természetjáró Szövetség) at <https://www.kektura.hu/okt-szakaszok> |
| `src/content/stamp-descriptions.json` | Translations (English, Russian, German) of the descriptions of the official stamping places published by MTSZ |
| `supabase/seed_extra.sql` | The extra stamps of the Kéktúra movement, from <https://heyjoe.hu> |
| `public/data/restaurants.json` | Restaurant locations listed on <https://etteremhet.hu> |

The map tiles shown in the app are © OpenStreetMap contributors (<https://www.openstreetmap.org/copyright>) and are
not part of this repository.

This is an independent project. It is not affiliated with, or endorsed by, MTSZ.

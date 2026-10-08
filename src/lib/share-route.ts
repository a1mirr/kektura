// The trail's line for the share card's map and image (spec 0039 AC-5), read on the server straight from the file the
// map fetches in the browser (`public/data/okt-route.json`, spec 0004: generated, never hand-edited).
import type { Route } from "./route-geometry";
import routeData from "../../public/data/okt-route.json";

export const TRAIL_ROUTE = routeData as unknown as Route;

import type { RefObject } from "react";
import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { setExtraStamped, setPlacesStamped } from "@/app/[locale]/dashboard/actions";
import type { ActionResult } from "@/lib/action-result";
import { buildMenu, type MenuAction, type MenuExtras } from "@/lib/map-popups";
import { newStampDate } from "@/lib/stamp-date";
import type { MapContext, MapInputs, MapLibre } from "./types";

// Official and extra stamps on the map (spec 0003 AC-12): hover shows the name, a click opens a popup
// with route from/to, mark / unmark walked and show in list.
export function attachStampPopups(
  m: MapLibreMap,
  maplibregl: MapLibre,
  latest: RefObject<MapInputs>,
  ctx: RefObject<MapContext>,
) {
  const hover: Popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
  m.on("mouseenter", ["dots", "extras"], (e) => {
    m.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (f?.geometry.type === "Point") {
      hover
        .setLngLat(f.geometry.coordinates as [number, number])
        .setText(String(f.properties?.name))
        .addTo(m);
    }
  });
  m.on("mouseleave", ["dots", "extras"], () => {
    m.getCanvas().style.cursor = "";
    hover.remove();
  });

  const menu: Popup = new maplibregl.Popup({
    offset: 12,
    closeOnClick: true,
    maxWidth: "280px",
  });
  m.on("click", ["dots", "extras"], (e) => {
    const f = e.features?.[0];
    if (f?.geometry.type !== "Point") return;
    hover.remove();
    const c = ctx.current;
    const { t } = c;
    const kind = String(f.properties?.kind);
    const key = String(f.properties?.key);
    const name = String(f.properties?.name);

    // Runs a stamp action behind a menu button: success closes the menu, an expired session sends the
    // page to sign-in, anything else re-enables the button and says so.
    const done = (button: HTMLButtonElement, showError: (message: string) => void, task: Promise<ActionResult>) => {
      button.disabled = true;
      task
        .catch((): ActionResult => ({ ok: false, reason: "failed" })) // network error
        .then((result) => {
          if (result.ok) menu.remove();
          else if (result.reason === "unauthorized") {
            menu.remove();
            ctx.current.refreshPage();
          } else {
            button.disabled = false;
            showError(t("actionFailed"));
          }
        });
    };

    const actions: MenuAction[] = [];
    let subtitle: string | null = null;
    const extras: MenuExtras = {};
    if (kind === "place") {
      const point = latest.current.points.find((p) => p.placeKey === key);
      const stamped = point?.stamped ?? false;
      if (point) {
        subtitle = [t("kmFromStart", { km: point.km.toFixed(1) }), point.note].filter(Boolean).join(" · ");
        extras.note = point.movedNote;
        // Spec 0003 AC-27: any stamp's popup offers the report; only its code travels in the address.
        if (point.code) extras.link = { label: t("reportLocation"), href: c.reportHref(point.code) };
      }
      actions.push(
        {
          label: t("routeFromHere"),
          run: () => {
            c.setRouteFrom(key);
            if (ctx.current.routeTo === key) c.setRouteTo(null);
            menu.remove();
          },
        },
        {
          label: t("routeToHere"),
          run: () => {
            c.setRouteTo(key);
            if (ctx.current.routeFrom === key) c.setRouteFrom(null);
            menu.remove();
          },
        },
        {
          label: stamped ? t("unmarkStamped") : t("markStamped"),
          run: (button, showError) =>
            done(button, showError, setPlacesStamped([key], !stamped, stamped ? undefined : newStampDate())),
        },
      );
    } else {
      const stamped = latest.current.extras.find((x) => String(x.id) === key)?.stamped ?? false;
      actions.push({
        label: stamped ? t("unmarkStamped") : t("markStamped"),
        run: (button, showError) =>
          done(button, showError, setExtraStamped(Number(key), !stamped, stamped ? undefined : newStampDate())),
      });
    }
    actions.push({
      label: t("showInList"),
      run: () => {
        menu.remove();
        c.showInList(kind, key);
      },
    });
    menu
      .setLngLat(f.geometry.coordinates as [number, number])
      .setDOMContent(buildMenu(name, subtitle, actions, extras))
      .addTo(m);
  });
}

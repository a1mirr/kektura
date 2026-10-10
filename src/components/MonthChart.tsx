"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, type BarShapeProps } from "recharts";

// Recharts draws the axes and sizes the bars; the bars themselves are drawn here (`shape`) because the tooltip has to
// work on a touch screen (a tap toggles it), with the keyboard (focus shows it) and for a month of height 0, none of
// which its own tooltip does.
export type ChartMonth = {
  key: string;
  short: string;
  year: string | null;
  stamps: number;
  title: string;
  lines: string[];
  label: string;
};

const HEIGHT = 240;
const TOP = 8;
const AXIS_HEIGHT = 46;
const Y_AXIS_WIDTH = 28;
const MIN_SLOT = 46; // the narrowest column of a month: room for "sept." and a tap target of 44 px
const MAX_BAR = 64;
const BAR = "#2563eb";
const BAR_ACTIVE = "#1e40af";
const ZERO = "#a8a29e";
const TEXT = "#57534e";
const AXIS = "#a8a29e";

type Active = { index: number; x: number };

// What a month's column needs from the chart. It travels by context, not by closure: Recharts takes a `shape` for a component type, so
// a new function on every render would remount every bar, and a bar that is remounted loses its focus.
type ChartState = {
  months: ChartMonth[];
  active: Active | null;
  tabStop: number;
  setActive: (update: Active | null | ((current: Active | null) => Active | null)) => void;
  setTabStop: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>, index: number, x: number) => void;
};
const ChartContext = createContext<ChartState | null>(null);

function MonthBar(props: Partial<BarShapeProps>) {
  const { months, active, tabStop, setActive, setTabStop, onKeyDown } = useContext(ChartContext)!;
  const { index, x, y, width, height } = props as BarShapeProps;
  const month = months[index];
  const base = y + height;
  const slot = width / 0.8; // the column of the month (the gap is 10 % of it on each side; with a capped bar it is narrower than the space the month has)
  const left = x - (slot - width) / 2;
  const centre = x + width / 2;
  const isActive = active?.index === index;
  return (
    <g
      role="button"
      aria-label={month.label}
      aria-pressed={isActive}
      tabIndex={index === tabStop ? 0 : -1}
      data-month={month.key}
      data-month-index={index}
      className="group cursor-pointer outline-none"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setActive({ index, x: centre });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setActive((a) => (a?.index === index ? null : a));
      }}
      onClick={(e: MouseEvent<SVGGElement>) => {
        const type = (e.nativeEvent as PointerEvent).pointerType;
        if (type === "touch" || type === "pen") setActive((a) => (a?.index === index ? null : { index, x: centre }));
      }}
      onFocus={(e) => {
        setTabStop(index);
        if (e.currentTarget.matches(":focus-visible")) setActive({ index, x: centre });
      }}
      onBlur={() => setActive((a) => (a?.index === index ? null : a))}
      onKeyDown={(e) => onKeyDown(e, index, centre)}
    >
      <rect x={left} y={TOP} width={slot} height={Math.max(0, base - TOP)} fill="transparent" />
      {month.stamps > 0 ? (
        <rect x={x} y={y} width={width} height={height} rx={4} fill={isActive ? BAR_ACTIVE : BAR} />
      ) : (
        <rect x={x} y={base - 2} width={width} height={2} fill={ZERO} />
      )}
      <rect
        x={left}
        y={TOP}
        width={slot}
        height={Math.max(0, base - TOP)}
        rx={4}
        fill="none"
        strokeWidth={2}
        className="stroke-transparent group-focus-visible:stroke-blue-800"
      />
    </g>
  );
}

function MonthTick({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) {
  const month = useContext(ChartContext)!.months[index ?? 0];
  if (!month) return <g />;
  return (
    <g aria-hidden="true">
      <text x={Number(x)} y={Number(y) + 14} textAnchor="middle" fontSize={12} fill={TEXT} data-tick="month">
        {month.short}
      </text>
      {month.year && (
        <text x={Number(x)} y={Number(y) + 30} textAnchor="middle" fontSize={12} fontWeight={600} fill={TEXT} data-tick="year">
          {month.year}
        </text>
      )}
    </g>
  );
}

// Everything handed to Recharts is the same object on every render: a new one makes it rebuild the chart (and its bars with it),
// and a bar that is rebuilt loses its focus.
const MARGIN = { top: TOP, right: 8, bottom: 0, left: 0 };
const Y_TICK = { fill: TEXT, fontSize: 12 };
const Y_DOMAIN: [number, (max: number) => number] = [0, (max) => Math.max(1, max)];
const SHAPE = <MonthBar />;
const TICK = <MonthTick />;

export default function MonthChart({ months, labelledBy }: { months: ChartMonth[]; labelledBy: string }) {
  const [active, setActive] = useState<Active | null>(null);
  const [tabStop, setTabStop] = useState(months.length - 1);
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (frame.current) frame.current.scrollLeft = frame.current.scrollWidth;
  }, []);

  useEffect(() => {
    if (!active) return;
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-month]")) setActive(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [active]);

  useLayoutEffect(() => {
    if (!active || !tip.current || !inner.current) return;
    const width = tip.current.offsetWidth;
    const room = inner.current.clientWidth;
    tip.current.style.left = `${Math.max(4, Math.min(active.x - width / 2, room - width - 4))}px`;
  }, [active]);

  const focusMonth = (from: Element, index: number) => {
    const next = frame.current?.querySelector<HTMLElement>(`[data-month-index="${index}"]`);
    if (next && next !== from) next.focus();
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>, index: number, x: number) => {
    const last = months.length - 1;
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: last }[e.key];
    if (target !== undefined) {
      e.preventDefault();
      focusMonth(e.currentTarget, Math.max(0, Math.min(last, target)));
    } else if (e.key === "Escape") {
      setActive(null);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActive((a) => (a?.index === index ? null : { index, x }));
    }
  };

  const state: ChartState = { months, active, tabStop, setActive, setTabStop, onKeyDown };
  const shown = active ? months[active.index] : null;
  return (
    <ChartContext.Provider value={state}>
      {/* A frame of its own: when the months do not fit, this scrolls and the page does not. */}
      <div ref={frame} role="group" aria-labelledby={labelledBy} data-month-chart className="overflow-x-auto">
        <div ref={inner} className="relative" style={{ minWidth: months.length * MIN_SLOT + Y_AXIS_WIDTH + 8 }}>
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <BarChart data={months} margin={MARGIN} barCategoryGap="10%" accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="#e7e5e4" />
              <XAxis dataKey="key" interval={0} height={AXIS_HEIGHT} tickLine={false} stroke={AXIS} tick={TICK} />
              <YAxis
                allowDecimals={false}
                width={Y_AXIS_WIDTH}
                stroke={AXIS}
                tick={Y_TICK}
                tickLine={false}
                domain={Y_DOMAIN}
              />
              <Bar dataKey="stamps" shape={SHAPE} maxBarSize={MAX_BAR} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          {shown && (
            <div
              ref={tip}
              data-chart-tooltip
              aria-hidden="true"
              style={{ top: TOP }}
              className="pointer-events-none absolute z-10 w-max rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-md"
            >
              <div className="font-semibold">{shown.title}</div>
              {shown.lines.map((line) => (
                <div key={line} className="whitespace-nowrap">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ChartContext.Provider>
  );
}

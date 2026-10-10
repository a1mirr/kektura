export const DEMO_EMAIL = "demo@kektura.test";

// Fixed, so the pictures can be made again and look the same.
export const DEMO_WALK = {
  stages: [
    { upToStage: 1, day: "2026-09-12" },
    { upToStage: 2, day: "2026-09-13" },
    { upToStage: 3, day: "2026-09-26" },
  ],
  partialStage: { stage: 4, places: 3, day: "2026-09-27" },
  extras: [
    { id: 1, day: "2026-09-12" },
    { id: 3, day: "2026-09-13" },
  ],
};

export const SIZE = { width: 780, height: 1520, scale: 2 };

export function pngSize(png) {
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;

// Every variant of a place gets a row, as the stamp button would.
/** @param {string} [email] @param {typeof DEMO_WALK} [walk] */
export function demoSql(email = DEMO_EMAIL, walk = DEMO_WALK) {
  const user = `(select id from auth.users where email = ${quote(email)})`;
  const stampRows = (where, day) =>
    `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select ${user}, c.id, ${quote(day)} from public.checkpoints c where c.retired_on is null and ${where} on conflict do nothing;`;
  return [
    `delete from public.user_stamps where user_id = ${user};`,
    `delete from public.user_extra_stamps where user_id = ${user};`,
    ...walk.stages.map(({ upToStage, day }, i) =>
      stampRows(`c.stage <= ${upToStage}${i > 0 ? ` and c.stage > ${walk.stages[i - 1].upToStage}` : ""}`, day),
    ),
    stampRows(`c.stage = ${walk.partialStage.stage} and c.stage_seq <= ${walk.partialStage.places}`, walk.partialStage.day),
    ...walk.extras.map(
      ({ id, day }) => `insert into public.user_extra_stamps (user_id, extra_id, stamped_on) values (${user}, ${id}, ${quote(day)}) on conflict do nothing;`,
    ),
  ].join("\n");
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;

/**
 * @param {{ text: string, alerts?: number, banner?: string, errors?: string[] }} page
 * @returns {string[]}
 */
export function pageProblems({ text, alerts = 0, banner, errors = [] }) {
  const problems = [];
  const email = EMAIL.exec(text);
  if (email) problems.push(`the page shows an email address (${email[0].replace(/^[^@]+/, "***")})`);
  if (banner && text.includes(banner)) problems.push("the page shows the test server banner");
  for (const message of errors) if (message && text.includes(message)) problems.push(`the page shows an error: "${message}"`);
  if (alerts > 0) problems.push(`the page shows ${alerts} alert message${alerts === 1 ? "" : "s"}`);
  return problems;
}

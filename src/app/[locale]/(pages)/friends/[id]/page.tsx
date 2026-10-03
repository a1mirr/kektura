import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { getFriends, getFriendProgress } from '@/lib/friends';
import { createClient } from '@/lib/supabase/server';
import { friendsEnabled } from '@/lib/friends-flag';
import { buildStages } from '@/lib/progress';
import stagesData from '../../../../../../scripts/data/okt-stages.json';
import { Link } from '@/i18n/navigation';
import StageControls from '@/components/StageControls';
import StageSection from '@/components/StageSection';

export default async function FriendPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  if (!friendsEnabled()) notFound();
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const friends = await getFriends(supabase);
  const friend = friends.find(f => f.id === id);

  if (!friend || !friend.friendIsSharing || friend.status !== 'accepted') {
    notFound();
  }

  const { summary, places, stampedKeys } = await getFriendProgress(friend);
  const t = await getTranslations('dashboard');
  const format = await getFormatter();

  const stages = buildStages(places, stagesData.stages);

  const cards = [
    { label: t("stamps"), value: `${stampedKeys.size} / ${places.length}` },
    { label: t("percent"), value: `${summary.percent}%` },
    { label: t("km"), value: format.number(summary.doneKm) },
    { label: t("remaining"), value: format.number(summary.remainingKm) },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">{friend.displayName}</h1>
        <div className="flex items-center gap-4">
          <Link href="/friends" className="text-sm text-stone-600 hover:underline">{t("friends")}</Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
            <dt className="text-sm text-stone-500">{c.label}</dt>
            <dd className="text-2xl font-semibold">{c.value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 font-semibold">{t("checkpoints")}</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-500">{t("stageHint")}</p>
            <StageControls />
          </div>
          {stages.map((stage) => {
            const { stage: n, meta, places: list } = stage;
            const done = list.filter((p) => stampedKeys.has(p.key)).length;
            return (
              <StageSection
                key={n}
                stage={n}
                title={t("stageTitle", { n })}
                route={meta ? `${meta.start} → ${meta.end}` : ""}
                kmText={meta ? t("kmValue", { km: format.number(meta.km) }) : ""}
                done={done}
                total={list.length}
                actions={<></>}
              >
                {list.map((p) => (
                  <li
                    id={`place-${p.key}`}
                    data-stage={p.stage}
                    key={p.key}
                    className="flex scroll-mt-24 items-start justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div>
                        <span className="mr-2 inline-block min-w-10 text-stone-400 tabular-nums">{p.label}</span>
                        {p.name}
                        <span className="ml-2 text-sm text-stone-500">{t("kmValue", { km: format.number(p.km) })}</span>
                      </div>
                      {p.variants.map((v) => (
                        <div key={v.id} className="truncate text-xs text-stone-500">
                          {v.description}
                        </div>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex h-10 w-10 items-center justify-center">
                        {stampedKeys.has(p.key) && (
                          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </StageSection>
            );
          })}
        </div>
      </section>
    </main>
  );
}

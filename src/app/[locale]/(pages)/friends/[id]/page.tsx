import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { compareWithFriend, getFriends } from '@/lib/friends';
import { createClient } from '@/lib/supabase/server';
import { flagOn } from '@/lib/feature-flags-server';
import { Link, redirect } from '@/i18n/navigation';
import CompareSection from '@/components/CompareSection';
import PageShell from '@/components/PageShell';
import MovedNote from '@/components/MovedNote';
import RequiredFrom from '@/components/RequiredFrom';
import StageControls from '@/components/StageControls';
import StageSection from '@/components/StageSection';
import StampDescriptions from '@/components/StampDescriptions';
import { hasToleranceNote } from '@/lib/new-stamps';
import { movedNote, recentlyMovedVariant, todayIso } from '@/lib/stamp-moves';
import { countDone } from '@/lib/progress';
import { localizedDescription } from '@/lib/stamp-description';

export default async function FriendPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  if (!(await flagOn("friends"))) notFound();
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/', locale });
  const friends = await getFriends(supabase, user.id);
  const friend = friends.find(f => f.id === id);

  if (!friend || !friend.friendIsSharing || friend.status !== 'accepted') {
    notFound();
  }

  const { progress, comparison, points } = await compareWithFriend(supabase, friend);
  const { summary, places, stages, stampedKeys, waived } = progress;
  const t = await getTranslations('dashboard');
  const format = await getFormatter();
  // A stamp that moved in the last 180 days says so on the friend's list too (spec 0024 AC-29), as on the dashboard (spec 0001 AC-29).
  const today = todayIso();
  const dateText = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' });
  const movedText = {
    on: (date: string) => t('movedOn', { date }),
    now: (description: string) => t('movedNow', { description }),
    check: t('movedCheck'),
  };

  const cards = [
    { label: t("stamps"), value: `${stampedKeys.size} / ${places.length}` },
    { label: t("percent"), value: `${summary.percent}%` },
    { label: t("km"), value: format.number(summary.doneKm) },
    { label: t("remaining"), value: format.number(summary.remainingKm) },
  ];

  return (
    <PageShell
      header={
        <>
          <header className="flex items-center justify-between gap-4">
            <h1 className="min-w-0 text-2xl font-bold text-blue-700 [overflow-wrap:anywhere]">{friend.displayName}</h1>
            <Link href="/friends" className="text-sm text-stone-600 hover:underline">
              {t("friends")}
            </Link>
          </header>

          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="min-w-0 rounded-lg bg-white p-3 shadow-sm sm:p-4">
                <dt className="text-sm text-stone-500">{c.label}</dt>
                <dd className="text-xl font-semibold sm:text-2xl">{c.value}</dd>
              </div>
            ))}
          </dl>
        </>
      }
      aside={<CompareSection comparison={comparison} points={points} />}
    >
      <section>
        <h2 className="mb-2 font-semibold">{t("checkpoints")}</h2>
        <div className="space-y-3">
          <div className="flex justify-end">
            <StageControls />
          </div>
          {stages.map((stage) => {
            const { stage: n, meta, places: list } = stage;
            const done = countDone(list, stampedKeys, waived);
            return (
              <StageSection
                key={n}
                stage={n}
                title={t("stageTitle", { n })}
                route={meta ? `${meta.start} → ${meta.end}` : ""}
                kmText={meta ? t("kmValue", { km: format.number(meta.km) }) : ""}
                done={done}
                total={list.length}
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
                        <span className="mr-2 inline-block min-w-10 text-stone-500 tabular-nums">{p.label}</span>
                        {p.name}
                        <span className="ml-2 text-sm text-stone-500">{t("kmValue", { km: format.number(p.km) })}</span>
                      </div>
                      {p.requiredFrom && (
                        <RequiredFrom requiredFrom={p.requiredFrom} waived={waived.has(p.key)} tolerance={hasToleranceNote(p)} who="friend" />
                      )}
                      {(() => {
                        const moved = recentlyMovedVariant(p.variants, today);
                        return (
                          moved && (
                            <MovedNote>{movedNote(moved.moved_on!, localizedDescription(moved.code, moved.description, locale), movedText, dateText)}</MovedNote>
                          )
                        );
                      })()}
                      <StampDescriptions descriptions={p.variants.map((v) => localizedDescription(v.code, v.description, locale))} />
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
    </PageShell>
  );
}

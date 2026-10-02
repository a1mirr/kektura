import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getFriends, getFriendProgress } from '@/lib/friends';
import { createClient } from '@/lib/supabase/server';
import { isFriendsEnabled, regenerateInvite, approveRequest, ignoreRequest, removeFriend, setSharing } from './actions';
import { Link } from '@/i18n/navigation';

import { headers } from 'next/headers';

export default async function FriendsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  if (!(await isFriendsEnabled())) notFound();
  
  const { error } = await searchParams;
  const { locale } = await params;
  const t = await getTranslations('friends');
  const tDash = await getTranslations('dashboard');
  const supabase = await createClient();
  const [friends, { data: userRes }] = await Promise.all([
    getFriends(supabase),
    supabase.auth.getUser()
  ]);
  const uid = userRes.user?.id;
  if (!uid) return null;
  
  const headersList = await headers();
  const host = headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'http';
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  
  const { data: profile } = await supabase.from('profiles').select('invite_token').eq('id', uid).single();
  const inviteLink = profile ? `${origin}/${locale}/friends/invite/${profile.invite_token}` : '';

  const pending = friends.filter(f => f.status === 'pending' && !f.isRequester);
  const accepted = friends.filter(f => f.status === 'accepted');
  const acceptedProgress = await Promise.all(accepted.map(async f => {
    if (!f.friendIsSharing) return { ...f, progress: null };
    const p = await getFriendProgress(f);
    return { ...f, progress: p };
  }));

  const errorKey = `error_${error}`;
  const errorMsg = error && t.has(errorKey as any) ? t(errorKey as any) : error;

  return (
    <div className='max-w-xl mx-auto p-4 space-y-8'>
      <h1 className='text-2xl font-bold'>{t('title')}</h1>
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg">{errorMsg}</div>}
      
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>{t('inviteTitle')}</h2>
        <div className='flex gap-2'>
          <input readOnly value={inviteLink} className='border p-2 flex-1 rounded' />
          <form action={async () => { "use server"; await regenerateInvite(); }}>
            <button className='bg-stone-200 px-4 py-2 rounded'>{t('regenerate')}</button>
          </form>
        </div>
      </section>

      {pending.length > 0 && (
        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>{t('pendingTitle')}</h2>
          <ul className='space-y-2'>
            {pending.map(f => (
              <li key={f.id} className='flex justify-between items-center border p-2 rounded'>
                <span>{f.displayName}</span>
                <div className='flex gap-2'>
                  <form action={async () => { "use server"; await approveRequest(f.id); }}>
                    <button className='bg-green-500 text-white px-3 py-1 rounded'>{t('approve')}</button>
                  </form>
                  <form action={async () => { "use server"; await ignoreRequest(f.id); }}>
                    <button className='bg-red-500 text-white px-3 py-1 rounded'>{t('ignore')}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>{t('acceptedTitle')}</h2>
        {acceptedProgress.length === 0 ? (
          <p className='text-stone-500'>{t('noFriends')}</p>
        ) : (
          <ul className='space-y-4'>
            {acceptedProgress.map(f => (
              <li key={f.id} className='border p-4 rounded space-y-2'>
                <div className='flex justify-between items-center'>
                  {f.friendIsSharing ? (
                    <Link href={`/friends/${f.id}`} className="font-bold text-blue-600 hover:underline">
                      {f.displayName}
                    </Link>
                  ) : (
                    <span className='font-bold'>{f.displayName}</span>
                  )}
                  <form action={async () => { "use server"; await removeFriend(f.id); }}>
                    <button className='text-red-600 text-sm'>{t('remove')}</button>
                  </form>
                </div>
                <div className='text-sm text-stone-600'>
                  {!f.friendIsSharing ? (
                    t('notSharing')
                  ) : (
                    <>
                      {f.progress?.stampedKeys.size || 0} {t('stampsCount')} &middot; {tDash('kmValue', { km: f.progress?.summary.doneKm ?? 0 })} &middot; {f.progress?.completedStages} {t('stagesCount')}
                    </>
                  )}
                </div>
                <form action={async () => {
                  'use server';
                  await setSharing(f.id, !f.isSharing);
                }} className='flex items-center gap-2'>
                  <button className='text-sm bg-stone-200 px-2 py-1 rounded'>
                    {f.isSharing ? t('stopSharing') : t('startSharing')}
                  </button>
                  <span className='text-sm text-stone-500'>
                    {f.isSharing ? t('isSharing') : t('notSharing')}
                  </span>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

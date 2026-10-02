import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getFriends } from '@/lib/friends';
import { createClient } from '@/lib/supabase/server';
import { isFriendsEnabled, regenerateInvite, approveRequest, ignoreRequest, removeFriend, setSharing } from './actions';

export default async function FriendsPage() {
  if (!(await isFriendsEnabled())) notFound();
  
  const t = await getTranslations('friends');
  const supabase = await createClient();
  const [friends, { data: userRes }] = await Promise.all([
    getFriends(supabase),
    supabase.auth.getUser()
  ]);
  const uid = userRes.user?.id;
  if (!uid) return null;
  
  const { data: profile } = await supabase.from('profiles').select('invite_token').eq('id', uid).single();
  const inviteLink = profile ? `${process.env.SITE_URL || 'http://localhost:3000'}/en/friends/invite/${profile.invite_token}` : '';

  const pending = friends.filter(f => f.status === 'pending' && !f.isRequester);
  const accepted = friends.filter(f => f.status === 'accepted');

  return (
    <div className='max-w-xl mx-auto p-4 space-y-8'>
      <h1 className='text-2xl font-bold'>{t('title')}</h1>
      
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
        {accepted.length === 0 ? (
          <p className='text-stone-500'>{t('noFriends')}</p>
        ) : (
          <ul className='space-y-4'>
            {accepted.map(f => (
              <li key={f.id} className='border p-4 rounded space-y-2'>
                <div className='flex justify-between items-center'>
                  <span className='font-bold'>{f.displayName}</span>
                  <form action={async () => { "use server"; await removeFriend(f.id); }}>
                    <button className='text-red-600 text-sm'>{t('remove')}</button>
                  </form>
                </div>
                <div className='text-sm text-stone-600'>
                  {f.stamps?.length || 0} {t('stampsCount')}
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

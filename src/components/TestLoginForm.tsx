import { getTranslations } from 'next-intl/server';
import { TEST_EMAIL } from '@/lib/test-login';

export default async function TestLoginForm({ locale, next = '/dashboard' }: { locale: string; next?: string }) {
  const t = await getTranslations('home');

  return (
    <form
      action='/auth/test-login'
      method='post'
      className='flex w-full max-w-sm flex-col gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 text-left'
    >
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='next' value={next} />
      <label className='flex flex-col gap-1 text-sm'>
        {t('testLoginEmail')}
        <input
          type='email'
          name='email'
          required
          defaultValue={TEST_EMAIL}
          className='rounded border border-stone-300 bg-white px-2 py-1'
        />
      </label>
      <button type='submit' className='rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700'>
        {t('testLoginButton')}
      </button>
      <p className='text-xs text-stone-500'>{t('testLoginNote')}</p>
    </form>
  );
}

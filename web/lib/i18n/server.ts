import 'server-only';
import { cookies } from 'next/headers';
import { dictionaries, isLocale, type DictKey, type Locale } from './dictionaries';

export async function getLocale(): Promise<Locale> {
  const raw = (await cookies()).get('locale')?.value;
  return isLocale(raw) ? raw : 'en';
}

/** Server-component translator: same dictionary and cookie as the client `useT()`. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: DictKey) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key };
}

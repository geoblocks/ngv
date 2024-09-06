import type {LocaleModule} from '@lit/localize';
import {configureLocalization} from '@lit/localize';
import {
  allLocales,
  sourceLocale,
  targetLocales,
} from '../../localeCodesModule.js';

export type Locale = (typeof allLocales)[number];
const localeImporters: Record<Locale, () => Promise<LocaleModule>> = {
  it: async () => {
    return import('../../../localized/it.js');
  },
  fr: async () => {
    return import('../../../localized/fr.js');
  },
  de: async () => {
    return import('../../../localized/de.js');
  },
  en: () => Promise.reject(new Error('impossible')),
};

export const {getLocale, setLocale} = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale(locale: string) {
    return localeImporters[locale as Locale]();
  },
});

/**
 * Use the navigator languages to choose which language is the best for the user.
 * @param appOK A list of accepted languages (2 characters, lowercase, like fr, en, ...)
 * @return the first acceptable language
 */
export function detectOKLanguage(navigator: Navigator): Locale | undefined {
  const languages = navigator.languages || [navigator.language];
  const userOK = languages.map((item) =>
    item.substring(0, 2),
  ) as unknown as Locale[];
  const ok = userOK.filter((item) => allLocales.includes(item));
  return ok[0]; // this is undefined when the array is empty
}

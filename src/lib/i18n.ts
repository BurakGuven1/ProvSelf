import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '@/src/locales/en.json';
import de from '@/src/locales/de.json';
import fr from '@/src/locales/fr.json';
import ja from '@/src/locales/ja.json';

const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'ja'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

function getDeviceLanguage(): SupportedLanguage {
  const deviceLocales = Localization.getLocales();
  if (deviceLocales.length > 0) {
    const languageCode = deviceLocales[0].languageCode;
    if (languageCode && SUPPORTED_LANGUAGES.includes(languageCode as SupportedLanguage)) {
      return languageCode as SupportedLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    ja: { translation: ja },
  },
  lng: getDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
export type { SupportedLanguage };

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '@/src/locales/en.json';
import de from '@/src/locales/de.json';
import fr from '@/src/locales/fr.json';
import ja from '@/src/locales/ja.json';
import zh from '@/src/locales/zh.json';
import ptBR from '@/src/locales/pt-BR.json';
import ru from '@/src/locales/ru.json';
import hi from '@/src/locales/hi.json';
import ko from '@/src/locales/ko.json';
import it from '@/src/locales/it.json';
import es from '@/src/locales/es.json';
import tr from '@/src/locales/tr.json';

const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'ja', 'zh', 'pt-BR', 'ru', 'hi', 'ko', 'it', 'es', 'tr'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

function getDeviceLanguage(): SupportedLanguage {
  const deviceLocales = Localization.getLocales();
  if (deviceLocales.length > 0) {
    const locale = deviceLocales[0];
    const languageCode = locale.languageCode;
    const languageTag = locale.languageTag; // e.g. "pt-BR"

    // Check full tag first (for pt-BR)
    if (languageTag && SUPPORTED_LANGUAGES.includes(languageTag as SupportedLanguage)) {
      return languageTag as SupportedLanguage;
    }
    // Then check language code
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
    zh: { translation: zh },
    'pt-BR': { translation: ptBR },
    ru: { translation: ru },
    hi: { translation: hi },
    ko: { translation: ko },
    it: { translation: it },
    es: { translation: es },
    tr: { translation: tr },
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

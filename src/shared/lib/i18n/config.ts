import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import de from './locales/de.json';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
const supportedLngs = ['en', 'es', 'fr', 'pt', 'it', 'de'];
const fallbackLng = 'en';

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    pt: { translation: pt },
    it: { translation: it },
    de: { translation: de },
  },
  lng: supportedLngs.includes(deviceLocale) ? deviceLocale : fallbackLng,
  fallbackLng,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

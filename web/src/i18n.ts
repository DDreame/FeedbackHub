import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const LANGUAGE_KEY = 'feedback_language';

const SUPPORTED_LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];

function getInitialLanguage(): SupportedLang {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved as SupportedLang)) {
    return saved as SupportedLang;
  }
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh-TW') || browserLang === 'zh-Hant') return 'zh-TW';
  if (browserLang.startsWith('zh')) return 'zh-CN';
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('ko')) return 'ko';
  return 'en';
}

const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
    ja: { translation: ja },
    ko: { translation: ko },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

const LANG_CYCLE: SupportedLang[] = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];

export function toggleLanguage() {
  const current = i18n.language as SupportedLang;
  const idx = LANG_CYCLE.indexOf(current);
  const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
  i18n.changeLanguage(next);
  localStorage.setItem(LANGUAGE_KEY, next);
}

export function getCurrentLanguage(): string {
  return i18n.language;
}

export default i18n;
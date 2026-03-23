import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

const LANGUAGE_KEY = 'feedback_language';

function getInitialLanguage(): string {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === 'en' || saved === 'zh-CN') return saved;
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function toggleLanguage() {
  const newLang = i18n.language === 'zh-CN' ? 'en' : 'zh-CN';
  i18n.changeLanguage(newLang);
  localStorage.setItem(LANGUAGE_KEY, newLang);
}

export function getCurrentLanguage(): string {
  return i18n.language;
}

export default i18n;

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');
const srcLocalesDir = path.join(__dirname, '..', 'src', 'locales');
const langs = ['ar', 'en', 'fr', 'es', 'de', 'zh', 'ru'];

const passwordHints = {
  en: 'Password (8+ characters)',
  ar: 'كلمة المرور (8 أحرف أو أكثر)',
  fr: 'Mot de passe (8+ caractères)',
  es: 'Contraseña (8+ caracteres)',
  de: 'Passwort (mind. 8 Zeichen)',
  zh: '密码（至少 8 位）',
  ru: 'Пароль (не менее 8 символов)',
};

const dictionaries = {};

langs.forEach(lang => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  let dict = {};
  if (fs.existsSync(filePath)) {
    dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Remove fake OTP hints & mock references
  delete dict['auth.demoOtpHint'];
  delete dict['auth.quickDemo'];

  // Remove all Free Shipping keys
  delete dict['nav.freeShipping'];
  delete dict['freeShipping'];
  delete dict['cart.freeShipping'];
  delete dict['shipping.freeShipping'];

  // Unify password hint to 8+ characters
  if (passwordHints[lang]) {
    dict['auth.passwordHint'] = passwordHints[lang];
  }

  dictionaries[lang] = dict;
});

// Ensure all keys in EN exist across all languages
const allKeys = Object.keys(dictionaries['en']);
langs.forEach(lang => {
  allKeys.forEach(k => {
    if (dictionaries[lang][k] === undefined) {
      dictionaries[lang][k] = dictionaries['en'][k];
    }
  });

  const sorted = {};
  Object.keys(dictionaries[lang]).sort().forEach(k => {
    sorted[k] = dictionaries[lang][k];
  });

  fs.writeFileSync(
    path.join(localesDir, lang, 'translation.json'),
    JSON.stringify(sorted, null, 2) + '\n',
    'utf8'
  );
  console.log(`Cleaned and updated public/locales/${lang}/translation.json`);
});

// Generate src/locales/all.ts
const tsContent = `// Auto-generated preloaded locale dictionaries for zero-latency synchronous i18n
import type { Language } from '@/contexts/I18nContext';

export const PRELOADED_LOCALES: Record<Language, Record<string, string>> = {
${langs.map(l => `  '${l}': ${JSON.stringify(dictionaries[l])},`).join('\n')}
};
`;

fs.writeFileSync(path.join(srcLocalesDir, 'all.ts'), tsContent, 'utf8');
console.log('Generated src/locales/all.ts cleanly!');

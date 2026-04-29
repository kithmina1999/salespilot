import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
  // Validate locale; default to 'en' if invalid
  const supported = ['en', 'si', 'ta'];
  const resolvedLocale = supported.includes(locale ?? '') ? (locale as string) : 'en';

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
  };
});

import { defineConfig } from 'astro/config'

import tailwind from '@astrojs/tailwind'

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind()],
    output: 'static',
    i18n: {
        locales: ['en', 'es'],
        defaultLocale: 'es',
        routing: {
            prefixDefaultLocale: false,
        },
    },
})

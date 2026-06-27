import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import emdash from 'emdash/astro'
import { github } from 'emdash/auth/providers/github'
import { google } from 'emdash/auth/providers/google'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import { d1, r2, kvCache } from '@emdash-cms/cloudflare'

// https://astro.build/config
export default defineConfig({
    site: 'https://cocodrulo.dev',
    output: 'server',
    adapter: cloudflare({
        platformProxy: {
            enabled: true,
            persist: {
                path: 'remote',
            },
        },
    }),

    i18n: {
        locales: ['en', 'es'],
        defaultLocale: 'es',
        routing: {
            prefixDefaultLocale: false,
        },
    },

    integrations: [
        react(),
        emdash({
            database: d1({
                binding: 'DB',
                session: 'auto',
            }),
            storage: r2({
                binding: 'MEDIA',
                publicUrl: 'https://files.cocodrulo.dev',
            }),
            objectCache: kvCache({ binding: 'CACHE' }),
            authProviders: [
                github({
                    clientId: process.env.GITHUB_CLIENT_ID,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                }),
                google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                }),
            ],
        }),
    ],

    vite: {
        plugins: [tailwindcss()],
    },
})

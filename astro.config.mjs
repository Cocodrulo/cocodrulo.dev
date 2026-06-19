import { defineConfig, sessionDrivers } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'
import emdash, { s3 } from 'emdash/astro'
import { postgres } from 'emdash/db'
import react from '@astrojs/react'
import { loadEnv } from 'vite'

process.env = loadEnv(process.env.NODE_ENV, process.cwd(), '')

// https://astro.build/config
export default defineConfig({
    output: 'server',
    adapter: vercel(),
    session: {
        driver: sessionDrivers.fs(),
    },
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
            database: postgres({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
            }),
            storage: s3(),
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
})

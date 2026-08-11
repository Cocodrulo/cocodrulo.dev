import type { APIRoute } from 'astro'
import { generateCVPdf } from '@/lib/cv-generator'
import { env } from 'cloudflare:workers'

const memoryCache = new Map<string, { bytes: Uint8Array; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour in ms
const CACHE_TTL_SEC = 3600 // 1 hour in seconds

export const GET: APIRoute = async (context) => {
    const url = new URL(context.request.url)
    const langParam = url.searchParams.get('lang')
    const currentLocale = (context.locals as any)?.lang || context.currentLocale || 'es'
    const lang = (langParam || currentLocale || 'es').toLowerCase() === 'en' ? 'en' : 'es'
    const noCache = import.meta.env.DEV || url.searchParams.has('nocache') || url.searchParams.has('refresh') || url.searchParams.has('t')

    const buildVersion = (import.meta as any).env?.BUILD_TIMESTAMP || 'dev'
    const cacheKey = `cv_pdf_${lang}_v${buildVersion}`
    // Access KV namespace via cloudflare:workers env with fallback to context.locals
    const kvCache = (env as any)?.CACHE || (context.locals as any)?.runtime?.env?.CACHE

    // 1. Check Cloudflare KV Cache (if not bypassing)
    if (kvCache && !noCache) {
        try {
            const cachedArrayBuffer = await kvCache.get(cacheKey, { type: 'arrayBuffer' })
            if (cachedArrayBuffer) {
                return new Response(cachedArrayBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="CV_Javier_Perez_${lang.toUpperCase()}.pdf"`,
                        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                        'X-CV-Cache': 'HIT-KV',
                    },
                })
            }
        } catch (e) {
            console.error('KV Cache read error:', e)
        }
    }

    // 2. Check In-Memory Cache (if not bypassing)
    if (!noCache) {
        const memEntry = memoryCache.get(cacheKey)
        if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
            return new Response(memEntry.bytes.buffer as ArrayBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="CV_Javier_Perez_${lang.toUpperCase()}.pdf"`,
                    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                    'X-CV-Cache': 'HIT-MEMORY',
                },
            })
        }
    }

    // 3. Generate PDF from EmDash
    const pdfBytes = await generateCVPdf(lang)

    // 4. Store in KV Cache (1 hour expiration)
    if (kvCache) {
        try {
            await kvCache.put(cacheKey, pdfBytes.buffer, { expirationTtl: CACHE_TTL_SEC })
        } catch (e) {
            console.error('KV Cache write error:', e)
        }
    }

    // 5. Store in Memory Cache
    memoryCache.set(cacheKey, { bytes: pdfBytes, timestamp: Date.now() })

    return new Response(pdfBytes.buffer as ArrayBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="CV_Javier_Perez_${lang.toUpperCase()}.pdf"`,
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'X-CV-Cache': 'MISS',
        },
    })
}

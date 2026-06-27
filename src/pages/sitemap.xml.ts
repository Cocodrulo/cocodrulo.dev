import { getEmDashCollection } from 'emdash'

export async function GET() {
    const domain = 'https://cocodrulo.dev'

    // Fetch dynamic entries from emdash CMS
    const { entries: postsEsRaw } = await getEmDashCollection('posts', {
        locale: 'es',
    })
    const { entries: postsEnRaw } = await getEmDashCollection('posts', {
        locale: 'en',
    })
    const { entries: projectsEsRaw } = await getEmDashCollection('projects', {
        locale: 'es',
        status: 'published',
    })
    const { entries: projectsEnRaw } = await getEmDashCollection('projects', {
        locale: 'en',
        status: 'published',
    })

    const postsEs = (postsEsRaw || []) as any[]
    const postsEn = (postsEnRaw || []) as any[]
    const projectsEs = (projectsEsRaw || []) as any[]
    const projectsEn = (projectsEnRaw || []) as any[]

    // Static routes in both Spanish and English
    const staticPages = [
        '',
        '/blog',
        '/projects',
        '/certificates',
        '/contact',
        '/en',
        '/en/blog',
        '/en/projects',
        '/en/certificates',
        '/en/contact',
    ]

    const urls: string[] = []

    // Add static pages
    for (const page of staticPages) {
        urls.push(`${domain}${page}`)
    }

    // Add Spanish blog posts
    if (postsEs) {
        for (const post of postsEs) {
            if (post.slug) {
                urls.push(`${domain}/blog/${post.slug}`)
            }
        }
    }

    // Add English blog posts
    if (postsEn) {
        for (const post of postsEn) {
            if (post.slug) {
                urls.push(`${domain}/en/blog/${post.slug}`)
            }
        }
    }

    // Add Spanish projects
    if (projectsEs) {
        for (const project of projectsEs) {
            if (project.slug) {
                urls.push(`${domain}/projects/${project.slug}`)
            }
        }
    }

    // Add English projects
    if (projectsEn) {
        for (const project of projectsEn) {
            if (project.slug) {
                urls.push(`${domain}/en/projects/${project.slug}`)
            }
        }
    }

    // Generate standard XML structure
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
        (url) => `  <url>
    <loc>${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${url === domain || url === `${domain}/en` ? '1.0' : '0.7'}</priority>
  </url>`,
    )
    .join('\n')}
</urlset>`

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}

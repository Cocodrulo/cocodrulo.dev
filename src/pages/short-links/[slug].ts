import { getEmDashEntry } from 'emdash'

export async function GET({ params }: { params: { slug: string } }) {
    const { slug } = params

    const { entry: shortLink, error } = await getEmDashEntry('shortlinks', slug)

    if (error) {
        console.error(error)
        return new Response('Server Error', {
            status: 500,
        })
    }

    if (!shortLink) {
        return new Response('Data not found', {
            status: 404,
        })
    }

    return new Response(null, {
        status: 301,
        headers: {
            Location: shortLink.data.url as string,
        },
    })
}
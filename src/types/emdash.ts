import type { PortableTextBlock } from 'emdash'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type Label = {
    label?: string
    etiqueta?: string
}

export type ImageField = {
    id: string
    src?: string
    alt?: string
    width?: number
    height?: number
    provider?: string
    previewUrl?: string
    meta?: {
        storageKey?: string
        caption?: string | null
        blurhash?: string | null
        dominantColor?: string | null
    }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export type EmDashEntry<T> = {
    slug: string
    data: T
}

// --- Profile ---
export type ProfileData = {
    name: string
    label: string
}

// --- Social ---
export type SocialData = {
    name: string
    label: string
    url: string
}

// --- About ---
export type AboutData = {
    label: string
    subtitle: string
    paragraphs: string[]
}

// --- Project ---
export type ProjectData = {
    title: string
    description: PortableTextBlock[]
    url?: string
    start_date?: string
    end_date?: string
    labels: Label[]
    image: ImageField
    featured?: boolean
}

// --- Post ---
export type PostData = {
    title: string
    excerpt: string
    content: PortableTextBlock[]
    published_at: string
    image?: ImageField
    labels?: Label[]
}

// --- Certificate ---
export type CertificateFileField = {
    id?: string
    url?: string
    filename?: string
    mimeType?: string
    size?: number
    provider?: string
    meta?: {
        storageKey?: string
        caption?: string | null
        blurhash?: string | null
        dominantColor?: string | null
    }
}

export type CertificateData = {
    title: string
    certificate_file: CertificateFileField
    issuer: string
    issuer_id: string
    issuer_website: string
}

// --- Timeline ---
export type TimelineType = 'work' | 'education'

export type TimelineData = {
    title: string
    place: string
    type: TimelineType
    start_year: string
    end_year?: string
    current?: boolean
    description?: string
}

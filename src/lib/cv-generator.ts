import {
    PDFDocument,
    rgb,
    StandardFonts,
    PDFString,
    PDFOperator,
    PDFNumber,
    pushGraphicsState,
    popGraphicsState,
    moveTo,
    clip,
    endPath,
    type PDFFont,
    type PDFPage,
} from 'pdf-lib'
import { getEmDashEntry, getEmDashCollection } from 'emdash'
import avatarDataUri from '../../public/images/me.jpg?inline'

// Helper for cubic bezier operator in PDF ('c' operator)
function curveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
) {
    return PDFOperator.of('c' as any, [
        PDFNumber.of(cp1x),
        PDFNumber.of(cp1y),
        PDFNumber.of(cp2x),
        PDFNumber.of(cp2y),
        PDFNumber.of(x),
        PDFNumber.of(y),
    ])
}

// Clean text for PDF Standard fonts (Helvetica in pdf-lib uses WinAnsi)
function cleanText(text: string): string {
    if (!text) return ''
    return text
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2022/g, '•')
        .replace(/[^\x00-\xFF]/g, '')
}

function getCertFileUrl(fileObj: any): string {
    if (!fileObj) return ''
    let url = fileObj.url || fileObj.src || ''

    if (!url && fileObj.meta?.storageKey) {
        url = `https://files.cocodrulo.dev/${fileObj.meta.storageKey}`
    }

    if (!url && fileObj.id) {
        url = `https://cocodrulo.dev/_emdash/api/media/file/${fileObj.id}`
    }

    if (url && url.startsWith('/')) {
        url = `https://cocodrulo.dev${url}`
    }

    return url
}

export type DescriptionBlock =
    | { type: 'heading'; text: string; level: number }
    | { type: 'bullet-item'; text: string; level: number }
    | { type: 'number-item'; text: string; index: number; level: number }
    | { type: 'paragraph'; text: string }

function extractBlocks(content: any): DescriptionBlock[] {
    if (!content) return []

    if (typeof content === 'string') {
        const lines = content.split(/\r?\n/)
        const blocks: DescriptionBlock[] = []
        let numberIdx = 1

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
                numberIdx = 1
                continue
            }

            // Headings: # Heading 1, ## Heading 2, ### Heading 3
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
            if (headingMatch) {
                blocks.push({
                    type: 'heading',
                    text: cleanText(headingMatch[2]),
                    level: headingMatch[1].length,
                })
                numberIdx = 1
                continue
            }

            // Bullet list item: - Item, * Item, • Item
            const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/)
            if (bulletMatch) {
                blocks.push({
                    type: 'bullet-item',
                    text: cleanText(bulletMatch[1]),
                    level: 1,
                })
                numberIdx = 1
                continue
            }

            // Numbered list item: 1. Item, 2. Item
            const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
            if (numberMatch) {
                const parsedIdx = parseInt(numberMatch[1], 10) || numberIdx
                blocks.push({
                    type: 'number-item',
                    text: cleanText(numberMatch[2]),
                    index: parsedIdx,
                    level: 1,
                })
                numberIdx = parsedIdx + 1
                continue
            }

            // Normal paragraph
            blocks.push({
                type: 'paragraph',
                text: cleanText(trimmed),
            })
            numberIdx = 1
        }
        return blocks
    }

    if (Array.isArray(content)) {
        const blocks: DescriptionBlock[] = []
        let numberIdx = 1

        for (const item of content) {
            if (typeof item === 'string') {
                blocks.push(...extractBlocks(item))
                continue
            }

            const childrenText =
                item?.children && Array.isArray(item.children)
                    ? item.children
                          .map((c: any) => cleanText(c?.text || ''))
                          .join('')
                    : cleanText(item?.text || '')

            const cleaned = childrenText.trim()
            if (!cleaned) {
                numberIdx = 1
                continue
            }

            if (item.listItem === 'bullet') {
                blocks.push({
                    type: 'bullet-item',
                    text: cleaned,
                    level: item.level || 1,
                })
                numberIdx = 1
            } else if (item.listItem === 'number') {
                blocks.push({
                    type: 'number-item',
                    text: cleaned,
                    index: numberIdx++,
                    level: item.level || 1,
                })
            } else if (
                typeof item.style === 'string' &&
                item.style.startsWith('h')
            ) {
                const level = parseInt(item.style.slice(1), 10) || 2
                blocks.push({
                    type: 'heading',
                    text: cleaned,
                    level,
                })
                numberIdx = 1
            } else {
                const subBlocks = extractBlocks(cleaned)
                blocks.push(...subBlocks)
                numberIdx = 1
            }
        }
        return blocks
    }

    return []
}

function wrapText(
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number,
): string[] {
    if (!text) return []
    const words = text.replace(/\n/g, ' \n ').split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        if (word === '\n') {
            if (currentLine) lines.push(currentLine)
            currentLine = ''
            continue
        }
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = font.widthOfTextAtSize(testLine, fontSize)
        if (width <= maxWidth) {
            currentLine = testLine
        } else {
            if (currentLine) lines.push(currentLine)
            currentLine = word
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

// Helper: Add clickable link annotation to PDF page
function addLink(
    pdfDoc: PDFDocument,
    page: PDFPage,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
) {
    if (!url) return
    const formattedUrl =
        url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `https://${url}`
    const linkAnnot = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, y, x + width, y + height],
        Border: [0, 0, 0],
        A: {
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(formattedUrl),
        },
    })
    const linkAnnotRef = pdfDoc.context.register(linkAnnot)
    page.node.addAnnot(linkAnnotRef)
}

export async function generateCVPdf(
    locale: string = 'es',
): Promise<Uint8Array> {
    const isEs = locale === 'es'

    // 1. Fetch data from EmDash CMS
    const { entry: profileEntry } = await getEmDashEntry('profile', 'profile', {
        locale,
    })
    const profile = (profileEntry?.data || {
        name: 'Javier Aday Pérez Romero',
        label: isEs ? 'Desarrollador de Software' : 'Software Developer',
    }) as { name: string; label: string }

    const { entry: aboutEntry } = await getEmDashEntry('about', 'about', {
        locale,
    })
    const about = (aboutEntry?.data || { subtitle: '', paragraphs: [] }) as {
        subtitle?: string
        paragraphs?: any
    }

    const { entries: socialEntries } = await getEmDashCollection('socials', {
        locale,
    })
    const socials = (socialEntries || []).map((s: any) => s.data) as Array<{
        name: string
        label: string
        url: string
    }>

    const { entries: timelineEntries } = await getEmDashCollection('timeline', {
        locale,
        status: 'published',
    })
    const rawTimeline = (timelineEntries || []).map(
        (t: any) => t.data,
    ) as Array<{
        title: string
        place: string
        type: 'work' | 'education'
        start_year: string
        end_year?: string
        current?: boolean
        description?: string
    }>

    const workTimeline = rawTimeline
        .filter((t) => t.type === 'work')
        .sort((a, b) => parseInt(b.start_year) - parseInt(a.start_year))

    const eduTimeline = rawTimeline
        .filter((t) => t.type === 'education')
        .sort((a, b) => parseInt(b.start_year) - parseInt(a.start_year))

    const { entries: projectEntries } = await getEmDashCollection('projects', {
        locale,
        status: 'published',
    })
    const projects = (projectEntries || []).map((p: any) => ({
        title: p.data.title,
        blocks: extractBlocks(p.data.description),
        url: p.data.url,
        labels: (p.data.labels || [])
            .map((l: any) => l.etiqueta || l.label)
            .filter(Boolean),
    }))

    const { entries: certEntries } = await getEmDashCollection('certificates', {
        locale,
        status: 'published',
    })
    const certificates = (certEntries || []).map((c: any) => {
        const certData = c.data || {}
        const fileUrl = getCertFileUrl(certData.certificate_file)
        return {
            title: certData.title,
            issuer: certData.issuer,
            issuer_website: certData.issuer_website,
            file_url: fileUrl,
        }
    })

    // 2. Initialize PDF Document
    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Load avatar image from bundled inline base64 string (works 100% in Cloudflare Workers / SSR)
    let avatarImg: any = null
    try {
        if (avatarDataUri) {
            const base64Data = avatarDataUri.replace(
                /^data:image\/\w+;base64,/,
                '',
            )
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            avatarImg = await pdfDoc.embedJpg(bytes)
        }
    } catch (e) {
        console.error('Error embedding inline avatar image:', e)
    }

    const pageWidth = 595.28 // A4 width
    const pageHeight = 841.89 // A4 height
    const margin = 40
    const contentWidth = pageWidth - margin * 2

    // Colors: Professional Modern Palette
    const colors = {
        primary: rgb(0.06, 0.09, 0.16), // #0F172A Dark Slate
        accent: rgb(0.15, 0.39, 0.92), // #2563EB Blue
        textDark: rgb(0.12, 0.16, 0.23), // #1E293B
        textMuted: rgb(0.35, 0.42, 0.52), // #5A6A80
        textLight: rgb(0.47, 0.55, 0.67), // #788C9E
        lineDivider: rgb(0.88, 0.91, 0.94), // #E2E8F0
        bgHeader: rgb(0.96, 0.97, 0.99), // #F5F7FA
    }

    let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    // Helper: Check space and add new page if needed
    function ensureSpace(heightNeeded: number) {
        if (y - heightNeeded < margin + 20) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
        }
    }

    // Helper: Draw Section Title
    function drawSectionTitle(title: string) {
        ensureSpace(35)
        currentPage.drawText(cleanText(title.toUpperCase()), {
            x: margin,
            y,
            size: 11,
            font: fontBold,
            color: colors.primary,
        })
        y -= 6
        currentPage.drawLine({
            start: { x: margin, y },
            end: { x: margin + contentWidth, y },
            thickness: 1,
            color: colors.accent,
        })
        y -= 14
    }

    // Helper: Render description blocks (headings, lists, paragraphs)
    function renderDescriptionBlocks(blocks: DescriptionBlock[]) {
        for (const block of blocks) {
            if (block.type === 'heading') {
                const headingSize = Math.max(9, 10.5 - block.level * 0.5)
                const lines = wrapText(
                    block.text,
                    fontBold,
                    headingSize,
                    contentWidth - 10,
                )
                ensureSpace(lines.length * 12 + 6)
                y -= 3
                for (const line of lines) {
                    currentPage.drawText(line, {
                        x: margin + 8,
                        y,
                        size: headingSize,
                        font: fontBold,
                        color: colors.primary,
                    })
                    y -= 12
                }
                y -= 2
            } else if (block.type === 'bullet-item') {
                const indent = margin + 12 + (block.level - 1) * 10
                const availWidth = contentWidth - 20 - (block.level - 1) * 10
                const bulletSymbol = '• '
                const bulletWidth = fontBold.widthOfTextAtSize(bulletSymbol, 9)
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    9,
                    availWidth - bulletWidth,
                )
                ensureSpace(lines.length * 11 + 2)

                for (let i = 0; i < lines.length; i++) {
                    if (i === 0) {
                        currentPage.drawText(bulletSymbol, {
                            x: indent,
                            y,
                            size: 9,
                            font: fontBold,
                            color: colors.accent,
                        })
                        currentPage.drawText(lines[i], {
                            x: indent + bulletWidth,
                            y,
                            size: 9,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    } else {
                        currentPage.drawText(lines[i], {
                            x: indent + bulletWidth,
                            y,
                            size: 9,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    }
                    y -= 11
                }
                y -= 1
            } else if (block.type === 'number-item') {
                const indent = margin + 12 + (block.level - 1) * 10
                const availWidth = contentWidth - 20 - (block.level - 1) * 10
                const numPrefix = `${block.index}. `
                const numWidth = fontBold.widthOfTextAtSize(numPrefix, 9)
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    9,
                    availWidth - numWidth,
                )
                ensureSpace(lines.length * 11 + 2)

                for (let i = 0; i < lines.length; i++) {
                    if (i === 0) {
                        currentPage.drawText(numPrefix, {
                            x: indent,
                            y,
                            size: 9,
                            font: fontBold,
                            color: colors.accent,
                        })
                        currentPage.drawText(lines[i], {
                            x: indent + numWidth,
                            y,
                            size: 9,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    } else {
                        currentPage.drawText(lines[i], {
                            x: indent + numWidth,
                            y,
                            size: 9,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    }
                    y -= 11
                }
                y -= 1
            } else {
                // Paragraph
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    9,
                    contentWidth - 10,
                )
                ensureSpace(lines.length * 12 + 4)
                for (const line of lines) {
                    currentPage.drawText(line, {
                        x: margin + 8,
                        y,
                        size: 9,
                        font: fontRegular,
                        color: colors.textDark,
                    })
                    y -= 12
                }
                y -= 4
            }
        }
    }

    // -----------------------------------------------------------------------
    // HEADER BLOCK (With Round Photo & Face Crop)
    // -----------------------------------------------------------------------
    const headerHeight = 85
    currentPage.drawRectangle({
        x: margin - 10,
        y: y - headerHeight,
        width: contentWidth + 20,
        height: headerHeight + 10,
        color: colors.bgHeader,
    })

    const headerTextWidth = avatarImg ? contentWidth - 85 : contentWidth

    // Name (with 22pt vertical top padding)
    const nameText = cleanText(profile.name || 'Javier Aday Pérez Romero')
    currentPage.drawText(nameText, {
        x: margin,
        y: y - 22,
        size: 21,
        font: fontBold,
        color: colors.primary,
    })
    addLink(
        pdfDoc,
        currentPage,
        'https://cocodrulo.dev',
        margin,
        y - 22,
        fontBold.widthOfTextAtSize(nameText, 21),
        21,
    )

    // Tagline / Label
    const labelText = cleanText(
        profile.label ||
            (isEs ? 'Desarrollador de Software' : 'Software Developer'),
    )
    currentPage.drawText(labelText, {
        x: margin,
        y: y - 41,
        size: 11,
        font: fontBold,
        color: colors.accent,
    })

    // Contact / Socials: ONLY LABELS (clickable links)
    const contactItems: Array<{ label: string; url: string }> = [
        { label: 'cocodrulo.dev', url: 'https://cocodrulo.dev' },
        ...socials.map((s) => ({
            label: cleanText(s.name || s.label),
            url: s.url,
        })),
    ]

    let contactX = margin
    let contactY = y - 61
    const fontSizeContact = 8.5
    const separator = '  •  '
    const separatorWidth = fontRegular.widthOfTextAtSize(
        separator,
        fontSizeContact,
    )

    for (let i = 0; i < contactItems.length; i++) {
        const item = contactItems[i]
        const cleanLabel = cleanText(item.label)
        const itemWidth = fontRegular.widthOfTextAtSize(
            cleanLabel,
            fontSizeContact,
        )

        if (
            contactX + itemWidth > margin + headerTextWidth &&
            contactX > margin
        ) {
            contactX = margin
            contactY -= 11
        }

        currentPage.drawText(cleanLabel, {
            x: contactX,
            y: contactY,
            size: fontSizeContact,
            font: fontRegular,
            color: colors.accent,
        })

        addLink(
            pdfDoc,
            currentPage,
            item.url,
            contactX,
            contactY,
            itemWidth,
            fontSizeContact,
        )

        contactX += itemWidth

        if (i < contactItems.length - 1) {
            if (contactX + separatorWidth <= margin + headerTextWidth) {
                currentPage.drawText(separator, {
                    x: contactX,
                    y: contactY,
                    size: fontSizeContact,
                    font: fontRegular,
                    color: colors.textMuted,
                })
                contactX += separatorWidth
            }
        }
    }

    // Draw Round Photo on Right Side (with aspect ratio preservation & face focus)
    if (avatarImg) {
        const cx = margin + contentWidth - 38
        const cy = y - 42
        const r = 32
        const k = r * 0.5522847498
        const D = r * 2

        // Object-fit cover math to keep aspect ratio & focus on face (top of portrait)
        const srcW = avatarImg.width
        const srcH = avatarImg.height
        const aspect = srcW / srcH

        let drawW: number
        let drawH: number
        let drawX: number
        let drawY: number

        if (aspect < 1) {
            // Portrait photo (taller than wide): match width, align top to show face
            drawW = D
            drawH = D / aspect
            drawX = cx - r
            drawY = cy + r - drawH
        } else {
            // Landscape or square photo: match height, center horizontally
            drawH = D
            drawW = D * aspect
            drawX = cx - drawW / 2
            drawY = cy - r
        }

        // Draw Accent Ring around avatar
        currentPage.drawCircle({
            x: cx,
            y: cy,
            size: r + 2.5,
            borderWidth: 2,
            borderColor: colors.accent,
            color: colors.bgHeader,
        })

        // Circular clipping operators
        currentPage.pushOperators(
            pushGraphicsState(),
            moveTo(cx, cy + r),
            curveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy),
            curveTo(cx + r, cy - k, cx + k, cy - r, cx, cy - r),
            curveTo(cx - k, cy - r, cx - r, cy - k, cx - r, cy),
            curveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r),
            clip(),
            endPath(),
        )

        // Draw avatar image without stretching/squishing
        currentPage.drawImage(avatarImg, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
        })

        // Restore graphics state
        currentPage.pushOperators(popGraphicsState())
    }

    y -= headerHeight + 15

    // -----------------------------------------------------------------------
    // ABOUT / PROFILE SUMMARY
    // -----------------------------------------------------------------------
    const aboutBlocks: DescriptionBlock[] = []
    if (about.subtitle) aboutBlocks.push(...extractBlocks(about.subtitle))
    if (Array.isArray(about.paragraphs)) {
        about.paragraphs.forEach((p: any) => {
            aboutBlocks.push(...extractBlocks(p))
        })
    }

    if (aboutBlocks.length > 0) {
        drawSectionTitle(isEs ? 'PERFIL PROFESIONAL' : 'PROFESSIONAL SUMMARY')
        renderDescriptionBlocks(aboutBlocks.slice(1, -1))
        y -= 10
    }

    // -----------------------------------------------------------------------
    // WORK EXPERIENCE
    // -----------------------------------------------------------------------
    if (workTimeline.length > 0) {
        drawSectionTitle(isEs ? 'EXPERIENCIA LABORAL' : 'WORK EXPERIENCE')

        for (const item of workTimeline) {
            const periodStr = item.current
                ? `${item.start_year} — ${isEs ? 'Presente' : 'Present'}`
                : item.end_year
                  ? `${item.start_year} — ${item.end_year}`
                  : item.start_year

            const titleStr = cleanText(item.title)
            const placeStr = cleanText(item.place)
            const descBlocks = extractBlocks(item.description)

            ensureSpace(30)

            // Title
            currentPage.drawText(titleStr, {
                x: margin,
                y,
                size: 10.5,
                font: fontBold,
                color: colors.textDark,
            })

            // Period right-aligned
            const periodWidth = fontBold.widthOfTextAtSize(periodStr, 9)
            currentPage.drawText(periodStr, {
                x: margin + contentWidth - periodWidth,
                y,
                size: 9,
                font: fontBold,
                color: colors.accent,
            })

            y -= 13

            // Place
            if (placeStr) {
                currentPage.drawText(placeStr, {
                    x: margin,
                    y,
                    size: 9.5,
                    font: fontOblique,
                    color: colors.textMuted,
                })
                y -= 13
            }

            // Render structured blocks (headings, lists, paragraphs)
            renderDescriptionBlocks(descBlocks)

            y -= 8
        }
        y -= 5
    }

    // -----------------------------------------------------------------------
    // EDUCATION
    // -----------------------------------------------------------------------
    if (eduTimeline.length > 0) {
        drawSectionTitle(isEs ? 'EDUCACIÓN' : 'EDUCATION')

        for (const item of eduTimeline) {
            const periodStr = item.current
                ? `${item.start_year} — ${isEs ? 'Presente' : 'Present'}`
                : item.end_year
                  ? `${item.start_year} — ${item.end_year}`
                  : item.start_year

            const titleStr = cleanText(item.title)
            const placeStr = cleanText(item.place)
            const descBlocks = extractBlocks(item.description)

            ensureSpace(30)

            currentPage.drawText(titleStr, {
                x: margin,
                y,
                size: 10.5,
                font: fontBold,
                color: colors.textDark,
            })

            const periodWidth = fontBold.widthOfTextAtSize(periodStr, 9)
            currentPage.drawText(periodStr, {
                x: margin + contentWidth - periodWidth,
                y,
                size: 9,
                font: fontBold,
                color: colors.accent,
            })

            y -= 13

            if (placeStr) {
                currentPage.drawText(placeStr, {
                    x: margin,
                    y,
                    size: 9.5,
                    font: fontOblique,
                    color: colors.textMuted,
                })
                y -= 13
            }

            renderDescriptionBlocks(descBlocks)

            y -= 8
        }
        y -= 5
    }

    // -----------------------------------------------------------------------
    // PROJECTS (With Headings, Bullet Lists, Numbered Lists & Paragraphs)
    // -----------------------------------------------------------------------
    if (projects.length > 0) {
        drawSectionTitle(isEs ? 'PROYECTOS DESTACADOS' : 'FEATURED PROJECTS')

        for (const proj of projects) {
            const pTitle = cleanText(proj.title)
            const pBlocks = proj.blocks
            const pTags = proj.labels.map(cleanText).join(' • ')
            const pUrl = proj.url ? cleanText(proj.url) : ''

            ensureSpace(25)

            currentPage.drawText(pTitle, {
                x: margin,
                y,
                size: 10,
                font: fontBold,
                color: colors.textDark,
            })

            if (pUrl) {
                const urlWidth = fontRegular.widthOfTextAtSize(pUrl, 8.5)
                const urlX = margin + contentWidth - urlWidth
                currentPage.drawText(pUrl, {
                    x: urlX,
                    y,
                    size: 8.5,
                    font: fontRegular,
                    color: colors.accent,
                })
                addLink(pdfDoc, currentPage, proj.url!, urlX, y, urlWidth, 8.5)
            }

            y -= 13

            // Render structured blocks for project description
            renderDescriptionBlocks(pBlocks)

            if (pTags) {
                y -= 2
                currentPage.drawText(`Tech: ${pTags}`, {
                    x: margin + 8,
                    y,
                    size: 8,
                    font: fontBold,
                    color: colors.textMuted,
                })
                y -= 12
            }

            y -= 6
        }
        y -= 5
    }

    // -----------------------------------------------------------------------
    // CERTIFICATES & COURSES (With Direct PDF Links)
    // -----------------------------------------------------------------------
    if (certificates.length > 0) {
        drawSectionTitle(isEs ? 'CERTIFICACIONES' : 'CERTIFICATES')

        for (const cert of certificates) {
            const certTitle = cleanText(cert.title)
            const certIssuer = cleanText(cert.issuer)
            const pdfTag = isEs ? '[Ver PDF]' : '[View PDF]'
            const pdfTagWidth = fontBold.widthOfTextAtSize(pdfTag, 8)

            const lines = wrapText(certTitle, fontBold, 9, contentWidth - 170)
            const itemHeight = Math.max(16, lines.length * 12)

            ensureSpace(itemHeight + 4)

            let certY = y
            for (let i = 0; i < lines.length; i++) {
                currentPage.drawText(lines[i], {
                    x: margin,
                    y: certY,
                    size: 9,
                    font: fontBold,
                    color: colors.textDark,
                })
                certY -= 12
            }

            // Link title to certificate file if available
            if (cert.file_url) {
                const titleWidth = fontBold.widthOfTextAtSize(lines[0], 9)
                addLink(
                    pdfDoc,
                    currentPage,
                    cert.file_url,
                    margin,
                    y,
                    titleWidth,
                    9,
                )
            }

            // Right side: Issuer + [Ver PDF] link
            let rightX = margin + contentWidth

            if (cert.file_url) {
                rightX -= pdfTagWidth
                currentPage.drawText(pdfTag, {
                    x: rightX,
                    y,
                    size: 8,
                    font: fontBold,
                    color: colors.accent,
                })
                addLink(
                    pdfDoc,
                    currentPage,
                    cert.file_url,
                    rightX,
                    y,
                    pdfTagWidth,
                    8,
                )
                rightX -= 8
            }

            if (certIssuer) {
                const issuerWidth = fontRegular.widthOfTextAtSize(
                    certIssuer,
                    8.5,
                )
                rightX -= issuerWidth
                currentPage.drawText(certIssuer, {
                    x: rightX,
                    y,
                    size: 8.5,
                    font: fontOblique,
                    color: cert.issuer_website
                        ? colors.accent
                        : colors.textMuted,
                })
                if (cert.issuer_website) {
                    addLink(
                        pdfDoc,
                        currentPage,
                        cert.issuer_website,
                        rightX,
                        y,
                        issuerWidth,
                        8.5,
                    )
                }
            }

            y = certY - 4
        }
    }

    // Add footer to all pages with website link
    const pageCount = pdfDoc.getPageCount()
    for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i)
        const footerText = cleanText(
            `Javier Aday Pérez Romero — Curriculum Vitae | ${isEs ? 'Página' : 'Page'} ${i + 1} ${isEs ? 'de' : 'of'} ${pageCount}`,
        )
        const fWidth = fontRegular.widthOfTextAtSize(footerText, 8)
        page.drawText(footerText, {
            x: (pageWidth - fWidth) / 2,
            y: 20,
            size: 8,
            font: fontRegular,
            color: colors.textLight,
        })
    }

    return await pdfDoc.save()
}

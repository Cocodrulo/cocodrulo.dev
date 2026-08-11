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
    let formattedUrl = url.trim()
    if (formattedUrl.startsWith('mailto:') || formattedUrl.startsWith('tel:')) {
        // Keep protocol as-is
    } else if (
        formattedUrl.includes('@') &&
        !formattedUrl.includes('/') &&
        !formattedUrl.startsWith('http')
    ) {
        formattedUrl = `mailto:${formattedUrl}`
    } else if (
        !formattedUrl.startsWith('http://') &&
        !formattedUrl.startsWith('https://')
    ) {
        formattedUrl = `https://${formattedUrl}`
    }

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

function isTruthy(val: any): boolean {
    if (
        val === true ||
        val === 1 ||
        val === '1' ||
        val === 'true' ||
        val === 'on'
    )
        return true
    return false
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
        label: isEs
            ? 'Desarrollador de software y estudiante de Ingeniería Informática en la ULPGC'
            : 'Software developer and Computer Science student at ULPGC',
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
        show_in_cv?: boolean
    }>

    // Work & Education filtering (opt-in if any entry has show_in_cv checked)
    const hasExplicitWorkFilter = rawTimeline.some(
        (t) => t.type === 'work' && isTruthy(t.show_in_cv),
    )
    const workTimeline = rawTimeline
        .filter((t) => {
            if (t.type !== 'work') return false
            if (hasExplicitWorkFilter) {
                return isTruthy(t.show_in_cv)
            }
            return (
                t.show_in_cv !== false &&
                t.show_in_cv !== undefined &&
                t.show_in_cv !== null
            )
        })
        .sort((a, b) => parseInt(b.start_year) - parseInt(a.start_year))

    const hasExplicitEduFilter = rawTimeline.some(
        (t) => t.type === 'education' && isTruthy(t.show_in_cv),
    )
    const eduTimeline = rawTimeline
        .filter((t) => {
            if (t.type !== 'education') return false
            if (hasExplicitEduFilter) {
                return isTruthy(t.show_in_cv)
            }
            return (
                t.show_in_cv !== false &&
                t.show_in_cv !== undefined &&
                t.show_in_cv !== null
            )
        })
        .sort((a, b) => parseInt(b.start_year) - parseInt(a.start_year))

    // Projects filtering (opt-in if show_in_cv / featured is checked)
    const { entries: projectEntries } = await getEmDashCollection('projects', {
        locale,
        status: 'published',
    })
    const hasExplicitProjectFilter = (projectEntries || []).some(
        (p: any) => isTruthy(p.data?.show_in_cv) || isTruthy(p.data?.featured),
    )
    const projects = (projectEntries || [])
        .filter((p: any) => {
            const data = p.data || {}
            if (hasExplicitProjectFilter) {
                return isTruthy(data.show_in_cv) || isTruthy(data.featured)
            }
            return (
                data.show_in_cv !== false &&
                data.show_in_cv !== 0 &&
                data.show_in_cv !== 'false'
            )
        })
        .map((p: any) => {
            const data = p.data || {}
            return {
                title: data.title || '',
                url: data.url || '',
                blocks: extractBlocks(data.cv_summary || data.description),
                labels: (data.labels || [])
                    .map((l: any) => l.etiqueta || l.label)
                    .filter(Boolean),
            }
        })

    // Certificates filtering (opt-in if show_in_cv / featured is checked)
    const { entries: certEntries } = await getEmDashCollection('certificates', {
        locale,
        status: 'published',
    })
    const hasExplicitCertFilter = (certEntries || []).some(
        (c: any) => isTruthy(c.data?.show_in_cv) || isTruthy(c.data?.featured),
    )
    const certificates = (certEntries || [])
        .filter((c: any) => {
            const certData = c.data || {}
            if (hasExplicitCertFilter) {
                return (
                    isTruthy(certData.show_in_cv) || isTruthy(certData.featured)
                )
            }
            return (
                certData.show_in_cv !== false &&
                certData.show_in_cv !== 0 &&
                certData.show_in_cv !== 'false'
            )
        })
        .map((c: any) => {
            const certData = c.data || {}
            const fileUrl = getCertFileUrl(certData.certificate_file)
            return {
                title: certData.title || '',
                issuer: certData.issuer || '',
                issuer_website: certData.issuer_website || '',
                file_url: fileUrl,
                show_in_cv: certData.show_in_cv,
            }
        })

    // 2. Initialize PDF Document
    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Load avatar image from bundled inline base64 string
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
    const margin = 34
    const contentWidth = pageWidth - margin * 2

    // Two-column layout geometry (Matching Enhancv layout from screenshot)
    const gutter = 18
    const leftColWidth = 316
    const rightColWidth = contentWidth - leftColWidth - gutter // ~173pt
    const leftX = margin
    const rightX = margin + leftColWidth + gutter

    // Colors: Clean High-Contrast Palette (Enhancv style)
    const colors = {
        primary: rgb(0.05, 0.05, 0.05), // #0D0D0D Deep Black
        accent: rgb(0.0, 0.44, 0.95), // #0070F3 / #0066FF Vibrant Accent Blue
        textDark: rgb(0.18, 0.22, 0.28), // #2E3846
        textMuted: rgb(0.45, 0.5, 0.58), // #738094
        textLight: rgb(0.6, 0.65, 0.72), // #99A6B8
        lineBlack: rgb(0.08, 0.08, 0.08), // Solid section underline
        lineDotted: rgb(0.82, 0.85, 0.89), // Light divider line
    }

    const pages: PDFPage[] = [pdfDoc.addPage([pageWidth, pageHeight])]

    function getPage(index: number): PDFPage {
        while (pages.length <= index) {
            pages.push(pdfDoc.addPage([pageWidth, pageHeight]))
        }
        return pages[index]
    }

    // -----------------------------------------------------------------------
    // FULL-WIDTH HEADER
    // -----------------------------------------------------------------------
    let curHeaderPage = pages[0]
    let yHeader = pageHeight - margin

    const headerTextWidth = avatarImg ? contentWidth - 75 : contentWidth

    // Full Name in uppercase bold
    const nameText = cleanText(
        profile.name || 'Javier Aday Pérez Romero',
    ).toUpperCase()
    curHeaderPage.drawText(nameText, {
        x: margin,
        y: yHeader - 18,
        size: 20,
        font: fontBold,
        color: colors.primary,
    })
    addLink(
        pdfDoc,
        curHeaderPage,
        'https://cocodrulo.dev',
        margin,
        yHeader - 18,
        fontBold.widthOfTextAtSize(nameText, 20),
        20,
    )

    // Subtitle in Vibrant Blue
    const labelText = cleanText(
        profile.label ||
            (isEs
                ? 'Desarrollador de software y estudiante de Ingeniería Informática en la ULPGC'
                : 'Software developer and Computer Science student at ULPGC'),
    )
    const labelLines = wrapText(labelText, fontBold, 10, headerTextWidth)
    let curLabelY = yHeader - 34
    for (const l of labelLines) {
        curHeaderPage.drawText(l, {
            x: margin,
            y: curLabelY,
            size: 10,
            font: fontBold,
            color: colors.accent,
        })
        curLabelY -= 12
    }

    // Contact bar with links directly from Emdash socials
    const socialItems =
        socials && socials.length > 0
            ? socials
                  .map((s) => ({
                      label: cleanText(s.label || s.name),
                      url: s.url,
                  }))
                  .filter((s) => s.label)
            : [
                  { label: 'Web', url: 'https://cocodrulo.dev' },
                  {
                      label: 'contact@cocodrulo.dev',
                      url: 'mailto:contact@cocodrulo.dev',
                  },
              ]

    const contactItems: Array<{ label: string; url?: string }> = [
        ...socialItems,
        {
            label: isEs
                ? 'Permiso B (Vehículo propio)'
                : "Driver's License B (Own vehicle)",
        },
    ]

    let contactX = margin
    let contactY = curLabelY - 4
    const fontSizeContact = 8
    const separatorGap = 10

    for (let i = 0; i < contactItems.length; i++) {
        const item = contactItems[i]
        const cleanLabel = cleanText(item.label)
        if (!cleanLabel) continue

        const isLink = Boolean(item.url)
        const itemFont = isLink ? fontBold : fontRegular
        const itemWidth = itemFont.widthOfTextAtSize(
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

        curHeaderPage.drawText(cleanLabel, {
            x: contactX,
            y: contactY,
            size: fontSizeContact,
            font: itemFont,
            color: isLink ? colors.primary : colors.textMuted,
        })

        if (item.url) {
            addLink(
                pdfDoc,
                curHeaderPage,
                item.url,
                contactX,
                contactY - 1,
                itemWidth,
                fontSizeContact + 2,
            )
        }

        contactX += itemWidth + separatorGap
    }

    // Draw Portrait Avatar on Top Right
    if (avatarImg) {
        const cx = margin + contentWidth - 32
        const cy = yHeader - 34
        const r = 30
        const k = r * 0.5522847498
        const D = r * 2

        const srcW = avatarImg.width
        const srcH = avatarImg.height
        const aspect = srcW / srcH

        let drawW = D
        let drawH = D / aspect
        let drawX = cx - r
        let drawY = cy + r - drawH

        if (aspect >= 1) {
            drawH = D
            drawW = D * aspect
            drawX = cx - drawW / 2
            drawY = cy - r
        }

        curHeaderPage.pushOperators(
            pushGraphicsState(),
            moveTo(cx, cy + r),
            curveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy),
            curveTo(cx + r, cy - k, cx + k, cy - r, cx, cy - r),
            curveTo(cx - k, cy - r, cx - r, cy - k, cx - r, cy),
            curveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r),
            clip(),
            endPath(),
        )

        curHeaderPage.drawImage(avatarImg, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
        })

        curHeaderPage.pushOperators(popGraphicsState())
    }

    // Starting Y for both columns
    const columnsStartY = Math.min(contactY - 16, yHeader - 78)

    let yLeft = columnsStartY
    let leftPageIndex = 0

    let yRight = columnsStartY
    let rightPageIndex = 0

    // Helper: Ensure space in Left Column
    function ensureSpaceLeft(heightNeeded: number) {
        if (yLeft - heightNeeded < margin + 25) {
            leftPageIndex++
            yLeft = pageHeight - margin
        }
    }

    // Helper: Ensure space in Right Column
    function ensureSpaceRight(heightNeeded: number) {
        if (yRight - heightNeeded < margin + 25) {
            rightPageIndex++
            yRight = pageHeight - margin
        }
    }

    // Helper: Draw Section Title with Solid Black Underline
    function drawSectionHeader(
        title: string,
        colX: number,
        getY: () => number,
        setY: (v: number) => void,
        colWidth: number,
        ensureSpaceFn: (h: number) => void,
        getPageIndex: () => number,
    ) {
        ensureSpaceFn(28)
        let curY = getY()
        const page = getPage(getPageIndex())

        page.drawText(cleanText(title.toUpperCase()), {
            x: colX,
            y: curY,
            size: 10.5,
            font: fontBold,
            color: colors.primary,
        })

        curY -= 4
        page.drawLine({
            start: { x: colX, y: curY },
            end: { x: colX + colWidth, y: curY },
            thickness: 1.5,
            color: colors.lineBlack,
        })

        setY(curY - 11)
    }

    // Helper: Render description blocks in a column
    function renderColBlocks(
        blocks: DescriptionBlock[],
        colX: number,
        colWidth: number,
        getY: () => number,
        setY: (v: number) => void,
        ensureSpaceFn: (h: number) => void,
        getPageIndex: () => number,
    ) {
        for (const block of blocks) {
            let curY = getY()
            let page = getPage(getPageIndex())

            if (block.type === 'heading') {
                const headingSize = Math.max(8.5, 9.5 - block.level * 0.5)
                const lines = wrapText(
                    block.text,
                    fontBold,
                    headingSize,
                    colWidth - 4,
                )
                ensureSpaceFn(lines.length * 11 + 4)
                curY = getY() - 2
                page = getPage(getPageIndex())

                for (const line of lines) {
                    page.drawText(line, {
                        x: colX,
                        y: curY,
                        size: headingSize,
                        font: fontBold,
                        color: colors.primary,
                    })
                    curY -= 11
                }
                setY(curY - 2)
            } else if (block.type === 'bullet-item') {
                const indent = colX + (block.level - 1) * 8
                const availWidth = colWidth - (block.level - 1) * 8
                const bulletSymbol = '• '
                const bulletWidth = fontBold.widthOfTextAtSize(
                    bulletSymbol,
                    8.5,
                )
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    8.5,
                    availWidth - bulletWidth,
                )
                ensureSpaceFn(lines.length * 10.5 + 2)
                curY = getY()
                page = getPage(getPageIndex())

                for (let i = 0; i < lines.length; i++) {
                    if (i === 0) {
                        page.drawText(bulletSymbol, {
                            x: indent,
                            y: curY,
                            size: 8.5,
                            font: fontBold,
                            color: colors.accent,
                        })
                        page.drawText(lines[i], {
                            x: indent + bulletWidth,
                            y: curY,
                            size: 8.5,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    } else {
                        page.drawText(lines[i], {
                            x: indent + bulletWidth,
                            y: curY,
                            size: 8.5,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    }
                    curY -= 10.5
                }
                setY(curY - 1)
            } else if (block.type === 'number-item') {
                const indent = colX + (block.level - 1) * 8
                const availWidth = colWidth - (block.level - 1) * 8
                const numPrefix = `${block.index}. `
                const numWidth = fontBold.widthOfTextAtSize(numPrefix, 8.5)
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    8.5,
                    availWidth - numWidth,
                )
                ensureSpaceFn(lines.length * 10.5 + 2)
                curY = getY()
                page = getPage(getPageIndex())

                for (let i = 0; i < lines.length; i++) {
                    if (i === 0) {
                        page.drawText(numPrefix, {
                            x: indent,
                            y: curY,
                            size: 8.5,
                            font: fontBold,
                            color: colors.accent,
                        })
                        page.drawText(lines[i], {
                            x: indent + numWidth,
                            y: curY,
                            size: 8.5,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    } else {
                        page.drawText(lines[i], {
                            x: indent + numWidth,
                            y: curY,
                            size: 8.5,
                            font: fontRegular,
                            color: colors.textDark,
                        })
                    }
                    curY -= 10.5
                }
                setY(curY - 1)
            } else {
                // Paragraph
                const lines = wrapText(
                    block.text,
                    fontRegular,
                    8.5,
                    colWidth - 2,
                )
                ensureSpaceFn(lines.length * 11 + 3)
                curY = getY()
                page = getPage(getPageIndex())

                for (const line of lines) {
                    page.drawText(line, {
                        x: colX,
                        y: curY,
                        size: 8.5,
                        font: fontRegular,
                        color: colors.textDark,
                    })
                    curY -= 11
                }
                setY(curY - 2)
            }
        }
    }

    // =======================================================================
    // LEFT COLUMN RENDERING (Resumen, Experiencia, Educación, Proyectos)
    // =======================================================================

    // 1. RESUMEN
    const aboutBlocks: DescriptionBlock[] = []
    if (about.subtitle) aboutBlocks.push(...extractBlocks(about.subtitle))
    if (Array.isArray(about.paragraphs)) {
        about.paragraphs.forEach((p: any) => {
            aboutBlocks.push(...extractBlocks(p))
        })
    } else if (typeof about.paragraphs === 'string') {
        aboutBlocks.push(...extractBlocks(about.paragraphs))
    }

    if (aboutBlocks.length > 0) {
        drawSectionHeader(
            isEs ? 'RESUMEN' : 'SUMMARY',
            leftX,
            () => yLeft,
            (v) => (yLeft = v),
            leftColWidth,
            ensureSpaceLeft,
            () => leftPageIndex,
        )
        renderColBlocks(
            aboutBlocks,
            leftX,
            leftColWidth,
            () => yLeft,
            (v) => (yLeft = v),
            ensureSpaceLeft,
            () => leftPageIndex,
        )
        yLeft -= 8
    }

    // 2. EXPERIENCIA LABORAL (if any)
    if (workTimeline.length > 0) {
        drawSectionHeader(
            isEs ? 'EXPERIENCIA LABORAL' : 'WORK EXPERIENCE',
            leftX,
            () => yLeft,
            (v) => (yLeft = v),
            leftColWidth,
            ensureSpaceLeft,
            () => leftPageIndex,
        )

        for (const item of workTimeline) {
            const periodStr = item.current
                ? `${item.start_year} — ${isEs ? 'Presente' : 'Present'}`
                : item.end_year
                  ? `${item.start_year} — ${item.end_year}`
                  : item.start_year

            const titleStr = cleanText(item.title)
            const placeStr = cleanText(item.place)
            const descBlocks = extractBlocks(item.description)

            ensureSpaceLeft(26)
            let page = getPage(leftPageIndex)

            page.drawText(titleStr, {
                x: leftX,
                y: yLeft,
                size: 9.5,
                font: fontBold,
                color: colors.primary,
            })

            const periodWidth = fontRegular.widthOfTextAtSize(periodStr, 8)
            page.drawText(periodStr, {
                x: leftX + leftColWidth - periodWidth,
                y: yLeft,
                size: 8,
                font: fontRegular,
                color: colors.textMuted,
            })

            yLeft -= 11

            if (placeStr) {
                page.drawText(placeStr, {
                    x: leftX,
                    y: yLeft,
                    size: 9,
                    font: fontBold,
                    color: colors.accent,
                })
                yLeft -= 11
            }

            renderColBlocks(
                descBlocks,
                leftX,
                leftColWidth,
                () => yLeft,
                (v) => (yLeft = v),
                ensureSpaceLeft,
                () => leftPageIndex,
            )
            yLeft -= 5
        }
        yLeft -= 6
    }

    // 3. EDUCACIÓN
    if (eduTimeline.length > 0) {
        drawSectionHeader(
            isEs ? 'EDUCACIÓN' : 'EDUCATION',
            leftX,
            () => yLeft,
            (v) => (yLeft = v),
            leftColWidth,
            ensureSpaceLeft,
            () => leftPageIndex,
        )

        for (const item of eduTimeline) {
            const periodStr = item.current
                ? `${item.start_year} - ${isEs ? 'Presente' : 'Present'}`
                : item.end_year
                  ? `${item.start_year} - ${item.end_year}`
                  : item.start_year

            const titleStr = cleanText(item.title)
            const placeStr = cleanText(item.place)
            const descBlocks = extractBlocks(item.description)

            ensureSpaceLeft(26)
            let page = getPage(leftPageIndex)

            page.drawText(titleStr, {
                x: leftX,
                y: yLeft,
                size: 9.5,
                font: fontBold,
                color: colors.primary,
            })
            yLeft -= 11

            if (placeStr) {
                page.drawText(placeStr, {
                    x: leftX,
                    y: yLeft,
                    size: 9,
                    font: fontBold,
                    color: colors.accent,
                })
                yLeft -= 11
            }

            // Date line
            page = getPage(leftPageIndex)
            page.drawText(periodStr, {
                x: leftX,
                y: yLeft,
                size: 8,
                font: fontRegular,
                color: colors.textMuted,
            })
            yLeft -= 10

            renderColBlocks(
                descBlocks,
                leftX,
                leftColWidth,
                () => yLeft,
                (v) => (yLeft = v),
                ensureSpaceLeft,
                () => leftPageIndex,
            )
            yLeft -= 5
        }
        yLeft -= 6
    }

    // 4. PROYECTOS
    if (projects.length > 0) {
        drawSectionHeader(
            isEs ? 'PROYECTOS DESTACADOS' : 'FEATURED PROJECTS',
            leftX,
            () => yLeft,
            (v) => (yLeft = v),
            leftColWidth,
            ensureSpaceLeft,
            () => leftPageIndex,
        )

        for (const proj of projects) {
            const pTitle = cleanText(proj.title)
            const pTags = proj.labels.map(cleanText).join(' • ')
            const pUrl = proj.url ? cleanText(proj.url) : ''

            ensureSpaceLeft(26)
            let page = getPage(leftPageIndex)

            // Project Title
            const titleLines = wrapText(pTitle, fontBold, 9.5, leftColWidth)
            for (const tl of titleLines) {
                page.drawText(tl, {
                    x: leftX,
                    y: yLeft,
                    size: 9.5,
                    font: fontBold,
                    color: colors.primary,
                })
                yLeft -= 11
            }

            // Project URL link line
            if (pUrl) {
                page = getPage(leftPageIndex)
                const urlClean = pUrl.replace(/^https?:\/\//, '')
                const urlDisplay =
                    fontRegular.widthOfTextAtSize(urlClean, 7.5) > leftColWidth
                        ? urlClean.slice(0, 48) + '...'
                        : urlClean
                const urlWidth = fontRegular.widthOfTextAtSize(urlDisplay, 7.5)

                page.drawText(urlDisplay, {
                    x: leftX,
                    y: yLeft,
                    size: 7.5,
                    font: fontRegular,
                    color: colors.accent,
                })
                addLink(pdfDoc, page, proj.url!, leftX, yLeft, urlWidth, 7.5)
                yLeft -= 10
            }

            renderColBlocks(
                proj.blocks,
                leftX,
                leftColWidth,
                () => yLeft,
                (v) => (yLeft = v),
                ensureSpaceLeft,
                () => leftPageIndex,
            )

            if (pTags) {
                ensureSpaceLeft(12)
                page = getPage(leftPageIndex)
                page.drawText(`Tech: ${pTags}`, {
                    x: leftX,
                    y: yLeft,
                    size: 7.5,
                    font: fontBold,
                    color: colors.textMuted,
                })
                yLeft -= 10
            }

            yLeft -= 5
        }
    }

    // =======================================================================
    // RIGHT COLUMN RENDERING (Certificaciones with subtle dotted dividers)
    // =======================================================================
    if (certificates.length > 0) {
        drawSectionHeader(
            isEs ? 'CERTIFICACIONES' : 'CERTIFICATES',
            rightX,
            () => yRight,
            (v) => (yRight = v),
            rightColWidth,
            ensureSpaceRight,
            () => rightPageIndex,
        )

        for (let i = 0; i < certificates.length; i++) {
            const cert = certificates[i]
            const certTitle = cleanText(cert.title)
            const certIssuer = cleanText(cert.issuer)

            const lines = wrapText(certTitle, fontBold, 8.5, rightColWidth)
            const neededHeight = lines.length * 10.5 + 18

            ensureSpaceRight(neededHeight)
            let page = getPage(rightPageIndex)

            let certY = yRight
            for (let j = 0; j < lines.length; j++) {
                page.drawText(lines[j], {
                    x: rightX,
                    y: certY,
                    size: 8.5,
                    font: fontBold,
                    color: colors.primary,
                })
                certY -= 10.5
            }

            // Link title to certificate file if available
            if (cert.file_url) {
                const titleWidth = fontBold.widthOfTextAtSize(lines[0], 8.5)
                addLink(
                    pdfDoc,
                    page,
                    cert.file_url,
                    rightX,
                    yRight,
                    titleWidth,
                    8.5,
                )
            }

            // Issuer
            if (certIssuer) {
                page.drawText(certIssuer, {
                    x: rightX,
                    y: certY,
                    size: 8,
                    font: fontRegular,
                    color: colors.textMuted,
                })
                if (cert.issuer_website) {
                    const issWidth = fontRegular.widthOfTextAtSize(
                        certIssuer,
                        8,
                    )
                    addLink(
                        pdfDoc,
                        page,
                        cert.issuer_website,
                        rightX,
                        certY,
                        issWidth,
                        8,
                    )
                }
                certY -= 10
            }

            // Subtle divider line between certificates (except after last)
            if (i < certificates.length - 1) {
                page.drawLine({
                    start: { x: rightX, y: certY + 3 },
                    end: { x: rightX + rightColWidth, y: certY + 3 },
                    thickness: 0.5,
                    color: colors.lineDotted,
                })
                certY -= 5
            }

            yRight = certY - 3
        }
    }

    // Add footer to all pages
    const pageCount = pages.length
    for (let i = 0; i < pageCount; i++) {
        const page = pages[i]
        const footerText = cleanText(
            `Javier Aday Pérez Romero — Curriculum Vitae | ${isEs ? 'Página' : 'Page'} ${i + 1} ${isEs ? 'de' : 'of'} ${pageCount}`,
        )
        const fWidth = fontRegular.widthOfTextAtSize(footerText, 7.5)
        page.drawText(footerText, {
            x: (pageWidth - fWidth) / 2,
            y: 16,
            size: 7.5,
            font: fontRegular,
            color: colors.textLight,
        })
    }

    return await pdfDoc.save()
}

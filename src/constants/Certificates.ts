export const CERTIFICATES = [
    {
        label: {
            es: 'Red Hat Training: Introducción a los Fundamentos de Linux (RH104 - RHA) - Ver. 9.1',
            en: 'Red Hat Training: Getting Started with Linux Fundamentals (RH104 - RHA) - Ver. 9.1',
        },
        certificate:
            '/certificates/red-hat-training-getting-started-with-linux-fundamentals-rh104-rha-ver-9-1.pdf',
        issuer: 'Red Hat',
        issuerId: 'redhat',
        issuerWebsite: 'https://www.redhat.com/',
    },
    {
        label: {
            es: 'Cisco Networking Academy: Introducción a la Ciberseguridad',
            en: 'Cisco Networking Academy: Introduction to Cybersecurity',
        },
        certificate:
            '/certificates/cisco-networking-academy-introduction-to-cybersecurity.pdf',
        issuer: 'Cisco Networking Academy',
        issuerId: 'cisco',
        issuerWebsite: 'https://www.netacad.com/',
    },
    {
        label: {
            es: 'Certificado en Inglés Avanzado (C1)',
            en: 'Advanced English Certificate (C1)',
        },
        certificate: '/certificates/c1-english-cambridge.pdf',
        issuer: 'Cambridge Assessment English',
        issuerId: 'cambridge',
        issuerWebsite: 'https://www.cambridgeenglish.org/',
    },
    {
        label: {
            es: 'Certificado de Nivel Intermedio (B2)',
            en: 'Intermediate English Certificate (B2)',
        },
        certificate: '/certificates/b2-eoi.pdf',
        issuer: 'Escuela Oficial de Idiomas 7 Palmas',
        issuerId: 'eoi7palmas',
        issuerWebsite: 'https://eoi7palmas.org/',
    },
    {
        label: {
            es: 'HTML desde Cero',
            en: 'HTML from Scratch',
        },
        certificate: '/certificates/html-desde-cero.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Aprende lo último de JavaScript (ES2023 & ES2024)',
            en: 'Learn the latest of JavaScript (ES2023 & ES2024)',
        },
        certificate:
            '/certificates/aprende-lo-ultimo-de-javascript-es2023-es2024.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Crea una PWA de Detección de Objetos con Angular 19 y Tensorflow.js',
            en: 'Create an Object Detection PWA with Angular 19 and Tensorflow.js',
        },
        certificate:
            '/certificates/crea-una-pwa-de-deteccion-de-objetos-con-angular-19-y-tensorflowjs.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'CSS desde Cero',
            en: 'CSS from Scratch',
        },
        certificate: '/certificates/css-desde-cero.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Crea experiencias 3D increíbles con Vue',
            en: 'Create amazing 3D experiences with Vue',
        },
        certificate:
            '/certificates/crea-experiencias-3d-increibles-con-vue.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Iniciación al Scraping con Python',
            en: 'Introduction to Scraping with Python',
        },
        certificate: '/certificates/iniciacion-al-scraping-con-python.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Curso Intensivo de Model Context Protocol',
            en: 'Intensive Course on Model Context Protocol',
        },
        certificate:
            '/certificates/curso-intensivo-de-model-context-protocol.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Promeses en JavaScript',
            en: 'Promises in JavaScript',
        },
        certificate: '/certificates/promesas-en-javascript.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Python desde Cero',
            en: 'Python from Scratch',
        },
        certificate: '/certificates/python-desde-cero.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Curso de Tailwind desde Cero',
            en: 'Tailwind Course from Scratch',
        },
        certificate: '/certificates/curso-de-tailwind-desde-cero.pdf',
        issuer: 'midudev',
        issuerId: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
]

export type Certificate = (typeof CERTIFICATES)[number]

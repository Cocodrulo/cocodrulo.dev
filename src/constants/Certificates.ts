export const CERTIFICATES = [
    {
        label: {
            es: 'Aprende lo últiimo de JavaScript (ES2023 & ES2024)',
            en: 'Learn the latest of JavaScript (ES2023 & ES2024)',
        },
        certificate:
            '/certificates/aprende-lo-ultimo-de-javascript-es2023-es2024.pdf',
        issuer: 'midudev',
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
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'CSS desde Cero',
            en: 'CSS from Scratch',
        },
        certificate: '/certificates/css-desde-cero.pdf',
        issuer: 'midudev',
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
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Iniciación al Scraping con Python',
            en: 'Introduction to Scraping with Python',
        },
        certificate: '/certificates/iniciacion-al-scraping-con-python.pdf',
        issuer: 'midudev',
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
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Promeses en JavaScript',
            en: 'Promises in JavaScript',
        },
        certificate: '/certificates/promesas-en-javascript.pdf',
        issuer: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Python desde Cero',
            en: 'Python from Scratch',
        },
        certificate: '/certificates/python-desde-cero.pdf',
        issuer: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Curso de Tailwind desde Cero',
            en: 'Tailwind Course from Scratch',
        },
        certificate: '/certificates/curso-de-tailwind-desde-cero.pdf',
        issuer: 'midudev',
        issuerWebsite: 'https://midu.dev/',
    },
    {
        label: {
            es: 'Red Hat Training: Introducción a los Fundamentos de Linux (RH104 - RHA) - Ver. 9.1',
            en: 'Red Hat Training: Getting Started with Linux Fundamentals (RH104 - RHA) - Ver. 9.1',
        },
        certificate:
            '/certificates/red-hat-training-getting-started-with-linux-fundamentals-rh104-rha-ver-9-1.pdf',
        issuer: 'Red Hat',
        issuerWebsite: 'https://www.redhat.com/',
    },
]

export type Certificate = (typeof CERTIFICATES)[number]

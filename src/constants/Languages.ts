export default {
    ['/es/']: {
        prefix: 'es',
        name: 'Español',
        flag: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgh2widkbW8rRkRhWP_Ppd1OI8GRLyiyNVyg&s',
    },
    ['/en/']: {
        prefix: 'en',
        name: 'English',
        flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Flag_of_the_United_Kingdom_%283-5%29.svg/2560px-Flag_of_the_United_Kingdom_%283-5%29.svg.png',
    },
} as { [key: string]: { prefix: string; name: string; flag: string } }

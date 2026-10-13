/** Статическая информация о барбершопе: контакты, адрес, часы. Не зависит от API. */
export const shop = {
  name: 'Sharp',
  fullName: 'Sharp Barbershop',
  tagline: 'Мужские стрижки и борода в центре Ташкента',
  address: 'Ташкент, ул. Амира Темура, 15',
  landmark: 'Ориентир: сквер Амира Темура, 3 минуты пешком',
  phone: '+998 90 123 45 67',
  phoneHref: 'tel:+998901234567',
  telegram: '@sharp_barber',
  telegramHref: 'https://t.me/sharp_barber',
  instagram: '@sharp.barber.tashkent',
  instagramHref: 'https://instagram.com/sharp.barber.tashkent',
  hours: [
    { days: 'Пн–Сб', time: '10:00–21:00' },
    { days: 'Вс', time: '11:00–19:00' },
  ],
  map: {
    lat: 41.3111,
    lon: 69.2797,
  },
} as const

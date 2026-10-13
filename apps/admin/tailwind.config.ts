import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: 'hsl(0 0% 100%)',
        'surface-raised': 'hsl(0 0% 98%)',
        border: 'hsl(0 0% 87%)',
        'text-muted': 'hsl(0 0% 50%)',
        'text-body': 'hsl(0 0% 18%)',
      },
    },
  },
  plugins: [],
}

export default config

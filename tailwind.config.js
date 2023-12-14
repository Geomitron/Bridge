/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      screens: {
        '3xl': '1900px',
      },
    },
  },
  content: ['./src-angular/**/*.{html,js,ts}'],
  plugins: [
		require('tailwind-scrollbar')({ nocompatible: true }),
		require('daisyui'),
	],
	daisyui: {
		logs: false,
		themes: [
      'business',
      'dark',
      'halloween',
      'night',
      'synthwave',
      'aqua',
      'emerald',
      'lemonade',
      'valentine',
      'winter',
			{
				'aren': {
					"primary": "#00FFFF",
					"secondary": "#FF1010",
					"accent": "#999999",
					"neutral": "#606666",
					"base-100": "#111111",
					"info": "#666666",
					"success": "#AEFFFF",
					"warning": "#FF5555",
					"error": "#FF1111",
				},
				'froogs': {
					"primary": "#22d3ee",
					"secondary": "#e879f9",
					"accent": "#818cf8",
					"neutral": "#312e81",
					"base-100": "#280044",
					"info": "#7e22ce",
					"success": "#c026d3",
					"warning": "#fef08a",
					"error": "#111827",
				},
			},
		],
	}
}

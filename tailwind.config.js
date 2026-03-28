/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Dark mode (default)
        background: '#0F172A',
        card: '#1E293B',
        border: '#334155',
        // Brand
        'brand-orange': '#F97316',
        'brand-charcoal': '#1E293B',
        // Status
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        'not-started': '#9CA3AF',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', '.dark-theme'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#006C45',
          secondary: '#00A86B',
          background: '#F7FAF8',
        },
        status: {
          draft: '#9CA3AF',
          submitted: '#3B82F6',
          received: '#6366F1',
          diagnosis: '#8B5CF6',
          waitingApproval: '#F97316',
          waitingParts: '#F59E0B',
          repairing: '#06B6D4',
          vendorRepair: '#EA580C',
          completed: '#22C55E',
          returned: '#14B8A6',
          closed: '#166534',
          cancelled: '#EF4444',
          rejected: '#991B1B',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 10px 0 rgb(0 0 0 / 0.06)',
        softLg: '0 8px 24px 0 rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // ปิด preflight เพื่อไม่ชนกับ Angular Material base style/reset
  },
};

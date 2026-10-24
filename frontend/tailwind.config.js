/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--khd-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', '.dark-theme'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // สีแบรนด์อ่านจาก CSS variable ใน styles.scss — สลับโหมดมืดอัตโนมัติ ไม่ต้องเติม dark: เอง
        brand: {
          primary: token('primary'),
          soft: token('primary-soft'),
          secondary: token('teal'),
          teal: token('teal'),
          green: token('green'),
          ink: token('ink'),
          background: token('bg'),
        },
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: token('border'),
        ink: token('ink'),
        muted: token('muted'),
        // neutral อมกรมท่าเล็กน้อย (แทน neutral เทาล้วนของ Tailwind) — ใช้อยู่ทั่วทุกหน้าเดิม เปลี่ยนที่นี่ที่เดียว
        neutral: {
          50: '#F5F7FA',
          100: '#EDF1F6',
          200: '#DDE3EC',
          300: '#C3CCD9',
          400: '#8E9BB0',
          500: '#64728A',
          600: '#4B586E',
          700: '#374356',
          800: '#152033',
          900: '#0F1828',
          950: '#0A111E',
        },
        status: {
          draft: '#9CA3AF',
          submitted: '#3B82F6',
          received: '#6366F1',
          diagnosis: '#8B5CF6',
          waitingApproval: '#F97316',
          waitingParts: '#F59E0B',
          repairing: '#06B6D4',
          vendorRepair: '#F97316',
          completed: '#22C55E',
          returned: '#14B8A6',
          closed: '#166534',
          cancelled: '#EF4444',
          rejected: '#991B1B',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(var(--khd-shadow) / 0.05), 0 1px 3px 0 rgb(var(--khd-shadow) / 0.04)',
        softLg: '0 12px 32px -8px rgb(var(--khd-shadow) / 0.18)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // ปิด preflight เพื่อไม่ชนกับ Angular Material base style/reset
  },
};

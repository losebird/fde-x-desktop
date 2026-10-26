/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Notion-like 浅色克制风
        canvas: '#FAFAFA',          // 背景
        surface: '#FFFFFF',          // 卡片
        'surface-2': '#F7F7F5',      // 次级卡片
        ink: {
          DEFAULT: '#1A1A1A',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        },
        line: '#ECECE9',             // 描边
        brand: {
          DEFAULT: '#2F6B3A',        // 主色 沉稳绿
          soft: '#E7F0E9',
        },
        accent: {
          red: '#C8553D',
          amber: '#D4A24C',
          blue: '#3D6FC8',
          purple: '#7C5BC8',
          teal: '#2D9D8F',
        },
        kit: {
          canvas: 'var(--kit-canvas)',
          card: 'var(--kit-card)',
          muted: 'var(--kit-muted)',
          sunken: 'var(--kit-sunken)',
          ink: 'var(--kit-ink)',
          secondary: 'var(--kit-secondary)',
          tertiary: 'var(--kit-tertiary)',
          line: 'var(--kit-line)',
          'line-strong': 'var(--kit-line-strong)',
          brand: 'var(--kit-brand)',
          'brand-ink': 'var(--kit-brand-ink)',
          'brand-soft': 'var(--kit-brand-soft)',
          danger: 'var(--kit-danger)',
          'danger-soft': 'var(--kit-danger-soft)',
          warn: 'var(--kit-warn)',
          'warn-soft': 'var(--kit-warn-soft)',
          info: 'var(--kit-info)',
          'info-soft': 'var(--kit-info-soft)',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        xl: '14px',
        kit: '8px',
        'kit-lg': '12px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(15,15,15,0.04)',
        pop: '0 12px 32px rgba(15,15,15,0.10), 0 2px 6px rgba(15,15,15,0.06)',
        kit: '0 1px 0 rgba(26,26,26,0.04), 0 1px 2px rgba(26,26,26,0.03)',
        'kit-pop': '0 16px 40px rgba(26,26,26,0.12), 0 2px 6px rgba(26,26,26,0.05)',
        'kit-ring': '0 0 0 3px rgba(47,107,58,0.18)',
      },
      fontSize: {
        'kit-meta': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'kit-sm': ['12px', { lineHeight: '16px' }],
        kit: ['13px', { lineHeight: '20px' }],
        'kit-title': ['14px', { lineHeight: '20px', letterSpacing: '-0.011em' }],
        'kit-stat': ['22px', { lineHeight: '26px', letterSpacing: '-0.03em' }],
      },
      spacing: {
        'kit-nav': '220px',
      },
      transitionDuration: {
        'kit-fast': '120ms',
        kit: '160ms',
      },
      transitionTimingFunction: {
        kit: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'kit-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'kit-overlay': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'kit-in': 'kit-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        'kit-overlay': 'kit-overlay 120ms ease-out',
      },
    },
  },
  plugins: [],
}

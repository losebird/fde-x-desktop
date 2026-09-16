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
      },
      boxShadow: {
        card: '0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(15,15,15,0.04)',
        pop: '0 12px 32px rgba(15,15,15,0.10), 0 2px 6px rgba(15,15,15,0.06)',
      },
    },
  },
  plugins: [],
}

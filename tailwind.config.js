/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          invert: 'var(--ink-invert)'
        },
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
          3: 'var(--line-3)'
        },
        surface: {
          DEFAULT: 'var(--bg)',
          panel: 'var(--panel)',
          2: 'var(--panel-2)',
          3: 'var(--panel-3)',
          sunken: 'var(--panel-sunken)'
        },
        brand: {
          DEFAULT: 'var(--blue)',
          deep: 'var(--blue-deep)',
          soft: 'var(--blue-soft)',
          hover: 'var(--blue-hover)',
          cyan: 'var(--cyan)'
        },
        signal: {
          DEFAULT: 'var(--signal)',
          soft: 'var(--signal-soft)'
        },
        ok: {
          DEFAULT: 'var(--ok)',
          soft: 'var(--ok-soft)'
        },
        warn: {
          DEFAULT: 'var(--warn)',
          soft: 'var(--warn-soft)'
        }
      },
      fontFamily: {
        display: ['Chakra Petch', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
        body: ['Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '2px',
        md: '3px'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)'
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.32, 0.72, 0.28, 1)'
      },
      keyframes: {
        'lamp-pulse': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        },
        'fade-slide': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'sheen': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        'lamp-pulse': 'lamp-pulse 2.4s ease-in-out infinite',
        'fade-slide': 'fade-slide 320ms cubic-bezier(0.32,0.72,0.28,1) both',
        sheen: 'sheen 2.6s linear infinite'
      }
    }
  },
  plugins: []
}

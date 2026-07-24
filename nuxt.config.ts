import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2024-03-18',
  // Frontend sources live in app/; Nitro server stays at repo-root server/
  srcDir: 'app',
  serverDir: 'server',
  // Static assets stay at repo-root public/
  dir: {
    public: join(rootDir, 'public')
  },
  devtools: { enabled: false },
  sourcemap: {
    server: false,
    client: false
  },
  modules: [
    '@nuxt/ui'
  ],

  ui: {
    fonts: false
  },
  devServer: {
    port: 3030,
    host: '0.0.0.0'
  },
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
  app: {
    head: {
      title: 'MediaHub',
      meta: [
        { name: 'description', content: 'MediaHub - Media Library Dashboard' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon.svg' }
      ]
    }
  },
  vite: {
    esbuild: {
      target: 'es2020'
    }
  },
  nitro: {
    esbuild: {
      options: {
        target: 'es2020'
      }
    },
    routeRules: {
      '/**': {
        headers: {
          'X-Frame-Options': '',
          'Content-Security-Policy': ''
        }
      },
      '/api/organize/execute': {
        cache: false
      }
    },
    externals: {
      external: [
        'better-sqlite3',
        'node-cron'
      ],
      inline: [
        '@iconify/utils',
        'ms',
        'entities',
        'htmlparser2',
        'dom-serializer',
        'domelementtype',
        'domhandler',
        'domutils',
        'telegram',
        'big-integer',
        'mime',
        '@wechatbot/wechatbot',
        'socks-proxy-agent',
        'socks',
        'agent-base',
        'https-proxy-agent',
        'qrcode',
        'dijkstrajs',
        'abort-controller',
        'event-target-shim'
      ]
    },
    publicAssets: [
      {
        // Cover fonts at repo-root fonts/ (absolute, independent of srcDir)
        dir: join(rootDir, 'fonts'),
        maxAge: 60 * 60 * 24 * 365
      }
    ]
  }
})
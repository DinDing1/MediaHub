export default defineNuxtConfig({
  compatibilityDate: '2024-03-18',
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
  nitro: {
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
        'debug',
        'ms',
        'entities',
        'htmlparser2',
        'dom-serializer',
        'domelementtype',
        'domhandler',
        'domutils',
        'telegram',
        'big-integer',
        'mime'
      ]
    },
    publicAssets: [
      {
        dir: '../fonts',
        maxAge: 60 * 60 * 24 * 365
      }
    ]
  }
})


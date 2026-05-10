import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'nodew-api',
  description: 'Node.js and TypeScript edition of the One API gateway.',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/reference/relay-api' },
      { text: 'Deployment', link: '/deployment/vercel' },
      {
        text: 'Language',
        items: [
          { text: 'English', link: '/' },
          { text: '简体中文', link: '/zh/' },
        ],
      },
      { text: 'Preview', link: 'https://nodew.lezi.chat' },
      { text: 'GitHub', link: 'https://github.com/lezi-fun/nodew-api' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Database', link: '/guide/database' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Relay API', link: '/reference/relay-api' },
            { text: 'Admin API', link: '/reference/admin-api' },
          ],
        },
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Vercel', link: '/deployment/vercel' },
            { text: 'Docs Site', link: '/deployment/docs-site' },
            { text: 'Production Notes', link: '/deployment/production-notes' },
          ],
        },
      ],
      '/zh/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/zh/guide/getting-started' },
            { text: '配置说明', link: '/zh/guide/configuration' },
            { text: '数据库', link: '/zh/guide/database' },
          ],
        },
        {
          text: '参考',
          items: [
            { text: 'Relay API', link: '/zh/reference/relay-api' },
            { text: '管理 API', link: '/zh/reference/admin-api' },
          ],
        },
        {
          text: '部署',
          items: [
            { text: 'Vercel', link: '/zh/deployment/vercel' },
            { text: '文档站', link: '/zh/deployment/docs-site' },
            { text: '生产说明', link: '/zh/deployment/production-notes' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/lezi-fun/nodew-api' },
    ],
    footer: {
      message: 'Apache License 2.0',
      copyright: 'Copyright 2026 lezi-fun Team.',
    },
  },
});

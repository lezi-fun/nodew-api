import { defineConfig } from 'vitepress';

const sharedThemeConfig = {
  logo: '/logo.svg',
  search: {
    provider: 'local' as const,
  },
  socialLinks: [
    { icon: 'github' as const, link: 'https://github.com/lezi-fun/nodew-api' },
  ],
  footer: {
    message: 'Apache License 2.0',
    copyright: 'Copyright 2026 lezi-fun Team.',
  },
};

const enThemeConfig = {
  ...sharedThemeConfig,
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
  },
};

const zhThemeConfig = {
  ...sharedThemeConfig,
  nav: [
    { text: '指南', link: '/zh/guide/getting-started' },
    { text: 'API', link: '/zh/reference/relay-api' },
    { text: '部署', link: '/zh/deployment/vercel' },
    {
      text: '语言',
      items: [
        { text: 'English', link: '/' },
        { text: '简体中文', link: '/zh/' },
      ],
    },
    { text: '预览', link: 'https://nodew.lezi.chat' },
    { text: 'GitHub', link: 'https://github.com/lezi-fun/nodew-api' },
  ],
  sidebar: {
    '/zh/guide/': [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '配置说明', link: '/zh/guide/configuration' },
          { text: '数据库', link: '/zh/guide/database' },
        ],
      },
    ],
    '/zh/reference/': [
      {
        text: '参考',
        items: [
          { text: 'Relay API', link: '/zh/reference/relay-api' },
          { text: '管理 API', link: '/zh/reference/admin-api' },
        ],
      },
    ],
    '/zh/deployment/': [
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
};

export default defineConfig({
  title: 'nodew-api',
  description: 'Node.js and TypeScript edition of the One API gateway.',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'nodew-api',
      description: 'Node.js and TypeScript edition of the One API gateway.',
      themeConfig: enThemeConfig,
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'nodew-api',
      description: 'One API 的 Node.js / TypeScript 版本。',
      link: '/zh/',
      themeConfig: zhThemeConfig,
    },
  },
});

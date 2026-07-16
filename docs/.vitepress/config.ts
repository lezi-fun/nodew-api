import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

import { getPageFileDates } from './file-dates.js';

const docsRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = resolve(docsRoot, '..');

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
    { text: 'Development', link: '/development/architecture' },
    { text: 'Deployment', link: '/deployment/vercel' },
    {
      text: 'Language',
      items: [
        { text: 'English', link: '/' },
        { text: '简体中文', link: '/zh/' },
      ],
    },
    { text: 'Preview', link: 'https://nodew.lezi.chat' },
    { text: 'Docs', link: 'https://docs.lezi.chat' },
    { text: 'GitHub', link: 'https://github.com/lezi-fun/nodew-api' },
  ],
  sidebar: {
    '/guide/': [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Wallet Top-Up', link: '/guide/wallet-topup' },
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
    '/development/': [
      {
        text: 'Development',
        items: [
          { text: 'Architecture Overview', link: '/development/architecture' },
          { text: 'Backend Structure', link: '/development/backend-structure' },
          { text: 'Frontend Structure', link: '/development/frontend-structure' },
          { text: 'Code Map', link: '/development/code-map' },
          { text: 'Testing Guide', link: '/development/testing-guide' },
          { text: 'i18n Guide', link: '/development/i18n-guide' },
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
    { text: '开发', link: '/zh/development/architecture' },
    { text: '部署', link: '/zh/deployment/vercel' },
    {
      text: '语言',
      items: [
        { text: 'English', link: '/' },
        { text: '简体中文', link: '/zh/' },
      ],
    },
    { text: '预览', link: 'https://nodew.lezi.chat' },
    { text: '文档', link: 'https://docs.lezi.chat' },
    { text: 'GitHub', link: 'https://github.com/lezi-fun/nodew-api' },
  ],
  sidebar: {
    '/zh/guide/': [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '配置说明', link: '/zh/guide/configuration' },
          { text: '钱包充值', link: '/zh/guide/wallet-topup' },
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
    '/zh/development/': [
      {
        text: '开发',
        items: [
          { text: '架构总览', link: '/zh/development/architecture' },
          { text: '后端结构', link: '/zh/development/backend-structure' },
          { text: '前端结构', link: '/zh/development/frontend-structure' },
          { text: '代码地图', link: '/zh/development/code-map' },
          { text: '测试指南', link: '/zh/development/testing-guide' },
          { text: 'i18n 指南', link: '/zh/development/i18n-guide' },
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
  title: 'NodEW-api',
  description: 'Node.js and TypeScript edition of the One API gateway.',
  cleanUrls: true,
  lastUpdated: false,
  transformPageData(pageData) {
    pageData.frontmatter.fileDates = getPageFileDates(
      pageData.relativePath,
      docsRoot,
      repositoryRoot,
    );
  },
  head: [
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'NodEW-api',
      description: 'Node.js and TypeScript edition of the One API gateway.',
      themeConfig: enThemeConfig,
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'NodEW-api',
      description: 'One API 的 Node.js / TypeScript 版本。',
      link: '/zh/',
      themeConfig: zhThemeConfig,
    },
  },
});

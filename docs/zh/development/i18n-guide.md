# i18n 开发指南

前端使用 i18next、react-i18next 和 `i18next-browser-languagedetector`。

## 关键文件

- `web/src/i18n/i18n.ts`：资源注册、fallback 和 detector 顺序。
- `web/src/i18n/language.ts`：`zh-CN` / `en` 规范化和用户偏好优先级。
- `web/src/i18n/locales/zh-CN.json`：中文资源。
- `web/src/i18n/locales/en.json`：英文资源。
- `web/src/main.tsx`：服务端用户语言、localStorage、浏览器语言和 `<html lang>` 同步。
- `src/modules/self/routes.ts`：独立的 `User.language` 字段读写。

## 页面接入

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <Button>{t('保存')}</Button>;
```

中英文 JSON 必须拥有完全相同的 key。带变量时使用插值：

```tsx
t('验证时间 {{time}}', { time: formatDateTime(value) })
```

## 不要这样做

- 不要只添加英文 JSON 而漏掉中文。
- 不要在 JSX、Toast、placeholder、aria-label 中保留硬编码中文。
- 不要用整个 `user.settings` 保存语言，语言使用独立 `User.language`，否则可能覆盖订阅 JSON。
- 不要在服务端保存成功前改变登录用户的本地语言。

## 一次性回调页面

`VerifyEmail.tsx` 和 `OAuthCallback.tsx` 会消费一次性 token/code。React StrictMode 会重新挂载 effect，因此通过 `web/src/lib/shared-request.ts` 共享 in-flight Promise。请求失败后缓存会清除，允许用户重试。

## 测试

- `test/i18n.test.ts`：资源键一致、页面接线和英文有效值。
- `test/auth-callback-i18n.test.ts`：邮箱/OAuth 回调页。
- `test/integration/user-language.test.ts`：服务端语言字段不会覆盖 settings。
- `test/shared-request.test.ts`：一次性请求去重和失败重试。

```bash
npm test -- --run test/i18n.test.ts test/auth-callback-i18n.test.ts
npm run build:web
```

新增页面后，把文件加入 `test/i18n.test.ts` 的覆盖列表。

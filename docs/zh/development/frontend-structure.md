# 前端结构

前端位于 `web/`，使用 React、React Router、Vite、Semi UI 和 i18next。

## 入口和全局状态

| 文件 | 说明 |
| --- | --- |
| `web/src/main.tsx` | 挂载 React，组合 User/Status/Theme Provider，同步语言和 Semi UI locale |
| `web/src/App.tsx` | 全部路由、懒加载恢复、PrivateRoute/AdminRoute |
| `web/src/context/User.tsx` | 当前用户、刷新、登出 |
| `web/src/context/Status.tsx` | 公开站点状态和 provider 能力 |
| `web/src/context/Theme.tsx` | 深浅主题 |
| `web/src/lib/api.ts` | Axios client、前端 API 类型和所有请求方法 |

## 布局

- `web/src/components/layout/PageLayout.tsx`：公共页与控制台整体布局。
- `headerbar.tsx`：顶栏、语言切换、用户菜单。
- `SiderBar.tsx`：控制台导航和权限分组。
- `Footer.tsx`：页脚。
- `SetupCheck.tsx`：初始化状态门禁。

## 页面分组

### 公共和认证页

`Home.tsx`、`Login.tsx`、`Register.tsx`、`Reset.tsx`、`ResetConfirm.tsx`、`VerifyEmail.tsx`、`OAuthCallback.tsx`、`Pricing.tsx`、`About.tsx`、`Setup.tsx`。

邮箱验证和 OAuth callback 是一次性请求，使用 `web/src/lib/shared-request.ts` 避免 React StrictMode 重复消费 token/code。

### 用户控制台

- `Dashboard.tsx`：指标和总览。
- `Token.tsx`：API Key。
- `Playground.tsx` / `Chat.tsx`：模型调用。
- `TopUp.tsx` / `Subscription.tsx`：充值与订阅。
- `Personal.tsx`：资料、邮箱、OAuth、2FA、Passkey、签到。
- `Log.tsx`、`Task.tsx`、`Midjourney.tsx`：日志和异步结果。

### 管理控制台

`Channel.tsx`、`User.tsx`、`Redemption.tsx`、`Models.tsx`、`Deployment.tsx`、`Setting.tsx`。

`Setting.tsx` 通过 `web/src/lib/settings-sections.ts` 分成 general/security/oauth/billing 四个业务域；数据加载由 `settings-loader.ts` 隔离单个接口失败。

## 组件目录

- `components/security/`：2FA、Passkey、OAuth、邮箱、安全验证弹窗。
- `components/billing/`：价格和套餐展示。
- `components/models/`：模型覆盖与上游模型选择。
- `components/common/`：表格页、错误边界、加载和路由错误。
- `components/setup/`：初始化向导步骤。

## 完整前端文件索引
| 文件 | 职责 |
| --- | --- |
| `web/src/App.tsx` | 路由表、权限门禁和懒加载失败恢复。 |
| `web/src/components/billing/PricingOverview.tsx` | 价格指标和套餐卡片。 |
| `web/src/components/common/ConsoleTablePage.tsx` | 通用控制台表格、筛选和分页壳。 |
| `web/src/components/common/ErrorBoundary.tsx` | React 页面级错误边界和恢复。 |
| `web/src/components/common/Loading.tsx` | 通用加载状态。 |
| `web/src/components/common/RouteError.tsx` | 路由错误展示。 |
| `web/src/components/layout/Footer.tsx` | 全站页脚。 |
| `web/src/components/layout/PageLayout.tsx` | 公共/控制台布局和移动抽屉。 |
| `web/src/components/layout/SetupCheck.tsx` | 旧布局层初始化门禁。 |
| `web/src/components/layout/SiderBar.tsx` | 控制台分组导航。 |
| `web/src/components/layout/headerbar.tsx` | 顶栏、语言、主题、用户菜单。 |
| `web/src/components/models/MissingModelsTable.tsx` | 未覆盖模型列表。 |
| `web/src/components/models/ModelCoverageTable.tsx` | 模型到渠道覆盖表。 |
| `web/src/components/models/UpstreamModelSelectModal.tsx` | 上游模型发现与多选。 |
| `web/src/components/security/AdminOAuthBindingModal.tsx` | 管理员查看/解除用户 OAuth 绑定。 |
| `web/src/components/security/EmailBindingModal.tsx` | 邮箱更换 token/code 表单。 |
| `web/src/components/security/OAuthBindingCard.tsx` | 用户 OAuth 绑定列表和操作。 |
| `web/src/components/security/PasskeySettingCard.tsx` | Passkey 注册、状态和删除。 |
| `web/src/components/security/SecureVerificationModal.tsx` | 敏感操作二次验证弹窗。 |
| `web/src/components/security/TwoFASettingCard.tsx` | 2FA 设置和备用码。 |
| `web/src/components/security/useSecureVerification.tsx` | 封装 2FA/Passkey 安全验证流程。 |
| `web/src/components/setup/SetupCheck.tsx` | 初始化向导门禁组件。 |
| `web/src/components/setup/SetupWizard.tsx` | 多步骤初始化向导状态机。 |
| `web/src/components/setup/components/StepNavigation.tsx` | 向导上一步/下一步导航。 |
| `web/src/components/setup/components/steps/AdminStep.tsx` | 管理员账号表单。 |
| `web/src/components/setup/components/steps/CompleteStep.tsx` | 初始化摘要和完成页。 |
| `web/src/components/setup/components/steps/DatabaseStep.tsx` | 数据库连接检查步骤。 |
| `web/src/components/setup/components/steps/UsageModeStep.tsx` | 使用模式选择步骤。 |
| `web/src/context/Status.tsx` | 公开状态和启动能力。 |
| `web/src/context/Theme.tsx` | 主题持久化和切换。 |
| `web/src/context/User.tsx` | 当前用户状态、刷新、登出。 |
| `web/src/i18n/i18n.ts` | i18next 资源和 detector 初始化。 |
| `web/src/i18n/language.ts` | 支持语言规范化和偏好优先级。 |
| `web/src/lib/api.ts` | 全部前端 API 类型、Axios client 和请求方法。 |
| `web/src/lib/format.ts` | 日期、额度和延迟格式化。 |
| `web/src/lib/oauth.tsx` | OAuth provider 元数据、图标、启用判断。 |
| `web/src/lib/settings-loader.ts` | 设置资源并行加载和错误隔离。 |
| `web/src/lib/settings-sections.ts` | 设置业务域、URL section 和导航属性。 |
| `web/src/lib/shared-request.ts` | 一次性异步请求的 in-flight 去重和重试清理。 |
| `web/src/main.tsx` | React 挂载、Provider 组合、语言和 Semi UI locale 同步。 |
| `web/src/pages/About.tsx` | 关于页与站点统计。 |
| `web/src/pages/Channel.tsx` | 渠道管理、测试和模型发现。 |
| `web/src/pages/Chat.tsx` | 本地会话管理和聊天请求。 |
| `web/src/pages/Dashboard.tsx` | 控制台总览。 |
| `web/src/pages/Deployment.tsx` | 渠道模型部署视图。 |
| `web/src/pages/Home.tsx` | 公开首页。 |
| `web/src/pages/Log.tsx` | 用量日志和摘要。 |
| `web/src/pages/Login.tsx` | 本地、OAuth、Passkey 和 2FA 登录。 |
| `web/src/pages/Midjourney.tsx` | 绘图任务展示。 |
| `web/src/pages/Models.tsx` | 模型覆盖管理。 |
| `web/src/pages/NotFound.tsx` | 404 页面。 |
| `web/src/pages/OAuthCallback.tsx` | OAuth 一次性回调处理。 |
| `web/src/pages/Personal.tsx` | 用户资料和安全中心。 |
| `web/src/pages/Placeholder.tsx` | 未完成模块占位页。 |
| `web/src/pages/Playground.tsx` | 模型调试操练场。 |
| `web/src/pages/Pricing.tsx` | 公开价格页。 |
| `web/src/pages/Redemption.tsx` | 兑换码管理。 |
| `web/src/pages/Register.tsx` | 注册与注册前邮箱验证。 |
| `web/src/pages/Reset.tsx` | 请求密码重置。 |
| `web/src/pages/ResetConfirm.tsx` | 提交 token 和新密码。 |
| `web/src/pages/Setting.tsx` | 系统设置四业务域。 |
| `web/src/pages/Setup.tsx` | 首个管理员初始化页。 |
| `web/src/pages/Subscription.tsx` | 用户订阅页。 |
| `web/src/pages/Task.tsx` | 异步任务日志。 |
| `web/src/pages/Token.tsx` | API Key 管理。 |
| `web/src/pages/TopUp.tsx` | 充值 provider 和订单。 |
| `web/src/pages/User.tsx` | 管理员用户管理。 |
| `web/src/pages/VerifyEmail.tsx` | 账户、注册和邮箱更换验证。 |

## 添加一个页面

1. 在 `web/src/pages/<PageName>.tsx` 创建组件（`<PageName>` 替换为实际页面名）。
2. 在 `web/src/App.tsx` 注册路由，管理页使用 `AdminRoute`，用户页使用 `PrivateRoute`。
3. 在 `web/src/components/layout/SiderBar.tsx` 添加菜单。
4. 在 `web/src/lib/api.ts` 增加请求和类型。
5. 将所有可见文案接入 `useTranslation()`。
6. 添加页面行为或资源覆盖测试。

## 本地开发和验证

```bash
bun install --cwd web
bun run --cwd web dev
npm run build:web
npm test -- --run test/i18n.test.ts
```

完整验证：

```bash
npm run build
npm run build:web
npm test
```

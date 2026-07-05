# Astro 框架迁移概览

## 迁移状态：✅ 完成

将栈流Streack网站从纯静态HTML成功迁移至 **Astro 5.7.0** 框架。

---

## 构建结果

| 指标 | 数值 |
|------|------|
| 构建页面数 | 15 |
| 构建耗时 | ~724ms |
| 文件变更 | 93 个 |
| 代码新增 | 6,693 行 |
| 代码删除 | 1,149 行 |
| Git 提交 | `71f26ed` (分支 `astro-transfer`) |
| 提交者 | Neonai <neonai+coding@streack.top> |

---

## 项目结构

```
Streack/
├── astro.config.mjs          # Astro 配置（site=streack.top, static 模式）
├── package.json              # 依赖管理（astro ^5.7.0）
├── tsconfig.json             # TypeScript 严格模式
├── .github/workflows/
│   └── build_and_release.yml  # GitHub Actions（Node 22 + astro build）
├── public/                    # 静态资源目录
│   ├── assets/               # 框架 JS/CSS、图片、视频
│   ├── webtool/code/         # 工具页 JS/CSS
│   ├── pmd.js                # 页面配置框架
│   ├── CNAME                 # 自定义域名
│   └── ...
└── src/
    ├── layouts/
    │   ├── BaseLayout.astro       # HTML 骨架 + Sober UI CDN
    │   ├── FrameworkLayout.astro  # 首页风格（dark theme + content slot）
    │   └── ToolLayout.astro       # 工具页风格（s-appbar + s-drawer + sidebar）
    ├── components/
    │   ├── Toolbar.astro          # 服务端渲染工具栏
    │   ├── Footer.astro           # 服务端渲染页脚
    │   └── Sidebar.astro          # 工具页左侧导航
    └── pages/
        ├── index.astro            # 首页
        ├── 404.astro              # 404 错误页
        ├── temple.astro           # 模板页
        ├── about/                 # 关于页面（4页）
        ├── minecraft/             # Minecraft 服务器页面（3页）
        └── webtool/               # 工具页面（5页）
```

---

## 关键技术决策

### 1. Astro slot 属性冲突
HTML `slot="0"` 属性（用于自定义 content 插槽系统）会被 Astro 误解为插槽指令。
**解决方案**：用 `<div style="display: contents">` 包裹层隔离，使 slot 属性作为普通 HTML 属性传递。

### 2. is:inline 指令
所有引用 `public/` 资源或外部 URL 的 `<script>` 标签必须添加 `is:inline` 指令，否则 Astro 尝试打包导致构建失败。

### 3. 服务端渲染替代 fetch 注入
原 `framework.js` 通过 `fetch` 运行时加载 `toolbar.html` / `footer.html`。
**迁移后**：改为 Astro 组件服务端渲染，`framework.js` 中 `DEFAULT_FRAGMENTS` 清空。

### 4. 遥测禁用
沙箱环境无法写入 `~/Library/Preferences/astro`，构建时需设置 `ASTRO_TELEMETRY_DISABLED=1`。
GitHub Actions 中不受此限制。

---

## Git 配置

- **分支**：`astro-transfer`
- **提交者**：Neonai <neonai+coding@streack.top>
- **配置范围**：仅写入 `.git/config`（仓库级），未修改全局配置
- **全局配置**：保持不变（kdxiaoyi [MacMini]）

---

## 后续步骤

1. **推送至 GitHub**：`git push origin astro-transfer`，然后创建 Pull Request 合并至主分支
2. **GitHub Pages 部署**：推送后 GitHub Actions 将自动构建并部署
3. **本地预览**：`ASTRO_TELEMETRY_DISABLED=1 npx astro dev` 启动开发服务器
4. **构建验证**：`ASTRO_TELEMETRY_DISABLED=1 npx astro build` 生成 `dist/` 目录

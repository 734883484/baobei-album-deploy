# 宝贝相册部署包

这是一个可直接部署到 Vercel 的静态前端版本，后端能力由 Supabase 提供。

## 本地结构

- `public/`: 页面与前端脚本
- `public/js/common.js`: Supabase 共享逻辑
- `supabase/schema.sql`: 数据库表、函数、RLS、Storage 策略
- `scripts/build.mjs`: 构建时将环境变量注入到静态文件
- `vercel.json`: Vercel 配置

## 本地构建

```bash
npm run build
```

构建结果输出到 `dist/`。

## 部署前需要准备

1. 在 Supabase 创建项目。
2. 在 SQL Editor 执行 `supabase/schema.sql`。
3. 在 Vercel 配置环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 部署到 Vercel

将本目录推送到 GitHub 仓库后，在 Vercel 中导入该仓库并完成环境变量配置即可。

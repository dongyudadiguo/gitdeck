# GitDeck

> 网页版 Git 控制台 — 在浏览器里打开、克隆并浏览 Git 仓库。

GitDeck 是一个纯前端、零依赖的单文件应用。把 `index.html` 丢到任何静态服务器（Cloudflare Pages / Netlify / GitHub Pages）就能用。

---

## 功能

- **打开本地仓库** — 通过 File System Access API 选择本地目录，读取 `.git`
- **克隆到本地磁盘** — 从 HTTPS URL 下载 packfile，在目标目录生成完整的 `.git` 并检出工作树
- **提交图可视化** — 多分支 lane 布局，颜色区分
- **分支 / 标签 / 远程引用** — 左侧面板切换视图
- **行级差异** — 行号、语法高亮、增删统计、hunk 折叠
- **搜索与键盘导航** — `j` / `k` 或方向键切换提交，`/` 聚焦搜索

---

## 一、部署到 Cloudflare Pages（连接 Git 仓库）

### 1. 推送到 GitHub

```bash
cd gitdeck
git remote add origin git@github.com:YOUR_NAME/gitdeck.git
git push -u origin main
```

### 2. 在 Cloudflare Dashboard 创建 Pages 项目

1. **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. 选择仓库 `YOUR_NAME/gitdeck`
3. 构建配置：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | **None** |
   | Build command | *（留空）* |
   | Build output directory | `/` |
   | Root directory | `/` |
   | Environment variables | *（不需要）* |

4. **Save and Deploy**

30 秒后即可通过 `https://<project>.pages.dev` 访问。

> **为什么不用构建？** 这是纯静态单文件应用，`index.html` 就是最终产物。Cloudflare Pages 直接把仓库根目录作为静态资源。

### 3. 自定义域名（可选）

Pages 项目 → **Custom domains** → 添加域名。Cloudflare 自动签发证书。

---

## 二、部署 CORS 代理 Worker（克隆功能需要）

GitHub 等站点不给浏览器开 CORS，直接 `fetch` 会被拦截。需要一个 Worker 转发。

### 1. 安装 wrangler

```bash
npm i -g wrangler
wrangler login
```

### 2. 部署 Worker

```bash
cd worker
wrangler deploy
```

完成后会得到类似地址：

```
https://git-proxy.<your-subdomain>.workers.dev
```

### 3. 在应用中使用

打开网页 → **克隆到本地** → 把 Worker 地址填入 **CORS 代理 URL** → 开始克隆。

### 4. 建议：限制 Worker 调用来源

默认 Worker 对任何人开放。编辑 `worker/index.js` 顶部的 `ALLOWED_ORIGINS`，填入你的 Pages 域名：

```js
const ALLOWED_ORIGINS = [
  'https://gitdeck.pages.dev',
];
```

---

## 三、本地预览

```bash
npx --yes serve . -l 5173
# 或
python3 -m http.server 5173
```

打开 <http://localhost:5173>。

> **浏览器要求**：`showDirectoryPicker` 只支持 **Chrome / Edge 86+**（桌面版）。Safari / Firefox 目前不支持 File System Access API，只能查看 UI。

---

## 四、工作原理

| 模块 | 说明 |
|---|---|
| `inflateWithConsumed` | 纯 JS 实现的 zlib inflate，解压 `.git/objects` 和 packfile |
| `parsePackAt` | 解析 PACK 文件，处理 OFS_DELTA 递归基对象 |
| `computeSha` | 对每个对象重新计算 SHA-1，建立 pack 索引 |
| `generateIdx` | 按 pack idx v2 格式生成 `.idx` 文件 |
| `cloneToDisk` | 完整流程：获取 refs → 请求 pack → 解析 → 写 `.git` → 检出工作树 |
| `GitRepo` | 读取本地 `.git`：refs / packed-refs / 松散对象 / packfile |
| `myers` | 行级 diff，配合公共前后缀裁剪提升性能 |

---

## 五、已知限制

- 只支持 `https://` 的仓库；SSH 需要自行走代理
- 每次克隆会重新下载全部对象（浅克隆可自行改造 `want` 行）
- 大仓库（> 100MB）在浏览器里可能较慢，建议用真 git
- 只读浏览，不提供 push / fetch / commit

## License

MIT

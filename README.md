# 作品集 · 侠迹

水墨风作品集展示工作台，支持作品分类管理、文件上传、链接分享、搜索筛选等功能。

## 📂 项目位置

- **代码**：`D:\portfolio-workbench\`
- **数据**：`D:\portfolio-workbench-data\`（数据库 + 上传文件）
- **启动脚本**：双击 `start-server.bat`

---

## 🚀 快速启动（让他人能看到你的作品）

### 方式一：本机运行（同一WiFi/局域网）

1. 双击 `D:\portfolio-workbench\start-server.bat`
2. 浏览器访问 `http://localhost:3000`
3. 注册账号 → 登录 → 添加分类 → 上传作品
4. **同一局域网内的其他人**通过你的 IP 访问：
   - 按 `Win+R` → 输入 `cmd` → 输入 `ipconfig`
   - 找到 **IPv4 地址**（如 `192.168.1.100`）
   - 别人访问：`http://192.168.1.100:3000`

> **缺点**：电脑必须一直开着，且只能在同一WiFi下访问。

---

### 方式二：免费部署到云端（推荐）

不需要买服务器，用免费平台一键部署：

#### 推荐平台：Render.com（免费，最稳定）

1. 注册 [Render.com](https://render.com)（用GitHub账号登录）
2. 新建一个 **Web Service**
3. 连接你的 GitHub 仓库（或直接上传代码）
4. 配置：
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: 添加 `JWT_SECRET=任意随机字符串`
5. 点击 Deploy，等待完成
6. 获得一个 `https://xxx.onrender.com` 的链接，分享给任何人都能访问

> **注意**：Render免费版会在一段时间无访问后休眠，首次访问可能需要等30秒唤醒。

---

#### 备选平台：Railway.app（免费）

1. 注册 [Railway.app](https://railway.app)（用GitHub账号）
2. 新建项目 → 从GitHub导入
3. 选择本项目代码
4. 自动检测Node.js，直接部署
5. 获得公网链接

---

#### 备选平台：Vercel（国内访问快）

Vercel 主要支持静态网站，但可以通过 Serverless Functions 跑后端。

由于本项目需要文件上传和SQLite，Vercel不太适合。推荐用 Render 或 Railway。

---

### 方式三：内网穿透（电脑当服务器，外网也能访问）

不想部署到云端？用内网穿透工具把本机暴露到公网：

#### 推荐：cpolar（免费，最简单）

1. 下载 [cpolar](https://www.cpolar.com/) 安装
2. 注册账号，获取 token
3. 命令行运行：`cpolar http 3000`
4. 获得一个 `https://xxx.cpolar.io` 的公网链接
5. 把这个链接发给任何人都能访问

> **缺点**：免费版域名会变，每次重启都换地址。想固定域名需要付费。

#### 备选：花生壳（国内老牌）

1. 下载 [花生壳](https://hsk.oray.com/)
2. 注册账号，申请免费域名
3. 配置内网映射：内网主机填 `127.0.0.1`，端口 `3000`
4. 获得固定域名，长期有效

---

## 📦 打包为安装包

### 安卓 APK

1. 安装 [Android Studio](https://developer.android.com/studio)
2. 双击 `build-android.bat`
3. 按提示打开 Android Studio
4. 点击 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. APK 文件：`android\app\build\outputs\apk\debug\app-debug.apk`

### 电脑端 EXE

1. 双击 `build-desktop.bat`
2. 等待打包完成
3. 安装包：`dist\作品集侠迹 Setup.exe`

---

## ✨ 功能特性

- **水墨风设计**：宣纸质感背景、动态竹叶飘落动画、竖排诗句装饰
- **足迹路线**：作品按分类节点分布在中心路线两侧，自适应布局
- **作品类型**：支持文档（PDF/DOC等）、视频（MP4）、链接、网页四种类型
- **自定义分类**：登录后可自由添加分类，不限数量
- **搜索筛选**：按关键词搜索作品
- **用户系统**：注册/登录，密码加密存储
- **文件管理**：上传、下载、删除作品文件
- **响应式设计**：支持电脑端和手机端访问

---

## 🔧 技术栈

- 前端：原生 HTML / CSS / JavaScript
- 后端：Node.js + Express + better-sqlite3
- 打包：Capacitor（安卓）/ Electron（电脑端）

---

## 📁 目录结构

```
D:\portfolio-workbench\
├── server.js              # 后端服务入口
├── start-server.bat       # 一键启动脚本
├── build-android.bat      # 安卓打包脚本
├── build-desktop.bat      # 电脑端打包脚本
├── Dockerfile             # Docker 镜像配置
├── docker-compose.yml     # Docker Compose 配置
├── capacitor.config.json  # Capacitor 配置
├── package.json           # 项目配置
├── public\                # 前端静态文件
│   └── index.html         # 主页面
├── android\               # 安卓项目（打包时生成）
└── README.md              # 本文件

D:\portfolio-workbench-data\
├── database.sqlite        # SQLite 数据库
└── uploads\              # 上传的作品文件
```

---

## 🐳 Docker 运行（高级用户）

```bash
cd D:\portfolio-workbench

# 构建镜像
docker build -t portfolio-workbench .

# 运行容器
docker run -d -p 3000:3000 -v D:\portfolio-workbench-data:/data portfolio-workbench

# 或用 docker-compose
docker-compose up -d
```

---

## ❓ 常见问题

**Q：我上传的作品别人看不到？**
> A：必须运行服务端（双击 `start-server.bat`）或使用上述云端部署方案。直接打开 HTML 文件只能自己看到。

**Q：没有服务器怎么办？**
> A：三种方案任选：
> 1. 本机运行 + 同一WiFi访问（最简单，免费）
> 2. 免费部署到 Render/Railway（推荐，长期有效）
> 3. 内网穿透 cpolar/花生壳（免费，但可能不稳定）

**Q：数据会丢失吗？**
> A：数据库存放在 `D:\portfolio-workbench-data\`，只要这个文件夹在，数据就不会丢失。云端部署时数据在平台服务器上。

**Q：如何备份数据？**
> A：复制 `D:\portfolio-workbench-data\` 文件夹到其他位置即可。云端部署时从平台后台导出。

**Q：免费平台有限制吗？**
> A：Render免费版每月有免费额度，长时间不用会休眠。Railway也有类似限制。对于个人作品集展示完全够用。

Deployed to Vercel

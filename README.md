# 小鹿的澳门入学记

一个移动优先、可独立运行/安装到桌面的 PWA 原型，用来规划一家三口送女儿到澳门读研的六日行程。

## 已包含

- 一家三口的动漫风角色与昵称：熊爸、兔妈、小鹿
- 2026.08.19—08.24 六日行程：航班、体检、宿舍入住、新生入学、返程
- 每日旅游路线：氹仔、路环、澳门半岛世遗线、渔人码头、科学馆、旅游塔、金光大道等
- 每段交通方式、预约/门票提示、餐饮安排；入住期间早餐均安排在酒店
- 行程期间天气预报（Open-Meteo）与中文语音播报
- 重要时间节点的浏览器提醒与 `.ics` 日历导入
- 响应式界面：手机端底部导航为主，桌面端同样可用

## 如何运行

由于浏览器出于安全原因会限制直接双击 `index.html` 时的 Service Worker 和部分网络请求，建议用本地静态服务器打开：

```powershell
cd C:\Users\qzq\AppData\Local\Codex\macau-family-trip
python -m http.server 8080
```

然后打开：<http://localhost:8080>

也可以在项目目录双击 `run.ps1`，脚本会启动服务器并尝试打开浏览器。

## 手机端独立运行

### 方式 A：PWA 安装到主屏幕（推荐，改动最少）

1. 把整个 `macau-family-trip` 目录部署到支持 HTTPS 的静态托管，任选其一：
   - GitHub Pages
   - Cloudflare Pages
   - Netlify
   - Vercel
2. 用手机 Chrome / Edge 打开部署后的 HTTPS 地址。
3. 等待页面提示“把行程装到手机桌面”，点击“安装”；也可以从浏览器菜单中选择“安装应用”或“添加到主屏幕”。
4. 安装后从主屏幕图标打开，即可全屏独立运行，并具备离线缓存能力。

iPhone 使用 Safari：

1. 打开 HTTPS 地址。
2. 点击 Safari 底部的“分享”按钮。
3. 选择“添加到主屏幕”。
4. 从主屏幕打开，页面会以独立 App 模式显示。

> 说明：PWA 安装通常要求 HTTPS。`http://localhost:8080` 只适合电脑端开发预览；手机直接访问电脑局域网 IP 的 HTTP 地址，浏览器一般不会提供真正的安装/离线能力。

### 方式 B：Capacitor 打包成 Android APK

如果想得到一个真正可安装的 APK 文件，而不是 PWA：

```powershell
cd C:\Users\qzq\AppData\Local\Codex\macau-family-trip
npx cap init "小鹿的澳门入学记" "com.example.macaufamilytrip" --web-dir .
npm install @capacitor/android @capacitor/cli
npx cap add android
npx cap copy android
npx cap open android
```

然后用 Android Studio 构建 APK。iOS 则需要在 macOS 上使用 `npx cap add ios`。

## 移动端体验优化

- 已使用 `viewport-fit=cover`、底部安全区适配和固定底部导航。
- 已提供 192/512 PNG 图标，满足 Android/Chrome PWA 安装要求。
- 已提供 180px Apple Touch Icon，满足 iOS 主屏幕图标。
- 已加入 `beforeinstallprompt` 安装引导、iOS“添加到主屏幕”提示和桌面快捷入口。
- 页面通过 `#home`、`#itinerary`、`#weather`、`#family`、`#reminders` 支持深链，桌面快捷方式可直接打开对应页面。

## 关于提醒

- “浏览器提醒”只在页面保持打开时最可靠。
- 更推荐点击“生成并下载日历提醒”，把 `.ics` 文件导入 iPhone/Android/Outlook，由系统日历负责提前提醒。
- 航班、体检、宿舍入住、入学、返程等节点均已写入日历，默认提前 30—120 分钟提醒。

## 天气说明

- 页面优先请求 Open-Meteo 公共 API，无需 Key。
- 请求失败时会自动降级为示例天气，并提示；出发前请以澳门地球物理气象局和航空公司最新通知为准。

## 图像素材

- 当前角色形象使用自包含 SVG/CSS 绘制，便于离线运行。
- 若你希望替换为更精致的生成式动漫位图，可以把 `assets/papa.svg`、`mama.svg`、`daughter.svg` 换成同尺寸 PNG，并同步 `data.js` 与 `sw.js` 中的引用。

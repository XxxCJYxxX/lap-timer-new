# LapTimer · 赛道计时段

**MimoCode 重构版本。** 完整的赛道计时管理解决方案——创建路线 → 一键启动计时 → 自动分段 → 自动停表。默认开启自动启停模式，全程无需手动干预。从零生成全部组件、状态管理和工具层，严格遵循 Apple HIG 设计规范。

## 项目简介

LapTimer 是一款基于浏览器的 GPS 赛段计时工具。在多航点路线上自动记录单圈成绩，支持分段计时、实时天气采集和 F1 风格起跑灯序。纯前端运行，数据存储在浏览器 IndexedDB 中，无需安装或注册。

LapTimer is a browser-based GPS lap timing tool. It records lap times on multi-waypoint routes with automatic split detection, real-time weather capture, and F1-style start lights. Fully client-side — all data stored in IndexedDB, no installation or account required.

## 功能特性

**路线管理**
- 多航点路线：在地图上自由点击添加中间航点，末点设为终点
- 路线反跑：一键生成反向路线（waypoints 倒序另存）
- 路线导入/导出：JSON 文件格式（`*.laproute.json`）
- 种子码分享：Google Polyline 编码，5 航点约 60 字符，可复制粘贴传播

**计时与记录**
- `performance.now()` 毫秒级精度计时
- GPS 自动分段：接近中间航点时自动记录 split time（阈值 15m）
- 手动分段按钮：与自动分段可混用
- 三色成绩判定：首圈紫色 (PB) / 比上次快绿色 / 比上次慢黄色

**F1 启停序列**
- 五灯逐盏亮起（600ms/盏），全亮后随机延迟（0.5–2s），灯灭即起跑
- GPS 自动启停：默认开启。三段状态机（靠近起点 → 离开发车区 > 50m → 接近终点 < 20m 自动停表），防抖动。可在计时面板手动关闭切换为手动模式
- Screen Wake Lock：计时期间屏幕常亮（iOS 16.4+ / Chrome 84+）

**地图与定位**
- Leaflet 地图，高德矢量路网默认底图
- 四套图层切换：OpenStreetMap / 高德地图 / 高德卫星+路网 / 高德卫星图
- GCJ-02 ↔ WGS-84 坐标转换（`gcoord`）
- GPS 实时追踪：蓝色脉冲标记 + 精度圈 + 时速表盘
- Retina/HiDPI 瓦片自适应（高德 `scale=2`，2x/3x 屏幕清晰渲染）
- Nominatim 地名搜索 + 地图飞行

**天气**
- 启表时自动采集起跑点天气（Open-Meteo API，无需密钥）
- 记录温度、湿度、风速、天气类型

**设计**
- Apple HIG 设计语言：SF 字体栈、玻璃面板、暗色模式系统色彩
- 响应式布局：iPhone SE (375px) / iPhone Pro Max / iPad / Mac 桌面四级断点
- Safe area 全向适配（notch / Dynamic Island / home indicator）
- 44pt 最小触控区域，`touch-action` 手势分区
- Apple Maps 风格右上玻璃控件栈（定位 + 图层切换）
- 等宽字体计时器（SF Mono），`prefers-reduced-motion` 尊重

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | React 18, TypeScript 5 (strict) |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| 地图 | Leaflet 1.9, react-leaflet 4 |
| 状态 | Zustand 5 |
| 存储 | Dexie.js 4 (IndexedDB) |
| 坐标 | gcoord 1 |
| 编码 | Google Polyline (自写，无 npm 依赖) |
| 天气 | Open-Meteo (免费，无需 API Key) |
| 搜索 | Nominatim (OSM) |

## 快速开始

```bash
cd lap-timer-new
npm install
npm run dev     # 开发服务器 → http://localhost:5173
npm run build   # 生产构建 → dist/
```

## 里程碑

- **v1.0** — 当前版本：多航点路线、自动分段、起跑灯序、GPS 自动启停、天气记录、路线分享、防熄屏
- **v1.1** — 计划：S3 视角 POV 录像叠加
- **v1.2** — 计划：蓝牙 OBD-II 实时转速/油门/SRS 数据接入

## 许可

MIT

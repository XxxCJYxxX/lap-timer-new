# 更新日志

## [1.0.0-alpha] — 2026-07-18

MimoCode 初始生成版本。从原版 `lap-timer` 参考代码中完整重建。

### Added
- 多航点路线创建与管理（自由加点 → 设终点 → 命名保存）
- `performance.now()` 毫秒级计时器，rAF 驱动显示
- F1 五灯起跑序列（600ms/盏逐亮 → 随机延迟 → 全灭起跑）
- GPS 三段自动启停（waiting_start / leaving_start / heading_to_finish）
- 三色成绩判定（紫 PB / 绿 进步 / 黄 退步）
- 手动分段计时按钮
- GPS 自动分段：接近中间航点 15m 内自动 split
- Screen Wake Lock：计时期间屏幕常亮
- Open-Meteo 实时天气采集（温度、湿度、风速、天气类型）
- 路线反跑（waypoints 倒序另存）
- Google Polyline 种子码编码/解码（自写，零 npm 依赖）
- `.laproute.json` 文件导入/导出
- 种子码输入框 + 一键导入按钮（路线列表页）
- 地图标记/折线点击弹出操作菜单（复制种子/反跑/导出）
- 记录删除（hover 显示 × 按钮）
- 记录展示含天气标签

### Design
- Apple HIG 完整适配：SF 字体栈、玻璃面板、暗色模式、动态字体
- Safe area 全向适配（viewport-fit=cover + safe-area-inset）
- 响应式四级断点：375 / 430 / 768 / 1024
- 44pt 最小触控区域
- Apple Maps 风格右上玻璃控件栈（定位 + 图层切换）
- 等宽字体计时器（SF Mono / tabular-nums）
- `prefers-reduced-motion` 动画降级

### Performance
- Retina/HiDPI 瓦片自适应（高德 `scale=2`，OSM `detectRetina`）
- GPS 移动 < 5m 跳过标记重绘（节流省电）
- CSS containment + `transform: translateZ(0)` 合成层
- `touch-action: manipulation/none` 分区禁用默认手势

### Fixed
- `vite.config.ts` 的 `base` 路径误设为 `/lap-timer/`，修正为 `/lap-timer-new/`，修复部署白屏

### Technical
- TypeScript strict 模式全开（`noUnusedLocals` 零警告 build）
- Zustand 5 stores: timer / route / record / location
- Dexie.js IndexedDB v3 schema（routes.waypoints 数组 + records.splits + records.weather）
- gcoord WGS-84 ↔ GCJ-02 坐标双端转换
- Nominatim 地理编码搜索（AbortController 防抖）
- GitHub Pages 静态部署（gh-pages 分支）

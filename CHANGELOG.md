# 更新日志

## [1.0.0-beta] — 2026-07-26

### Added
- 实时 Delta 显示：计时中对比 PB 累计分段，红绿实时显示快慢
- 赛段级 PB 对比：每个分段显示与 PB 对应赛段的差值
- 赛后统计面板：总圈数、最快圈、平均圈速、稳定性（标准差）
- 天气数据写入每条成绩记录详情行
- 目的地搜索 + OSRM 驾车路线规划（免费，无需 API Key）
- 导航路线信息卡：距离、预计用时、立刻开始（自动创建赛道路线）
- `navStore` 导航状态管理 + `routing.ts` OSRM 路由客户端

### Changed
- 速度表盘从 SVG 大圆盘替换为紧凑内联格式，释放空间给分段列表
- 计时面板拆分为固定头 + 可滚动体，分段再多面板不撑高
- `autoMode` 默认值从 `false` 改为 `true`（默认自动启停）
- 毫秒显示从浮点精度泄漏修复为整数取整

### Fixed
- 计时毫秒位浮点数泄漏导致长串显示和宽度抖动
- Canvas 渲染器 + 200ms panTo 节流提升 GPS 跟随性能

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

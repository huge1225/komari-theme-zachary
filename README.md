# Komari Theme Zachary (`komari-theme-zachary`)

<div align="center">

**由 Zachary 开发维护的 Komari Monitor 哪吒监控（Nezha Dash V1）增强主题**

将 [nezha-dash-v1](https://github.com/hamster1963/nezha-dash-v1) 的经典视觉设计与 [Komari Monitor](https://github.com/komari-monitor/komari) 的 JSON-RPC 2.0 / REST 接口深度融合，并独家新增 **多币种实时汇率 VPS 剩余总价值计算器**、**节点框内周期流量进度条** 及 **详情子页全维度账单与硬件监控面板**。

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Author](https://img.shields.io/badge/Author-Zachary-amber.svg)](https://github.com/huge1225/komari-theme-zachary)
[![Komari](https://img.shields.io/badge/Komari-Theme-emerald.svg)](https://github.com/komari-monitor/komari)

![Komari Theme Zachary Preview](./preview.webp)

</div>

---

## ✨ 核心特性

### 1. 独家增强：多币种实时汇率 & VPS 剩余价值引擎
- **顶部第 5 张总览卡片「剩余总价值」**：
  - 自动读取 Komari 节点配置的续费价格（`price`）、币种（`currency`）、计费周期（`billing_cycle`）、到期时间（`expired_at`）与自动续费状态（`auto_renewal`）。
  - **实时汇率折算**：自动从公共汇率 API 获取当前时间的最新汇率（内置 18+ 种常见货币支持：`CNY/￥`、`USD/$`、`HKD/HK$`、`EUR/€`、`GBP/£`、`JPY/JP¥`、`TWD/NT$`、`CAD`、`AUD`、`SGD`、`KRW`、`RUB` 等，支持本地缓存与离线兜底汇率）。
  - **一键切换折算币种**：支持在前台随时切换 `CNY` / `USD` / `HKD` / `EUR` 查看总剩余价值、月均总持有成本与年付总支出。
  - **交互式「VPS 资产与剩余价值实时排行榜」**：点击「剩余总价值」卡片即可展开全部 VPS 的剩余价值排行明细，点击任意节点卡片直接跳转至详情页。
- **首页服务器卡片内余值速览**：
  - 在每个服务器卡片的 `剩余: XX 天` 旁直接展示实时折算后的 `· 余值 ¥XX.X`。

### 2. 独家增强：服务器卡片底部周期流量用量条 (`TrafficUsageBar`)
- 当服务器在 Komari 后台配置了周期流量限额（`traffic_limit > 0`）或在公开备注中配置了 `trafficVol`（如 `"1TB"`、`"500GB"`）时，自动在每个服务器卡片（双列网格视图 `ServerCard` 与单行紧凑视图 `ServerCardInline`）框内底部渲染**周期流量用量条**。
- **支持全部 5 种 Komari 流量计费规则**：
  - `sum`（双向求和：`上传 + 下载`）
  - `max`（单向取大：`max(上传, 下载)`）
  - `min`（取较小值：`min(上传, 下载)`）
  - `up`（仅计上行：`上传`）
  - `down`（仅计下行：`下载`）
- **三色动态告警状态**：`< 70%` 翠绿、`70% ~ 90%` 琥珀黄、`>= 90%` 告警红。

### 3. 独家增强：节点详情子页面 (`/server/:id`) 全量信息展示
点进任意一台 VPS 的子页面，顶部展示专属的 **「当前 VPS 剩余价值与账单详情」** 卡片与完整硬件状态：
- **单机账单与剩余价值面板**：
  - 当前折算剩余价值 + 原币种剩余价值双显；
  - 实时汇率参考（如 `1 USD ≈ 7.2450 CNY`）与一键币种切换；
  - 套餐续费价格、计费周期天数、折算月均成本与日均成本；
  - 到期日期、剩余天数与百分比、剩余周期进度条、自动续费/手动续费状态徽章；
  - 周期流量计费模式、已用流量 / 总配额及大号进度条。
- **补全 Komari 扩展硬件与系统指标**：
  - **虚拟化架构徽章**（`virtualization`，如 `KVM`、`LXC`）；
  - **所属分组徽章**（`group`）；
  - **内存与 Swap 虚拟内存**（实时显示 `已用 / 总量`）；
  - **磁盘存储**（实时显示 `已用 / 总量`）；
  - **实时连接与进程数**（`TCP 连接数`、`UDP 连接数`、`活跃进程数`）；
  - **公开备注与自定义线路标签**。

### 4. 1:1 还原哪吒 V1 经典体验
- 顶部实时时钟、在线节点数徽章、亮/暗色主题切换、多语言切换（简/繁/英/俄）、`Ctrl+K` 快捷命令面板与背景壁纸一键显隐。
- 双视图切换（双列网格卡片 / 单行紧凑列表）、分组标签滑块、状态筛选与多维度排序（CPU / 内存 / 磁盘 / 上传 / 下载 / 权重）。
- 交互式 `d3-geo` 全球节点分布地图（`GlobalMap`）与 30 天服务可用性状态栏（`ServiceTracker`）。
- 节点详情页三栏切换（`Detail` 实时与历史负载图表、`Network` 多目标 Ping 延迟曲线与 EWMA 削峰平滑、`Online` 在线率与时间轴统计）。
- 完整支持 Komari 后台 **可视化受管配置（Managed Theme Configuration）**，无需手写代码即可在后台配置 16 项外观参数。

---

## 🚀 安装与一键更新方法（Komari 后台）

### 方法一：在 Komari 后台通过 GitHub 链接直接导入 & 一键在线更新（推荐）
1. 登录您的 Komari 管理后台（`/admin`） -> **主题管理（Theme）**。
2. 选择 **从链接导入主题（Import Theme）**，直接输入本仓库地址：
   ```text
   https://github.com/huge1225/komari-theme-zachary
   ```
3. Komari 会自动拉取本仓库最新 Release 的主题包并完成安装。
4. **后续一键更新**：当本仓库发布新版本后，您只需在 Komari 后台的主题卡片上点击 **「更新」** 按钮，Komari 即可自动从 GitHub Releases 拉取最新版本完成升级！

### 方法二：手动下载 `.zip` 上传安装
1. 前往本仓库右侧的 **[Releases](https://github.com/huge1225/komari-theme-zachary/releases)** 页面，下载最新的 `komari-theme-nezha.zip`。
2. 在 Komari 管理后台 -> **主题管理** 中点击上传 `.zip` 文件并启用主题。

---

## ⚙️ 后台可视化配置项说明 (`komari-theme.json`)

在 Komari 后台启用本主题后，点击 **主题设置** 即可直接配置以下参数：

| 配置键名 | 名称 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `customLogo` | 自定义 Logo URL | `string` | `""` | 左上角品牌图标与浏览器 Favicon 地址 |
| `customDesc` | 自定义站点副标题 | `string` | `""` | 顶栏站点名称右侧显示的副标题描述 |
| `customLinks` | 自定义导航链接 | `string` | `""` | JSON 数组，例如：`[{"link":"https://github.com","name":"GitHub"}]` |
| `forceTheme` | 强制明暗主题 | `select` | `"system"` | 可选 `"system"`（跟随系统/用户切换）、`"light"`、`"dark"` |
| `backgroundImage` | 桌面端背景图 URL | `string` | `""` | 开启后卡片自动切换为毛玻璃半透明效果 |
| `mobileBackgroundImage` | 移动端背景图 URL | `string` | `""` | 手机端专用背景图片地址 |
| `disableAnimatedMan` | 隐藏右上角挂件插画 | `switch` | `true` | 默认隐藏概览卡片右上角的插画挂件 |
| `customIllustration` | 自定义右上角插画 URL | `string` | `""` | 可选：配置右上角自定义插画图片地址 |
| `showNetTransfer` | 卡片显示总流量徽章 | `switch` | `true` | 在网格卡片中显示上传/下载总流量胶囊徽章 |
| `fixedTopServerName` | 固定服务器名称在卡片顶部 | `switch` | `false` | 网格视图下将服务器名称与操作系统图标固定在顶部显示 |
| `forceCardInline` | 默认启用单行紧凑列表视图 | `switch` | `false` | 桌面端默认以单行宽表卡片（Inline）模式展示所有服务器 |
| `forceShowMap` | 默认展开全球节点分布地图 | `switch` | `false` | 进入首页时默认展开 D3 全球节点分布交互地图 |
| `forceShowServices` | 默认展开流量周期与服务状态面板 | `switch` | `false` | 进入首页时默认展开 30 天服务可用率与周期流量卡片 |
| `forceUseSvgFlag` | 强制使用 SVG 国旗图标 | `switch` | `true` | 统一使用高清 SVG 国旗图标，避免 Windows 浏览器显示字母 |
| `forcePeakCutEnabled` | 网络延迟图默认开启削峰平滑 | `switch` | `false` | 详情页网络延迟折线图默认开启 EWMA 异常值削峰平滑 |
| `customFooterHtml` | 自定义页脚附加 HTML | `richtext` | `""` | 页脚额外展示的备案号或统计信息（支持 HTML） |

---

## 🛠️ 本地二次开发与构建

### 环境要求
- **Node.js** >= 20
- **pnpm** >= 9

### 常用命令

```bash
# 1. 克隆仓库
git clone https://github.com/huge1225/komari-theme-zachary.git
cd komari-theme-zachary

# 2. 安装依赖
pnpm install

# 3. 启动本地开发服务器（未连接 Komari 后端或携带 ?mock=1 时自动启用仿真演示节点）
pnpm run dev

# 4. 一键编译并打包 Komari 主题安装包 (komari-theme-nezha.zip)
./build-theme.sh
```

> **自动化发布（GitHub Actions）**：仓库内置 [`.github/workflows/release.yml`](./.github/workflows/release.yml)，每次向 `main` 分支推送代码或推送 `v*` 标签时，GitHub Actions 会自动编译前端并发布最新 GitHub Release，供 Komari 后台一键在线更新。

---

## 🗂️ 项目目录结构

```text
komari-theme-zachary/
├── .github/workflows/
│   └── release.yml                # GitHub Actions 自动构建与 Release 发布工作流
├── public/                        # 静态资源（图标、PWA 清单、操作系统 SVG 图标）
├── src/
│   ├── components/                # UI 组件（Header, ServerOverview, TrafficUsageBar, ServerDetailOverview 等）
│   ├── context/                   # 状态上下文（RPC2/WebSocket 实时状态、排序、筛选、命令面板）
│   ├── features/                  # 业务模块（详情图表、运行时配置、节点筛选器）
│   ├── hooks/                     # React Hooks（指标历史查询、登录态、媒体查询等）
│   ├── lib/
│   │   ├── komari-adapter.ts      # 核心适配层：Komari RPC2/REST <-> Nezha 数据模型双向桥接
│   │   ├── billing-value.ts       # 核心引擎：多币种实时汇率拉取、单机与全局 VPS 剩余价值计算
│   │   ├── nezha-api.ts           # 统一数据请求入口
│   │   └── ...
│   ├── locales/                   # 国际化语言包（zh-CN, zh-TW, en, ru）
│   ├── pages/                     # 路由页面（Server 首页、ServerDetail 详情页、ErrorPage）
│   └── types/                     # TypeScript 类型定义
├── index.html                     # 包含 Komari 注入占位符与首屏骨架屏的 HTML 模板
├── komari-theme.json              # Komari 主题清单与后台受管配置声明
├── preview.webp                   # 主题高清预览封面图
├── build-theme.sh                 # 一键编译并打包 Komari 主题 zip 脚本
├── LICENSE                        # Apache License 2.0 开源许可证
├── NOTICE                         # Apache-2.0 合规归属与修改声明
└── DEVELOPMENT_PLAN.md            # 架构设计与接口映射技术文档
```

---

## 📜 开源协议、合规性与版权声明 (License & Attribution)

本主题由 **Zachary** 开发与维护，遵循 **[Apache License 2.0](./LICENSE)** 协议开源发布。

### 上游项目开源协议合规说明

1. **哪吒监控官方主仓库 ([nezhahq/nezha](https://github.com/nezhahq/nezha))**：
   - 采用 **[WTFPL](http://www.wtfpl.net/) (Do What The F\*ck You Want To Public License)** 协议，无任何使用、修改或再分发限制。
2. **哪吒 V1 前端主题仓库 ([hamster1963/nezha-dash-v1](https://github.com/hamster1963/nezha-dash-v1))**：
   - 采用 **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)** 协议，允许自由修改、衍生开发（Derivative Works）、分发及署名。
   - 根据 Apache-2.0 第 4 条（Redistribution）合规要求，本项目已完整包含 [`LICENSE`](./LICENSE) 与 [`NOTICE`](./NOTICE) 文件，保留了上游版权声明，并在 [`NOTICE`](./NOTICE) 与页脚明确标注了由 **Zachary** 完成的 Komari 适配与功能扩展（JSON-RPC 2.0 适配层、节点周期流量进度条、多币种实时汇率与 VPS 剩余价值计算引擎等）。
3. **Komari 探针主仓库 ([komari-monitor/komari](https://github.com/komari-monitor/komari))**：
   - 采用 **[MIT License](https://opensource.org/licenses/MIT)** 协议，支持并鼓励社区开发第三方自定义主题。

- **Theme Author & Maintainer**: **Zachary** ([@huge1225](https://github.com/huge1225))
- **Upstream UI Design**: [hamster1963/nezha-dash-v1](https://github.com/hamster1963/nezha-dash-v1) (Apache-2.0 License)
- **Target Monitor Platform**: [komari-monitor/komari](https://github.com/komari-monitor/komari) (MIT License)

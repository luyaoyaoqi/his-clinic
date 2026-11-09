# his-demo

HIS 端调用**辅助诊疗系统**（平台侧 `mhi_back_cis`）接口的调试 Demo。

**纯前端应用**（Vite + Vue 3 + Element Plus + axios），无后端服务、无数据库：浏览器直接向平台发起 POST 请求，用于接口联调、字段验证与演示。

当前覆盖两个 inbound 接口：

| 接口编码 | 接口名称 | 请求路径 |
| --- | --- | --- |
| `his_outpatient_visit` | HIS 发起门诊 / 住院 | `POST /hosp/api/system/external-api/inbound/<hospital_code>/his_outpatient_visit/` |
| `medical_record_query` | HIS 主动查询病历 | `POST /hosp/api/system/external-api/inbound/<hospital_code>/medical_record_query/` |

> 完整接口规范（字段定义、错误码、映射表）见仓库根目录的 `辅助诊疗系统_接口对接文档.md`。

---

## 快速开始

```bash
cd his-demo
npm install
npm run dev
```

浏览器打开终端输出的地址（默认 <http://localhost:5173/>）。

### 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（HMR） |
| `npm run build` | 生产构建，产物输出到 `his-demo/dist/` |
| `npm run preview` | 本地预览构建产物 |

### 部署

- **GitHub Pages**：`.github/workflows/deploy.yml` 在 `main` 分支推送后自动构建并发布。
  Vite 的 `base` 已设为 `/his-clinic/`，对应页面 `luyaoyaoqi.github.io/his-clinic/`。
- **本地静态托管**：`npm run build` 后把 `dist/` 交给任意静态服务器即可（注意 `base` 需要相应调整）。

---

## 使用步骤

1. **对接配置**（页面左侧「对接配置」）
   填写平台 Base URL、医院编码、App ID、App Secret。
   Base URL 不含 `/hosp` 前缀，调用时由 `src/api/platform.js` 自动拼接。
2. **HIS 发起**（页面左侧「HIS 发起」）
   - 卡片内含「门诊 / 住院」两个 Tab，分别对应 `source_type = 1` / `2`；
   - 填入 7 项业务必填（病历编号、机构编码、科室编码、医生编码、患者 ID / 姓名 / 年龄），点「提交发起门诊 / 住院」；
   - 成功后自动拼出病历页面 URL（`data.code` 填入模板 `{code}`），可复制或直接打开。
3. **主动查询病历**
   与上方共用同一个 `his_record_id`（两边实时同步），只需填编号即可发起 `medical_record_query`。

所有输入与最近一次响应都会实时缓存到浏览器 `localStorage`，刷新页面不丢失。

---

## 目录结构

```
his-demo/
├── package.json
├── vite.config.mjs          # Vite 配置（base=/his-clinic/，端口 5173）
├── index.html               # 入口 HTML
├── public/favicon.svg
└── src/
    ├── main.js              # Vue 应用挂载 + Element Plus（中文 locale）
    ├── App.vue              # 根布局：侧边栏导航 + provide(config / notify)
    ├── api/
    │   └── platform.js      # axios 统一封装：拼 URL、计时、归一化返回
    ├── utils/
    │   ├── defaults.js      # 全局默认配置（BaseURL / 医院编码 / App 凭据 / 门诊 URL 模板）
    │   ├── storage.js       # localStorage 工具（含命名空间隔离）
    │   └── visitDefaults.js # 门诊 / 住院两套表单样例与模式定义
    └── components/
        ├── ConfigPanel.vue  # 对接配置卡片
        ├── VisitForm.vue    # 门诊 / 住院 Tab 容器
        ├── VisitPanel.vue   # 发起门诊（住院）表单、请求构造、响应展示
        └── QueryForm.vue    # 主动查询病历卡片
```

---

## 数据流

```
浏览器 (Vue)  ──POST JSON──▶  平台 /hosp/api/system/external-api/inbound/<hospital_code>/<endpoint>/
```

`src/api/platform.js` 的 `callPlatform({ baseUrl, hospitalCode, endpoint, body })` 是唯一的出口，返回统一结构：

```js
{ httpStatus: number, body: any, error: string | null, elapsed: number }
```

- `httpStatus`：HTTP 状态码；网络层失败时为 `0`；
- `body`：平台原始响应（平台用 `code === 20000` 表示成功，另有 `msg`、`log_id`、`data`）；
- `error`：网络层错误描述（CORS 拦截、超时、连接拒绝等）；
- `elapsed`：本次调用耗时（毫秒，前端新增）。

---

## 本地缓存

| 键 | 内容 |
| --- | --- |
| `his-demo:cfg-baseUrl` / `cfg-hospitalCode` / `cfg-appId` / `cfg-appSecret` | 对接配置 |
| `his-demo:outpatient.*` / `his-demo:inpatient.*` | 门诊 / 住院两套表单数据、共享的 `hisRecordId`、最近一次响应 |

门诊与住院通过命名空间前缀隔离，互不干扰；旧版本的无前缀数据在首次访问时自动迁移到 `outpatient.` 命名空间。

---

## 注意事项

- **CORS**：浏览器直连平台，平台侧需在该路径返回 `Access-Control-Allow-Origin`，否则请求会被浏览器拦截（表现为 `error` 为网络类错误、`httpStatus` 为 0）。
- **凭据**：App ID / App Secret 由表单传入并存于 `localStorage`（`src/utils/defaults.js` 中带内置默认值）。仅适用于内网 / 本地调试环境，**不要用于公网部署**。
- **平台鉴权**：当前按平台文档以 `app_id` / `app_secret` 放在请求体中，未实现额外的请求头签名。

# his-demo

HIS 端调用辅助诊疗系统（mhi_back_cis）接口的 Demo，覆盖两个 inbound 接口：

| 接口编码 | 接口名称 | 路径 |
| --- | --- | --- |
| `his_outpatient_visit` | HIS 发起门诊 | `POST /api/system/external-api/inbound/<hospital_code>/his_outpatient_visit/` |
| `medical_record_query` | HIS 主动查询病历 | `POST /api/system/external-api/inbound/<hospital_code>/medical_record_query/` |

技术栈：**Vite + Vue 3 + Element Plus + Express + axios**

## 启动

```bash
cd his-demo
npm install
npm run dev          # 同时启 Vite (5173) + Node 后端 (3000)
```

浏览器打开 http://localhost:5173

### 其他命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev:web` | 只启 Vite（前端） |
| `npm run dev:api` | 只启 Node（后端，端口 3000） |
| `npm start` | 只启 Node 后端（不依赖前端） |
| `npm run build` | 生产构建到 `dist/` |

> Vite 默认把 `/demo/*` 和 `/health` 代理到 `http://localhost:3000`，所以前端无需配置 CORS。

## 目录结构

```
his-demo/
├── package.json
├── vite.config.mjs                    # Vite 配置（含后端代理）
├── index.html                         # Vite 入口
├── src/
│   ├── main.js                        # Vue 应用 + Element Plus 注入
│   ├── App.vue                        # 根布局（provide 全局 config）
│   ├── api/
│   │   └── platform.js                # axios 调用封装
│   ├── utils/
│   │   └── storage.js                 # localStorage 工具
│   ├── components/
│   │   ├── ConfigPanel.vue            # 顶部对接配置
│   │   ├── VisitForm.vue              # 发起门诊表单
│   │   └── QueryForm.vue              # 查询病历表单
│   ├── config.js                      # 后端：仅读 PORT
│   ├── server.js                      # 后端：路由 /health 和 /demo/*
│   └── api/
│       ├── platformClient.js          # 后端：axios 工厂
│       ├── hisOutpatientVisit.js      # 后端：发起门诊
│       └── medicalRecordQuery.js      # 后端：查询病历
└── README.md
```

## 后端路由（不变）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| POST | `/demo/his-outpatient-visit` | 透传调用平台 |
| POST | `/demo/medical-record-query` | 透传调用平台 |

请求体格式：

```json
{
  "baseUrl": "http://localhost:9100",
  "hospitalCode": "hospitalA",
  "body": { /* 平台接口的完整 JSON 请求体 */ }
}
```

响应原样返回 `{ httpStatus, body, error }` + `elapsed`（前端新增的耗时字段）。

## 使用步骤

1. 顶部「对接配置」填写：Base URL / Hospital Code / App ID / App Secret
2. ① HIS 发起门诊：填必填项（his_record_id / institution / department / doctor / 患者 ID-姓名-年龄），点提交
3. ② 主动查询病历：只需填 his_record_id
4. 所有输入实时缓存到 localStorage

## 安全注意

- App Secret 在页面以 `type="password"` 遮罩，但仍以明文落到 localStorage，仅适用于开发调试，**不要用此 demo 部署到公网**
- 后端不做凭据校验，凭据由浏览器表单传入，仅用于透传
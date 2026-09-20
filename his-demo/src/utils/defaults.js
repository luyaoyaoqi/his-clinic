// 共享的默认配置（App.vue 初始化 + ConfigPanel "恢复默认" 都从这里读）
// baseUrl 不带 /hosp 前缀，调用 API 时 platform.js 会自动拼上
export const CONFIG_DEFAULTS = {
  baseUrl: 'http://192.168.2.35:11080',
  hospitalCode: 'xwzqzyy',
  appId: 'fc8b26d0b0b3ddbdb2737332d5705486',
  appSecret: 'JC6Ugg4GL0iaf_Fbin7s09TGhSdIrpyRTvSTPLOtTV8',
  // 门诊页面 URL 相对路径（不带 host），{code} 占位会被响应里的 data.code 替换
  // 渲染时自动用 baseUrl 拼接
  clinicUrlTemplate: '/clinic/#/loading?code={code}',
};
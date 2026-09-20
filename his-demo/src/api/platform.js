import axios from 'axios';

/**
 * 前端直连平台的统一调用封装。
 *
 * 浏览器 → 平台（POST {baseUrl}/hosp/api/system/external-api/inbound/<hospital_code>/<endpoint>/）
 * ⚠️ 需要平台 nginx 在该路径返回 CORS 头（Access-Control-Allow-Origin），
 * 否则浏览器会拦截响应，前端拿不到任何数据。
 *
 * @param {object} cfg
 * @param {string} cfg.baseUrl        平台 Base URL（不含 /hosp，会自动拼上）
 * @param {string} cfg.hospitalCode   路径占位（医院编码）
 * @param {string} cfg.endpoint       接口名，如 'his_outpatient_visit' 或 'medical_record_query'
 * @param {object} cfg.body           请求体
 * @returns {Promise<{httpStatus: number, body: any, error: string|null, elapsed: number}>}
 */
export async function callPlatform({ baseUrl, hospitalCode, endpoint, body }) {
  const started = performance.now();
  const url = `${(baseUrl || '').replace(/\/+$/, '')}/hosp/api/system/external-api/inbound/${encodeURIComponent(hospitalCode || '')}/${endpoint}/`;
  try {
    const resp = await axios.post(url, body, {
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
      // 让 axios 在 4xx/5xx 也 resolve，由调用方统一处理
      validateStatus: () => true,
    });
    const elapsed = Math.round(performance.now() - started);
    if (resp.status >= 400) {
      return { httpStatus: resp.status, body: resp.data, error: `http ${resp.status}`, elapsed };
    }
    return { httpStatus: resp.status, body: resp.data, error: null, elapsed };
  } catch (err) {
    const elapsed = Math.round(performance.now() - started);
    // 网络层失败（CORS 拦截、超时、连接拒绝等都走这里）
    return {
      httpStatus: 0,
      body: null,
      error: err.code || err.message || 'network error',
      elapsed,
    };
  }
}
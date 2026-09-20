<script setup>
import { inject, reactive, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { callPlatform } from '../api/platform.js';

const config = inject('config');
const notify = inject('notify');

// 与「发起门诊」面板共享同一个 his_record_id（任一边改动，另一边实时同步）
const sharedHisRecordId = inject('hisRecordId');
const form = reactive({ mqHisRecordId: sharedHisRecordId.value ?? '' });
watch(sharedHisRecordId, (v) => {
  const nv = v ?? '';
  if (form.mqHisRecordId !== nv) form.mqHisRecordId = nv;
});
watch(() => form.mqHisRecordId, (v) => {
  const nv = v ?? '';
  if (sharedHisRecordId.value !== nv) sharedHisRecordId.value = nv;
});

const formRef = ref(null);
const loading = ref(false);
const lastResult = ref(null);
const statusText = ref('未调用');

const rules = {
  mqHisRecordId: [{ required: true, message: 'HIS 病历唯一标识必填', trigger: 'blur' }],
};

async function submit() {
  if (!config.baseUrl || !config.hospitalCode || !config.appId || !config.appSecret) {
    notify.err('请先填写「对接配置」', '顶部 4 个必填项');
    return;
  }
  try {
    await formRef.value.validate();
  } catch {
    notify.err('请补全必填项', '已定位到第一个错误');
    return;
  }
  loading.value = true;
  statusText.value = '请求中…';
  const result = await callPlatform({
    baseUrl: config.baseUrl,
    hospitalCode: config.hospitalCode,
    endpoint: 'medical_record_query',
    body: {
      app_id: config.appId,
      app_secret: config.appSecret,
      his_record_id: (form.mqHisRecordId || '').trim(),
      // outer_institution_code 复用 hospitalCode（多数部署两者相同，ConfigPanel 已说明）
      outer_institution_code: config.hospitalCode,
    },
  });
  lastResult.value = result;
  const ok = result.body?.code === 20000;
  statusText.value = ok ? `成功 · 耗时 ${result.elapsed}ms` : `失败 · HTTP ${result.httpStatus || '—'}`;
  if (ok) notify.ok('调用成功', `HTTP ${result.httpStatus} · ${result.elapsed}ms`);
  else if (result.error) notify.err('网络错误', result.error);
  else notify.err('调用失败', result.body?.msg || `HTTP ${result.httpStatus}`);
  loading.value = false;
}

function restore() {
  form.mqHisRecordId = sharedHisRecordId.value ?? '';
  formRef.value?.clearValidate();
  notify.ok('已恢复默认样例');
}

async function confirmRestore() {
  try {
    await ElMessageBox.confirm(
      '将清空当前查询条件，恢复为他接口的样例数据。确定继续？',
      '恢复默认样例',
      { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  restore();
}

const codeOk = (r) => r?.body?.code === 20000;
</script>

<template>
  <el-card shadow="never" class="panel">
    <template #header>
      <div class="card-head">
        <span class="card-title">
          HIS 主动查询病历（medical_record_query）
        </span>
        <div class="head-right">
          <span class="endpoint">POST /api/system/external-api/inbound/{hospital_code}/medical_record_query/</span>
          <el-button size="small" plain class="restore-btn" @click="confirmRestore">
            <el-icon><Refresh /></el-icon>
            <span>恢复默认</span>
          </el-button>
        </div>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="his_record_id" prop="mqHisRecordId">
            <el-input v-model="form.mqHisRecordId" placeholder="34997589" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-alert type="info" :closable="false" show-icon>
        App ID / App Secret / outer_institution_code 直接复用顶部「对接配置」。
      </el-alert>

      <div class="action-row">
        <el-button type="primary" :loading="loading" @click="submit">提交查询</el-button>
        <span class="status">{{ statusText }}</span>
      </div>
    </el-form>

    <div v-if="lastResult" class="response" :class="{ 'is-fail': !codeOk(lastResult) }">
      <div class="response-head">
        <el-tag :type="codeOk(lastResult) ? 'success' : (lastResult.error ? 'danger' : 'warning')">
          HTTP {{ lastResult.httpStatus || '—' }}
        </el-tag>
        <el-tag v-if="lastResult.body?.code !== undefined" :type="codeOk(lastResult) ? 'success' : 'danger'">
          code {{ lastResult.body.code }}
        </el-tag>
        <el-tag v-if="lastResult.body?.msg" type="info" effect="plain">msg: {{ lastResult.body.msg }}</el-tag>
        <el-tag v-if="lastResult.body?.log_id" type="info" effect="plain">log_id: {{ lastResult.body.log_id }}</el-tag>
        <el-tag type="info" effect="plain">{{ lastResult.elapsed }}ms</el-tag>
        <el-tag v-if="lastResult.error" type="danger">{{ lastResult.error }}</el-tag>
      </div>
      <pre class="response-body">{{ JSON.stringify(lastResult, null, 2) }}</pre>
    </div>
  </el-card>
</template>

<style scoped>
.panel { border-radius: 8px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; }
.num { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 4px; background: #ecf5ff; color: #409eff; font-size: 12px; font-weight: 600; }
.endpoint { font-family: ui-monospace, monospace; font-size: 12px; color: #909399; word-break: break-all; text-align: right; }
.action-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.status { color: #909399; font-size: 12px; margin-left: auto; }
.response { margin-top: 16px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.response.is-fail { border-color: #fde2e2; }
.response-head { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #ebeef5; }
.response.is-fail .response-head { background: #fef0f0; }
.response-body { background: #fff; padding: 16px; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.55; max-height: 360px; overflow: auto; margin: 0; white-space: pre; color: #ef4444; }
.response:not(.is-fail) .response-body { color: inherit; }

@media (max-width: 720px) {
  .card-head { flex-direction: column; align-items: flex-start; }
  .endpoint { text-align: left; }
}
</style>
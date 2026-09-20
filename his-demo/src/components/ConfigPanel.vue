<script setup>
import { inject, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { lsGet, lsSet } from '../utils/storage.js';
import { CONFIG_DEFAULTS } from '../utils/defaults.js';

const config = inject('config');
const notify = inject('notify');

async function restore() {
  try {
    await ElMessageBox.confirm(
      '将清空当前 Base URL / App ID / App Secret / 医院编码，恢复为内置默认值。确定继续？',
      '恢复默认配置',
      { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  config.baseUrl = CONFIG_DEFAULTS.baseUrl;
  config.hospitalCode = CONFIG_DEFAULTS.hospitalCode;
  config.appId = CONFIG_DEFAULTS.appId;
  config.appSecret = CONFIG_DEFAULTS.appSecret;
  notify.ok('已恢复默认配置');
}
</script>

<template>
  <el-card shadow="never" class="panel">
    <template #header>
      <div class="card-head">
        <span class="card-title">对接配置</span>
        <el-button size="small" plain class="restore-btn" @click="restore">
          <el-icon><Refresh /></el-icon>
          <span>恢复默认</span>
        </el-button>
      </div>
    </template>

    <el-form :inline="false" label-position="top">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="平台 Base URL" required>
            <el-input v-model="config.baseUrl" placeholder="http://localhost:9100" clearable />
            <span class="hint">调用接口时自动拼上 <code>/hosp/api/...</code></span>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="医院编码（路径占位 / outer_institution_code）" required>
            <el-input v-model="config.hospitalCode" placeholder="hospitalA" clearable />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="App ID" required>
            <el-input v-model="config.appId" placeholder="医院 AppId" clearable />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="App Secret" required>
            <el-input v-model="config.appSecret" placeholder="医院 AppSecret" clearable />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </el-card>
</template>

<style scoped>
.panel { border-radius: 8px; }
.card-head { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 600; font-size: 15px; }
.hint { font-size: 12px; color: #909399; margin-top: 2px; display: block; }
.hint.warn { color: #e6a23c; }
</style>
<script setup>
import { ref } from 'vue';
import VisitPanel from './VisitPanel.vue';

// 门诊 / 住院两个类型：内部 tab 切换，各自的数据分开缓存
const activeTab = ref('outpatient');
</script>

<template>
  <el-tabs v-model="activeTab" class="visit-tabs">
    <el-tab-pane label="门诊" name="outpatient">
      <VisitPanel mode="outpatient" />
    </el-tab-pane>
    <el-tab-pane label="住院" name="inpatient">
      <VisitPanel mode="inpatient" />
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.visit-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
</style>

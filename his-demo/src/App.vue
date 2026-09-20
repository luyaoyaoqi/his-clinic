<script setup>
import { reactive, provide, watch, ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { Setting, EditPen, Search, Menu } from "@element-plus/icons-vue";
import ConfigPanel from "./components/ConfigPanel.vue";
import VisitForm from "./components/VisitForm.vue";
import QueryForm from "./components/QueryForm.vue";
import { lsGet, lsSet } from "./utils/storage.js";
import { CONFIG_DEFAULTS } from "./utils/defaults.js";
import { VISIT_DEFAULTS } from "./utils/visitDefaults.js";

const config = reactive({
  baseUrl: lsGet("cfg-baseUrl") ?? CONFIG_DEFAULTS.baseUrl,
  hospitalCode: lsGet("cfg-hospitalCode") ?? CONFIG_DEFAULTS.hospitalCode,
  appId: lsGet("cfg-appId") ?? CONFIG_DEFAULTS.appId,
  appSecret: lsGet("cfg-appSecret") ?? CONFIG_DEFAULTS.appSecret,
});

watch(
  () => config.baseUrl,
  (v) => lsSet("cfg-baseUrl", v),
);
watch(
  () => config.hospitalCode,
  (v) => lsSet("cfg-hospitalCode", v),
);
watch(
  () => config.appId,
  (v) => lsSet("cfg-appId", v),
);
watch(
  () => config.appSecret,
  (v) => lsSet("cfg-appSecret", v),
);

// 发起门诊 / 主动查询 共用的 his_record_id（单一来源，任一边输入都会同步到另一边）
const hisRecordId = ref(
  lsGet("hisRecordId") ?? VISIT_DEFAULTS.ovHisRecordId,
);
watch(hisRecordId, (v) => lsSet("hisRecordId", v ?? ""));

provide("config", config);
provide("hisRecordId", hisRecordId);
provide("notify", {
  ok: (title, message) =>
    ElMessage({
      type: "success",
      message: title + (message ? ` · ${message}` : ""),
      grouping: true,
    }),
  err: (title, message) =>
    ElMessage({
      type: "error",
      message: title + (message ? ` · ${message}` : ""),
      grouping: true,
      duration: 5000,
    }),
});

const NAV = [
  { id: "config", label: "对接配置", icon: Setting },
  { id: "visit", label: "发起门诊", icon: EditPen },
  { id: "query", label: "主动查询", icon: Search },
];
const TITLE_MAP = {
  config: "对接配置",
  visit: "HIS 发起门诊",
  query: "HIS 主动查询病历",
};
const active = ref("config");
const topbarTitle = computed(() => TITLE_MAP[active.value] || "");

function selectPanel(id) {
  active.value = id;
  drawerOpen.value = false;
}

const drawerOpen = ref(false);
const isMobile = ref(window.innerWidth < 860);
window.addEventListener("resize", () => {
  isMobile.value = window.innerWidth < 860;
});
</script>

<template>
  <div class="app">
    <!-- 桌面端 Sidebar -->
    <aside v-if="!isMobile" class="sidebar">
      <div class="brand">
        <svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#2563eb"/>
          <path d="M14 8h4v6h6v4h-6v6h-4v-6H8v-4h6V8z" fill="#ffffff"/>
        </svg>
      </div>

      <nav class="nav">
        <button
          v-for="item in NAV"
          :key="item.id"
          class="nav-item"
          :class="{ active: active === item.id }"
          @click="selectPanel(item.id)"
        >
          <span>{{ item.label }}</span>
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
        </button>
      </nav>

      <div class="sidebar-foot">
        <div class="version">v2.0.0</div>
      </div>
    </aside>

    <!-- 移动端 Topbar + Drawer -->
    <header v-if="isMobile" class="mobile-top">
      <button
        class="hamburger"
        @click="drawerOpen = true"
        aria-label="打开菜单"
      >
        <el-icon><Menu /></el-icon>
      </button>
      <div class="mobile-title">{{ topbarTitle }}</div>
      <el-tag type="success" effect="plain" size="small" round>● live</el-tag>
    </header>
    <el-drawer
      v-if="isMobile"
      v-model="drawerOpen"
      direction="ltr"
      :with-header="false"
      size="260px"
    >
      <div class="drawer-inner">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#2563eb"/>
            <path d="M14 8h4v6h6v4h-6v6h-4v-6H8v-4h6V8z" fill="#ffffff"/>
          </svg>
        </div>
        <nav class="nav">
          <button
            v-for="item in NAV"
            :key="item.id"
            class="nav-item"
            :class="{ active: active === item.id }"
            @click="selectPanel(item.id)"
          >
            <span>{{ item.label }}</span>
            <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          </button>
        </nav>
      </div>
    </el-drawer>

    <!-- 主区 -->
    <main class="main">
      <div v-if="!isMobile" class="topbar">
        <div class="topbar-title">{{ topbarTitle }}</div>
        <div class="topbar-spacer"></div>
        <el-tag type="success" effect="plain" size="small" round>● live</el-tag>
      </div>

      <div class="content">
        <div v-show="active === 'config'" class="pane"><ConfigPanel /></div>
        <div v-show="active === 'visit'" class="pane"><VisitForm /></div>
        <div v-show="active === 'query'" class="pane"><QueryForm /></div>

        <footer class="footer">
          <span>辅助诊疗系统对接演示 · 仅供本地调试</span>
          <span class="footer-meta">所有输入自动保存到浏览器本地</span>
        </footer>
      </div>
    </main>
  </div>
</template>

<style>
/* ============ 基础 ============ */
:root {
  --font-display:
    "Source Serif 4", "Source Han Serif SC", "Songti SC", ui-serif, Georgia,
    serif;
}
html,
body,
#app {
  margin: 0;
  padding: 0;
}
body {
  background: #f5f6f8;
  color: #1f2933;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
* {
  box-sizing: border-box;
}

.app {
  display: grid;
  grid-template-columns: 248px 1fr;
  min-height: 100vh;
}

/* ============ Sidebar（内容整体右对齐） ============ */
.sidebar {
  background: #ffffff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

/* 品牌区：仅居中显示 favicon 同款图标 */
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 20px 24px;
  border-bottom: 1px solid #f1f2f4;
}
.brand-mark {
  width: 36px;
  height: 36px;
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
  flex-shrink: 0;
}

/* nav：每项内容贴右 */
.nav {
  display: flex;
  flex-direction: column;
  padding: 12px 12px;
  gap: 2px;
  flex: 1;
  align-items: stretch;
}
.nav-item {
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 文字 + icon 贴左 */
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: #4b5563;
  cursor: pointer;
  text-align: left;
  transition:
    background 140ms ease,
    color 140ms ease;
}
.nav-item:hover {
  background: #f5f7fa;
  color: #1f2933;
}
.nav-item.active {
  background: linear-gradient(
    90deg,
    rgba(64, 158, 255, 0.02),
    rgba(64, 158, 255, 0.1)
  );
  color: #2563eb;
  font-weight: 500;
}
/* 蓝色色条用 ::after 推到 nav-item 最右 */
.nav-item.active::after {
  content: "";
  width: 3px;
  height: 16px;
  background: #409eff;
  border-radius: 2px;
  margin-left: auto; /* 关键：推到最右 */
  flex-shrink: 0;
}
.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* 底栏：贴左 */
.sidebar-foot {
  padding: 16px 20px;
  border-top: 1px solid #f1f2f4;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.foot-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  text-decoration: none;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  transition: color 140ms;
}
.foot-link:hover {
  color: #2563eb;
}
.version {
  font-size: 11px;
  color: #c0c4cc;
  font-family: ui-monospace, monospace;
}

/* ============ Main ============ */
.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(245, 246, 248, 0.85);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid #ebeef5;
  padding: 14px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
}
.topbar-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #1f2933;
}
.topbar-spacer {
  flex: 1;
}

.content {
  flex: 1;
  align-self: center;
  padding: 24px 32px 16px;
  max-width: 1200px;
  width: 100%;
}
.pane {
  animation: paneFade 220ms ease both;
}
@keyframes paneFade {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.footer {
  margin-top: 40px;
  padding: 24px 0 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #909399;
  font-size: 12px;
}
.footer-meta {
  color: #c0c4cc;
  font-family: ui-monospace, monospace;
}

/* ============ 移动端 ============ */
.mobile-top {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid #ebeef5;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
}
.hamburger {
  border: none;
  background: transparent;
  padding: 6px;
  font-size: 20px;
  color: #4b5563;
  cursor: pointer;
}
.mobile-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  color: #1f2933;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ============ 响应式 ============ */
@media (max-width: 860px) {
  .app {
    grid-template-columns: 1fr;
  }
  .content {
    padding: 16px;
  }
  .footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

/* ============ 卡片微调 ============ */
.el-card {
  border-radius: 10px !important;
  border: 1px solid #ebeef5 !important;
}

/* 卡片 header 右上角统一：endpoint 路径 + 「恢复默认」按钮 */
.card-head .head-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.card-head .restore-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* el-alert 带 description 时 icon 自动放大到 28px，这里统一收回 16px
   （用 CSS 变量覆盖，比直接写选择器优先级更稳） */
.el-alert {
  --el-alert-icon-size: 16px;
  --el-alert-icon-large-size: 16px;
}
.el-card.is-always-shadow,
.el-card.is-hover-shadow {
  box-shadow: none !important;
}
.el-card__header {
  padding: 14px 18px !important;
  border-bottom: 1px solid #f1f2f4 !important;
}

/* ============ 表单微调 ============ */
.el-form-item__label {
  font-weight: 500;
}
.el-input__wrapper,
.el-textarea__inner,
.el-select__wrapper {
  border-radius: 6px !important;
}
</style>

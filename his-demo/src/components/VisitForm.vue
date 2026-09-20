<script setup>
import { inject, reactive, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { callPlatform } from '../api/platform.js';
import { lsGet, lsSet } from '../utils/storage.js';
import { VISIT_DEFAULTS } from '../utils/visitDefaults.js';

const config = inject('config');
const notify = inject('notify');

const DEFAULTS = VISIT_DEFAULTS;

function makeInitial() {
  // 先把所有 key 初始化为空串（避免 undefined），再覆盖有默认值的字段
  const obj = {};
  ALL_KEYS.forEach((k) => { obj[k] = lsGet(k) ?? (DEFAULTS[k] ?? ''); });
  return obj;
}

const ALL_KEYS = [
  'ovHisRecordId', 'ovPrevHisRecordId', 'ovInstCode', 'ovDeptCode', 'ovDeptName',
  'ovDoctorCode', 'ovDoctorName',
  'ovPatientId', 'ovPatientName', 'ovPatientGender', 'ovPatientAge',
  'ovPatientMobile', 'ovPatientIdcard', 'ovPatientSscid',
  'ovPatientProvince', 'ovPatientCity', 'ovPatientArea',
  'ovPatientAddress', 'ovPatientContactsName', 'ovPatientContactsMobile',
  'ovAppointmentDate', 'ovHisAppointmentNo', 'ovHisRegisterNo',
  'ovPbMainRemark', 'ovPbInputRemark', 'ovPbObjectiveRemark', 'ovPbAssistCheck',
  'ovPbDiseaseHistory', 'ovPbAllergyHistory', 'ovPbBirthHistory',
  'ovPbPersonalHistory', 'ovPbFamilyHistory', 'ovPbMaritalHistory',
  'ovPbEpidemicsHistory', 'ovPbLookListen', 'ovPbDialectic',
  'ovPbHeight', 'ovPbWeight', 'ovPbTemperature', 'ovPbHeartRate',
  'ovPbSystolic', 'ovPbDiastolic', 'ovIcd10s',
];

const form = reactive(makeInitial());

// 字段变化 → 写 localStorage（ovHisRecordId 由 App.vue 的共享 hisRecordId 接管，不重复持久化）
Object.keys(DEFAULTS).forEach((k) => {
  if (k === 'ovHisRecordId') return;
  watch(() => form[k], (v) => lsSet(k, v ?? ''));
});

// 与「主动查询」面板共享同一个 his_record_id（任一边改动，另一边实时同步）
const sharedHisRecordId = inject('hisRecordId');
form.ovHisRecordId = sharedHisRecordId.value ?? '';
watch(sharedHisRecordId, (v) => {
  const nv = v ?? '';
  if (form.ovHisRecordId !== nv) form.ovHisRecordId = nv;
});
watch(() => form.ovHisRecordId, (v) => {
  const nv = v ?? '';
  if (sharedHisRecordId.value !== nv) sharedHisRecordId.value = nv;
});

const formRef = ref(null);
const loading = ref(false);
const lastResult = ref(null);
const statusText = ref('未调用');

// 仅 7 个业务必填项配 rules
const rules = {
  ovHisRecordId: [{ required: true, message: 'HIS 病历唯一编号必填', trigger: 'blur' }],
  ovInstCode: [{ required: true, message: '机构编码必填', trigger: 'blur' }],
  ovDeptCode: [{ required: true, message: '科室编码必填', trigger: 'blur' }],
  ovDoctorCode: [{ required: true, message: '医生编码必填', trigger: 'blur' }],
  ovPatientId: [{ required: true, message: '必填', trigger: 'blur' }],
  ovPatientName: [{ required: true, message: '必填', trigger: 'blur' }],
  ovPatientAge: [{ required: true, message: '必填', trigger: 'blur' }],
};

function numOrUndef(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const num = Number(v);
  return Number.isNaN(num) ? undefined : num;
}

function parseIcd10s(text) {
  return (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf(':');
    if (idx < 0) return null;
    return { code: line.slice(0, idx).trim(), name: line.slice(idx + 1).trim() };
  }).filter(Boolean);
}

function buildBody() {
  // patient_basic
  const pbMap = {
    ovPbMainRemark: 'main_remark', ovPbInputRemark: 'input_remark',
    ovPbObjectiveRemark: 'objective_remark', ovPbAssistCheck: 'assist_check',
    ovPbDiseaseHistory: 'disease_history', ovPbAllergyHistory: 'allergy_history',
    ovPbBirthHistory: 'birth_history', ovPbPersonalHistory: 'personal_history',
    ovPbFamilyHistory: 'family_history', ovPbMaritalHistory: 'marital_reproductive_history',
    ovPbEpidemicsHistory: 'epidemics_history', ovPbLookListen: 'look_listen',
    ovPbDialectic: 'dialectic', ovPbHeight: 'height', ovPbWeight: 'weight',
    ovPbTemperature: 'temperature', ovPbHeartRate: 'heart_rate',
    ovPbSystolic: 'systolic_blood_pressure', ovPbDiastolic: 'diastolic_blood_pressure',
  };
  const numKeys = new Set(['ovPbHeight', 'ovPbWeight', 'ovPbTemperature', 'ovPbHeartRate', 'ovPbSystolic', 'ovPbDiastolic']);
  const patient_basic = {};
  Object.entries(pbMap).forEach(([k, field]) => {
    const v = numKeys.has(k) ? numOrUndef(form[k]) : (form[k] || '').trim();
    if (v !== '' && v !== undefined) patient_basic[field] = v;
  });

  const record = {};
  if (form.ovAppointmentDate) record.appointment_date = form.ovAppointmentDate;
  if (form.ovHisAppointmentNo) record.his_appointment_no = form.ovHisAppointmentNo;
  if (form.ovHisRegisterNo) record.his_register_no = form.ovHisRegisterNo;
  if (Object.keys(patient_basic).length) record.patient_basic = patient_basic;
  const icd10s = parseIcd10s(form.ovIcd10s);
  // 平台要求 diagnose 至少有 icd10s / gbs / syndrome / syndromes / therapy / therapies 六个字段
  record.diagnose = {
    icd10s,
    gbs: [],
    syndrome: { code: '', name: '' },
    syndromes: [],
    therapy: { code: '', name: '' },
    therapies: [],
  };

  const body = {
    app_id: config.appId,
    app_secret: config.appSecret,
    his_record_id: (form.ovHisRecordId || '').trim(),
  };
  if (form.ovPrevHisRecordId) body.previous_his_record_id = form.ovPrevHisRecordId;
  body.institution = { outer_institution_code: (form.ovInstCode || '').trim() };
  const dept = { outer_department_code: (form.ovDeptCode || '').trim() };
  if (form.ovDeptName) dept.name = form.ovDeptName;
  body.department = dept;
  const doc = { outer_doctor_code: (form.ovDoctorCode || '').trim() };
  if (form.ovDoctorName) doc.name = form.ovDoctorName;
  body.doctor = doc;
  body.patient = {
    his_patient_id: (form.ovPatientId || '').trim(),
    name: (form.ovPatientName || '').trim(),
    gender: form.ovPatientGender,
    age: numOrUndef(form.ovPatientAge),
  };
  const patMap = {
    ovPatientMobile: 'mobile', ovPatientIdcard: 'idcard', ovPatientSscid: 'sscid',
    ovPatientProvince: 'province', ovPatientCity: 'city', ovPatientArea: 'area',
    ovPatientAddress: 'family_address', ovPatientContactsName: 'contacts_name',
    ovPatientContactsMobile: 'contacts_mobile',
  };
  Object.entries(patMap).forEach(([k, field]) => {
    const v = (form[k] || '').trim();
    if (v) body.patient[field] = v;
  });
  body.record = record;
  return body;
}

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
    endpoint: 'his_outpatient_visit',
    body: buildBody(),
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
  Object.keys(DEFAULTS).forEach((k) => { form[k] = DEFAULTS[k]; });
  formRef.value?.clearValidate();
  notify.ok('已恢复发起门诊样例');
}

async function confirmRestore() {
  try {
    await ElMessageBox.confirm(
      '将清空当前已填的机构 / 科室 / 医生 / 患者 / 病历内容，恢复为内置示例数据。确定继续？',
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
          HIS 发起门诊（his_outpatient_visit）
        </span>
        <div class="head-right">
          <span class="endpoint">POST /api/system/external-api/inbound/{hospital_code}/his_outpatient_visit/</span>
          <el-button size="small" plain class="restore-btn" @click="confirmRestore">
            <el-icon><Refresh /></el-icon>
            <span>恢复默认</span>
          </el-button>
        </div>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="8">
          <el-form-item label="his_record_id" prop="ovHisRecordId">
            <el-input v-model="form.ovHisRecordId" placeholder="34997589" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-form-item label="previous_his_record_id">
            <el-input v-model="form.ovPrevHisRecordId" placeholder="选填：上一次病历 ID" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-form-item label="institution.outer_institution_code" prop="ovInstCode">
            <el-input v-model="form.ovInstCode" placeholder="hospitalA" />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="8">
          <el-form-item label="department.outer_department_code" prop="ovDeptCode">
            <el-input v-model="form.ovDeptCode" placeholder="nk_02" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-form-item label="department.name">
            <el-input v-model="form.ovDeptName" placeholder="内科2" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-form-item label="doctor.outer_doctor_code" prop="ovDoctorCode">
            <el-input v-model="form.ovDoctorCode" placeholder="doctor001" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-form-item label="doctor.name">
            <el-input v-model="form.ovDoctorName" placeholder="医生" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-collapse>
        <el-collapse-item title="患者信息（patient）" name="patient">
          <el-row :gutter="16">
            <el-col :xs="24" :sm="8">
              <el-form-item label="his_patient_id" prop="ovPatientId">
                <el-input v-model="form.ovPatientId" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="name" prop="ovPatientName">
                <el-input v-model="form.ovPatientName" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="gender" prop="ovPatientGender">
                <el-radio-group v-model="form.ovPatientGender">
                  <el-radio-button value="男">男</el-radio-button>
                  <el-radio-button value="女">女</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="age" prop="ovPatientAge">
                <el-input-number v-model="form.ovPatientAge" :min="0" :max="150" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="mobile"><el-input v-model="form.ovPatientMobile" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="idcard"><el-input v-model="form.ovPatientIdcard" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="sscid"><el-input v-model="form.ovPatientSscid" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="province"><el-input v-model="form.ovPatientProvince" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="city"><el-input v-model="form.ovPatientCity" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="area"><el-input v-model="form.ovPatientArea" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="family_address"><el-input v-model="form.ovPatientAddress" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="contacts_name"><el-input v-model="form.ovPatientContactsName" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="contacts_mobile"><el-input v-model="form.ovPatientContactsMobile" /></el-form-item></el-col>
          </el-row>
        </el-collapse-item>

        <el-collapse-item title="病历主信息（record）" name="record">
          <el-row :gutter="16">
            <el-col :xs="24" :sm="8"><el-form-item label="appointment_date"><el-date-picker v-model="form.ovAppointmentDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="his_appointment_no"><el-input v-model="form.ovHisAppointmentNo" /></el-form-item></el-col>
            <el-col :xs="24" :sm="8"><el-form-item label="his_register_no"><el-input v-model="form.ovHisRegisterNo" /></el-form-item></el-col>
          </el-row>

          <div class="sub-section">
            <div class="sub-title">patient_basic</div>
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12"><el-form-item label="main_remark（主诉）"><el-input v-model="form.ovPbMainRemark" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="input_remark（現病史）"><el-input v-model="form.ovPbInputRemark" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="objective_remark（体格检查）"><el-input v-model="form.ovPbObjectiveRemark" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="assist_check（辅助检查）"><el-input v-model="form.ovPbAssistCheck" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="disease_history（既往史）"><el-input v-model="form.ovPbDiseaseHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="allergy_history（过敏史）"><el-input v-model="form.ovPbAllergyHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="birth_history（出生史）"><el-input v-model="form.ovPbBirthHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="personal_history（个人史）"><el-input v-model="form.ovPbPersonalHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="family_history（家族史）"><el-input v-model="form.ovPbFamilyHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="marital_reproductive_history（婚育史）"><el-input v-model="form.ovPbMaritalHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="epidemics_history（流行病史）"><el-input v-model="form.ovPbEpidemicsHistory" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="look_listen（望闻切诊）"><el-input v-model="form.ovPbLookListen" /></el-form-item></el-col>
              <el-col :xs="24" :sm="12"><el-form-item label="dialectic（辨证论治）"><el-input v-model="form.ovPbDialectic" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="height"><el-input-number v-model="form.ovPbHeight" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="weight"><el-input-number v-model="form.ovPbWeight" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="temperature"><el-input-number v-model="form.ovPbTemperature" :step="0.1" controls-position="right" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="heart_rate"><el-input-number v-model="form.ovPbHeartRate" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="systolic_blood_pressure"><el-input-number v-model="form.ovPbSystolic" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="diastolic_blood_pressure"><el-input-number v-model="form.ovPbDiastolic" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
            </el-row>
          </div>

          <div class="sub-section">
            <div class="sub-title">diagnose</div>
            <el-form-item label="ICD10 列表">
              <el-input v-model="form.ovIcd10s" type="textarea" :rows="4"
                        placeholder="K29.100x001:急性胃炎&#10;A49.809:幽门螺杆菌感染" />
              <span class="hint">每行 <code>code:名称</code>，空行忽略。</span>
            </el-form-item>
          </div>
        </el-collapse-item>
      </el-collapse>

      <el-alert type="warning" :closable="false" show-icon style="margin-top: 12px;">
        平台限制：同一个 <code>his_record_id</code> 在 <strong>30 分钟</strong>内重复发起门诊会被拒绝（防重复门诊）。
        如遇报错，换一个 ID 即可。发起成功后，可用同一 ID 在「主动查询」面板拉回病历。
      </el-alert>

      <div class="action-row">
        <el-button type="primary" :loading="loading" @click="submit">提交发起门诊</el-button>
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
        <el-tag v-if="codeOk(lastResult) && lastResult.body?.data?.code" type="success" effect="plain" class="mono">门诊号 {{ lastResult.body.data.code }}</el-tag>
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
.sub-section { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #ebeef5; }
.sub-title { font-size: 12px; color: #909399; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
.action-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.status { color: #909399; font-size: 12px; margin-left: auto; }
.hint { font-size: 12px; color: #909399; margin-top: 4px; display: block; }
.hint code { background: #f5f7fa; padding: 0 4px; border-radius: 3px; font-size: 12px; }

.response { margin-top: 16px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.response.is-fail { border-color: #fde2e2; }
.response-head { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #ebeef5; }
.response.is-fail .response-head { background: #fef0f0; }
.response-body { background: #fff; padding: 16px; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.55; max-height: 360px; overflow: auto; margin: 0; white-space: pre; color: #ef4444; }
.response-head .el-tag.mono { font-family: ui-monospace, monospace; font-size: 11px; padding: 0 8px; }
.response:not(.is-fail) .response-body { color: inherit; }

@media (max-width: 720px) {
  .card-head { flex-direction: column; align-items: flex-start; }
  .endpoint { text-align: left; }
}
</style>
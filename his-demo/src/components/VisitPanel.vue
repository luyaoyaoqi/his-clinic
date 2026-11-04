<script setup>
import { computed, inject, reactive, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Refresh, CopyDocument, Link, Monitor } from '@element-plus/icons-vue';
import { callPlatform } from '../api/platform.js';
import { lsGet, lsSet, lsGetJson, lsSetJson } from '../utils/storage.js';
import { VISIT_MODES } from '../utils/visitDefaults.js';
import { CONFIG_DEFAULTS } from '../utils/defaults.js';
import QueryForm from './QueryForm.vue';

const props = defineProps({
  // 'outpatient' | 'inpatient'
  mode: { type: String, required: true },
});

const config = inject('config');
const notify = inject('notify');

const MODE = VISIT_MODES[props.mode];
const NS = MODE.ns;
const DEFAULTS = MODE.defaults;
const isInpatient = computed(() => MODE.sourceType === 2);

const ALL_KEYS = [
  'ovHisRecordId', 'ovPrevHisRecordId', 'ovInstCode',
  'ovDeptCode', 'ovDeptName', 'ovDoctorCode', 'ovDoctorName',
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
  'ovRecordType', 'ovInpatientId', 'ovRawContent',
];

// 读缓存：门诊沿用旧的无命名空间 key（首次访问时自动迁移到 outpatient. 前缀）
function readValue(key) {
  const v = lsGet(key, NS);
  if (v !== null) return v;
  if (NS === 'outpatient.') {
    const legacy = lsGet(key);
    if (legacy !== null) {
      lsSet(key, legacy, NS);
      return legacy;
    }
  }
  return DEFAULTS[key] ?? '';
}

function makeInitial() {
  /** @type {Record<string, string>} */
  const obj = {};
  ALL_KEYS.forEach((k) => { obj[k] = readValue(k); });
  // his_record_id 统一以 'hisRecordId' 为准：用户实际编辑的值写入的是这个 key
  const shared = lsGet('hisRecordId', NS);
  if (shared !== null) {
    obj.ovHisRecordId = shared;
  } else if (NS === 'outpatient.') {
    // 旧版本全局共用一个 hisRecordId，迁移到门诊命名空间
    const legacy = lsGet('hisRecordId');
    if (legacy !== null) {
      lsSet('hisRecordId', legacy, NS);
      obj.ovHisRecordId = legacy;
    }
  }
  return obj;
}

const form = reactive(makeInitial());

// 字段变化 → 写 localStorage（ovHisRecordId 由 hisRecordId 统一接管，不重复持久化）
ALL_KEYS.forEach((k) => {
  if (k === 'ovHisRecordId') return;
  watch(() => form[k], (v) => lsSet(k, v ?? '', NS));
});

// 与本页「主动查询」卡片共享同一个 his_record_id（任一边改动，另一边实时同步）
const hisRecordId = ref(form.ovHisRecordId);
watch(hisRecordId, (v) => {
  lsSet('hisRecordId', v ?? '', NS);
  const nv = v ?? '';
  if ((form.ovHisRecordId ?? '') !== nv) form.ovHisRecordId = nv;
});
watch(() => form.ovHisRecordId, (v) => {
  const nv = v ?? '';
  if ((hisRecordId.value ?? '') !== nv) hisRecordId.value = nv;
});

const formRef = ref(null);
const loading = ref(false);
const lastResult = ref(null);
const lastRequest = ref(null);
const statusText = ref('未调用');

// 刷新后恢复上次响应（避免关页面、刷新后看不到刚调的结果）
const LAST_RESULT_KEY = 'visit-lastResult';
{
  const cached = lsGetJson(LAST_RESULT_KEY, NS);
  if (cached && typeof cached === 'object') {
    lastResult.value = cached;
    const ok = cached.body?.code === 20000;
    statusText.value = ok
      ? `成功 · 耗时 ${cached.elapsed}ms`
      : `失败 · HTTP ${cached.httpStatus || '—'}`;
  }
}

// 7 个业务必填项
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
  // 来源类型 / 内容类型由当前 tab 决定：1=门诊，2=住院
  record.source_type = MODE.sourceType;
  record.content_type = MODE.sourceType;
  if (form.ovRecordType) record.record_type = (form.ovRecordType || '').trim();
  if (form.ovInpatientId) record.inpatient_id = (form.ovInpatientId || '').trim();
  if (form.ovRawContent) record.raw_content = (form.ovRawContent || '').trim();
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
  const body = buildBody();
  lastRequest.value = body;
  const result = await callPlatform({
    baseUrl: config.baseUrl,
    hospitalCode: config.hospitalCode,
    endpoint: 'his_outpatient_visit',
    body,
  });
  lastResult.value = result;
  lsSetJson(LAST_RESULT_KEY, result, NS);
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
  notify.ok(`已恢复发起${MODE.label}样例`);
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

// 拼出病历页面 URL：baseUrl + 内置模板，{code} 占位 → 响应里的 data.code
const clinicUrl = computed(() => {
  const code = lastResult.value?.body?.data?.code;
  if (!code) return '';
  const base = (config.baseUrl || '').replace(/\/+$/, '');
  return `${base}${CONFIG_DEFAULTS.clinicUrlTemplate.replace('{code}', encodeURIComponent(code))}`;
});

async function copyClinicUrl() {
  if (!clinicUrl.value) return;
  try {
    await navigator.clipboard.writeText(clinicUrl.value);
    notify.ok(`已复制${MODE.label}页面 URL`, clinicUrl.value);
  } catch {
    notify.err('复制失败', '浏览器拒绝写入剪贴板');
  }
}

function openClinicUrl() {
  if (!clinicUrl.value) return;
  window.open(clinicUrl.value, '_blank', 'noopener');
}
</script>

<template>
  <div class="visit-panel">
    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-head">
          <span class="card-title">{{ MODE.title }}</span>
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
            <el-form-item label="his_record_id（HIS 病历唯一编号）" prop="ovHisRecordId">
              <el-input v-model="form.ovHisRecordId" placeholder="34997589" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="previous_his_record_id（上一次病历 ID）">
              <el-input v-model="form.ovPrevHisRecordId" placeholder="选填：上一次病历 ID" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="institution.outer_institution_code（机构编码）" prop="ovInstCode">
              <el-input v-model="form.ovInstCode" placeholder="hospitalA" />
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="8">
            <el-form-item label="department.outer_department_code（科室编码）" prop="ovDeptCode">
              <el-input v-model="form.ovDeptCode" :placeholder="isInpatient ? '住院科室编码，如 nkzy' : '门诊科室编码，如 nk_01'" />
              <span class="hint">{{ isInpatient ? '住院系统下的科室' : '门诊系统下的科室' }}</span>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="department.name（科室名称）">
              <el-input v-model="form.ovDeptName" :placeholder="isInpatient ? '内科住院' : '内科'" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="doctor.outer_doctor_code（医生编码）" prop="ovDoctorCode">
              <el-input v-model="form.ovDoctorCode" :placeholder="isInpatient ? '住院医生编码，如 luyao002' : '门诊医生编码，如 luyao001'" />
              <span class="hint">{{ isInpatient ? '该医生的住院编码' : '该医生的门诊编码' }}</span>
            </el-form-item>
          </el-col>

          <el-col :xs="24" :sm="8">
            <el-form-item label="doctor.name（医生姓名）">
              <el-input v-model="form.ovDoctorName" placeholder="医生" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="record_type（病历类型）">
              <el-input v-model="form.ovRecordType" placeholder="首次病程记录" />
            </el-form-item>
          </el-col>
          <el-col v-if="isInpatient" :xs="24" :sm="8">
            <el-form-item label="inpatient_id（住院号）">
              <el-input v-model="form.ovInpatientId" placeholder="住院号，如 NO1019" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-collapse>
          <el-collapse-item title="患者信息（patient）" name="patient">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="8">
                <el-form-item label="his_patient_id（HIS 患者 ID）" prop="ovPatientId">
                  <el-input v-model="form.ovPatientId" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="8">
                <el-form-item label="name（姓名）" prop="ovPatientName">
                  <el-input v-model="form.ovPatientName" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="8">
                <el-form-item label="gender（性别）" prop="ovPatientGender">
                  <el-radio-group v-model="form.ovPatientGender">
                    <el-radio-button value="男">男</el-radio-button>
                    <el-radio-button value="女">女</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="8">
                <el-form-item label="age（年龄）" prop="ovPatientAge">
                  <el-input-number v-model="form.ovPatientAge" :min="0" :max="150" controls-position="right" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="mobile（手机号）"><el-input v-model="form.ovPatientMobile" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="idcard（身份证号）"><el-input v-model="form.ovPatientIdcard" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="sscid（社保卡号）"><el-input v-model="form.ovPatientSscid" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="province（省份）"><el-input v-model="form.ovPatientProvince" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="city（城市）"><el-input v-model="form.ovPatientCity" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="area（区域）"><el-input v-model="form.ovPatientArea" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="family_address（家庭地址）"><el-input v-model="form.ovPatientAddress" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="contacts_name（联系人姓名）"><el-input v-model="form.ovPatientContactsName" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="contacts_mobile（联系人手机）"><el-input v-model="form.ovPatientContactsMobile" /></el-form-item></el-col>
            </el-row>
          </el-collapse-item>

          <el-collapse-item title="病历主信息（record）" name="record">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="8"><el-form-item label="appointment_date（就诊日期）"><el-date-picker v-model="form.ovAppointmentDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="his_appointment_no（就诊单号）"><el-input v-model="form.ovHisAppointmentNo" /></el-form-item></el-col>
              <el-col :xs="24" :sm="8"><el-form-item label="his_register_no（HIS 挂号号）"><el-input v-model="form.ovHisRegisterNo" /></el-form-item></el-col>
            </el-row>

            <div class="sub-section">
              <div class="sub-title">raw_content（病历原文）</div>
              <el-form-item label="raw_content（病历原文）">
                <el-input
                  v-model="form.ovRawContent"
                  type="textarea"
                  :rows="6"
                  placeholder="整段病历原文，与下方 patient_basic 结构化字段并存"
                />
                <span class="hint">与 patient_basic 独立，两者都会提交。</span>
              </el-form-item>
            </div>

            <div class="sub-section">
              <div class="sub-title">patient_basic</div>
              <el-row :gutter="16">
                <el-col :xs="24" :sm="12"><el-form-item label="main_remark（主诉）"><el-input v-model="form.ovPbMainRemark" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="input_remark（現病史）"><el-input v-model="form.ovPbInputRemark" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="objective_remark（体格检查）"><el-input v-model="form.ovPbObjectiveRemark" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="assist_check（辅助检查）"><el-input v-model="form.ovPbAssistCheck" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="disease_history（既往史）"><el-input v-model="form.ovPbDiseaseHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="allergy_history（过敏史）"><el-input v-model="form.ovPbAllergyHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="birth_history（出生史）"><el-input v-model="form.ovPbBirthHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="personal_history（个人史）"><el-input v-model="form.ovPbPersonalHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="family_history（家族史）"><el-input v-model="form.ovPbFamilyHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="marital_reproductive_history（婚育史）"><el-input v-model="form.ovPbMaritalHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="epidemics_history（流行病史）"><el-input v-model="form.ovPbEpidemicsHistory" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="look_listen（望闻切诊）"><el-input v-model="form.ovPbLookListen" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="12"><el-form-item label="dialectic（辨证论治）"><el-input v-model="form.ovPbDialectic" type="textarea" :rows="2" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="height（身高）"><el-input-number v-model="form.ovPbHeight" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="weight（体重）"><el-input-number v-model="form.ovPbWeight" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="temperature（体温）"><el-input-number v-model="form.ovPbTemperature" :step="0.1" controls-position="right" style="width:100%" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="heart_rate（心率）"><el-input-number v-model="form.ovPbHeartRate" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="systolic_blood_pressure（收缩压）"><el-input-number v-model="form.ovPbSystolic" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
                <el-col :xs="24" :sm="8"><el-form-item label="diastolic_blood_pressure（舒张压）"><el-input-number v-model="form.ovPbDiastolic" :min="0" controls-position="right" style="width:100%" /></el-form-item></el-col>
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
          平台限制：同一个 <code>his_record_id</code> 在 <strong>30 分钟</strong>内重复发起{{ MODE.label }}会被拒绝（防重复{{ MODE.label }}）。
          如遇报错，换一个 ID 即可。发起成功后，可用同一 ID 在下方「主动查询」卡片拉回病历。
        </el-alert>

        <div class="action-row">
          <el-button type="primary" :loading="loading" @click="submit">{{ MODE.submitText }}</el-button>
          <span class="status">{{ statusText }}</span>
        </div>
      </el-form>

      <div v-if="lastRequest" class="request">
        <div class="request-head">本次请求体（POST body）</div>
        <pre class="request-body">{{ JSON.stringify(lastRequest, null, 2) }}</pre>
      </div>

      <div v-if="lastResult" class="response" :class="{ 'is-fail': !codeOk(lastResult) }">
        <div class="response-head">
          <div class="response-tags">
            <el-tag :type="codeOk(lastResult) ? 'success' : (lastResult.error ? 'danger' : 'warning')">
              HTTP {{ lastResult.httpStatus || '—' }}
            </el-tag>
            <el-tag v-if="lastResult.body?.code !== undefined" :type="codeOk(lastResult) ? 'success' : 'danger'">
              code {{ lastResult.body.code }}
            </el-tag>
            <el-tag v-if="lastResult.body?.msg" type="info" effect="plain">msg: {{ lastResult.body.msg }}</el-tag>
            <el-tag v-if="lastResult.body?.log_id" type="info" effect="plain">log_id: {{ lastResult.body.log_id }}</el-tag>
            <el-tag v-if="codeOk(lastResult) && lastResult.body?.data?.code" type="success" effect="plain" class="mono">{{ MODE.codeLabel }} {{ lastResult.body.data.code }}</el-tag>
            <el-tag type="info" effect="plain">{{ lastResult.elapsed }}ms</el-tag>
            <el-tag v-if="lastResult.error" type="danger">{{ lastResult.error }}</el-tag>
          </div>
          <div v-if="clinicUrl" class="response-actions">
            <span class="action-label">
              <el-icon><Monitor /></el-icon>
              <span>浏览页面</span>
            </span>
            <code class="clinic-url" :title="clinicUrl">{{ clinicUrl }}</code>
            <el-button size="small" plain class="icon-btn" @click="copyClinicUrl" title="复制完整 URL">
              <el-icon><CopyDocument /></el-icon>复制
            </el-button>
            <el-button size="small" type="primary" plain class="icon-btn" @click="openClinicUrl" title="新窗口打开">
              <el-icon><Link /></el-icon>打开
            </el-button>
          </div>
        </div>
        <pre class="response-body">{{ JSON.stringify(lastResult, null, 2) }}</pre>
      </div>
    </el-card>

    <!-- 主动查询：放在对应类型（门诊 / 住院）下面 -->
    <QueryForm :mode="props.mode" v-model:his-record-id="hisRecordId" />
  </div>
</template>

<style scoped>
.visit-panel { display: flex; flex-direction: column; gap: 16px; }
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

.request { margin-top: 16px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.request-head { padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #ebeef5; font-size: 12px; font-weight: 600; color: #606266; }
.request-body { background: #fff; padding: 16px; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.55; max-height: 320px; overflow: auto; margin: 0; white-space: pre; color: #2563eb; }

.response { margin-top: 16px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.response.is-fail { border-color: #fde2e2; }
.response-head { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #ebeef5; }
.response-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.response-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
.response-actions .action-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  margin-right: 8px;
  flex-shrink: 0;
}
.response-actions .action-label .el-icon { font-size: 14px; }
.response-actions .clinic-url {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: #2563eb;
  background: #ecf5ff;
  padding: 4px 8px;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid #d9ecff;
  margin-right: 12px;
}
.response-actions .icon-btn { padding: 4px 10px; }
.response-actions .icon-btn .el-icon { font-size: 14px; }
.response.is-fail .response-head { background: #fef0f0; }
.response-body { background: #fff; padding: 16px; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.55; max-height: 360px; overflow: auto; margin: 0; white-space: pre; color: #ef4444; }
.response-head .el-tag.mono { font-family: ui-monospace, monospace; font-size: 11px; padding: 0 8px; }
.response:not(.is-fail) .response-body { color: inherit; }

@media (max-width: 720px) {
  .card-head { flex-direction: column; align-items: flex-start; }
  .endpoint { text-align: left; }
}
</style>

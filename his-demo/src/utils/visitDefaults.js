// 门诊 / 住院两套独立的表单样例。
// 数据分开缓存：localStorage 前缀分别为 'outpatient.' 与 'inpatient.'（见 storage.js）。

// 两套共用的部分
const BASE = {
  ovHisRecordId: '1499762027',
  ovPrevHisRecordId: '',
  ovInstCode: 'xwzqzyy',
  ovPatientId: 'DD1577603E1D46DBBF84986D6B950DC2028',
  ovPatientName: '琪琪',
  ovPatientGender: '女',
  ovPatientAge: '28',
  ovPatientMobile: '15707647698',
  ovPatientIdcard: '330825199209161825',
  ovPatientSscid: '33080099000000000001873548',
  ovPatientProvince: '福建省',
  ovPatientCity: '厦门市',
  ovPatientArea: '湖里区',
  ovPatientAddress: '家庭地址（改）',
  ovPatientContactsName: '联系人（改）',
  ovPatientContactsMobile: '1333',
  ovAppointmentDate: '2026-09-11',
  ovHisRegisterNo: '0000535164',
  ovPbMainRemark: '发热伴咳嗽咳痰 5 天，加重 1 天',
  ovPbInputRemark: '患者 5 天前受凉后出现发热，体温最高 39.2℃，午后发热明显，伴阵发性咳嗽，咳黄色黏痰，痰量中等，不易咳出。偶有畏寒寒战，无抽搐，无胸痛咯血。发病第 3 天自行口服解热镇痛药，服药后体温可短暂下降，数小时后复升。1 天前上述症状加重，发热持续不退，咳嗽频次增多，自觉乏力、头部胀痛。无鼻塞流涕，无恶心呕吐，无腹痛腹泻，无胸闷气促。未于外院做血常规、胸片等相关检查。纳差，睡眠欠佳，大便偏干，小便黄，近期体重无明显下降。',
  ovPbObjectiveRemark: '神志清，精神可，咽腔轻度充血，扁桃体无肿大。双肺呼吸音清，未闻及啰音。心律齐，无病理性杂音。腹软，无压痛反跳痛，双下肢无水肿，生理反射存在，病理征阴性。',
  ovPbAssistCheck: '暂未行喉镜等检查。',
  ovPbDiseaseHistory: '否认高血压、糖尿病病史，否认肝炎、肺结核病史，否认食物药物中毒青霉素过敏史，近3天内有阿莫西林用药史，否认外伤、手术史，否认输血史，预防接种史不详。',
  ovPbAllergyHistory: '否认药物及食物过敏史。',
  ovPbPersonalHistory: '平素偶有熬夜。',
  ovPbLookListen: '咽干，舌淡红少津，苔薄，脉细。',
  ovPbDialectic: '肺胃阴亏，咽喉失濡，胃气上逆。',
  ovPbHeight: '168',
  ovPbWeight: '63',
  ovPbTemperature: '36.4',
  ovPbHeartRate: '72',
  ovPbSystolic: '116',
  ovPbDiastolic: '72',
  ovIcd10s: 'K29.100x001:急性胃炎\nA49.809:幽门螺杆菌感染',
};

// 发起门诊样例（source_type=1）
export const OUTPATIENT_DEFAULTS = {
  ...BASE,
  ovDeptCode: 'nk_01',
  ovDeptName: '内科',
  ovDoctorCode: 'luyao001',
  ovDoctorName: '医生',
  ovRecordType: '',
  ovInpatientId: '',
  ovRawContent: '',
};

// 发起住院样例（source_type=2）
export const INPATIENT_DEFAULTS = {
  ...BASE,
  ovHisRecordId: '1499762028',
  ovDeptCode: 'nkzy',
  ovDeptName: '内科住院',
  ovDoctorCode: 'luyao002',
  ovDoctorName: '路瑶',
  ovRecordType: '首次病程记录',
  ovInpatientId: 'NO1019',
  ovRawContent:
    '患者 5 天前受凉后出现发热，体温最高 39.2℃，午后发热明显，伴阵发性咳嗽，咳黄色黏痰，痰量中等，不易咳出。偶有畏寒寒战，无抽搐，无胸痛咯血。发病第 3 天自行口服解热镇痛药，服药后体温可短暂下降，数小时后复升。1 天前上述症状加重，发热持续不退，咳嗽频次增多，自觉乏力、头部胀痛。无鼻塞流涕，无恶心呕吐，无腹痛腹泻，无胸闷气促。未于外院做血常规、胸片等相关检查。纳差，睡眠欠佳，大便偏干，小便黄，近期体重无明显下降。神志清，精神可，咽腔轻度充血，扁桃体无肿大。双肺呼吸音清，未闻及啰音。心律齐，无病理性杂音。腹软，无压痛反跳痛，双下肢无水肿，生理反射存在，病理征阴性。否认高血压、糖尿病病史，否认肝炎、肺结核病史，否认食物药物中毒青霉素过敏史，近3天内有阿莫西林用药史，否认外伤、手术史，否认输血史，预防接种史不详。',
};

// 各类型的默认配置（namespace / source_type / 文案）
export const VISIT_MODES = {
  outpatient: {
    key: 'outpatient',
    label: '门诊',
    sourceType: 1,
    ns: 'outpatient.',
    defaults: OUTPATIENT_DEFAULTS,
    title: 'HIS 发起门诊（his_outpatient_visit）',
    submitText: '提交发起门诊',
    codeLabel: '门诊号',
  },
  inpatient: {
    key: 'inpatient',
    label: '住院',
    sourceType: 2,
    ns: 'inpatient.',
    defaults: INPATIENT_DEFAULTS,
    title: 'HIS 发起住院（his_outpatient_visit · source_type=2）',
    submitText: '提交发起住院',
    codeLabel: '住院号',
  },
};

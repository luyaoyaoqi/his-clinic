const PREFIX = 'his-demo:';

// ns 为命名空间（namespace），用于门诊 / 住院两套数据分开缓存
// 例：lsGet('ovDeptCode', 'inpatient.') → localStorage['his-demo:inpatient.ovDeptCode']
export function lsGet(key, ns = '') {
  try { return localStorage.getItem(PREFIX + ns + key); } catch { return null; }
}

export function lsSet(key, value, ns = '') {
  try { localStorage.setItem(PREFIX + ns + key, value); } catch { /* quota */ }
}

export function lsGetJson(key, ns = '') {
  const raw = lsGet(key, ns);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function lsSetJson(key, value, ns = '') {
  try { lsSet(key, JSON.stringify(value), ns); } catch { /* quota / circular */ }
}

// 把对象所有顶层 key 自动绑到 localStorage（reactive-friendly）
export function bindReactive(reactiveObj, keyMap) {
  // 初次填充
  Object.keys(keyMap).forEach((reactiveKey) => {
    const lsKey = keyMap[reactiveKey];
    const v = lsGet(lsKey);
    if (v !== null && v !== undefined) reactiveObj[reactiveKey] = v;
  });
  // 监听变化
  Object.keys(keyMap).forEach((reactiveKey) => {
    const lsKey = keyMap[reactiveKey];
    let initialized = false;
    // 跳过首次绑定时的写入
    const original = reactiveObj[reactiveKey];
    setTimeout(() => { initialized = true; }, 0);
    // 用 watch 在外部调用，这里只暴露一次性绑定
    // 这里采用最简方案：依靠子组件 watch
  });
}

// 把对象恢复为默认值，并写回 localStorage
export function restoreDefaults(reactiveObj, keyMap, defaults) {
  Object.keys(keyMap).forEach((reactiveKey) => {
    const lsKey = keyMap[reactiveKey];
    if (defaults[lsKey] !== undefined) {
      reactiveObj[reactiveKey] = defaults[lsKey];
      lsSet(lsKey, defaults[lsKey]);
    }
  });
}
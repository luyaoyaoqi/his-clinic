const PREFIX = 'his-demo:';

export function lsGet(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function lsSet(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* quota */ }
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
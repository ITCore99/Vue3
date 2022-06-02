// 对元素设置属性
export const patchAttr = (el: HTMLElement, key, value) => {
  if (value ===null) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
} 
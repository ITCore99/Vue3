// 处理比对类名
export const patchClass = (el: HTMLElement, value) => {
  if (value === null) {
    value = ''
  } 
  // value = Object.keys(value).filter(key => value[key]).join(' ')
  el.className = value
}
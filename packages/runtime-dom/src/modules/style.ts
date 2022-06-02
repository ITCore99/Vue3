// 对比更新属性
export const patchStyle = (el :HTMLElement, prev, next) => {
  const style = el.style // 获取样式
  if (next === null) { // 新的里面没有需要全部删除
    el.removeAttribute('style')
  } else {
    if(prev) { // 如果老的存在
      for(let key of Object.keys(prev)) {
        if (next[key] === null) { // 新的中没有需要删除
          style[key] = ''
        }
      }
    }
     // 对于新的值全部进行设置
    for(let key of Object.keys(next)) {
      style[key] = next[key]
    }
  } 
}
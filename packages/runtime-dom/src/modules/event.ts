// 比对处理一些事件
export const patchEvent = (el, key, value) => {
  // 注意这里的技巧 平常我们要修改addEventLister绑定的方法是 先移除再绑定 但是有点麻烦
  // 这里我们使用一个变量来存放函数，每次去绑定一个匿名函数在这个匿名函数函数中调用这个引用，所以每次修改的时候只需要修改引用就行。
  // 对原函数进行缓存
  const invokers = el._vei || (el._vei = {})
  const exist = invokers[key]
  if(value && exist) { // 需要对事件进行更新
    exist.value = value
  } else {
    const eventName = key.slice(2).toLowerCase() // 获取事件名
    if(value) { // 需要绑定事件 之前没有进行绑定过
      const invoker = invokers[key] = createInvoker(value)
      el.addEventListener(eventName, invoker)
    } else { // value 不存在需要移除
      if (exist) {
        el.removeEventListener(eventName, exist)
        invokers[key] = null
      }
    }
  }
}

// 创建一个匿名的invoker
function createInvoker(value) {
  const invoker = (e) => {
    invoker.value(e)
  }
  invoker.value = value // 这里进行保存 修改的时候只需要修改这个引用就可以
  return invoker
}
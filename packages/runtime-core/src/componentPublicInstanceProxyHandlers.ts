import { hasOwn } from "@vue/shared"

export const publicInstanceProxyHandlers =  {
  get({ _: instance }, key) {
    if(key[0] ==='$') { // 用户不能访问$开头的变量
      return
    }
    // 取值时可以访问 setupState props
    const { setupState, props } = instance
    if(hasOwn(setupState, key)) {
      return setupState[key]
    } else if(hasOwn(props, key)) {
      return props[key]
    } else {
      return undefined
    }
  },
  set({ _: instance }, key, value) {
    const { setupState } = instance 
    if(hasOwn(setupState, key)) {
      setupState[key] = value
    }
  }
}
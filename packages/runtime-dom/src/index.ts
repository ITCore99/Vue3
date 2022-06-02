// runtime-dom核心就是提供dom操作Api
// 操作节点和属性的更新 

import { createRenderer } from "@vue/runtime-core";
import { extend } from "@vue/shared";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

// 节点操作 增删改查
// 样式操作 增加、删除、更新、类、事件、其他属性
// 需要将nodeOps和patchProp进行整合 渲染的时候会使用到
export const renderOptions = extend({}, nodeOps, { patchProp })

// 用户调用的是runtime-dom runtime-dom 调用runtime-core 
// runtimedom(浏览器) 是为了解决平台差异

// vue中runtime-core里面提供了核心的方法 用来处理渲染 会使用runtime-dom中的api来进行渲染(这样写的好处将dom和core层分开)
export function createApp(rootComponent, rootProps = null) {
  const app:any = createRenderer(renderOptions).createApp(rootComponent, rootProps)
  const { mount } = app 
  // 重写mount方法 添加自己的逻辑
  app.mount = function(selector) {
    // 这是进行对容器的清空
    const container = nodeOps.querySelector(selector)
    container.innerHTML = ''
    // 调用createRender中的mount方法
    mount(container)
    // 将组建渲染成Dom元素 进行挂载
  }
  return app
}
// 保证我们使用的runtime-dom里面的
export * from '@vue/runtime-core'
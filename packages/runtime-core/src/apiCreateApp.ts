import { createVNode } from "./vnode"

/**
 * 流程：
 * 1、根据组件创建虚拟节点
 * 2、将容器和虚拟节点获取到后调用render进行渲染
 */
export function createAppApi(render){
   return function createApp(rootComponent, rootProps) { // 渲染哪一个组件
    const app  = {
      _props: rootProps,
      _component: rootComponent,
      _container: null,
      mount(container) { // 挂载到哪里去
        // 1、根据组件和属性生成虚拟节点
        const vnode = createVNode(rootComponent, rootProps)
        // 2、根据虚拟节点调用render函数来渲染
        render(vnode, container)
        app._container = container
      }
    }
    return app
  }
}
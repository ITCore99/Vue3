// 组件中所有的方法
import { isFunction, isObject, ShapeFlags } from "@vue/shared"
import { publicInstanceProxyHandlers } from "./componentPublicInstanceProxyHandlers"

// 创建一个组件实例
export function createInitialInstance(vnode) {
  // webComponent 组件必备的有属性和插槽
  const instance = {
    vnode,
    type: vnode.type,
    props: {}, // 当前组件的属性这里不直接写vnode.props 因为为这里的属性 不仅是props还有attrs 是一个合集
    slots: {},
    setupState: {}, // 如果setup返回一个对象 这个对象就是setupState
    ctx: {},
    isMounted: false, // 表示当前组件是否挂载过
    render: null
  }
  instance.ctx = { _: instance }
  return instance
}
// 初始化启动组件
export function setupComponent(instance) {
  const { props, children } = instance.vnode
  // 根据props 解析出 props和attrs 更新到instance上
  instance.props = props // 对应源码中 => initProps
  instance.children = children // 插槽的解析 => initSlots
  // 判断当前是不是有状态的组件
  const isStateful = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
  if(isStateful) {
    // 调用实例的setup方法，用setup函数的返回值填充instance的setupState和render
    setupStatefulComponent(instance)
  }
}
function setupStatefulComponent(instance) {
  // 1、属性的代理 方便用户访问 传递给render函数的参数  
  // 我什么不直接代理instance 是因为自己需要更新instance上的属性 并不需要走代理
  instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandlers as any)
  // 2、获取组件的类型 拿到组件的setup 方法
  const component = instance.type
  const { setup } = component 
  if(setup) {
    const setupContext = createContext(instance)
    const setupResult = setup(instance.props, setupContext)
    // 主要进行处理setup 返回值
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance) // 完成组件的启动
  }
}
// 创建一个组件的上下文
function createContext(instance) {
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: () => {},
    expose: () => {}
  }
}
// 完成组件的启动
function finishComponentSetup(instance) {
  const component = instance.type
  let { render } = instance 
  if(!render) {
    if(!component.render && component.template) { 
      // 如果没有render则对template模板进行编译产生render函数 将结果赋给component.render 
    }
    instance.render =  component.render // 如果组件中有render函数将render函数保存到实例上
  }
}
// 处理setup 返回值
function handleSetupResult(instance, setupResult) {
  if(isFunction(setupResult)) { // 如果返回的是一个函数 则将作为render函数
    instance.render = setupResult
  } else if (isObject(setupResult)) { // 如果是对象则将返回的对象更新到setupState上 
    instance.setupState = setupResult
  }
  finishComponentSetup(instance)
 }
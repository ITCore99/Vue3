import { effect } from "@vue/reactivity"
import { isArray, ShapeFlags } from "@vue/shared"
import { createAppApi } from "./apiCreateApp"
import { createInitialInstance, setupComponent } from "./component"
import { queueJob } from "./sechduler"
import { normalizeVNode, TEXT } from "./vnode"
/**
 * 渲染流程: 首先将组件转化为虚拟节点 根据虚拟节点进行挂载(patch) 在组建挂载的时候执行setup方法和渲染模板生成组件的render函数 render函数执行
 * 会返回此组件子树的虚拟节点 在根据子树虚拟执行patch方法挂载子树 最终挂载的整个流程。
 * 每个组件都是一个effect
 * @param renderOptions 
 * @returns 
 */

// 创建一个渲染器 这样写的好处是 如果我们要创建不同的渲染器只需要传递不同的renderOption即可实现
export function createRenderer(renderOptions) { // 告诉core如何进行渲染(使用哪些平台api
  const { 
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    remove: hostRemove,
    createText: hostCreateText,
    setElementText: hostSetElementText,
    insert: hostInsert ,
    nextSibling: hostNextSibling
  }  = renderOptions
  // ------------ 处理 组件 --------------------
  // 执行render方法
  function setupRenderEffect(instance, container) {
    // 创建一个effect在effect中调用render函数，对这个render进行收集依赖
    // render中使用到变量发生变化会自执行render

    instance.update = effect(function componentEffect(){ // 每一个组件都有一个effect 进行组件的更新 vue3是组件级的更新 属性变化会重新执行组件的effect来进行更新
      if(!instance.isMounted) {
      // 这是初次渲染
      const proxyToUser = instance.proxy
      // 组件render初次渲染的vnode 
      // 在vue3中组件就叫vnode(是对组件的描述) 组件的真正渲染内容叫做subtree  对应vue2的 $vnode 和_vnoode 
      const subTree = instance.subTree =  instance.render.call(proxyToUser, proxyToUser) // 别忘记传递参数并修改this指向
      // 初始化字树 用render函数返回值继续渲染
      patch(null, subTree, container)
      instance.isMounted = true
      } else {
        // 这是更新逻辑 依赖发生变化 则开始进行更新逻辑(diff算法)
        const proxyToUser = instance.proxy
        const prevTree = instance.subTree // 上一次的旧树
        const nextTree =  instance.render.call(proxyToUser, proxyToUser) // 重新执行render方法创建获取到新树的vnode
        patch(prevTree, nextTree, container) // 进行patch方法的新老节点比对更新页面
      }
    }, {
      scheduler: (effect) => { // 作用是组件数据多次更新执行一次渲染
        // 通过scheduler来执行我们自定义的渲染函数 而不是执行收集到effect
        queueJob(effect)
      }
    })
  }
  // 挂载组件
  function mountComponent(initialVNode, container) {
    // 组件的渲染流程 核心是调用setup拿到返回值，获取render函数的返回值进行渲染
    // 1、创建一个实例
    const instance = initialVNode.component = createInitialInstance (initialVNode)
    // 2、将需要的数据解析到实例上
    setupComponent(instance) // 初始化组件 将数据全部放到实例上
    // 3、创建一个effect 让render函数执行
    setupRenderEffect(instance, container)
  }
  // 处理组件
  function processComponent(n1, n2, container) {
    if (n1 === null) { // 进行组件的初始化
      mountComponent(n2, container)
    } else { // 进行组件的更新
      
    }
  }
  // ------------ 处理 组件 End--------------------
  // ------------ 处理 元素 Start -----------------

  function mountChildren(children, container) {
    for(let i = 0; i < children.length; i++) { 
      // 需要注意如果孩子是多个文本的话 多次调用setElementText时候 后一次会把前一次设置的文本覆盖掉
      const child = normalizeVNode(children[i])  // 文本处理成文本虚拟节点 解决覆盖问题
      patch(null, child, container)
    }

  }
  // 挂载元素
  function mountElement(vnode, container, anchor = null) {
    // 进行递归渲染
    const { props, shapeFlag, children, type } = vnode
    const el = vnode.el = hostCreateElement(type)
    if (props) { // 添加属性
      for(let key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    if(shapeFlag & ShapeFlags.TEXT_CHILDREN) { // 孩子节点是文本 直接扔进去即可
      hostSetElementText(el, children)
    } else if(shapeFlag & ShapeFlags.ARRAY_CHILDREN) { // 孩子是一个数组
      mountChildren(children, el) // 可能出现 [文本， 文本] [文本， 虚拟节点] 等文本和虚拟节点的情况抽离方法处理
    }
    hostInsert(el, container, anchor)
  }
  // diff 算法比对儿子
  function patchKeyChildren(c1, c2, el) {
    // 对特殊情况进行优化(特殊情况就是首部或者尾部新增和删除)
    let i = 0; // 默认从头开始比对
    let e1 =  c1.length - 1 // 尾指针
    let e2 = c2.length - 1 // 尾指针
    // sync from start 从头开始一个个比 遇到不同的就停止(尽可能较少比对区域) 旧 abcd 新 abde
    while(i<= e1 && i <= e2){
      const n1 = c1[i]
      const n2 = c2[i]
      if(isSameVNodeType(n1, n2)){
        patch(n1, n2, el) // 比对属性和孩子
      } else {
        break
      }
      i++
    }
    // sync from end 从尾部开始一个个比
    while(i<= e1 && i <= e2){
      const n1 = c1[e1]
      const n2 = c2[e2]
      if(isSameVNodeType(n1, n2)){
        patch(n1, n2, el) // 比对属性和孩子
      } else {
        break
      }
      e1--
      e2--
    }
    // 同序列挂载 头尾添加删除
    // 如果完成后i > e1 说明新孩子有新增节点 老的少新的多 需要新增i和e2之间的元素
    if(i > e1) {
      if(i <= e2) { // 表示有新增的部分
        // 想知道是向前插入还是向后插入
        let anchor
        const nextPos = e2 + 1 // 获取到e2的下一个位置
        if(nextPos >= c2.length) { // 则说明是从前往后比对 需要向后插入
          anchor = null 
        } else {  // 则说明是从后往前比对 需要向前插入
          anchor = c2[nextPos].el // 这里为什么是nextPos索引因为 这种是e2向左移动执行减操作 +1就是让e2加操作向右侧移动去上一个索引(表示说明e2是否移动过)
        }
        while(i <= e2) { // 循环新增节点
          patch(null, c2[i], el, anchor) 
          i++
        }
      }
    } else if(i > e2) { // 老的多新的少
      while( i <= e1) { // 将老的多的进行删除
        unmount(c1[i])
        i++
      }
    } else {
      // 乱序比较 需要尽可能的复用  这已经是经过前面收尾智指针缩小范围之后的中间部分就是需要diff的部分把中间不相等部分做如下处理，遍历新的元素做一个映射表老的元素去里面找 一样的就复用 不一样的要不就插入要不就删除
      // 例如: abcdefg abecdhfg [5340]
      let s1 = i
      let s2 = i
      // 遍历新的元素将元素的key与索引进行映射
      const keyToNewIndexMap = new Map()
      for(let i = s2; i <= e2; i++) {
        const child = c2[i]
        keyToNewIndexMap.set(child.key, i)
      }
      // 将patch过元素进行记录下来 是为了知道哪些是新增元素
      const toBePatched = e2 - s2 + 1
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0) // 将新的索引到老的索引进行记录 表明是已经patch过的(不是0的表示是已经patch过的是0的表明是没有patch过的是新增的元素)
      // 用老的新的map里面查找看有没有复用的
      for(let i = s1; i <= e1; i++) {
        const oldChild = c1[i]
        const newIndex = keyToNewIndexMap.get(oldChild.key)
        if(newIndex === undefined) { // 说明新的中没有需要删除
          unmount(oldChild)
        } else { // 如果找到了 则去比较新旧节点以及孩子节点 (这里比较完了之后位置有问题)
          // 新和旧的关系 索引关系
          newIndexToOldIndexMap[newIndex - s2] = i + 1 // 减去s2是为了 将索引相对 s2的下标  为什么需要i+1因为如果正好为0的时候正好和我们的初始值一样，为了保证不一样我们需要+1 到时使用的时候记得减去即可
          patch(oldChild, c2[newIndex], el)
        }
      }
      // [5 ,3,4, 0 ] => [1, 2] => []
      const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap) //求出最常的递增索引序列
      let j = increasingNewIndexSequence.length - 1 // 取出最后一项
      for(let i = toBePatched - 1 ; i >= 0; i-- ) { // 插入新增的元素 这里为什么是倒叙 是因为这样的话我们就可以插入的前一个元素作为要插入下一个元素的参照物
        const currentIndex = s2 + i // 之前减去过s2 现在复原找到元素原本的位置 如例子所属的话就是h的索引
        let child = c2[currentIndex] 
        let anchor = currentIndex + 1  < c2.length ? c2[currentIndex + 1].el : null// 获取下一项 如果存在则需要插入到下一项的前面如果不存在只需要插入到最后即可
        if(newIndexToOldIndexMap[i]=== 0) { // 没有被patch过 是新增元素进行新增操作
          patch(null, child, el, anchor)
        } else { // 操作当前的D 以D的先一个作为参照物插入 注意📢 这里else插入其实并不是插入而是移动位置 因为使用beforeInser或者appendChild插入一个已经存在的dom元素浏览器会将此元素从之前的位置移动到新的位置
          if (i !== increasingNewIndexSequence[j]) { // 取出最后一个索引 不匹配则进行移动否则不进行移动(优化移动次数)
            hostInsert(child.el, el, anchor) // 但是虽然浏览器可以帮我们移动但是如果之前的顺序和新的顺序有一部分是一致的 本不该移动但是还是全部插入移动 所以性能会稍微差点需要优化(最常递增子序列优化移动) 我们期望是尽可能的少移动
          } else {
            j--
          }
         
        }
      }
    }
  }
  // 求最长的递增子序列
  function  getSequence(arr) {
    const len = arr.length
    const result = [0] // 里面放的是索引
    const p = arr.slice(0) // 里面内容无所谓 和原数组相同 用来存放前一个索引
    let start 
    let end
    let middle
    for(let i = 1; i < len; i ++) {
      const arrI = arr[i]
      if(arrI !== 0 ) { // 当不为0的时候才开始操作因为 0 的表示的是新增元素 需要插入而不是排序
        const resultLastIndex = result[result.length - 1] // 取最后一个索引
        if(arr[resultLastIndex] < arrI) {  // 当前值大于最后一个
          p[i] = resultLastIndex // 记录前一个索引
          result.push(i) 
          continue
        } 
        if(arr[resultLastIndex] > arrI) {
          // 采用二分查找的方式进行 寻找最小的比当前数大的元素
          start = 0
          end = result.length - 1
          while(start < end) { // 重合就说明找到
            middle = Math.floor((start + end) / 2)
            if(arr[result[middle]] < arrI) {
              start = middle + 1
            } else {
              end = middle
            }
          }
          // 循环结束start/end 就是找到位置
          if(arrI < arr[result[start]]) { // 找到比当前值大的一个数
            if(start > 0 ) { // 索引0 没有前一项索引所以不赋值
              p[i] = result[start - 1] // 找到需要替换元素的前一个索引 TODO: 这里是不是可以是 p[i] = p[start]
            }
            result[start] = i //用当前值替换找到的值
          }
        }
      }
    }
    console.log('p=>', p)
    // 从最后一个元素开始遍历 根据前驱节点遍历输出整个链条
    let len1 = result.length // 总的个数 之前说过这里的个数正确的
    let last = result[len1 - 1] // 取到最后一项索引
    while(len1-- > 0) { //TODO: 这里的向前遍历没懂
      result[len1] = last
      last = p[last]
    }
    return result
  }
  // 卸载孩子
  function unmountChild(children) {
    for(let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }
  // 进行儿子的比对 (老的有儿子新的没儿子 新的有儿子老的没儿子 新的老的都有儿子 (进行diff对比))
  function patchChildren(n1, n2, el) {
    const c1 = n1.children
    const c2 = n2.children
    // 分别标识孩子的状况
    const prevShapFlag = n1.shapeFlag
    const shapeFalg = n2.shapeFlag
    if (shapeFalg && shapeFalg & ShapeFlags.TEXT_CHILDREN) { // 当前孩子是文本
      if(prevShapFlag && prevShapFlag & ShapeFlags.ARRAY_CHILDREN) { // 旧孩子是数组需要先进行卸载孩子这里不判断元素的原因是 虚拟节点孩子节点要么是字符串要么是数组(元素也会被处理为数组)
        unmountChild(c1) // 如果c1中包含组件会调用组件的卸载方法
      }
      // 两个都是文本
      if (c1 !== c2) {
        console.log(el, c2)
        hostSetElementText(el, c2)
      }
    } else { // 本次孩子是数组
      if(prevShapFlag && prevShapFlag & ShapeFlags.ARRAY_CHILDREN) { //  之前是数组 因为h函数在创建的时候一个也会被包裹为数组
        if(shapeFalg && shapeFalg & ShapeFlags.ARRAY_CHILDREN) { // 当前是数组 兼容万一传参错误的问题 所以加一层判断
          // diff算
          patchKeyChildren(c1, c2, el)
        } else { // 当前没有孩子 当前是null 特殊情况
          unmountChild(c1) // 卸载之前的孩子
        }
      } else { // 之前是文本
        if(prevShapFlag && prevShapFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, '') // 清空之前的文本
        }
        if(shapeFalg && shapeFalg & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el) // 挂载当前孩子
        }
      }
    }
  }
  // 比对属性
  function patchProps(oldProps, newProps, el) {
    if(oldProps !== newProps) {
      for(let key in newProps) {
        const prev = oldProps[key]
        const next = newProps[key]
        if(prev !== next) {
          hostPatchProp(el, key, prev, next)
        }
      }
      // 老的中有新的中没有则删除
      for(let key in oldProps) {
        const prev = oldProps[key]
        if(!(key in newProps)) {
          hostPatchProp(el, key, prev, null)
        }
      }
    }

  }
  // 比对元素(更新元素)
  function patchElement(n1, n2, container) { 
    // 元素是相同节点 需要复用节点
    const el = n2.el = n1.el
    // 更新属性 
    const oldProps = n1.props || {}
    const newProps = n2.props || {}
    patchProps(oldProps, newProps, el)
    // 更新儿子
    patchChildren(n1, n2, el)
  }
  // 处理元素
  function processElement(n1, n2, container, anchor) {
    if(n1 === null) { // 元素挂载
      mountElement(n2, container, anchor)
    } else { // 元素更新
      console.log('进行元素更新逻辑') 
      patchElement(n1, n2, container)
    }
  }
  // ------------ 处理 元素 End -----------------
  // ------------ 处理 文本 Start----------------
  function processText(n1, n2, container) {
    if(n1 === null) { // 文本挂载
      n2.el  = hostCreateText(n2.children)
      hostInsert(n2.el, container)
    } else {  // 文本的更新

    }
  }
  // ------------ 处理 文本 End----------------
  // 是不是同一个类型的虚拟节点
  function isSameVNodeType(n1, n2): Boolean {
    return n1.type === n2.type && n1.key === n2.key
  }
  // 卸载(单独抽离出来是为了扩展 后期如果是组件的话 需要调用组件卸载时的生命周期等)
  function unmount(n1) { 
    hostRemove(n1.el)
  }
  // 参数 n1: 老的虚拟节点 n2: 新的虚拟节点 
  function patch(n1, n2, container, anchor = null) {
    // 针对不同的类型做初始化方式
    const { shapeFlag, type} = n2
    if(n1 && !isSameVNodeType(n1, n2)){ // 判断前后的虚拟节点是不是同一个类型的 不是同类型的不用进行diff比较直接替换
      // 首先删除掉n1元素 再挂载n2元素
      anchor =  hostNextSibling(n1.el) // 获取元素的下一个兄弟节点作为参考点防止新增节点插入到container最后
      unmount(n1)
      n1 = null  // 设置为null 进入元素的挂载流程
    }
    switch (type) { // 后期有其他类型也可以在这里进行扩展
      case TEXT:
        processText(n1, n2, container)
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) { // 是一个元素
          processElement(n1, n2, container, anchor)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) { // 是一个组件
          processComponent(n1, n2, container)
        }
        break;
    }
  }
  // 渲染函数core核心函数 作用可以将一个虚拟节点挂载到一个容器上
  const render = function(vnode, container) {
    // 根据不同的虚拟节点创建真实的节点
    // 默认进行初始化流程
    patch(null, vnode, container) // 初始化、更新都会使用此方法进行
  }
  return {
    // 这里因为createApp是一个用户可以调用的api所以我们打算再次进行拆分拆到API的文件夹中
    createApp: createAppApi(render)
  }
}

// 框架流程都是将组件 => 虚拟DOM => 真实DOM => 挂载到页面
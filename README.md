# patchFlags 对不同动态节点进行描述

> 表示要比对哪些类型

## 性能优化

- 每次重新渲染 都要创建虚拟节点 createVnode 这个方法
- 静态变量提升 静态节点进行提取

## 事件缓存

- 缓存事件防止重新创建事件

> jsx 目的是为了灵活 （但是没有优化）

## Vue3 和 Vue2的对比

- 响应式原理 proxy - defineProperty
- Vue3 的diff算法(根据 patchFlag 做diff 最常递增子序列) 和 Vue2 (全量diff)
- compositionApi 将代码按照功能拆分 可以提取为函数方便复用 / options APi 需要将变量函数写到不同的位置
- Fragment 多个根节点支持 Teleport 传送门 Suspense 异步组件
- Vue3 ts -> Vue flow 相比更好的推断
- 自定义渲染器 createRenderer() 传入自己渲染的方法 好处是可以根据vue 核心来实现不同平台代码

## Vue3模板编译和Vue2模板编译有什么区别

> 编译流程:

- 对模板进行分析(词法分析生成token流 语法分析) => 生成ast树(就是一个对象用来描述语法本身)
- 做转化流程transform 主要是对动态节点进行标记 比如 指令 插槽 事件 属性  (即就是添加pathFlag)
- 代码生成 codegen -> 生成最终的代码

> block的概念：

- block的作用: 就是收集动态节点 (它自己下面所有的) 将树的递归拍平成了一个数组(dynamicChildren) 在进行比对的时候只需要比对收集的这个数组 不需要递归比对虚拟节点children 提高性能
在进行createVnode创建虚拟节点的时候会判断这个节点是不是动态的 如果是动态的话我们就需要让外层的block对其进行收集起来

diff 算法的特点 就是递归遍历 每次比较同一层 之前写全量比对

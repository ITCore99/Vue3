export const enum ShapeFlags {
  ELEMENT = 1, // 1
  FUNCTIONAL_COMPONENT = 1 << 1, // 2
  STATEFUL_COMPONENT = 1 << 2, // 4
  TEXT_CHILDREN = 1 << 3, // 8
  ARRAY_CHILDREN = 1 << 4, // 16
  SLOTS_CHILDREN = 1 << 5,
  COMPONENT = ShapeFlags.FUNCTIONAL_COMPONENT | ShapeFlags.STATEFUL_COMPONENT // 6
}
// 判断是不是组件 component 00000110 functional_component 00000010 stateful_component 00000100
// 00000110 & 00000010 => 2  00000110 & 00000100  => 4   00000110 & 00000001 => 0
// 由此可见与两种函数类型的与操作之后都是大于0与element与操作之后为0所以通过这样就可判断是元素韩式组件。
// 做权限判断和类型 位运算是最佳的实践方式
// 最常递增子序列（贪心算法+二分查找算法）
const arr = [2,3,1,5,6,8,7,9,4] // 算法就结果是 [ 2, 1, 8, 4, 6, 7 ] 个数是对的但是结果是不对的
// 如何找到正确的顺序序列: 我们每次放入的时候 都需要记住前一个人(的索引)是谁 然后跟着这个关系从最后一个(因为最大肯定在最后面最后一个肯定是正确的)往前找 最终找到正确的链 
/**
 * 大概算法流程：
 * 1、如果当前的数比最后一个大则直接插入到最后
 * 2、如果当前的数比最后一个小则采用二分查找在已经拍好序的列表中找到比当前数大的第一个元素替换 （ps 力 我觉的当前的数比最后一个小比倒数第二大的还才能替换这样才能保证是自递增的顺序 这个思路不对 可能后面都是小的会更有潜）
 * 
 * 1
 * 1 8
 * 1 5
 * 1 3
 * 1 3 4
 * 1 3 4 9
 * 1 3 4 7
 * 1 3 4 6 
 * 1 2 4 6 这个结果是不对的 但是格式没错的
 */
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
        // 循环结束start/end 就是找到位置 此时start等于end
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
console.log(getSequence(arr))
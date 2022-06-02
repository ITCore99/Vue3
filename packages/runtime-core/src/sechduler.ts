// 自定义我们的effect执行策略
const queue= []
export function queueJob(job) {
  if(!queue.includes(job)) { // 对任务进行去重处理
    queue.push(job)
    queueFrush() // 进行任务队列的刷新
  }
}

let isFulshing = false // 是否正在刷新中
// 刷新任务队列 这里的要求是不能频繁的执行
function queueFrush() {
  if(!isFulshing) {
    isFulshing = true
    // 使用微任务来进行异步更新 同步任务执行完毕之后来进行清空任务 
    Promise.resolve().then(flushJobs)
  }
}

// 清空任务
function flushJobs() {
  isFulshing = false
  // 清空时我们需要对job进行排序 根据调用的顺序依次刷新 当父子组件更新的时候 需要先父级更新在子组件进行更新
  // 父组件的effect的id小一些 所以对job进行排序
  queue.sort((a, b) => a.id - b.id)
  for(let i = 0; i < queue.length; i++) {
    const job = queue[i]
    job()
  }
  queue.length = 0
}
/**
 * 共享的方法
 */
const isObject = (value) => typeof value === 'object' && value !== null;
const extend = Object.assign;
const isArray = (value) => Array.isArray(value);
const isFunction = value => typeof value === 'function';
const isString = value => typeof value === 'string';
// 是不是一个整形的key 
const isIntegerKey = value => parseInt(value) + '' === value;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (target, key) => hasOwnProperty.call(target, key);
const hasChange = (oldValue, newValue) => oldValue !== newValue;

/**
 * effect 副作用函数
 * 注意effect不仅仅只有一个参数 它还有第二个参数
 * effect是响应式的可以做到数据变化 effect 重新执行
 */
function effect(fn, options = {}) {
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) { // lazy 属性为true 说明这个effect 是懒执行的
        effect(); // 默认先执行一次 
    }
    return effect;
}
let uid = 0;
let activeEffect = null; // 存储当前正在执行的effect
const effectStack = []; // 解决嵌套effect 出现依赖收集错误的问题
// 创建一个响应式的effect 作用是对effect进行二次的处理 添加一些标识
function createReactiveEffect(fn, options) {
    const reactiveEffect = function () {
        if (!effectStack.includes(reactiveEffect)) {
            try {
                effectStack.push(reactiveEffect);
                activeEffect = reactiveEffect;
                return fn(); // 进行依赖的收集
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    reactiveEffect.id = uid++; // effect标识 执行更新的时候用此标识对effect进行排序
    reactiveEffect._isEffect = true; // 用于标识这是一个effect
    reactiveEffect.raw = fn; // 保存原始的fn函数
    reactiveEffect.options = options; // 保存options配置项 注意这里会保存computed的scheduler
    return reactiveEffect;
}
const targetMap = new WeakMap();
// 进行依赖收集 operator 是一个标识
function track(target, type, key) {
    if (!activeEffect)
        return;
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
        depsMap.set(key, (deps = new Set()));
    }
    if (!deps.has(activeEffect)) {
        deps.add(activeEffect);
    }
}
/**
 * effect(() => { // effect1
 *  state.name ==> effect1
 *  effect(() => { // effect2
 *    state.age ==> effect2
 *  })
 *  state.address ==> effect2 这依赖收集出现了错误
 * })
 */
// 触发更新
function trigger(target, type, key, value, oldvalue) {
    // 如果这个属性没有收集过effect 则不需要任何的更新
    const depsMap = targetMap.get(target);
    if (!depsMap)
        return;
    // 将所有收集的effect 全部存在一个新的集合中(主要是对数组的lenth和下标effect整合) 最后在一起执行(使用set对effect进行去重)
    const effects = new Set();
    // 需要判断是不是修改的数组的长度 因为数组的长度影响比较大(就是当我们把数组的长度由100变为1 之前也收集了下标为3的依赖 
    // 那我们不仅要执行length的依赖也要执行下标为3的依赖)
    if (isArray(target) && key === 'length') { // 如果更改的长度小于收集的索引那么这个索引也许需要触发更新
        // 如果对应的长度有依赖收集则需要更新
        depsMap.forEach((deps, key) => {
            if (key === 'length' || key >= value) {
                add(deps);
            }
        });
    }
    else {
        // 对象数组 修改
        if (key !== undefined) { // (数组修改对象的新增修改) 这里对象的新增获取到deps是undefined不会添加到effects中 同时你也没使用到所以不需要触发
            const depsMap = targetMap.get(target);
            const deps = depsMap.get(key);
            add(deps);
        }
        switch (type) {
            case 0 /* ADD */: // 新增  
                if (isArray(target) && isIntegerKey(key)) { // 是数组并且修改是索引 这里需要触发length的更新
                    // 情况是这样的 app.innerHTML = state.arr  这样修改  state.arr[100] = 1
                    add(depsMap.get('length'));
                }
        }
    }
    // 将所有收集到的effect进行执行 更新页面
    effects.forEach((effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    });
    // 将deps 添加到effects中
    function add(deps) {
        if (deps) {
            deps.forEach(dep => {
                effects.add(dep);
            });
        }
    }
}

/**
 * 实现proxy的handlers
 * 需要注意的是要判断是不是仅读的 如果是仅读的话 在进行set是时候要进行报异常处理
 * 判断是是不是深度的
 */
// 创建一个getter
function createGetter(isReadonly = false, isShallow = false) {
    return function (target, key, receive) {
        const res = Reflect.get(target, key, receive);
        if (!isReadonly) {
            // 如果不是仅读 要收集依赖 仅读的 不能够修改所以不需要收集依赖 提高性能
            track(target, 0 /* GET */, key);
        }
        if (isShallow) {
            return res;
        }
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
const get = createGetter(false, false);
const shallowGet = createGetter(false, true);
const readonlyGet = createGetter(true, false);
const shallowReadonlyGet = createGetter(true, true);
// 创建一个setter
function createSetter(isShallow = false) {
    return function (target, key, value, receive) {
        const oldValue = target[key]; // 获取老值
        // 判断是不属性更新还是属性新增（需要分成两种情况判断数组还是对象）haskey为true则是修改否则为新增
        let hasKey = (isArray(target) &&
            isIntegerKey(key)) ? Number(key) < target.length : hasOwn(target, key);
        const res = Reflect.set(target, key, value, receive);
        // 触发依赖更新
        if (!hasKey) { //新增
            trigger(target, 0 /* ADD */, key, value);
        }
        else if (hasChange(oldValue, value)) { // 修改
            trigger(target, 1 /* SET */, key, value);
        }
        return res;
    };
}
const set = createSetter();
const shallowSet = createSetter(true);
// 仅读对象
const readonlyObj = {
    set(target, key, value) {
        console.log(`set on key ${key} is fail, because is readonly`);
    }
};
const mutableHandlers = {
    get,
    set
};
const shallowReactiveHandlers = {
    get: shallowGet,
    set: shallowSet
};
const readonlyHandlers = extend({
    get: readonlyGet,
}, readonlyObj);
const shallowReadonlyHandlers = extend({
    get: shallowReadonlyGet,
}, readonlyObj);

function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
}
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers);
}
// 用于存储代理过的对象 已经被代理过的对象将不在被代理
const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
// 创建一个响应式对象
function createReactiveObject(target, isReadonly, handlers) {
    if (!isObject(target)) {
        return target;
    }
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    const existProxy = proxyMap.get(target);
    if (existProxy) {
        return existProxy;
    }
    const proxy = new Proxy(target, handlers);
    proxyMap.set(target, proxy);
    return proxy;
}

function ref(value) {
    return createRef(value);
}
function shallowRef(value) {
    return createRef(value, true);
}
const convert = val => isObject(val) ? reactive(val) : val;
class RefImpl {
    rawValue;
    isShallow;
    _value; // 表示声明了没赋值
    __v_isRef = true; // 产生的实例会被添加这个属性 表示是一个ref
    constructor(rawValue, isShallow) {
        this.rawValue = rawValue;
        this.isShallow = isShallow;
        this._value = isShallow ? rawValue : convert(rawValue);
    }
    // 使用类的属性访问器 (这里通过babel转义之后就是es5的defineProperty)
    get value() {
        track(this, 0 /* GET */, 'value');
        return this._value;
    }
    set value(newValue) {
        if (hasChange(newValue, this.rawValue)) {
            this.rawValue = newValue;
            this._value = this.isShallow ? newValue : convert(newValue);
            trigger(this, 1 /* SET */, 'value', newValue);
        }
    }
}
// 创建一个ref
function createRef(rawValue, isShallow = false) {
    return new RefImpl(rawValue, isShallow);
}
// 注意由官方文档结果来 并不是RefImpl类的实例 而是这个新类的实例 所以toRef和Ref基本是没有任何关系
class ObjectRefImpl {
    taget;
    key;
    __v_isRef = true; // 标识是一个ref
    constructor(taget, key) {
        this.taget = taget;
        this.key = key;
    }
    get value() {
        // 注意这里没有响应式 对象是响应式的 代理之后就是响应式的 对象不是响应式的代理之后就不是响应式的
        // 因为这个对象已经是响应式的了 我们通过get和set也是对对象进行修改所以对象的相关依赖和收集和触发 所以这里不需要添加. 只要一層的代理
        return this.taget[this.key];
    }
    set value(newValue) {
        this.taget[this.key] = newValue;
    }
}
// 可以将一个对象的属性变为ref 返回一个ref
function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}
// 将一个对象的所有属性都转化为ref
function toRefs(target) {
    const res = isArray(target) ? new Array(target.length) : {};
    const keys = Object.keys(target);
    keys.forEach(key => {
        res[key] = toRef(target, key);
    });
    return res;
}

/**
 * computed 默认不执行 只有调用才会执行
 * 存在缓存 依赖的值不发生变化不执行 使用缓存
 * 当依赖的值发生了变化 不会立即执行 而是当下一次获取的时候在执行
 * 我们发现computed的值 使用的时候是可以.value的所以 应该是ref
 */
class ComputedRefImpl {
    setter;
    _dirty = true; // 缓存标识 默认为true即取值时不要使用缓存
    _value;
    effect;
    constructor(getter, setter) {
        this.setter = setter;
        // 计算属性默认产生一个effect使用effect来进行收集依赖
        this.effect = effect(getter, {
            lazy: true,
            scheduler: (effect) => {
                if (!this._dirty) {
                    this._dirty = true;
                    trigger(this, 1 /* SET */, 'value'); // 当有computed 有依赖的话去更新
                }
            }
        });
    }
    // 取值
    get value() {
        if (this._dirty) { // 只有脏的的时候才执行否则将缓存下来的老值进行返回
            this._value = this.effect();
            this._dirty = false;
        }
        track(this, 0 /* GET */, 'value'); // 有可能在effect中使用computed所以也要收集自己的依赖
        return this._value;
    }
    // 设置值
    set value(newValue) {
        this.setter(newValue); // 如果用户传递了set方法 会调用用户set方法
    }
}
function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = () => {
            console.warn('computed value must be is readOnly');
        };
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    return new ComputedRefImpl(getter, setter);
}

// 创建虚拟节点的核心
// h函数就是创建虚拟节点 h方法与此方法类似 h('div', { style: {color: '#f00'}, hello world})
const createVNode = function (type, props, children = null) {
    // 可以根据type来进行判断是组件还是元素
    const shapeFlag = isString(type) ?
        1 /* ELEMENT */ : isObject(type) ?
        4 /* STATEFUL_COMPONENT */ : 0;
    const vnode = {
        __v_isVnode: true,
        type,
        props,
        children,
        key: props && props.key,
        el: null,
        shapeFlag,
        componet: null, // 用来存放组件的实例
    };
    // 对孩子类型进行处理
    normalizeChild(vnode, children);
    return vnode;
};
function normalizeChild(vnode, children) {
    let type = vnode.type;
    if (children === null) ;
    else if (isArray(children)) { // 孩子是数组
        type = 16 /* ARRAY_CHILDREN */;
    }
    else { // 不考虑插槽 这里就是文本孩子
        type = 8 /* TEXT_CHILDREN */;
    }
    vnode.shapeFlag = vnode.shapeFlag | type;
}
const isVNode = val => val.__v_isVnode;
const TEXT = Symbol('text');
// 对于孩子是文本的进行处理成虚拟节点
function normalizeVNode(child) {
    if (isObject(child)) { // 说明是h方法创建的vnode的节点不用处理
        return child;
    }
    else if (isString(child)) {
        return createVNode(TEXT, null, String(child));
    }
}

/**
 * 流程：
 * 1、根据组件创建虚拟节点
 * 2、将容器和虚拟节点获取到后调用render进行渲染
 */
function createAppApi(render) {
    return function createApp(rootComponent, rootProps) {
        const app = {
            _props: rootProps,
            _component: rootComponent,
            _container: null,
            mount(container) {
                // 1、根据组件和属性生成虚拟节点
                const vnode = createVNode(rootComponent, rootProps);
                // 2、根据虚拟节点调用render函数来渲染
                render(vnode, container);
                app._container = container;
            }
        };
        return app;
    };
}

const publicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        if (key[0] === '$') { // 用户不能访问$开头的变量
            return;
        }
        // 取值时可以访问 setupState props
        const { setupState, props } = instance;
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        else {
            return undefined;
        }
    },
    set({ _: instance }, key, value) {
        const { setupState } = instance;
        if (hasOwn(setupState, key)) {
            setupState[key] = value;
        }
    }
};

// 组件中所有的方法
// 创建一个组件实例
function createInitialInstance(vnode) {
    // webComponent 组件必备的有属性和插槽
    const instance = {
        vnode,
        type: vnode.type,
        props: {},
        slots: {},
        setupState: {},
        ctx: {},
        isMounted: false,
        render: null
    };
    instance.ctx = { _: instance };
    return instance;
}
// 初始化启动组件
function setupComponent(instance) {
    const { props, children } = instance.vnode;
    // 根据props 解析出 props和attrs 更新到instance上
    instance.props = props; // 对应源码中 => initProps
    instance.children = children; // 插槽的解析 => initSlots
    // 判断当前是不是有状态的组件
    const isStateful = instance.vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */;
    if (isStateful) {
        // 调用实例的setup方法，用setup函数的返回值填充instance的setupState和render
        setupStatefulComponent(instance);
    }
}
// 缓存当前的组件实例
let currentInstance = null;
// 设置当前的instance
function setCurrentIntance(instance) {
    currentInstance = instance;
}
// 为用户暴露的instance 方法
function getCurrentInstance() {
    return currentInstance;
}
function setupStatefulComponent(instance) {
    // 1、属性的代理 方便用户访问 传递给render函数的参数  
    // 我什么不直接代理instance 是因为自己需要更新instance上的属性 并不需要走代理
    instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandlers);
    // 2、获取组件的类型 拿到组件的setup 方法
    const component = instance.type;
    const { setup } = component;
    if (setup) {
        currentInstance = instance;
        const setupContext = createContext(instance);
        const setupResult = setup(instance.props, setupContext);
        // 组件setup 执行完成之后将当前缓存的组件进行重置 保证生命周期只能在setup中使用
        currentInstance = instance;
        // 主要进行处理setup 返回值
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance); // 完成组件的启动
    }
}
// 创建一个组件的上下文
function createContext(instance) {
    return {
        attrs: instance.attrs,
        slots: instance.slots,
        emit: () => { },
        expose: () => { }
    };
}
// 完成组件的启动
function finishComponentSetup(instance) {
    const component = instance.type;
    let { render } = instance;
    if (!render) {
        if (!component.render && component.template) ;
        instance.render = component.render; // 如果组件中有render函数将render函数保存到实例上
    }
}
// 处理setup 返回值
function handleSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) { // 如果返回的是一个函数 则将作为render函数
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) { // 如果是对象则将返回的对象更新到setupState上 
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}

const onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
const onMounted = createHook("m" /* MOUNTED */);
const onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
const onUpdated = createHook("u" /* UPDATE */);
const onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNT */);
const omUnmounted = createHook("um" /* UNMOUNTED */);
// 创建钩子函数
function createHook(lifecycle) {
    return function (hook, target = currentInstance) {
        // 为当前实例增加对的生命周期
        injectHook(lifecycle, hook, target);
    };
}
function injectHook(type, hook, target) {
    if (!currentInstance) {
        console.warn('生命周期钩子' + 'hook' + '只能用到setup函数中');
    }
    else {
        const hooks = target[type] || (target[type] = []); // 数组有可能是多个相同的生命周期
        const warp = () => {
            setCurrentIntance(target); // currentInstance 是自己的 target 被保存到当前这个wrap的作用域下面 这样就保证了当孩子挂载完之后setcurrent指向孩子组件 执行父组件mounted的时候currentInstance不正确的问题
            hook.call(target);
            setCurrentIntance(null);
        };
        hooks.push(warp); // 保存的时候就知道当前生命周期是那个实例的
    }
}
// 调用函数
function invokeArrayFns(fns) {
    for (let i = 0; i < fns.length; i++) { // 和vue2 类似调用时让函数一次执行
        fns[i]();
    }
}

// 自定义我们的effect执行策略
const queue = [];
function queueJob(job) {
    if (!queue.includes(job)) { // 对任务进行去重处理
        queue.push(job);
        queueFrush(); // 进行任务队列的刷新
    }
}
let isFulshing = false; // 是否正在刷新中
// 刷新任务队列 这里的要求是不能频繁的执行
function queueFrush() {
    if (!isFulshing) {
        isFulshing = true;
        // 使用微任务来进行异步更新 同步任务执行完毕之后来进行清空任务 
        Promise.resolve().then(flushJobs);
    }
}
// 清空任务
function flushJobs() {
    isFulshing = false;
    // 清空时我们需要对job进行排序 根据调用的顺序依次刷新 当父子组件更新的时候 需要先父级更新在子组件进行更新
    // 父组件的effect的id小一些 所以对job进行排序
    queue.sort((a, b) => a.id - b.id);
    for (let i = 0; i < queue.length; i++) {
        const job = queue[i];
        job();
    }
    queue.length = 0;
}

/**
 * 渲染流程: 首先将组件转化为虚拟节点 根据虚拟节点进行挂载(patch) 在组建挂载的时候执行setup方法和渲染模板生成组件的render函数 render函数执行
 * 会返回此组件子树的虚拟节点 在根据子树虚拟执行patch方法挂载子树 最终挂载的整个流程。
 * 每个组件都是一个effect
 * @param renderOptions
 * @returns
 */
// 创建一个渲染器 这样写的好处是 如果我们要创建不同的渲染器只需要传递不同的renderOption即可实现
function createRenderer(renderOptions) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, remove: hostRemove, createText: hostCreateText, setElementText: hostSetElementText, insert: hostInsert, nextSibling: hostNextSibling } = renderOptions;
    // ------------ 处理 组件 --------------------
    // 执行render方法
    function setupRenderEffect(instance, container) {
        // 创建一个effect在effect中调用render函数，对这个render进行收集依赖
        // render中使用到变量发生变化会自执行render
        instance.update = effect(function componentEffect() {
            if (!instance.isMounted) {
                // 这是初次渲染
                let { bm, m } = instance;
                if (bm) {
                    invokeArrayFns(bm); // 执行beforMount 生命周期
                }
                const proxyToUser = instance.proxy;
                // 组件render初次渲染的vnode 
                // 在vue3中组件就叫vnode(是对组件的描述) 组件的真正渲染内容叫做subtree  对应vue2的 $vnode 和_vnoode 
                const subTree = instance.subTree = instance.render.call(proxyToUser, proxyToUser); // 别忘记传递参数并修改this指向
                // 初始化字树 用render函数返回值继续渲染
                patch(null, subTree, container);
                instance.isMounted = true;
                if (m) { // 有问题 mounted 要求是子组件挂载完毕之后才会调用自己 这里可能子组件还没挂载完毕
                    invokeArrayFns(m); // 执行Mounted 生命周期
                }
            }
            else {
                // 这是更新逻辑 依赖发生变化 则开始进行更新逻辑(diff算法)
                let { bu, u } = instance;
                if (bu) {
                    invokeArrayFns(bu); // 执行beforUpdate 生命周期
                }
                const proxyToUser = instance.proxy;
                const prevTree = instance.subTree; // 上一次的旧树
                const nextTree = instance.render.call(proxyToUser, proxyToUser); // 重新执行render方法创建获取到新树的vnode
                patch(prevTree, nextTree, container); // 进行patch方法的新老节点比对更新页面
                if (u) {
                    invokeArrayFns(u); // 执行onUpdated 生命周期
                }
            }
        }, {
            scheduler: (effect) => {
                // 通过scheduler来执行我们自定义的渲染函数 而不是执行收集到effect
                queueJob(effect);
            }
        });
    }
    // 挂载组件
    function mountComponent(initialVNode, container) {
        // 组件的渲染流程 核心是调用setup拿到返回值，获取render函数的返回值进行渲染
        // 1、创建一个实例
        const instance = initialVNode.component = createInitialInstance(initialVNode);
        // 2、将需要的数据解析到实例上
        setupComponent(instance); // 初始化组件 将数据全部放到实例上
        // 3、创建一个effect 让render函数执行
        setupRenderEffect(instance, container);
    }
    // 处理组件
    function processComponent(n1, n2, container) {
        if (n1 === null) { // 进行组件的初始化
            mountComponent(n2, container);
        }
    }
    // ------------ 处理 组件 End--------------------
    // ------------ 处理 元素 Start -----------------
    function mountChildren(children, container) {
        for (let i = 0; i < children.length; i++) {
            // 需要注意如果孩子是多个文本的话 多次调用setElementText时候 后一次会把前一次设置的文本覆盖掉
            const child = normalizeVNode(children[i]); // 文本处理成文本虚拟节点 解决覆盖问题
            patch(null, child, container);
        }
    }
    // 挂载元素
    function mountElement(vnode, container, anchor = null) {
        // 进行递归渲染
        const { props, shapeFlag, children, type } = vnode;
        const el = vnode.el = hostCreateElement(type);
        if (props) { // 添加属性
            for (let key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        if (shapeFlag & 8 /* TEXT_CHILDREN */) { // 孩子节点是文本 直接扔进去即可
            hostSetElementText(el, children);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) { // 孩子是一个数组
            mountChildren(children, el); // 可能出现 [文本， 文本] [文本， 虚拟节点] 等文本和虚拟节点的情况抽离方法处理
        }
        hostInsert(el, container, anchor);
    }
    // diff 算法比对儿子
    function patchKeyChildren(c1, c2, el) {
        // 对特殊情况进行优化(特殊情况就是首部或者尾部新增和删除)
        let i = 0; // 默认从头开始比对
        let e1 = c1.length - 1; // 尾指针
        let e2 = c2.length - 1; // 尾指针
        // sync from start 从头开始一个个比 遇到不同的就停止(尽可能较少比对区域) 旧 abcd 新 abde
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, el); // 比对属性和孩子
            }
            else {
                break;
            }
            i++;
        }
        // sync from end 从尾部开始一个个比
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, el); // 比对属性和孩子
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 同序列挂载 头尾添加删除
        // 如果完成后i > e1 说明新孩子有新增节点 老的少新的多 需要新增i和e2之间的元素
        if (i > e1) {
            if (i <= e2) { // 表示有新增的部分
                // 想知道是向前插入还是向后插入
                let anchor;
                const nextPos = e2 + 1; // 获取到e2的下一个位置
                if (nextPos >= c2.length) { // 则说明是从前往后比对 需要向后插入
                    anchor = null;
                }
                else { // 则说明是从后往前比对 需要向前插入
                    anchor = c2[nextPos].el; // 这里为什么是nextPos索引因为 这种是e2向左移动执行减操作 +1就是让e2加操作向右侧移动去上一个索引(表示说明e2是否移动过)
                }
                while (i <= e2) { // 循环新增节点
                    patch(null, c2[i], el, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) { // 老的多新的少
            while (i <= e1) { // 将老的多的进行删除
                unmount(c1[i]);
                i++;
            }
        }
        else {
            // 乱序比较 需要尽可能的复用  这已经是经过前面收尾智指针缩小范围之后的中间部分就是需要diff的部分把中间不相等部分做如下处理，遍历新的元素做一个映射表老的元素去里面找 一样的就复用 不一样的要不就插入要不就删除
            // 例如: abcdefg abecdhfg [5340]
            let s1 = i;
            let s2 = i;
            // 遍历新的元素将元素的key与索引进行映射
            const keyToNewIndexMap = new Map();
            for (let i = s2; i <= e2; i++) {
                const child = c2[i];
                keyToNewIndexMap.set(child.key, i);
            }
            // 将patch过元素进行记录下来 是为了知道哪些是新增元素
            const toBePatched = e2 - s2 + 1;
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0); // 将新的索引到老的索引进行记录 表明是已经patch过的(不是0的表示是已经patch过的是0的表明是没有patch过的是新增的元素)
            // 用老的新的map里面查找看有没有复用的
            for (let i = s1; i <= e1; i++) {
                const oldChild = c1[i];
                const newIndex = keyToNewIndexMap.get(oldChild.key);
                if (newIndex === undefined) { // 说明新的中没有需要删除
                    unmount(oldChild);
                }
                else { // 如果找到了 则去比较新旧节点以及孩子节点 (这里比较完了之后位置有问题)
                    // 新和旧的关系 索引关系
                    newIndexToOldIndexMap[newIndex - s2] = i + 1; // 减去s2是为了 将索引相对 s2的下标  为什么需要i+1因为如果正好为0的时候正好和我们的初始值一样，为了保证不一样我们需要+1 到时使用的时候记得减去即可
                    patch(oldChild, c2[newIndex], el);
                }
            }
            // [5 ,3,4, 0 ] => [1, 2] => []
            const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap); //求出最常的递增索引序列
            let j = increasingNewIndexSequence.length - 1; // 取出最后一项
            for (let i = toBePatched - 1; i >= 0; i--) { // 插入新增的元素 这里为什么是倒叙 是因为这样的话我们就可以插入的前一个元素作为要插入下一个元素的参照物
                const currentIndex = s2 + i; // 之前减去过s2 现在复原找到元素原本的位置 如例子所属的话就是h的索引
                let child = c2[currentIndex];
                let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null; // 获取下一项 如果存在则需要插入到下一项的前面如果不存在只需要插入到最后即可
                if (newIndexToOldIndexMap[i] === 0) { // 没有被patch过 是新增元素进行新增操作
                    patch(null, child, el, anchor);
                }
                else { // 操作当前的D 以D的先一个作为参照物插入 注意📢 这里else插入其实并不是插入而是移动位置 因为使用beforeInser或者appendChild插入一个已经存在的dom元素浏览器会将此元素从之前的位置移动到新的位置
                    if (i !== increasingNewIndexSequence[j]) { // 取出最后一个索引 不匹配则进行移动否则不进行移动(优化移动次数)
                        hostInsert(child.el, el, anchor); // 但是虽然浏览器可以帮我们移动但是如果之前的顺序和新的顺序有一部分是一致的 本不该移动但是还是全部插入移动 所以性能会稍微差点需要优化(最常递增子序列优化移动) 我们期望是尽可能的少移动
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    }
    // 求最长的递增子序列
    function getSequence(arr) {
        const len = arr.length;
        const result = [0]; // 里面放的是索引
        const p = arr.slice(0); // 里面内容无所谓 和原数组相同 用来存放前一个索引
        let start;
        let end;
        let middle;
        for (let i = 1; i < len; i++) {
            const arrI = arr[i];
            if (arrI !== 0) { // 当不为0的时候才开始操作因为 0 的表示的是新增元素 需要插入而不是排序
                const resultLastIndex = result[result.length - 1]; // 取最后一个索引
                if (arr[resultLastIndex] < arrI) { // 当前值大于最后一个
                    p[i] = resultLastIndex; // 记录前一个索引
                    result.push(i);
                    continue;
                }
                if (arr[resultLastIndex] > arrI) {
                    // 采用二分查找的方式进行 寻找最小的比当前数大的元素
                    start = 0;
                    end = result.length - 1;
                    while (start < end) { // 重合就说明找到
                        middle = Math.floor((start + end) / 2);
                        if (arr[result[middle]] < arrI) {
                            start = middle + 1;
                        }
                        else {
                            end = middle;
                        }
                    }
                    // 循环结束start/end 就是找到位置
                    if (arrI < arr[result[start]]) { // 找到比当前值大的一个数
                        if (start > 0) { // 索引0 没有前一项索引所以不赋值
                            p[i] = result[start - 1]; // 找到需要替换元素的前一个索引 TODO: 这里是不是可以是 p[i] = p[start]
                        }
                        result[start] = i; //用当前值替换找到的值
                    }
                }
            }
        }
        console.log('p=>', p);
        // 从最后一个元素开始遍历 根据前驱节点遍历输出整个链条
        let len1 = result.length; // 总的个数 之前说过这里的个数正确的
        let last = result[len1 - 1]; // 取到最后一项索引
        while (len1-- > 0) { //TODO: 这里的向前遍历没懂
            result[len1] = last;
            last = p[last];
        }
        return result;
    }
    // 卸载孩子
    function unmountChild(children) {
        for (let i = 0; i < children.length; i++) {
            unmount(children[i]);
        }
    }
    // 进行儿子的比对 (老的有儿子新的没儿子 新的有儿子老的没儿子 新的老的都有儿子 (进行diff对比))
    function patchChildren(n1, n2, el) {
        const c1 = n1.children;
        const c2 = n2.children;
        // 分别标识孩子的状况
        const prevShapFlag = n1.shapeFlag;
        const shapeFalg = n2.shapeFlag;
        if (shapeFalg && shapeFalg & 8 /* TEXT_CHILDREN */) { // 当前孩子是文本
            if (prevShapFlag && prevShapFlag & 16 /* ARRAY_CHILDREN */) { // 旧孩子是数组需要先进行卸载孩子这里不判断元素的原因是 虚拟节点孩子节点要么是字符串要么是数组(元素也会被处理为数组)
                unmountChild(c1); // 如果c1中包含组件会调用组件的卸载方法
            }
            // 两个都是文本
            if (c1 !== c2) {
                console.log(el, c2);
                hostSetElementText(el, c2);
            }
        }
        else { // 本次孩子是数组
            if (prevShapFlag && prevShapFlag & 16 /* ARRAY_CHILDREN */) { //  之前是数组 因为h函数在创建的时候一个也会被包裹为数组
                if (shapeFalg && shapeFalg & 16 /* ARRAY_CHILDREN */) { // 当前是数组 兼容万一传参错误的问题 所以加一层判断
                    // diff算
                    patchKeyChildren(c1, c2, el);
                }
                else { // 当前没有孩子 当前是null 特殊情况
                    unmountChild(c1); // 卸载之前的孩子
                }
            }
            else { // 之前是文本
                if (prevShapFlag && prevShapFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(el, ''); // 清空之前的文本
                }
                if (shapeFalg && shapeFalg & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, el); // 挂载当前孩子
                }
            }
        }
    }
    // 比对属性
    function patchProps(oldProps, newProps, el) {
        if (oldProps !== newProps) {
            for (let key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next);
                }
            }
            // 老的中有新的中没有则删除
            for (let key in oldProps) {
                const prev = oldProps[key];
                if (!(key in newProps)) {
                    hostPatchProp(el, key, prev, null);
                }
            }
        }
    }
    // 比对元素(更新元素)
    function patchElement(n1, n2, container) {
        // 元素是相同节点 需要复用节点
        const el = n2.el = n1.el;
        // 更新属性 
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        patchProps(oldProps, newProps, el);
        // 更新儿子
        patchChildren(n1, n2, el);
    }
    // 处理元素
    function processElement(n1, n2, container, anchor) {
        if (n1 === null) { // 元素挂载
            mountElement(n2, container, anchor);
        }
        else { // 元素更新
            console.log('进行元素更新逻辑');
            patchElement(n1, n2);
        }
    }
    // ------------ 处理 元素 End -----------------
    // ------------ 处理 文本 Start----------------
    function processText(n1, n2, container) {
        if (n1 === null) { // 文本挂载
            n2.el = hostCreateText(n2.children);
            hostInsert(n2.el, container);
        }
    }
    // ------------ 处理 文本 End----------------
    // 是不是同一个类型的虚拟节点
    function isSameVNodeType(n1, n2) {
        return n1.type === n2.type && n1.key === n2.key;
    }
    // 卸载(单独抽离出来是为了扩展 后期如果是组件的话 需要调用组件卸载时的生命周期等)
    function unmount(n1) {
        hostRemove(n1.el);
    }
    // 参数 n1: 老的虚拟节点 n2: 新的虚拟节点 
    function patch(n1, n2, container, anchor = null) {
        // 针对不同的类型做初始化方式
        const { shapeFlag, type } = n2;
        if (n1 && !isSameVNodeType(n1, n2)) { // 判断前后的虚拟节点是不是同一个类型的 不是同类型的不用进行diff比较直接替换
            // 首先删除掉n1元素 再挂载n2元素
            anchor = hostNextSibling(n1.el); // 获取元素的下一个兄弟节点作为参考点防止新增节点插入到container最后
            unmount(n1);
            n1 = null; // 设置为null 进入元素的挂载流程
        }
        switch (type) { // 后期有其他类型也可以在这里进行扩展
            case TEXT:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) { // 是一个元素
                    processElement(n1, n2, container, anchor);
                }
                else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) { // 是一个组件
                    processComponent(n1, n2, container);
                }
                break;
        }
    }
    // 渲染函数core核心函数 作用可以将一个虚拟节点挂载到一个容器上
    const render = function (vnode, container) {
        // 根据不同的虚拟节点创建真实的节点
        // 默认进行初始化流程
        patch(null, vnode, container); // 初始化、更新都会使用此方法进行
    };
    return {
        // 这里因为createApp是一个用户可以调用的api所以我们打算再次进行拆分拆到API的文件夹中
        createApp: createAppApi(render)
    };
}
// 框架流程都是将组件 => 虚拟DOM => 真实DOM => 挂载到页面

// h 函数创建虚拟节点
const h = function (type, propsOrChildren, children = null) {
    const l = arguments.length;
    if (l === 2) { // 类型 + 属性 或者是 类型 + 孩子
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
            if (isVNode(propsOrChildren)) { // 是虚拟节点 则是孩子
                return createVNode(type, null, [propsOrChildren]);
            }
            else { // 是属性
                return createVNode(type, propsOrChildren);
            }
        }
        else { // 第二个参数不是对象一定是孩子
            return createVNode(type, null, propsOrChildren);
        }
    }
    else {
        if (l > 3) {
            children = Array.prototype.slice.call(null, 2);
        }
        else if (l === 3 && isVNode(children)) {
            children = [children];
        }
        return createVNode(type, propsOrChildren, children);
    }
};

const nodeOps = {
    // createElement 不同的平台创建的方式不一样 这里我们先不考虑 只用管浏览器的就行
    createElement(tagName) {
        return document.createElement(tagName);
    },
    // 删除元素
    remove(el) {
        const parent = el.parentNode;
        if (parent) {
            parent.removeChild(el);
        }
    },
    // 元素的插入
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor); // 如果参照物为null的话 等同于appendChild
    },
    // 查询
    querySelector(selector) {
        return document.querySelector(selector);
    },
    // 设置元素内容
    setElementText(el, text) {
        el.textContent = text;
    },
    // 创建文本
    createText(text) {
        return document.createTextNode(text);
    },
    // 设置文本内容
    setText(node, text) {
        node.nodeValue = text;
    },
    // 获取下一个兄弟节点
    nextSibling(el) {
        return el.nextSibling;
    }
};

// 对元素设置属性
const patchAttr = (el, key, value) => {
    if (value === null) {
        el.removeAttribute(key);
    }
    else {
        el.setAttribute(key, value);
    }
};

// 处理比对类名
const patchClass = (el, value) => {
    if (value === null) {
        value = '';
    }
    // value = Object.keys(value).filter(key => value[key]).join(' ')
    el.className = value;
};

// 比对处理一些事件
const patchEvent = (el, key, value) => {
    // 注意这里的技巧 平常我们要修改addEventLister绑定的方法是 先移除再绑定 但是有点麻烦
    // 这里我们使用一个变量来存放函数，每次去绑定一个匿名函数在这个匿名函数函数中调用这个引用，所以每次修改的时候只需要修改引用就行。
    // 对原函数进行缓存
    const invokers = el._vei || (el._vei = {});
    const exist = invokers[key];
    if (value && exist) { // 需要对事件进行更新
        exist.value = value;
    }
    else {
        const eventName = key.slice(2).toLowerCase(); // 获取事件名
        if (value) { // 需要绑定事件 之前没有进行绑定过
            const invoker = invokers[key] = createInvoker(value);
            el.addEventListener(eventName, invoker);
        }
        else { // value 不存在需要移除
            if (exist) {
                el.removeEventListener(eventName, exist);
                invokers[key] = null;
            }
        }
    }
};
// 创建一个匿名的invoker
function createInvoker(value) {
    const invoker = (e) => {
        invoker.value(e);
    };
    invoker.value = value; // 这里进行保存 修改的时候只需要修改这个引用就可以
    return invoker;
}

// 对比更新属性
const patchStyle = (el, prev, next) => {
    const style = el.style; // 获取样式
    if (next === null) { // 新的里面没有需要全部删除
        el.removeAttribute('style');
    }
    else {
        if (prev) { // 如果老的存在
            for (let key of Object.keys(prev)) {
                if (next[key] === null) { // 新的中没有需要删除
                    style[key] = '';
                }
            }
        }
        // 对于新的值全部进行设置
        for (let key of Object.keys(next)) {
            style[key] = next[key];
        }
    }
};

// 这里是针对属性操作 是一系列的属性操作
const patchProp = (el, key, prevValue, nextValue) => {
    switch (key) {
        case 'class':
            patchClass(el, nextValue); // 使用最新的将之前的覆盖掉
            break;
        case 'style':
            patchStyle(el, prevValue, nextValue);
            break;
        default:
            // 如果不是事件才是属性
            if (/^on[^a-z]/.test(key)) { // 判断是不是事件 事件写法onClick
                patchEvent(el, key, nextValue);
            }
            else {
                patchAttr(el, key, nextValue); // 这里调用的方式不是和2.0那样是需要attr包裹而是直接写所以直接赋值即可
            }
            break;
    }
};

// runtime-dom核心就是提供dom操作Api
// 节点操作 增删改查
// 样式操作 增加、删除、更新、类、事件、其他属性
// 需要将nodeOps和patchProp进行整合 渲染的时候会使用到
const renderOptions = extend({}, nodeOps, { patchProp });
// 用户调用的是runtime-dom runtime-dom 调用runtime-core 
// runtimedom(浏览器) 是为了解决平台差异
// vue中runtime-core里面提供了核心的方法 用来处理渲染 会使用runtime-dom中的api来进行渲染(这样写的好处将dom和core层分开)
function createApp(rootComponent, rootProps = null) {
    const app = createRenderer(renderOptions).createApp(rootComponent, rootProps);
    const { mount } = app;
    // 重写mount方法 添加自己的逻辑
    app.mount = function (selector) {
        // 这是进行对容器的清空
        const container = nodeOps.querySelector(selector);
        container.innerHTML = '';
        // 调用createRender中的mount方法
        mount(container);
        // 将组建渲染成Dom元素 进行挂载
    };
    return app;
}

export { computed, createApp, createRenderer, effect, getCurrentInstance, h, invokeArrayFns, omUnmounted, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, reactive, readonly, ref, renderOptions, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=runtime-dom.esm-bundler.js.map

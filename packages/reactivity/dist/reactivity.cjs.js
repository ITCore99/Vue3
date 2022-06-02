'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * 共享的方法
 */
const isObject = (value) => typeof value === 'object' && value !== null;
const extend = Object.assign;
const isArray = (value) => Array.isArray(value);
const isFunction = value => typeof value === 'function';
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
        if (key !== undefined) { // (数组修改对象的新增修改) 这里对象的新增获取到deps是undefined不会添加到effects中 同时也没你也没使用到所以不需要触发
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

exports.computed = computed;
exports.effect = effect;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.toRef = toRef;
exports.toRefs = toRefs;
//# sourceMappingURL=reactivity.cjs.js.map

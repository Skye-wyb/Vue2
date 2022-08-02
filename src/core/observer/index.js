/* @flow */

import Dep from "./dep";
import VNode from "../vdom/vnode";
import { arrayMethods } from "./array";
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
} from "../util/index";

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true;

/**
 *
 * @param {*} value
 */
export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  /**
   * ! observer的实例对象有三个属性:value dep vmCount
   *            ! 两个实例方法:walk和observerArray
   *
   */
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  /**
   *
   * @param {*接收参数为数据对象(要观测的数据对象)} value
   */
  constructor(value: any) {
    // observer实例对象的value引用了数据对象
    this.value = value;
    // observer实例对象的dep属性,保存了一个新创建的Dep实例对象
    this.dep = new Dep();
    this.vmCount = 0;
    /**
     * * 为数据对象定义一个__ob__属性,值为当前Observer实例对象
     * * def 函数是对Object.definedProperty函数的简单封装
     */
    // todo 可以定义不可枚举的属性,后面遍历数据对象时,能够防止遍历到__ob__属性
    def(value, "__ob__", this);
    // 判断数据对象是一个数组还是一个纯对象
    // * 数据对象为数组
    /**
     * push pop shift unshift splice sort reverse
     */
    if (Array.isArray(value)) {
      // ? protoAugment和copyAugment函数的目的都是：把数组实例与代理原型或与代理原型中定义的函数联系起来，从而拦截数组变异方法
      // ! hasProto是一个布尔值，用于检测当前环境是否可以使用__proto__属性
      if (hasProto) {
        // ! value：数组实例  arrayMethods：代理原型
        protoAugment(value, arrayMethods);
      } else {
        // 不支持__proto__属性
        // todo arrayKeys：定义在arrayMethods对象上的所有函数的键，即所要拦截的数组变异方法的名称
        copyAugment(value, arrayMethods, arrayKeys);
      }
      // * 数组中嵌套了数组或对象使用使用push等方法不是响应的，observeArray解决上述问题
      this.observeArray(value);
    } else {
      // * 数据对象为纯对象
      // 执行walk函数
      this.walk(value);
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: Object) {
    // 获取所有可枚举属性
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      // ?遍历所有属性,同时为每个属性调用了defineReactive函数
      defineReactive(obj, keys[i]);
    }
  }

  /**
   * Observe a list of Array items.
   */
  // ? 使数组中嵌套的数组或对象同样是响应式的数据，递归观测类型为数组或对象的数组元素
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// ! 设置target的__proto__属性，让其指向一个代理原型，从而做到拦截
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src;
  /* eslint-enable no-proto */
}

// ! protoAugment和copyAugment函数的目的都是：把数组实例与代理原型或与代理原型中定义的函数联系起来，从而拦截数组变异方法
/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
/**
 * 
 * @param {*} target 
 * @param {*} src 
 * @param {*} keys  
 */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/**
 *
 * @param {*要观测的数据} value
 * @param {*布尔值,代表要被观测的数据是否为根级数据} asRootData
 * @returns
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // 判断是否为一个对象或者VNode实例
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  // * 判断要检测的value对象身上是否有__ob__属性,且__ob__属性应该是Observer的实例
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    // * 当一个数据对象被观测之后将会在该对象上定义 __ob__ 属性,所以这里的if分支是为了避免重复观测一个数据对象
    ob = value.__ob__;
  } else if (
    // 代表一个开关:如果为true则代表打开了开关,此时可以对数据进行观测,为false则不会对数据进行观测
    shouldObserve &&
    // 用于判断是否是服务端渲染,只有当不是服务端渲染时才回观测数据
    !isServerRendering() &&
    // 只有当数据数组或者纯对象时,才有必要对其进行观测
    (Array.isArray(value) || isPlainObject(value)) &&
    // 被观测的数据必须是可扩展的
    Object.isExtensible(value) &&
    // Vue实例对象有_isVue属性,避免Vue实例对象被观测
    !value._isVue
  ) {
    // 创建一个Observer实例
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 */
/**
 * 
 * @param {*对象} obj 
 * @param {*属性键名} key 
 * @param {*属性值} val 
 * @param {*} customSetter 
 * @param {*} shallow 
 * @returns 
 */
// ! defineReactive函数的核心是:将数据对象的数据属性转为访问器属性
// 即为数据对象的属性设置一对getter/setter
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 定义Dep实例对象
  const dep = new Dep();

  // Object.getOwnPropertyDescriptor函数获取该字段可能已有的属性描述对象
  const property = Object.getOwnPropertyDescriptor(obj, key);
  // 判断该属性是否可配置
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters
  // 缓存属性原有的getter和setter
  // * 因为下面会通过defineProperty函数重新定义属性的setter、getter，会导致属性原有的setter、getter被覆盖，所以需要在重新定义的set、get方法中调用缓存的getter、setter
  const getter = property && property.get;
  const setter = property && property.set;
  // ? 只传有两个参数时，需要根据key主动去对象上获取相应的值
  /**
   * * !getter || setter
   * 
   */
  // * 当没有传递第三个参数val，自然需要去obj上获取
  // * 当属性拥有自己的getter时不会对其进行深度观测：
  // * 原因（1）由于存在原来的getter时在深度观测之前不会取值，取不到属性值则无法进行深度观测 （2）若getter由用户自己定义，防止用户在getter中有意想不到的行为
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }

  // ! val本身可能也是一个对象需要继续调用observer函数观测该对象，从而深度观测数据对象
  // * !shallow为false表示开启深度观测，为该函数传入的第五个参数
  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    /**
     * * get函数的作用：正确的返回属性值以及收集依赖
     * @returns 
     */
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      if (Dep.target) { // ? Dep.target中保存的值就是要被收集的依赖（观察者），为true代表有依赖需要被收集，false代表无
        // 收集依赖
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
          if (Array.isArray(value)) {
            // ? 数组元素为对象时，无法触发响应
            dependArray(value);
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      // * set函数：当属性被修改时如何触发依赖
      // * 2件事：正确的为属性设置新值，而能够触发相应的依赖
      const value = getter ? getter.call(obj) : val;
      /* eslint-disable no-self-compare */
      // 存在新值、旧值都为NaN的情况，NaN自相反
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== "production" && customSetter) {
        customSetter();
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return;
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = !shallow && observe(newVal);
      dep.notify();
    },
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
/**
 * 
 * @param {* 要被添加属性的对象} target 
 * @param {* 要添加属性的键名} key 
 * @param {* 要添加属性的值} val 
 * @returns 
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (
    process.env.NODE_ENV !== "production" &&
    /**
     * ? isUndef：判断一个值是否是undefined或null
     * ? isPrimitive：判断一个值是否是原始类型值
     */
    (isUndef(target) || isPrimitive(target))
  ) {
    // 理论上只能给对象添加属性（或只能给数组添加元素）
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  // ! isvalidArrayIndex：用于判断给定变量的值是否为有效的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 修改数组的长度
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }
  // target不是数组是一个纯对象
  if (key in target && !(key in Object.prototype)) {  // * 保证key在target对象上或target对象的原型链上，但同时不能在Object.prototype上
    target[key] = val;
    return val;
  }
  // 定义了ob常量，是数据对象__ob__属性的引用
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    // * 不能满足(ob && ob.vmCount) ：代表不允许在根数据对象添加属性，因为永远触发不了依赖，因为根数据对象的Observer实例收集不到依赖
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid adding reactive properties to a Vue instance or its root $data " +
          "at runtime - declare it upfront in the data option."
      );
    return val;
  }
  if (!ob) {
    target[key] = val;
    return val;
  }
  // ? 设置属性值，保证新添加的属性是响应式的
  defineReactive(ob.value, key, val);
  // * 触发响应
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 */
/**
 * 
 * @param {* 将要被删除属性的目标对象} target 
 * @param {* 要删除属性的键名} key 
 * @returns 
 */
export function del(target: Array<any> | Object, key: any) {
  if (
    process.env.NODE_ENV !== "production" &&
    // 检测是不是undefined或null或是原始类型值
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  // ? 数组类型且是有效的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // * 使用splice方法移除元素，可以触发响应
    target.splice(key, 1);
    return;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    // todo 不能满足(ob && ob.vmCount) ：代表不允许在根数据对象删除属性，因为永远触发不了依赖，因为根数据对象的Observer实例收集不到依赖
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid deleting properties on a Vue instance or its root $data " +
          "- just set it to null."
      );
    return;
  }
  // todo 检测key是否为target对象自身拥有的属性
  if (!hasOwn(target, key)) {
    return;
  }
  // ? 删除key
  delete target[key];
  // todo 如果ob不存在则证明原本不是响应的直接返回，否则证明target对象是响应的要触发响应
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    // * 如果该元素值拥有ob对象和ob.dep对象，则说明该元素也是一个对象或数组，手动执行ob.dep.depend()达到收集依赖的目的
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      // * 若数组元素仍然是一个数组则继续递归
      dependArray(e);
    }
  }
}

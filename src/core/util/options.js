/* @flow */

import config from "../config";
import { warn } from "./debug";
import { set } from "../observer/index";
import { unicodeRegExp } from "./lang";
import { nativeWatch, hasSymbol } from "./env";

import { ASSET_TYPES, LIFECYCLE_HOOKS } from "shared/constants";

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject,
} from "shared/util";

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * 选项覆盖策略是处理如何将父选项值和子选项值合并到最终值的函数。
 * value into the final value.
 */
// 定义一个策略对象
const strats = config.optionMergeStrategies;

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== "production") {
  // 非生产环境下strats策略对象上添加两个策略（属性）：el，propsData，且这两个属性的值为一个函数
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
          "creation with the `new` keyword."
      );
    }
    return defaultStrat(parent, child);
  };
}

/**
 * Helper that recursively merges two data objects together.
 */
// 合并Data策略
function mergeData(to: Object, from: ?Object): Object {
  // 没有from直接返回to
  if (!from) return to;
  let key, toVal, fromVal;

  const keys = hasSymbol ? Reflect.ownKeys(from) : Object.keys(from);

  // 遍历from的key
  for (let i = 0; i < keys.length; i++) {
    key = keys[i];
    // in case the object is already observed...
    if (key === "__ob__") continue;
    toVal = to[key];
    fromVal = from[key];
    // 如果from对象中的key不在to对象中，则使用set函数为to对象设置key以及相应的值
    if (!hasOwn(to, key)) {
      set(to, key, fromVal);
    } else if (
      // 如果from对象中的key也在to对象中，且这两个属性的值都是纯对象则递归进行深度合并
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal);
    }
  }
  return to;
}

/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 子组件选项
    // in a Vue.extend merge, both should be functions
    // 选项是在调用Vue.extend函数时进行合并处理的，此时父子data选项都应该是函数
    if (!childVal) {
      // 子组件无data选项，例如Vue.extend({})
      return parentVal;
    }
    if (!parentVal) {
      // 父组件无data选项
      return childVal;
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn() {
      return mergeData(
        typeof childVal === "function" ? childVal.call(this, this) : childVal,
        typeof parentVal === "function" ? parentVal.call(this, this) : parentVal
      );
    };
  } else {
    return function mergedInstanceDataFn() {
      // instance merge
      const instanceData =
        typeof childVal === "function" ? childVal.call(vm, vm) : childVal;
      const defaultData =
        typeof parentVal === "function" ? parentVal.call(vm, vm) : parentVal;
      if (instanceData) {
        return mergeData(instanceData, defaultData);
      } else {
        return defaultData;
      }
    };
  }
}
// 在strats策略对象上添加data策略函数，用于合并处理data选项
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 如果没有传递vm参数，那么处理的就是子组件的选项
    if (childVal && typeof childVal !== "function") {
      // 子组件中的data必须是一个返回对象的函数
      process.env.NODE_ENV !== "production" &&
        warn(
          'The "data" option should be a function ' +
            "that returns a per-instance value in component " +
            "definitions.",
          vm
        );

      return parentVal;
    }
    return mergeDataOrFn(parentVal, childVal);
  }

  // 当能拿到vm参数时
  return mergeDataOrFn(parentVal, childVal, vm);
};

/**
 * Hooks and props are merged as arrays.
 */
// 合并生命周期钩子函数
function mergeHook(
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  /**
   * return (是否有 childVal，即判断组件的选项中是否有对应名字的生命周期钩子函数)
        ? 如果有 childVal 则判断是否有 parentVal
         ? 如果有 parentVal 则使用 concat 方法将二者合并为一个数组
         : 如果没有 parentVal 则判断 childVal 是不是一个数组
            ? 如果 childVal 是一个数组则直接返回
            : 否则将其作为数组的元素，然后返回数组
        : 如果没有 childVal 则直接返回 parentVal
   */
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
      ? childVal
      : [childVal]
    : parentVal;
  return res ? dedupeHooks(res) : res;
}

// 去除重复的钩子函数
function dedupeHooks(hooks) {
  const res = [];
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i]);
    }
  }
  return res;
}

LIFECYCLE_HOOKS.forEach((hook) => {
  strats[hook] = mergeHook;
});

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
// 资源选项的合并策略（directives、filters、components）
function mergeAssets(
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  // 以parentVal为原型创建对象res
  const res = Object.create(parentVal || null);
  if (childVal) {
    process.env.NODE_ENV !== "production" &&
    // 检测childVal是不是一个纯对象
      assertObjectType(key, childVal, vm);
    // 使用extend函数将childVal上的属性混合到res对象上并返回
    return extend(res, childVal);
  } else {
    // 没有childVal对象则直接返回
    return res;
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + "s"] = mergeAssets;
});

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
// 选项watch的合并策略函数
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // Firefox中Object.prototype拥有一个原生的watch属性，所以这里是当发现组件选项是浏览器原生的watch时，则用户没有提供watch选项，置为undefined
  if (parentVal === nativeWatch) parentVal = undefined;
  if (childVal === nativeWatch) childVal = undefined;
  /* istanbul ignore if */
  // 检测是否有childVal，即组件选项是否有watch选项，若没有则直接以parentVal为原型创建对象并返回
  if (!childVal) return Object.create(parentVal || null);
  if (process.env.NODE_ENV !== "production") {
    // 检测childVal是不是一个纯对象
    assertObjectType(key, childVal, vm);
  }
  if (!parentVal) return childVal;
  // 定义ret常量，其值为一个对象
  const ret = {};
  // 将parentVal的属性混合到ret中，后面的处理都是ret对象，最后返回的也是ret对象
  extend(ret, parentVal);
  // 遍历childVal
  for (const key in childVal) {
    // 由于遍历的是childVal，所以key是子选项的key，父选项中未必能获取到值，所以parent未必有值
    let parent = ret[key];
    // child肯定是有值的，因为遍历的就是childVal本身
    const child = childVal[key];
    // if分支的作用是：如果parent存在就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent];
    }
    ret[key] = parent
    // 如果parent存在，此时的parent是数组，直接concat child
      ? parent.concat(child)
      // 如果parent不存在，则将child转为数组返回
      : Array.isArray(child)
      ? child
      : [child];
  }
  // 最后返回新的ret对象
  return ret;
};

/**
 * Other object hashes.
 */
// props、methods、inject、computed的合并策略
strats.props =
  strats.methods =
  strats.inject =
  strats.computed =
    function (
      parentVal: ?Object,
      childVal: ?Object,
      vm?: Component,
      key: string
    ): ?Object {
      if (childVal && process.env.NODE_ENV !== "production") {
        // 判断childVal是不是纯对象
        assertObjectType(key, childVal, vm);
      }
      // parentVal无值，直接返回childVal
      if (!parentVal) return childVal;
      // 创建一个原型为null的新对象
      const ret = Object.create(null);
      // 给新对象身上混合parentVal的相关选项
      extend(ret, parentVal);
      // 如果有childVal，给ret新对象混合childVal的相关选项，此时如果父子选项中有相同的键，子选项会把父选项覆盖掉
      if (childVal) extend(ret, childVal);
      // 返回新的带有扩展属性的ret对象
      return ret;
    };
// 选项provide的合并策略（与data的合并策略类似）
strats.provide = mergeDataOrFn;

/**
 * Default strategy.
 */
// 默认策略（当一个选项不需要进行特殊的处理时就是用默认的合并策略）：只要子选项不是undefined就使用子选项，否则使用父选项
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined ? parentVal : childVal;
};

/**
 * Validate component names
 */
// 用于校验组件的名字是否符合要求
function checkComponents(options: Object) {
  for (const key in options.components) {
    validateComponentName(key);
  }
}
// 真正校验名字的函数
export function validateComponentName(name: string) {
  // 组件的名字要满足正则表达式：/^[a-zA-Z][\w-]*$/
  /**
   * 限定组件的名字由普通字符和中横线-组成，且必须以字母开头
   */
  if (
    !new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)
  ) {
    warn(
      'Invalid component name: "' +
        name +
        '". Component names ' +
        "should conform to valid custom element name in html5 specification."
    );
  }
  // 要满足：isBuiltInTag(name) || config.isReservedTag(name) 不成立，否则warn
  /**
   * isBuiltInTag(name)作用是：检测你所注册的组件是否是内置的标签：slot、component被Vue视为内置标签，不能够使用
   * isReservedTag(name)作用是：检测是否为保留标签
   */
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      "Do not use built-in or reserved HTML elements as component " +
        "id: " +
        name
    );
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
// 规范化props
function normalizeProps(options: Object, vm: ?Component) {
  const props = options.props;
  // 若选项中无props选项，则直接return
  if (!props) return;
  // 有props选项
  // res用于保存规范化后的结果
  const res = {};
  let i, val, name;
  // 用于判断开发者在使用props，到底是使用字符串数组还是使用纯对象书写的props
  if (Array.isArray(props)) {
    // 如果是字符串数组的形式
    i = props.length;
    while (i--) {
      val = props[i];
      // props数组中的元素必须是字符串形式的，否则在生产环境下生成一个警告
      if (typeof val === "string") {
        // camelize函数:将中横线转为驼峰
        name = camelize(val);
        // 实现字符串数组的规范化
        res[name] = { type: null };
      } else if (process.env.NODE_ENV !== "production") {
        warn("props must be strings when using array syntax.");
      }
    }
  } else if (isPlainObject(props)) {
    // props选项不是数组而是对象
    // isPlainObject:判断是否一个纯对象
    /**
     * props: {
      // 第一种写法，直接写类型,主要是规范化这种类型的props
      someData1: Number,
      // 第二种写法，对象
      someData2: {
        type: String,
        default: ''
      }
    }
     */
    for (const key in props) {
      val = props[key];
      name = camelize(key);
      res[name] = isPlainObject(val) ? val : { type: val };
    }
  } else if (process.env.NODE_ENV !== "production") {
    // 当传入了一个props,但既不是数组类型也不是对象类型时,发出警告
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
        `but got ${toRawType(props)}.`,
      // toRawType():获取传递的props的真实数据类型
      vm
    );
  }
  // 将res赋值给options的props属性，使用res覆盖了原有的options.props
  options.props = res;
}

/**
 * Normalize all injections into Object-based format
 */
// 规范化inject
function normalizeInject(options: Object, vm: ?Component) {
  // inject变量缓存options.inject
  const inject = options.inject;
  // 判断是否传递了inject
  if (!inject) return;
  // 重写options.inject为一个空的JSON对象，并定义了一个为空JSON对象的变量normalized
  // normalized和options.inject有相同的引用，修改时互相影响
  const normalized = (options.inject = {});
  if (Array.isArray(inject)) {
    // inject选项是数组形式
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] };
    }
  } else if (isPlainObject(inject)) {
    // inject选项是一个纯对象
    for (const key in inject) {
      const val = inject[key];
      normalized[key] = isPlainObject(val)
        ? // 若是纯对象使用extend混合
          extend({ from: key }, val)
        : { from: val };
    }
  } else if (process.env.NODE_ENV !== "production") {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
        `but got ${toRawType(inject)}.`,
      vm
    );
  }
}

/**
 * Normalize raw function directives into object format.
 */
// 规范化自定义指令
function normalizeDirectives(options: Object) {
  const dirs = options.directives;
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key];
      if (typeof def === "function") {
        // 将函数形式自定义指令规范化为对象形式的自定义指令
        dirs[key] = { bind: def, update: def };
      }
    }
  }
}
// 检测value是不是一个纯对象，若不是会给出一个警告
function assertObjectType(name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
        `but got ${toRawType(value)}.`,
      vm
    );
  }
}

/**
 * Merge two option objects into a new one.
 * 合并两个选项对象为一个新对象
 * Core utility used in both instantiation and inheritance.
 * 这个函数在实例化和继承时均有使用
 */
export function mergeOptions(
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== "production") {
    checkComponents(child);
  }

  //  Vue 构造函数本身就拥有这个options属性，其实通过 Vue.extend 创造出来的子类也是拥有这个属性的。所以这就允许我们在进行选项合并的时候，去合并一个 Vue 实例构造者的选项了。
  if (typeof child === "function") {
    child = child.options;
  }

  // 规范化props
  normalizeProps(child, vm);
  normalizeInject(child, vm);
  normalizeDirectives(child);

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  // 处理extends选项和mixins选项
  if (!child._base) {
    if (child.extends) {
      // 存在extends选项递归调用mergeOptions函数合并parent和child.extends
      parent = mergeOptions(parent, child.extends, vm);
    }
    /**
     * mixins用于解决代码复用的问题
     */
    if (child.mixins) {
      // mixins是一个数组的形式，所以需要遍历
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm);
      }
    }
  }

  const options = {};
  let key;
  /**
   * 如果parent是Vue.options：
   * Vue.options = {
        components: {
          KeepAlive,
          Transition,
          TransitionGroup
        },
        directives:{
          model,
          show
        },
        filters: Object.create(null),
        _base: Vue
    }
   */
  for (key in parent) {
    mergeField(key);
  }
  for (key in child) {
    // hasOwn()：用于判断key属性是否是parent身上的属性，若parent上已经有key属性，可不需要再重读调用mergeField函数
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  // 将parent的属性，child的属性合并到最终的函数（合并特定选项的函数）
  function mergeField(key) {
    const strat = strats[key] || defaultStrat;
    options[key] = strat(parent[key], child[key], vm, key);
  }
  return options;
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== "string") {
    return;
  }
  const assets = options[type];
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id];
  const camelizedId = camelize(id);
  if (hasOwn(assets, camelizedId)) return assets[camelizedId];
  const PascalCaseId = capitalize(camelizedId);
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId];
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId];
  if (process.env.NODE_ENV !== "production" && warnMissing && !res) {
    warn("Failed to resolve " + type.slice(0, -1) + ": " + id, options);
  }
  return res;
}

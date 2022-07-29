/* not type checking this file because flow doesn't play well with Proxy */

import config from "core/config";
import { warn, makeMap, isNative } from "../util/index";

// 声明initProxy变量
let initProxy;

if (process.env.NODE_ENV !== "production") {
  // allowedGlobals 函数的作用是判断给定的 key 是否出现在上面字符串中定义的关键字中的。
  const allowedGlobals = makeMap(
    "Infinity,undefined,NaN,isFinite,isNaN," +
      "parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent," +
      "Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt," +
      "require" // for Webpack/Browserify
  );

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
        "referenced during render. Make sure that this property is reactive, " +
        "either in the data option, or for class-based components, by " +
        "initializing the property. " +
        "See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.",
      target
    );
  };

  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
        'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
        "prevent conflicts with Vue internals. " +
        "See: https://vuejs.org/v2/api/#data",
      target
    );
  };

  const hasProxy = typeof Proxy !== "undefined" && isNative(Proxy);

  // 检测是否支持Proxy
  if (hasProxy) {
    // isBuiltInModifier 函数用来检测是否是内置的修饰符
    const isBuiltInModifier = makeMap(
      "stop,prevent,self,ctrl,shift,alt,meta,exact"
    );
    // 为 config.keyCodes 设置 set 代理，防止内置修饰符被覆盖
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(
            `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
          );
          return false;
        } else {
          target[key] = value;
          return true;
        }
      },
    });
  }

  const hasHandler = {
    has(target, key) {
      // has常量是真实经过in运算符得来的结果
      const has = key in target;
      // 如果key在allowedGlobals之内,或者key是以下划线_开头的字符串且key不是target的data对象的属性
      const isAllowed =
        allowedGlobals(key) ||
        (typeof key === "string" &&
          key.charAt(0) === "_" &&
          !(key in target.$data));
      if (!has && !isAllowed) {
        // has和allowed都为假,则打印错误
        if (key in target.$data) warnReservedPrefix(target, key);
        // 警告信息提示你“在渲染的时候引用了 key，但是在实例对象上并没有定义 key 这个属性或方法”。
        else warnNonPresent(target, key);
      }
      return has || !isAllowed;
    },
  };

  const getHandler = {
    get(target, key) {
      if (typeof key === "string" && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key);
        else warnNonPresent(target, key);
      }
      return target[key];
    },
  };

  // 初始化initProxy
  // initProxy 的目的，就是设置渲染函数的作用域代理，其目的是为我们提供更好的提示信息。
  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options;
      const handlers =
        options.render && options.render._withStripped
          ? getHandler
          : hasHandler;
      vm._renderProxy = new Proxy(vm, handlers);
    } else {
      vm._renderProxy = vm;
    }
  };
}
// 导出initProxy
export { initProxy };

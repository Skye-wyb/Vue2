/* @flow */

import config from "../config";
import { initUse } from "./use";
import { initMixin } from "./mixin";
import { initExtend } from "./extend";
import { initAssetRegisters } from "./assets";
import { set, del } from "../observer/index";
import { ASSET_TYPES } from "shared/constants";
import builtInComponents from "../components/index";
import { observe } from "core/observer/index";

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive,
} from "../util/index";

export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  const configDef = {};
  configDef.get = () => config;
  if (process.env.NODE_ENV !== "production") {
    configDef.set = () => {
      warn(
        "Do not replace the Vue.config object, set individual fields instead."
      );
    };
  }
  Object.defineProperty(Vue, "config", configDef);

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 在Vue上添加util属性，是一个对象，对象拥有四个属性
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive,
  };

  Vue.set = set;
  Vue.delete = del;
  Vue.nextTick = nextTick;

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj);
    return obj;
  };
  {
    /* Vue.options目前是一个空对象 */
  }
  Vue.options = Object.create(null);
  {
    /* 经过下面的代码，Vue.options不是一个空对象了 */
  }
  {
    /* ASSET_TYPES 来自于 shared/constants.js 文件，打开这个文件，发现 ASSET_TYPES 是一个数组，
    export const ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ] 
  */
  }
  {/* //?给Vue.options上添加三个属性：components、directives、filters，都是一个空对象 */}
  ASSET_TYPES.forEach((type) => {
    Vue.options[type + "s"] = Object.create(null);
  });

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.

  Vue.options._base = Vue;
  {
    /* 上述代码执行后，Vue.options变为以下形式：//* Vue.options = {
  //* components: Object.create(null),
  //* directives: Object.create(null),
  //* filters: Object.create(null),
  //* _base: Vue
} */
  }

  {
    /* //todo 将 builtInComponents对象身上的属性混合到Vue.options.components对象身上 
    export function extend (to: Object, _from: ?Object): Object {
      for (const key in _from) {
        to[key] = _from[key]
      }
      return to
    }
*/
  }
  extend(Vue.options.components, builtInComponents);
  {
    /* // !Vue.options.components对象为：
  ! Vue.options.components = {
  !   KeepAlive
  ! }
  */
  }
  {
    /* 最终Vue.options变为以下形式：
    Vue.options = {
      components: {
        KeepAlive
      },
      directives: Object.create(null),
      filters: Object.create(null),
      _base: Vue
    }
  */
  }

  initUse(Vue);
  initMixin(Vue);
  initExtend(Vue);
  initAssetRegisters(Vue);
}

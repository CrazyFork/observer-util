import { proxyToRaw, rawToProxy } from './internals'
import { storeObservable } from './store'
import * as builtIns from './builtIns'
// :todo, 没有循环引用么, 还是es6 的module system 能自动判断解除循环引用
import baseHandlers from './handlers'

export function observable (obj = {}) {
  // if it is already an observable or it should not be wrapped, return it
  if (proxyToRaw.has(obj) || !builtIns.shouldInstrument(obj)) {
    return obj
  }
  // if it already has a cached observable wrapper, return it
  // otherwise create a new observable
  return rawToProxy.get(obj) || createObservable(obj)
}

function createObservable (obj) {
  // if it is a complex built-in object or a normal object, wrap it
  const handlers = builtIns.getHandlers(obj) || baseHandlers
  const observable = new Proxy(obj, handlers)
  // save these to switch between the raw object and the wrapped object with ease later
  // :todo, 
  // :Q, would WeakMap create a circlar reference here that causes memory leak?
  // if not, why?
  // :A, after seeing a WeakMap ployfill, these two line definitely created a circule refs. 
  rawToProxy.set(obj, observable)
  proxyToRaw.set(observable, obj)
  // init basic data structures to save and cleanup later (observable.prop -> reaction) connections
  storeObservable(obj)
  return observable
}

export function isObservable (obj) {
  return proxyToRaw.has(obj)
}

export function raw (obj) {
  return proxyToRaw.get(obj) || obj
}

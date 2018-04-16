## Overview
我读这个库的目的就是为了理解mobx是如何运作的(mobx我也读过, 但是代码太复杂了, 就放弃了). 这个库代码量相对来说少些,
也更加容易我理解里边的精髓.

这个库的工作方式:
核心的原理就是通过Proxy来instrument obj, 拦截 get, set. 所有 mutation 会触发以 {target, key, } 为ID
的Set<Reaction> 的执行. 而 Reaction 仅仅是一个函数包装了最核心的 runAsReaction, 又这个函数执行最终的调度.



```js
import { observable, observe } from '@nx-js/observer-util'
// 这段代码将 {num: 0} 转换成了 observable 对象返回了, 底层会将 {num:0} 为key生成一个 value 为 
// object[key]:Set<Reaction> 的 WeakMap 的值, 
const counter = observable({ num: 0 })
// observe 会将传递进来的 function 转换成 Reaction, 然后立即执行一次 Reaction. 会调用 runAsReaction
// 将当前 Reaction 设置为 runningReaction, 然后在执行到 conter.num 的时候, 会将这个 runningReaction
// add 到 {num:0} 为 key 的, 值为 object[key]:Set<Reaction> 中, 然后执行 counter.num++, 会调用 Proxy
// 的 set instrument 方法, 里边会通过 `queueReactionsForOperation` 将所有 {target, key} 为id 的所有
// Reaction 执行, 包括刚刚注册过的. 执行完之后, 又会调用 counter 的 getter 方法, 再一次将 running reaction
// 加入到 Reaction<Set> 中, 等待下次mutation.
// 可以看出, 这个库目前性能上就是在一个Reaction中有多个 observable 对象改变的时候, Reaction 会被执行多次.
const countLogger = observe(() => console.log(counter.num))

// this calls countLogger and logs 1
counter.num++
```






```
// file structure

src
├── builtIns
│   ├── collections.js      # proxy instrumentations for Set/Map collection
│   └── index.js            # 
├── handlers.js             # basic proxy instruments other than collection
├── index.js                # 
├── internals.js            # define two mapping object. used for get ref from & to: obj <-> proxied
├── observable.js           # create a observable instance
├── observer.js             # observe or unobserve reactions.
├── reactionRunner.js       # for running reaction & schedule reaction
└── store.js                # central storage for reactions.

```


## store.js
```
// central storage for reactions
connectionStore: Map<obj, object<key, Set<Reaction>>>


```

## Glossary
* `Reaction`

  * type: `Function`
    ```
    .cleaners: Array<Set<Reaction>>, 存放反向链接, 到 target[key] 的 reaction set
    .debugger: (operation)->(), 
    .scheduler: Set<Reaction> | (Reaction)->(), schedule reaction 
    .unobserved: boolean, whether or not this reaction is been unobserved.
    ```

  * defination, defined in observer.js

    ```js
    const reaction = fn[IS_REACTION]
      ? fn
      : function reaction () {
        return runAsReaction(reaction, fn, this, arguments) // pass this through
      }
    ```

* `operation`
  * type: 
    ```
    { 
      target: any, 目标raw 对象, 没有被 Proxy instrumented 过的
      key: string, raw 对象的属性值
      value: any,
      oldValue: any,
      type: 'has'| 'add' | 'clear' | 'iterate' | 'set' | 'delete' | 'get' 
    }
    ```

## notes
*

```
const globalObj = Function("return this")();
```

## todos
* WeakMap ? WeakSet? and how it's been implemented.
* registerRunningReactionForOperation, queueReactionsForOperation 这两个方法的区别
  * 感觉是读的时候用 `registerRunningReactionForOperation` 写的时候用 `queueReactionsForOperation`, but why ?
  
  * `registerRunningReactionForOperation`
    * 这个方法才会给对应的属性加上 reaction, 

  * `queueReactionsForOperation`:
    * 这个方法会在属性mutation的时候执行, 主要是执行(默认行为)`registerRunningReactionForOperation`添加的 reaction.
    * 这意味着所有的监听都是以 mutation push 的.




# The Observer Utility

Transparent reactivity with 100% language coverage. Made with :heart: and ES6 Proxies.

[![Build](https://img.shields.io/circleci/project/github/nx-js/observer-util/master.svg)](https://circleci.com/gh/nx-js/observer-util/tree/master) [![Coverage Status](https://coveralls.io/repos/github/nx-js/observer-util/badge.svg)](https://coveralls.io/github/nx-js/observer-util) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![Package size](http://img.badgesize.io/https://unpkg.com/@nx-js/observer-util/dist/umd.es6.min.js?compression=gzip&label=minzip_size)](https://unpkg.com/@nx-js/observer-util/dist/umd.es6.min.js)  [![Version](https://img.shields.io/npm/v/@nx-js/observer-util.svg)](https://www.npmjs.com/package/@nx-js/observer-util) [![dependencies Status](https://david-dm.org/nx-js/observer-util/status.svg)](https://david-dm.org/nx-js/observer-util) [![License](https://img.shields.io/npm/l/@nx-js/observer-util.svg)](https://www.npmjs.com/package/@nx-js/observer-util)

<details>
<summary><strong>Table of Contents</strong></summary>
<!-- Do not edit the Table of Contents, instead regenerate with `npm run build-toc` -->

<!-- toc -->

* [Motivation](#motivation)
* [Bindings](#bindings)
* [Installation](#installation)
* [Usage](#usage)
  + [Observables](#observables)
  + [Reactions](#reactions)
  + [Reaction scheduling](#reaction-scheduling)
* [API](#api)
  + [Proxy = observable(object)](#proxy--observableobject)
  + [boolean = isObservable(object)](#boolean--isobservableobject)
  + [reaction = observe(function, config)](#reaction--observefunction-config)
  + [unobserve(reaction)](#unobservereaction)
  + [obj = raw(observable)](#obj--rawobservable)
* [Platform support](#platform-support)
* [Alternative builds](#alternative-builds)
* [Contributing](#contributing)

<!-- tocstop -->

</details>

## Motivation

Popular frontend frameworks - like Angular, React and Vue - use a reactivity system to automatically update the view when the state changes. This is necessary for creating modern web apps and staying sane at the same time.

The Observer Utililty is a similar reactivity system, with a modern twist. It uses [ES6 Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to achieve true transparency and a 100% language coverage. Ideally you would like to manage your state with plain JS code and expect the view to update where needed. In practice some reactivity systems require extra syntax - like React's `setState`. Others have limits on the language features, which they can react on - like dynamic properties or the `delete` keyword. These are small nuisances, but they lead to long hours lost among special docs and related issues.

The Observer Utility aims to eradicate these edge cases. It comes with a tiny learning curve and with a promise that you won't have to dig up hidden docs and issues later. Give it a try, things will just work.

## Bindings

This is a framework independent library, which powers the reactivity system behind other state management solutions. These are the currently available bindings.

- [React Easy State](https://github.com/solkimicreb/react-easy-state) is a state management solution for React with a minimal learning curve.

## Installation

```
$ npm install @nx-js/observer-util
```

## Usage

The two building blocks of reactivity are **observables** and **reactions**. Observable objects represent the state and reactions are functions, that react to state changes. In case of transparent reactivity, these reactions are called automatically on relevant state changes.

### Observables

Observables are transparent Proxies, which can be created with the `observable` function. From the outside they behave exactly like plain JS objects.

```js
import { observable } from '@nx-js/observer-util'

const counter = observable({ num: 0 })

// observables behave like plain JS objects
counter.num = 12
```

### Reactions

Reactions are functions, which use observables. They can be created with the `observe` function and they are automatically executed whenever the observables - used by them - change.

#### Vanilla JavaScript

```js
import { observable, observe } from '@nx-js/observer-util'

const counter = observable({ num: 0 })
const countLogger = observe(() => console.log(counter.num))

// this calls countLogger and logs 1
counter.num++
```

#### React Component

```js
import { store, view } from 'react-easy-state'

// this is an observable store
const counter = store({
  num: 0,
  up () {
    this.num++
  }
})

// this is a reactive component, which re-renders whenever counter.num changes
const UserComp = view(() => <div onClick={counter.up}>{counter.num}</div>)
```

#### More examples

<details>
<summary>Dynamic properties</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const profile = observable()
observe(() => console.log(profile.name))

// logs 'Bob'
profile.name = 'Bob'
```

</details>
<details>
<summary>Nested properties</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const person = observable({
  name: {
    first: 'John',
    last: 'Smith'
  },
  age: 22
})

observe(() => console.log(`${person.name.first} ${person.name.last}`))

// logs 'Bob Smith'
person.name.first = 'Bob'
```

</details>
<details>
<summary>Computed properties</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const person = observable({
  firstName: 'Bob',
  lastName: 'Smith',
  get name () {
    return `${firstName} ${lastName}`
  }
})

observe(() => console.log(person.name))

// logs 'Ann Smith'
observable.firstName = 'Ann'
```

</details>
<details>
<summary>Conditionals</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const person = observable({
  gender: 'male',
  name: 'Potato'
})

observe(() => {
  if (person.gender === 'male') {
    console.log(`Mr. ${person.name}`)
  } else {
    console.log(`Ms. ${person.name}`)
  }
})

// logs 'Ms. Potato'
person.gender = 'female'
```

</details>
<details>
<summary>Arrays</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const users = observable([])

observe(() => console.log(users.join(', ')))

// logs 'Bob'
users.push('Bob')

// logs 'Bob, John'
users.push('John')

// logs 'Bob'
users.pop()
```

</details>
<details>
<summary>ES6 collections</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const people = observable(new Map())

observe(() => {
  for (let [name, age] of people) {
    console.log(`${name}, ${age}`)
  }
})

// logs 'Bob, 22'
people.set('Bob', 22)

// logs 'Bob, 22' and 'John, 35'
people.set('John', 35)
```

</details>
<details>
<summary>Inherited properties</summary>

```js
import { observable, observe } from '@nx-js/observer-util'

const defaultUser = observable({
  name: 'Unknown',
  job: 'developer'
})
const user = observable(Object.create(defaultUser))

// logs 'Unknown is a developer'
observe(() => console.log(`${user.name} is a ${user.job}`))

// logs 'Bob is a developer'
user.name = 'Bob'

// logs 'Bob is a stylist'
user.job = 'stylist'

// logs 'Unknown is a stylist'
delete user.name
```

</details>

### Reaction scheduling

Reactions are scheduled to run whenever the relevant observable state changes. The default scheduler runs the reactions synchronously, but custom schedulers can be passed to change this behavior. Schedulers are usually functions which receive the scheduled reaction as argument.

```js
import { observable, observe } from '@nx-js/observer-util'

// this scheduler delays reactions by 1 second
const scheduler = reaction => setTimeout(reaction, 1000)

const person = observable({ name: 'Josh' })
observe(() => console.log(person.name), { scheduler })

// this logs 'Barbie' after a one second delay
person.name = 'Barbie'
```

Alternatively schedulers can be objects with an `add` and `delete` method. Check out the below examples for more.

#### More examples

<details>
<summary>React Scheduler</summary>

The React scheduler simply calls `setState` on relevant observable changes. This delegates the render scheduling to React Fiber. It works roughly like this.

```js
import { observe } from '@nx-js/observer-util'

class ReactiveComp extends BaseComp {
  constructor () {
    // ...
    this.render = observe(this.render, {
      scheduler: () => this.setState()
    })
  }
}
```

</details>
<details>
<summary>Batched updates with ES6 Sets</summary>

Schedulers can be objects with an `add` and `delete` method, which schedule and unschedule reactions. ES6 Sets can be used as a scheduler, that automatically removes duplicate reactions.

```js
import { observable, observe } from '@nx-js/observer-util'

const reactions = new Set()
const person = observable({ name: 'Josh' })
observe(() => console.log(person), { scheduler: reactions })

// this throttles reactions to run with a minimal 1 second interval
setInterval(() => {
  reactions.forEach(reaction => reaction())
}, 1000)

// these will cause { name: 'Barbie', age: 30 } to be logged once
person.name = 'Barbie'
person.age = 87
```

</details>
<details>
<summary>Batched updates with queues</summary>

Queues from the [Queue Util](https://github.com/nx-js/queue-util) can be used to implement complex scheduling patterns by combining automatic priority based and manual execution.

```js
import { observable, observe } from '@nx-js/observer-util'
import { Queue, priorities } from '@nx-js/queue-util'

const scheduler = new Queue(priorities.LOW)
const person = observable({ name: 'Josh' })
observe(() => console.log(person), { scheduler })

// these will cause { name: 'Barbie', age: 30 } to be logged once
// when everything is idle and there is free time to do it
person.name = 'Barbie'
person.age = 87
```

Queues are automatically scheduling reactions - based on their priority - but they can also be stopped, started and cleared manually at any time. Learn more about them [here]().
</details>

## API

### Proxy = observable(object)

Creates and returns a proxied observable object, which behaves just like the originally passed object. The original object is **not modified**.

- If no argument is provided, it returns an empty observable object.
- If an object is passed as argument, it wraps the passed object in an observable.
- If an observable object is passed, it returns the passed observable object.

### boolean = isObservable(object)

Returns true if the passed object is an observable, returns false otherwise.

### reaction = observe(function, config)

Wraps the passed function with a reaction, which behaves just like the original function. The reaction is automatically scheduled to run whenever an observable - used by it - changes. The original function is **not modified**.

`observe` also accepts an optional config object with the following options.

- `lazy`: A boolean, which controls if the reaction is executed when it is created or not. If it is true, the reaction has to be called once manually to trigger the reactivity process. Defaults to false.

- `scheduler`: A function, which is called with the reaction when it is scheduled to run. It can also be an object with an `add` and `delete` method - which schedule and unschedule reactions. The default scheduler runs the reaction synchronously on observable mutations. You can learn more about reaction scheduling in the [related docs section](#reaction-scheduling).

- `debugger`: An optional function. It is called with contextual metadata object on basic operations - like set, get, delete, etc. The metadata object can be used to determine why the operation wired or scheduled the reaction and it always has enough data to reverse the operation. The debugger is always called before the scheduler.

### unobserve(reaction)

Unobserves the passed reaction. Unobserved reactions won't be automatically run anymore.

```js
import { observable, observe, unobserve } from '@nx-js/observer-util'

const counter = observable({ num: 0 })
const logger = observe(() => console.log(counter.num))

// after this the logger won't be automatically called on counter.num changes
unobserve(logger)
```

### obj = raw(observable)

Original objects are never modified, but transparently wrapped by observable proxies. `raw` can access the original non-reactive object. Modifying and accessing properties on the raw object doesn't trigger reactions.

#### Using `raw` at property access

```js
import { observable, observe, raw } from '@nx-js/observer-util'

const person = observable()
const logger = observe(() => console.log(person.name))

// this logs 'Bob'
person.name = 'Bob'

// `name` is used from the raw non-reactive object, this won't log anything
raw(person).name = 'John'
```

#### Using `raw` at property mutation

```js
import { observable, observe, raw } from '@nx-js/observer-util'

const person = observable({ age: 20 })
observe(() => console.log(`${person.name}: ${raw(person).age}`))

// this logs 'Bob: 20'
person.name = 'Bob'

// `age` is used from the raw non-reactive object, this won't log anything
person.age = 33
```

## Platform support

- Node: 6.5 and above
- Chrome: 49 and above
- Firefox: 38 and above
- Safari: 10 and above
- Edge: 12 and above
- Opera: 36 and above
- IE is not supported

## Alternative builds

This library detects if you use ES6 or commonJS modules and serve the right format to you. The exposed bundles are transpiled to ES5 to support common tools - like UglifyJS minifying. If you would like a finer control over the provided build, you can specify them in your imports.

- `@nx-js/observer-util/dist/es.es6.js` exposes an ES6 build with ES6 modules.
- `@nx-js/observer-util/dist/es.es5.js` exposes an ES5 build with ES6 modules.
- `@nx-js/observer-util/dist/cjs.es6.js` exposes an ES6 build with commonJS modules.
- `@nx-js/observer-util/dist/cjs.es5.js` exposes an ES5 build with commonJS modules.

If you use a bundler, set up an alias for `@nx-js/observer-util` to point to your desired build. You can learn how to do it with webpack [here](https://webpack.js.org/configuration/resolve/#resolve-alias) and with rollup [here](https://github.com/rollup/rollup-plugin-alias#usage).

## Contributing

Contributions are always welcomed! Just send a PR for fixes and doc updates and open issues for new features beforehand. Make sure that the tests and the linter pass and that
the coverage remains high. Thanks!

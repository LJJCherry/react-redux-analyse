### redux 源码分析

### 前言

项目基于 create-react-app 创建, 在此基础上引入了 redux、将 react-redux 6.0.1 的版本直接下载下来放到了项目的 src 目录，方便调试（打个 console 看看）

### react-redux 应用结构：

![undefined](https://intranetproxy.alipay.com/skylark/lark/0/2019/png/105555/1566013342127-6c2b4824-2e46-4773-a273-1fbb7b522aa0.png)
react-redux 主要就是完成了这两件事情
第一，提供 Provider 组件通过 context 方式向应用注入 store，使子节点可以获取到 state。
第二，使用 connect 高阶方法，获取并监听 store，然后根据 store state 和组件自身 props 计算得到新 props，注入该组件，并且可以通过监听 store，比较计算出的新 props 判断是否需要更新组件

### 源码解读

#### Provider

![undefined](https://intranetproxy.alipay.com/skylark/lark/0/2019/png/105555/1566045306704-7fb26c03-c729-48ee-a612-924727728f7c.png)
Provider： 接收从 redux 而来的 store，以供子组件使用,同时在 Provider 组件中注册了 store 的监听，核心就是调用`store.subscribe`。

#### connect

react 高阶组件，当组件需要获取或者想要改变 store 的时候使用,通常的使用方法。
connect(mapStateToProps,mapDispatchToProps)(App);
实际上它的 api 长这样：

```
function connect(mapStateToProps?, mapDispatchToProps?, mergeProps?, options?)`
```

`mapStateToProps?: (state, ownProps?) => Object` 正常我们用到的都是第一个参数，当 store 变化的时候，会被调用，第二个参数是组件的 props，如果添加了第二个参数，除了 store 变化的时候调用，每次父组件传入的 props 变化的时候也会被调用。
`mergeProps?: (stateProps, dispatchProps, ownProps) => Object` : 如果指定了这个参数，mapStateToProps() 与 mapDispatchToProps() 的执行结果和组件自身的 props 将传入到这个回调函数中。该回调函数返回的对象将作为 props 传递到被包装的组件中
** Connect 的源码**

```
export function createConnect({
  connectHOC = connectAdvanced,
  mapStateToPropsFactories = defaultMapStateToPropsFactories,
  mapDispatchToPropsFactories = defaultMapDispatchToPropsFactories,
  mergePropsFactories = defaultMergePropsFactories,
  selectorFactory = defaultSelectorFactory
} = {}) {
  return function connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    {
      pure = true,
      areStatesEqual = strictEqual,
      areOwnPropsEqual = shallowEqual,
      areStatePropsEqual = shallowEqual,
      areMergedPropsEqual = shallowEqual,
      ...extraOptions
    } = {}
  ) {
    const initMapStateToProps = match(mapStateToProps, mapStateToPropsFactories, 'mapStateToProps')
    const initMapDispatchToProps = match(mapDispatchToProps,mapDispatchToPropsFactories, 'mapDispatchToProps')
    const initMergeProps = match(mergeProps, mergePropsFactories, 'mergeProps')

    return connectHOC(selectorFactory, {
      // used in error messages
      methodName: 'connect',

      // used to compute Connect's displayName from the wrapped component's displayName.
      getDisplayName: name => `Connect(${name})`,

      // if mapStateToProps is falsy, the Connect component doesn't subscribe to store state changes
      shouldHandleStateChanges: Boolean(mapStateToProps),

      // passed through to selectorFactory
      // selectorFactory的传参
      initMapStateToProps,
      initMapDispatchToProps,
      initMergeProps,
      pure,
      areStatesEqual,
      areOwnPropsEqual,
      areStatePropsEqual,
      areMergedPropsEqual,

      // any extra options args can override defaults of connect or connectAdvanced
      ...extraOptions
    })
  }
}

export default createConnect()

```

这段我们可以知道，connect 是对 connectHOC（connectAdvanced）的封装，connectAdvanced 使用了 selectorFactory，来创建 selector, 选择器（selector）的作用就是计算 mapStateToProps，mapDispatchToProps, ownProps（来自父组件的 props）的结果，并将结果传给子组件 props。这样子组件可以通过 this.props 拿到 mapStateToProps 等的结果。

#### selectFactory

```
export default function finalPropsSelectorFactory(
  dispatch,
  { initMapStateToProps, initMapDispatchToProps, initMergeProps, ...options }
) {
  const mapStateToProps = initMapStateToProps(dispatch, options)
  const mapDispatchToProps = initMapDispatchToProps(dispatch, options)
  const mergeProps = initMergeProps(dispatch, options)

  if (process.env.NODE_ENV !== 'production') {
    verifySubselectors(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options.displayName
    )
  }

  const selectorFactory = options.pure
    ? pureFinalPropsSelectorFactory
    : impureFinalPropsSelectorFactory

  return selectorFactory(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    dispatch,
    options
  )
}
```

- 当 pure: true, selectorFactory 使用 pureFinalPropsSelectorFactory
- 当 pure: false，selectorFactory 使用 impureFinalPropsSelectorFactory
  **impureFinalPropsSelectorFactory**

```
export function impureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch
) {
  return function impureFinalPropsSelector(state, ownProps) {
    return mergeProps(
      mapStateToProps(state, ownProps),
      mapDispatchToProps(dispatch, ownProps),
      ownProps
    )
  }
}
```

直接传入返回新的 props

```
export function pureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  let hasRunAtLeastOnce = false
  let state
  let ownProps
  let stateProps
  let dispatchProps
  let mergedProps

  function handleFirstCall(firstState, firstOwnProps) {
    state = firstState
    ownProps = firstOwnProps
    stateProps = mapStateToProps(state, ownProps)
    dispatchProps = mapDispatchToProps(dispatch, ownProps)
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    hasRunAtLeastOnce = true
    return mergedProps
  }

  function handleNewPropsAndNewState() {
    stateProps = mapStateToProps(state, ownProps)

    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)

    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewProps() {
    if (mapStateToProps.dependsOnOwnProps)
      stateProps = mapStateToProps(state, ownProps)

    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)

    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewState() {
    const nextStateProps = mapStateToProps(state, ownProps)
    const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps)
    stateProps = nextStateProps

    if (statePropsChanged)
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps)

    return mergedProps
  }

  function handleSubsequentCalls(nextState, nextOwnProps) {
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    const stateChanged = !areStatesEqual(nextState, state)
    state = nextState
    ownProps = nextOwnProps

    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    return mergedProps
  }

  return function pureFinalPropsSelector(nextState, nextOwnProps) {
    return hasRunAtLeastOnce
      ? handleSubsequentCalls(nextState, nextOwnProps)
      : handleFirstCall(nextState, nextOwnProps)
  }
}
```

根据最后的返回得出：
当第一次运行时，执行 handleFirstCall, 将三个 map 函数运行一遍，并将结果缓存下来
第二次运行时，执行 handleSubsequentCalls, 将新的值和缓存下来的值进行比较，如果没有变化就返回直接的 mergeProps，如果有变化就返回新的 mergeProps

#### connectAdvanced

```
export default function connectAdvanced(
  selectorFactory,
  // options object:
  {
    getDisplayName = name => `ConnectAdvanced(${name})`,
    methodName = 'connectAdvanced',
    // ...
    ...connectOptions
  } = {}
) {

  const Context = context

  const wrappedComponentName =
      WrappedComponent.displayName || WrappedComponent.name || 'Component'

    const displayName = getDisplayName(wrappedComponentName)

    const selectorFactoryOptions = {
      ...connectOptions,
      getDisplayName,
      methodName,
      renderCountProp,
      shouldHandleStateChanges,
      storeKey,
      displayName,
      wrappedComponentName,
      WrappedComponent
    }

    const { pure } = connectOptions

    let OuterBaseComponent = Component

    if (pure) {
      OuterBaseComponent = PureComponent
    }

    function makeDerivedPropsSelector() {
      let lastProps
      let lastState
      let lastDerivedProps
      let lastStore
      let lastSelectorFactoryOptions
      let sourceSelector

      return function selectDerivedProps(
        state,
        props,
        store,
        selectorFactoryOptions
      ) {
        if (pure && lastProps === props && lastState === state) {
          return lastDerivedProps
        }

        if (
          store !== lastStore ||
          lastSelectorFactoryOptions !== selectorFactoryOptions
        ) {
          lastStore = store
          lastSelectorFactoryOptions = selectorFactoryOptions
          sourceSelector = selectorFactory(
            store.dispatch,
            selectorFactoryOptions
          )
        }

        lastProps = props
        lastState = state

        const nextProps = sourceSelector(state, props)

        lastDerivedProps = nextProps
        return lastDerivedProps
      }
    }

    function makeChildElementSelector() {
      let lastChildProps, lastForwardRef, lastChildElement, lastComponent

      return function selectChildElement(
        WrappedComponent,
        childProps,
        forwardRef
      ) {
        if (
          childProps !== lastChildProps ||
          forwardRef !== lastForwardRef ||
          lastComponent !== WrappedComponent
        ) {
          lastChildProps = childProps
          lastForwardRef = forwardRef
          lastComponent = WrappedComponent
          console.log('childProps', childProps);
          lastChildElement = (
            <WrappedComponent {...childProps} ref={forwardRef} />
          )
        }

        return lastChildElement
      }
    }

    class Connect extends OuterBaseComponent {
      constructor(props) {
        super(props)
        //...
        this.selectDerivedProps = makeDerivedPropsSelector()
        this.selectChildElement = makeChildElementSelector()
        this.indirectRenderWrappedComponent = this.indirectRenderWrappedComponent.bind(
          this
        )
      }

      indirectRenderWrappedComponent(value) {
        // calling renderWrappedComponent on prototype from indirectRenderWrappedComponent bound to `this`
        return this.renderWrappedComponent(value)
      }

      renderWrappedComponent(value) {
       //...
        const { storeState, store } = value

        let wrapperProps = this.props
        let forwardedRef

        if (forwardRef) {
          wrapperProps = this.props.wrapperProps
          forwardedRef = this.props.forwardedRef
        }

        let derivedProps = this.selectDerivedProps(
          storeState,
          wrapperProps,
          store,
          selectorFactoryOptions
        )

        return this.selectChildElement(
          WrappedComponent,
          derivedProps,
          forwardedRef
        )
      }

      render() {
        const ContextToUse =
          this.props.context &&
          this.props.context.Consumer &&
          isContextConsumer(<this.props.context.Consumer />)
            ? this.props.context
            : Context

        return (
          <ContextToUse.Consumer>
            {this.indirectRenderWrappedComponent}
          </ContextToUse.Consumer>
        )
      }
    }

    Connect.WrappedComponent = WrappedComponent
    Connect.displayName = displayName

    // ...

    return hoistStatics(Connect, WrappedComponent)
  }
}
```

connectAdvanced 是一个高阶组件，将 selectorFactory 计算得出的 props 和组件原有的 props 一起传给 WrappedComponent；
hoist-non-react-statics 这个库，作用是避免在使用 HOC 时，导致类的 static 方法丢失的问题。详情见[react doc](https://reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over)

### 参考资料：

1、[参考资料](https://juejin.im/post/5b8b5a60e51d4538c411ff12)
2、[参考资料](https://juejin.im/post/5b8baa06e51d45388c445f5d)

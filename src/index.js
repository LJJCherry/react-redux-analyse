// use react-redux hooks
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import { createStore } from 'redux'
import { Provider, connect, useSelector, useDispatch} from './react-redux-7.1.1/index'

// React component
const Counter = () => {
    const value = useSelector(state => state.count);
    const dispatch = useDispatch();

    return (
      <div>
        <span>{value}</span>
        <button onClick={() => dispatch(increaseAction)}>Increase</button>
      </div>
    )
}

// Action
const increaseAction = { type: 'increase' }

// Reducer
function counter(state = { count: 0 }, action) {
  const count = state.count
  switch (action.type) {
    case 'increase':
      return { count: count + 1 }
    default:
      return state
  }
}

// Store
const store = createStore(counter)
// Connected Component
const App = Counter;


ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)

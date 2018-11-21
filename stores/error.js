const { __ } = require('../lib/locale')

module.exports = function error (state, emitter) {
  state.error = state.error || null

  emitter.on('error', err => {
    err = err.error || err

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(err.stack)
    }

    state.error = {
      message: __(err.message),
      status: err.status,
      stack: err.stack
    }

    emitter.emit('render')
  })

  emitter.on(state.events.NAVIGATE, () => {
    state.error = null
  })

  emitter.on('error:dismiss', () => {
    state.error = null
    emitter.emit('render')
  })
}

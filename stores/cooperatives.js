const INIT = {
  credentials: 'include',
  headers: {
    'Accept': 'application/json'
  }
}

module.exports = cooperatives

function cooperatives (state, emitter) {
  state.cooperatives = state.cooperatives || []

  emitter.on('DOMContentLoaded', () => {
    emitter.emit('cooperatives:fetch')
  })

  emitter.on('cooperatives:add', ({ data }) => {
    const options = Object.assign({}, INIT, {
      body: JSON.stringify(data),
      method: 'POST',
      headers: Object.assign({
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, INIT.headers)
    })

    window.fetch('/cooperatives', options).then(capture).then(body => {
      state.cooperatives.push(body)
      state.isLoading = false
      emitter.emit('pushState', `/cooperatives/${body._id}`)
    }, err => emitter.emit('error', err))

    state.isLoading = true
    emitter.emit('render')
  })

  emitter.on('cooperatives:update', ({ cooperative, data }) => {
    const options = Object.assign({}, INIT, {
      body: JSON.stringify(data),
      method: 'PUT',
      headers: Object.assign({
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, INIT.headers)
    })

    window.fetch(`/cooperatives/${cooperative._id}`, options)
      .then(capture)
      .then(body => {
        const index = state.cooperatives.findIndex(item => {
          return item._id === cooperative._id
        })

        state.cooperatives.splice(index, 1, body)
        state.isLoading = false

        emitter.emit('pushState', `/cooperatives/${body._id}`)
      }, err => {
        // Fetch latest data before emitting error
        emitter.emit('cooperatives:fetch', cooperative._id)
        emitter.emit('error', err)
      })

    state.isLoading = true
    emitter.emit('render')
  })

  emitter.on('cooperatives:fetch', id => {
    const url = id ? `/cooperatives/${id}` : '/cooperatives'

    window.fetch(url, INIT).then(capture).then(body => {
      if (Array.isArray(body)) {
        body.forEach(inject)
      } else {
        inject(body)
      }

      emitter.emit('render')
    }, err => emitter.emit('error', err))
  })

  function capture (response) {
    return response.json().then(body => {
      if (!response.ok) {
        const { error: { message, status } } = body
        const error = new Error(message || response.statusText)
        error.status = status || response.status
        return Promise.reject(error)
      } else {
        return body
      }
    })
  }

  function inject (props) {
    const items = state.cooperatives
    const index = items.findIndex(item => item._id === props._id)

    if (index !== -1) {
      Object.assign(items[index], props)
    } else {
      items.push(props)
    }
  }
}

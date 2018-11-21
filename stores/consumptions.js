const url = require('url')
const moment = require('moment')
const hash = require('object-hash')
const assert = require('../lib/assert')
const { __ } = require('../lib/locale')

const FORMAT = 'YYYYMM'
const INIT = { credentials: 'include', headers: { accept: 'application/json' } }

module.exports = consumptions

function consumptions (state, emitter) {
  state.consumptions = Object.assign({
    items: {},
    clock: 0,
    isLoading: false,
    type: 'heat',
    compare: 'prev_year',
    granularity: 'month',
    normalized: true
  }, state.consumptions)

  let touched = false
  emitter.on('consumptions:type', type => {
    state.error = null
    state.consumptions.type = type
    state.consumptions.clock++

    if (type === 'electricity') {
      state.consumptions.normalized = false
    } else if (!touched) {
      state.consumptions.normalized = true
      touched = true
    }

    emitter.emit('render')
  })

  emitter.on('consumptions:compare', compare => {
    state.error = null
    state.consumptions.compare = compare
    state.consumptions.clock++
    emitter.emit('render')
  })

  emitter.on('consumptions:normalized', normalized => {
    state.error = null
    state.consumptions.normalized = normalized
    state.consumptions.clock++
    emitter.emit('render')
  })

  emitter.on('consumptions:granularity', granularity => {
    const { consumptions: { compare } } = state

    if (granularity === 'year' && compare === 'prev_year') {
      state.consumptions.compare = null
    } else if (granularity === 'month' && compare === null) {
      state.consumptions.compare = 'prev_year'
    }

    state.error = null
    state.consumptions.granularity = granularity
    state.consumptions.clock++

    emitter.emit('render')
  })

  emitter.on('consumptions:fetch', options => {
    const { consumptions } = state
    const done = (data) => {
      consumptions.isLoading = false

      if (Array.isArray(data)) {
        data.forEach(({ values, options }) => {
          state.consumptions.items[hash(options)] = values
        })
      } else {
        state.consumptions.items[hash(data.options)] = data.values
      }

      emitter.emit('render')
    }

    consumptions.isLoading = true

    if (Array.isArray(options)) {
      Promise.all(options.map(options => {
        return fetchConsumtion(defaults(options)).then(values => ({ values, options }))
      })).then(done, err => emitter.emit('error', err))
    } else {
      fetchConsumtion(defaults(options)).then(
        values => done({ values, options }),
        err => emitter.emit('error', err)
      )
    }
  })

  function defaults (options) {
    return Object.assign({
      types: [ state.consumptions.type ],
      granularity: 'month',
      normalized: state.consumptions.normalized
    }, options)
  }
}

/**
 * Fetch consumtion for given cooperative with query parameterss granularity,
 * from and to
 * @param  {Object} options Hash with cooperative and query parameters
 * @return {Promise}        Resolves to parsed response
 */

function fetchConsumtion (options) {
  const { from, to, types, granularity, normalized, cooperative: id } = options
  const endpoint = url.format({
    pathname: `/cooperatives/${id}/consumption`,
    query: {
      types: types.join(','),
      normalized: normalized,
      granularity: granularity,
      from: moment(from).format(FORMAT),
      to: moment(to).format(FORMAT)
    }
  })

  return window.fetch(endpoint, INIT).then(body => {
    return body.json().then(response => {
      if (!body.ok) {
        assert.reject(body.status, __(response.error.message))
      }

      return response.map((value, index) => {
        // Assign date to value
        const date = moment(from, FORMAT).add(index, granularity + 's').toDate()
        return { value, date }
      })
    })
  })
}

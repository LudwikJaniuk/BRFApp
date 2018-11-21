const Prismic = require('prismic-javascript')

const API = Prismic.api(process.env.PRISMIC_API)

module.exports = content

function content (state, emitter) {
  state.content = state.content || {}

  emitter.on('content:fetch', name => {
    API.then(api => api.getSingle(name).then(doc => {
      state.content[name] = doc
      emitter.emit('render')
    })).catch(err => emitter.emit('error', err))
  })
}

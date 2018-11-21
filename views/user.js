const html = require('choo/html')
const view = require('../components/view')

module.exports = view(user, title)

function user (state, emit) {
  return html`
    <pre>
      ${JSON.stringify(state.user, null, 2)}
    </pre>
  `
}

function title (state) {
  return state.user.name
}

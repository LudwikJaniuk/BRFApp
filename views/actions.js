const html = require('choo/html')
const view = require('../components/view')
const { __ } = require('../lib/locale')

module.exports = view(actions, title)

function actions (state, emit) {
  return html`
    <div>hello?</div>
  `
}

function title () {
  return __('Actions')
}

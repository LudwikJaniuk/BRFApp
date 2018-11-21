const html = require('choo/html')
const view = require('../components/view')
const ActionForm = require('../components/action/form')
const { __ } = require('../lib/locale')

module.exports = view(editAction, title)

function editAction (state, emit) {
  const { actions, params } = state
  const action = actions.find(props => props._id === params.action)

  return html`
    <div class="View-container View-container--sm u-block">
      <h1 class="Display Display--2 u-marginTl u-marginBm">${__('Edit energy action')}</h1>
      ${state.cache(ActionForm, 'edit-action').render(action)}
    </div>
  `
}

function title () {
  return __('Edit energy action')
}

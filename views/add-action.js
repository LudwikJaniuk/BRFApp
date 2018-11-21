const html = require('choo/html')
const view = require('../components/view')
const ActionForm = require('../components/action/form')
const { chevron, loader } = require('../components/icons')
const resolve = require('../lib/resolve')
const { __ } = require('../lib/locale')

module.exports = view(addAction, title)

function addAction (state, emit) {
  const { cooperatives, params: { cooperative: id } } = state
  const cooperative = cooperatives.find(item => item._id === id)

  if (!cooperative) {
    emit('cooperative:fetch', id)
  }

  return html`
    <div class="View-container View-container--sm u-block">
      <h1 class="Display Display--2 u-marginTl u-marginBb">${__('Add energy action')}</h1>
      <a class="u-inlineBlock u-marginBm" href="${resolve(`/cooperatives/${cooperative._id}`)}">
        ${chevron('left')}${__('Back to %s', cooperative.name)}
      </a>

      ${cooperative ? state.cache(ActionForm, 'add-action').render({ cooperative: cooperative._id }) : html`
        <div class="u-flexGrow1 u-flex u-flexCol u-flexJustifyCenter">
          ${loader()}
        </div>
      `}
    </div>
  `
}

function title () {
  return __('Add energy action')
}

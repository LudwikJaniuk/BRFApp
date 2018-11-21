const html = require('choo/html')
const modal = require('../modal')
const PageHead = require('../page-head')
const Symbols = require('../icons/symbols')
const ApplicationError = require('./error')
const Onboarding = require('../onboarding')

const errors = {
  '404': require('./404'),
  '500': require('./500')
}

const DEFAULT_TITLE = 'Brf Energi'

module.exports = function createView (view, title) {
  return function app (state, emit) {
    let content
    let hasCrashed = state.error && state.error.status >= 500

    if (state.error && state.error.status in errors) {
      title = errors[state.error.status].title
      content = errors[state.error.status](state.error)
    } else {
      try {
        content = view(state, emit)
      } catch (err) {
        hasCrashed = true
        title = errors['500'].title
        content = errors['500'](err)

        if (process.env.NODE_ENV === 'development') {
          console.error(err) // eslint-disable-line no-console
        }
      }
    }

    emit(
      state.events.DOMTITLECHANGE,
      title ? `${title(state)} | ${DEFAULT_TITLE}` : DEFAULT_TITLE
    )

    return html`
      <body class="View">
        ${!hasCrashed ? state.cache(ApplicationError, 'app-error').render() : null}
        ${!hasCrashed ? state.cache(PageHead, 'app-header').render() : null}
        ${content}
        ${state.cache(Symbols, 'app-symbols').render()}
        ${state.hasBoarded ? modal.placeholder() : modal.render(
          state.cache(Onboarding, 'onboarding').render(() => modal.close()),
          () => emit('user:boarded')
        )}
      </body>
    `
  }
}

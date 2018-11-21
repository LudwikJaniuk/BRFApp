const view = require('../components/view')
const views = {
  '404': require('../components/view/404'),
  '500': require('../components/view/500')
}

module.exports = function error (state, emit) {
  return view(errorView, title)(state, emit)

  function errorView (state, emit) {
    const status = (state.error && state.error.status) || '404'
    if (status in views) {
      return views[status](state.error || new Error('Page not found'))
    } else {
      return views['500'](state.error)
    }
  }

  function title () {
    const status = (state.error && state.error.status) || '404'
    if (status in views) {
      return views[status].title()
    } else {
      return views['500'].title()
    }
  }
}

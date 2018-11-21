const choo = require('choo')
const { setLocale } = require('./lib/locale')

const DEFAULT_LANGUAGE = 'sv'

/**
 * Create the application instance
 */

const app = choo({ hash: false })

/**
 * Take a list of routes/view pairs (`[<path>, <view>]`) and wrap each
 * respective view with a function that also sets the `document.title` on render
 * derrived from `view.title(state)`
 * @type {Array}
 */

const routes = [
  ['/', require('./views/home')],
  ['/cooperatives', require('./views/home')],
  ['/auth', require('./views/sign-in')],
  ['/auth/sign-up', require('./views/sign-up')],
  ['/user', require('./views/user')],
  ['/how-it-works', require('./views/faq')],
  ['/how-it-works/:anchor', require('./views/faq')],
  ['/about-the-project', require('./views/about')],
  ['/about-the-project/:anchor', require('./views/about')],
  ['/cooperatives/:cooperative', require('./views/cooperative')],
  ['/cooperatives/:cooperative/edit', require('./views/edit-cooperative')],
  ['/cooperatives/:cooperative/add-action', require('./views/add-action')],
  ['/actions', require('./views/actions')],
  ['/actions/:action', require('./views/action')],
  ['/actions/:action/edit', require('./views/edit-action')],
  ['/error', require('./views/error')],
  ['/*', require('./views/error')]
]

/**
 * Localize all the routes with a lang prefix
 */

routes.map(localize('sv')).forEach(([route, view]) => app.route(route, view))
routes.map(localize('en')).forEach(([route, view]) => app.route(route, view))

/**
 * Hook up devtools
 */

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  app.use(require('choo-devtools')())
}

/**
 * Set up application store
 */

app.use(require('./stores/reset'))
app.use(require('./stores/navigation'))
app.use(require('./stores/content'))
app.use(require('./stores/error'))
app.use(require('./stores/user'))
app.use(require('./stores/geoip'))
app.use(require('./stores/actions'))
app.use(require('./stores/cooperatives'))
app.use(require('./stores/consumptions'))
app.use(require('./stores/tracking'))

/**
 * Start application when running in browser
 */

try {
  module.exports = app.mount('body')
} catch (err) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error(err)
  }
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove('has-js')
  }
}

/**
 * Create an iterator that handles localization before rendering view
 * @param  {String}   lang Language code
 * @return {Function}      Iterator that localizes routes
 */

function localize (lang) {
  return function ([route, view]) {
    const localized = lang === DEFAULT_LANGUAGE ? route : ('/' + lang + route)
    return [localized.replace(/\/$/, ''), function (state, emit) {
      setLocale(state.user ? state.user.profile.language : lang)
      return view.call(this, state, emit)
    }]
  }
}

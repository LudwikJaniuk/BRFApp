const Core = require('./core');
const createStore = require('./store');
const { setLocale } = require('../locale');

const DEFAULT_LANGUAGE = 'sv';

/**
 * Create the application instance
 */

const app = module.exports = new Core();

/**
 * Take a list of routes/view pairs (`[<path>, <view>]`) and wrap each
 * respective view with a function that also sets the `document.title` on render
 * derrived from `view.title(state)`
 * @type {Array}
 */

const routes = [
  ['/', require('../views/home')],
  ['/cooperatives', require('../views/home')],
  ['/auth', require('../views/sign-in')],
  ['/user', require('../views/user')],
  ['/how-it-works', require('../views/faq')],
  ['/about-the-project', require('../views/about')],
  ['/cooperatives/:cooperative', require('../views/cooperative')],
  ['/cooperatives/:cooperative/edit', require('../views/edit-cooperative')],
  ['/cooperatives/:cooperative/add-action', require('../views/add-action')],
  ['/actions', require('../views/actions')],
  ['/actions/:action', require('../views/action')],
  ['/actions/:action/edit', require('../views/edit-action')],
  ['/404', require('../views/error')],
  ['/error', require('../views/error')],
  ['/*', require('../views/error')]
];

/**
 * Localize all the routes with a lang prefix
 */

routes.map(localize('sv')).forEach(([route, view]) => app.route(route, view));
routes.map(localize('en')).forEach(([route, view]) => app.route(route, view));

/**
 * Set up application store
 */

app.use(createStore());

/**
 * Start application when running in browser
 */

if (typeof window !== 'undefined') {
   /**
   * Mount the application
   */

  try {
    app.mount('.js-app');
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    document.documentElement.classList.remove('has-js');
  }
}

/**
 * Create an iterator that handles localization before rendering view
 * @param  {String}   lang Language code
 * @return {Function}      Iterator that localizes routes
 */

function localize(lang) {
  return function ([route, view]) {
    const localized = lang === DEFAULT_LANGUAGE ? route : ('/' + lang + route);

    return [localized.replace(/\/$/, ''), (state, emit) => {
      try {
        setLocale(state.user.profile.language);
      } catch (err) {
        setLocale(lang);
      }

      return view(state, emit);
    }];
  };
}

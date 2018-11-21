const y18n = require('y18n')
const moment = require('moment')

/**
 * Include locales in browser build
 */

const lang = {
  sv: require('./sv'),
  en: require('./en')
}

const options = { directory: __dirname }

/**
 * Adaption for browser bundle
 */

if (typeof window !== 'undefined') {
  options.updateFiles = false
  options.locale = process.env.BRFENERGI_LANG
}

const my18n = module.exports = y18n(options)

/**
 * Hijack native `setLocale` to configure moment at the same time
 */

const orig = my18n.setLocale
my18n.setLocale = function (locale) {
  moment.locale(locale)
  return orig.call(this, locale)
}

/**
 * Extend y18n with custom (static) `_readLocaleFile`
 */

if (typeof window !== 'undefined') {
  my18n._readLocaleFile = function () {
    this.cache[this.locale] = lang[this.locale]
  }
}

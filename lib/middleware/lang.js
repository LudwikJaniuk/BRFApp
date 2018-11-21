const url = require('url')

module.exports = lang

function lang (language) {
  return function (ctx, next) {
    if (ctx.state.user) {
      // User defined language have precedence over Swedish (default)
      language = ctx.state.user.profile.language
    }

    const redirect = ctx.redirect
    ctx.redirect = function (pathname) {
      return redirect.call(this, resolve(pathname))
    }

    ctx.state.lang = ctx.state.language = language

    return next()

    /**
     * Resolve urls per defined language
     */

    function resolve (...args) {
      const prefix = language === 'sv' ? '' : `/${language}`
      const props = url.parse(args.length > 1 ? url.resolve(...args) : args[0])
      props.pathname = prefix + props.pathname
      return url.format(props)
    }
  }
}

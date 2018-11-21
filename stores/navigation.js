module.exports = navigation

function navigation (state, emitter) {
  let anchor = null
  emitter.on('scrollto', function (id, opts) {
    window.setTimeout(function () {
      if (id === anchor) return

      const el = document.getElementById(id)
      if (!el) return

      el.scrollIntoView(Object.assign({
        behavior: 'smooth',
        block: 'start'
      }, opts))
    }, 0)
  })

  emitter.on('DOMContentLoaded', function () {
    require('smoothscroll-polyfill').polyfill()

    emitter.on(state.events.NAVIGATE, function () {
      if (anchor) {
        const el = document.getElementById(anchor)
        if (el) el.scrollIntoView(true)
        else anchor = null
      } else {
        document.body.scrollIntoView(true)
      }
    })
  })
}

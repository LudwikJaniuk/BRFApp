const Log = require('../models/logs')
const { __ } = require('../locale')

module.exports = error

async function error (ctx, next) {
  try {
    ctx.state.error = null
    await next()
  } catch (err) {
    if (ctx.accepts('html')) {
      ctx.state.status = err.status || 500
      if (err.status === 401) {
        ctx.redirect('/auth')
      } else {
        ctx.state.error = {
          message: __(err.message),
          status: ctx.state.status,
          stack: err.stack
        }
      }
    }

    Log.create({
      userId: ctx.state.user && ctx.state.user._id,
      category: 'Error',
      type: 'server',
      data: err.message
    })

    if (!ctx.accepts('html')) ctx.throw(err)
  }
}

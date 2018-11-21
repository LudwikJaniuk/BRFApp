const geoip = require('geoip-lite')

const DEBUG_IP = '130.237.227.33'

module.exports = middleware

function middleware (ctx, next) {
  if (!ctx.accepts('html')) return next()
  const ip = process.env.NODE_ENV === 'development' ? DEBUG_IP : ctx.ip
  ctx.state.geoip = geoip.lookup(ip)
  return next()
}

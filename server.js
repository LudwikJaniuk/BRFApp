require('dotenv/config')

const jalla = require('jalla')
const mount = require('koa-mount')
const mongoose = require('mongoose')
const compose = require('koa-compose')
const router = require('./lib/router')
const lang = require('./lib/middleware/lang')

const app = jalla('index.js', { css: 'index.css' })
app.keys = [process.env.BRFENERGI_SESSION_SECRET]

if (process.env.BRFENERGI_USER && process.env.BRFENERGI_PASS) {
  app.use(require('koa-basic-auth')({
    name: process.env.BRFENERGI_USER,
    pass: process.env.BRFENERGI_PASS
  }))
}

app.use(require('@koa/cors')())
app.use(require('koa-session')(app))
app.use(require('koa-methodoverride')('_method'))
app.use(require('./lib/middleware/error'))
app.use(require('./lib/middleware/geoip'))
app.use(require('./lib/middleware/auth')())
app.use(require('./lib/middleware/prismic'))

app.use(async function (ctx, next) {
  ctx.set('Access-Control-Allow-Origin', process.env.FORUM_URL)
  ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  if (!ctx.response.get('Cache-Control')) {
    ctx.set('Cache-Control', 'no-cache, max-age=0')
  }
  return next()
})

const routes = compose([router.routes(), router.allowedMethods()])
app.use(mount('/en', compose([lang('en'), routes])))
app.use(routes)

mongoose.Promise = Promise
mongoose.connect(process.env.MONGO_URL, { useMongoClient: true }).then(() => {
  app.listen(process.env.PORT || 8080)
}, err => {
  app.emit('error', err)
  process.exit(1)
})

const url = require('url')
const Router = require('koa-router')
const passport = require('koa-passport')
const Log = require('../models/logs')
const Cooperatives = require('../models/cooperatives')

const router = module.exports = new Router()

router.get('/', async function (ctx, next) {
  ctx.assert(ctx.accepts('html'), 406)

  if (ctx.isAuthenticated()) {
    ctx.redirect(`/cooperatives/${ctx.state.user.cooperative}`)
  } else {
    await ctx.prismic.api.getSingle('sign-in').then(doc => {
      ctx.state.content = ctx.state.content || {}
      ctx.state.content['sign-in'] = doc
    })

    Log.create({
      category: 'Auth',
      type: 'get'
    })
  }
})

router.get('/sign-up', async function (ctx, next) {
  ctx.assert(ctx.accepts('html'), 406)

  if (ctx.isAuthenticated()) {
    ctx.redirect(`/cooperatives/${ctx.state.user.cooperative}`)
  } else {
    await ctx.prismic.api.getSingle('registration').then(doc => {
      ctx.state.content = ctx.state.content || {}
      ctx.state.content.registration = doc
    })

    Log.create({
      category: 'Auth',
      type: 'get'
    })
  }
})

/**
 * Redirect to Metry OAuth
 */

router.get('/metry', passport.authenticate('metry', {
  failureRedirect: '/auth'
}))

/**
 * Sign up
 */

router.get('/metry/sign-up', function (ctx, next) {
  ctx.redirect(url.resolve(
    process.env.METRY_ENDPOINT,
    `/id/register/brf?${[
      'response_type=code',
      `redirect_uri=${url.resolve(
        process.env.BRFENERGI_SERVICE_URL,
        'auth/callback'
      )}`,
      'scope=basic%20add_to_open_channels%20write_meter_location',
      `client_id=${process.env.METRY_CLIENT_ID}`
    ].join('&')}`
  ))
})

/**
 * Handle Metry callback redirect
 */

router.get('/callback', async function (ctx, next) {
  try {
    await passport.authenticate('metry')(ctx, async function () {
      const id = ctx.state.user.cooperative
      const cooperative = await Cooperatives.get(id)
      if (!cooperative.needUpdate && cooperative.hasRegistered) {
        ctx.redirect(`/cooperatives/${ctx.state.user.cooperative}`)
      } else {
        ctx.redirect(`/cooperatives/${id}/edit`)
      }
    })
  } catch (err) {
    ctx.redirect(url.format({
      pathname: '/auth',
      query: { error: 'METRY_ERROR' }
    }))

    Log.create({
      category: 'Error',
      type: 'auth',
      data: err.message
    })
  }
})

/**
 * Sign out
 */

router.get('/signout', function (ctx) {
  ctx.assert(ctx.isAuthenticated(), 401)
  ctx.logout()
  ctx.redirect('/')
})

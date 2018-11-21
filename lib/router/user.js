const body = require('koa-body')
const Router = require('koa-router')
const Log = require('../models/logs')
const Users = require('../models/users')

const router = module.exports = new Router()

router.put('/:id', isCurrentUser('id'), body(), async function (ctx, next) {
  ctx.body = Users.update(ctx.params.id, ctx.request.body)
})

router.get('/:id', isCurrentUser('id'), async function (ctx, next) {
  const user = await Users.get(ctx.params.id)

  ctx.assert(user._id.toString() === ctx.state.user._id.toString(), 401)

  ctx.body = user

  Log.create({
    userId: user._id,
    category: 'Own User Profile',
    type: 'get'
  })
})

function isCurrentUser (param) {
  return async function (ctx, next) {
    ctx.assert(ctx.isAuthenticated(), 401)
    ctx.assert(ctx.params[param] === ctx.state.user._id.toString(), 401)
    return next()
  }
}

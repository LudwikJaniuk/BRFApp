const body = require('koa-body')
const Router = require('koa-router')
const Cooperatives = require('../models/cooperatives')
const Log = require('../models/logs')

const router = module.exports = new Router()

router.get('/', async function (ctx, next) {
  const cooperatives = await Cooperatives.all()
  if (ctx.accepts('html')) {
    ctx.state.cooperatives = cooperatives.map((model) => model.toJSON())
  } else {
    ctx.body = cooperatives
  }

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Cooperatives',
    type: 'get'
  })
})

router.get('/:id', async function (ctx, next) {
  const { id } = ctx.params
  const cooperative = await Cooperatives.get(id)

  if (ctx.accepts('html')) {
    ctx.state.cooperatives = [cooperative.toJSON()]
    ctx.state.actions = cooperative.actions.map((model) => model.toJSON())
  } else {
    ctx.body = cooperative
  }

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Cooperative',
    type: 'get',
    data: {
      cooperativeId: id
    }
  })
})

router.get('/:id/add-action', isEditor('id'), async function (ctx, next) {
  ctx.assert(ctx.accepts('html'), 406)

  const cooperative = await Cooperatives.get(ctx.params.id)
  ctx.state.cooperatives = [cooperative.toJSON()]

  Log.create({
    userId: ctx.state.user._id,
    category: 'Action',
    type: 'add',
    data: {
      cooperativeId: ctx.params.id
    }
  })
})

router.put('/:id', isEditor('id'), body(), async function (ctx, next) {
  const { request: { body }, params: { id } } = ctx
  const cooperative = await Cooperatives.update(id, body, ctx.state.user)

  if (cooperative.needUpdate) {
    if (ctx.accepts('html')) {
      ctx.redirect(`/cooperatives/${id}/edit`)
    } else {
      ctx.status = 400
      ctx.body = {
        error: {
          status: 400,
          message: 'Some information is missing, please review and try again'
        }
      }
    }
  } else {
    if (ctx.accepts('html')) {
      ctx.state.cooperatives = [cooperative.toJSON()]
      ctx.state.actions = cooperative.actions.map((model) => model.toJSON())
      if (cooperative.needUpdate) {
        ctx.state.error = {
          status: 417,
          message: 'Some information is missing, please '
        }
      }
    } else {
      ctx.body = cooperative
    }
  }

  Log.create({
    userId: ctx.state.user._id,
    category: 'Cooperative',
    type: 'update',
    data: body
  })
})

router.get('/:id/edit', isEditor('id'), async function (ctx, next) {
  ctx.assert(ctx.accepts('html'), 406)

  const [cooperative, doc] = await Promise.all([
    Cooperatives.get(ctx.params.id),
    ctx.prismic.api.getSingle('registration')
  ])

  ctx.state.content = ctx.state.content || {}
  ctx.state.content.registration = doc
  ctx.state.cooperatives = [cooperative.toJSON()]
})

router.get('/:id/consumption', async function (ctx, next) {
  const { params: { id }, query } = ctx
  const options = Object.assign({
    normalized: query.type === 'heat'
  }, query)

  if (typeof options.normalized === 'string') {
    options.normalized = options.normalized === 'true'
  }

  options.types = options.types.split(',')

  if (ctx.accepts('html')) {
    ctx.redirect(`cooperatives/${id}`)
  } else {
    ctx.body = await Cooperatives.getConsumption(id, options)

    Log.create({
      userId: ctx.state.user && ctx.state.user._id,
      category: 'Cooperative',
      type: 'getConsumption',
      data: {
        cooperativeId: id,
        query: query
      }
    })
  }
})

function isEditor (param) {
  return async function (ctx, next) {
    ctx.assert(ctx.isAuthenticated(), 401)

    const cooperative = await Cooperatives.get(ctx.params[param])
    const editor = cooperative.editors.find(editor => {
      return editor._id.toString() === ctx.state.user._id.toString()
    })

    if (!editor) ctx.throw(401)
    return next()
  }
}

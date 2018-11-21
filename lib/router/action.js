const body = require('koa-body')
const Router = require('koa-router')
const Log = require('../models/logs')
const Actions = require('../models/actions')
const Cooperatives = require('../models/cooperatives')

const router = module.exports = new Router()

router.post('/:id/comments', body(), async function (ctx, next) {
  ctx.assert(ctx.isAuthenticated(), 401)

  const { params, request, state } = ctx
  const comment = await Actions.addComment(params.id, request.body, state.user)

  if (ctx.accepts('html')) {
    ctx.redirect(`/actions/${params.id}`)
  } else {
    ctx.body = comment
  }

  Log.create({
    userId: state.user._id,
    category: 'Action Comments',
    type: 'create',
    data: request.body
  })
})

router.get('/:id/comments', async function (ctx, next) {
  if (ctx.accepts('html')) return ctx.redirect(`/actions/${ctx.params.id}`)

  ctx.body = await Actions.get(ctx.params.id)

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Action Comments',
    type: 'all',
    data: {
      actionId: ctx.params.id
    }
  })
})

router.get('/:id/comments/:commentId', async function (ctx, next) {
  if (ctx.accepts('html')) return ctx.redirect(`/actions/${ctx.params.id}`)

  ctx.body = await Actions.getComment(ctx.params.commentId)

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Action Comments',
    type: 'get',
    data: {
      actionId: ctx.params.id,
      commentId: ctx.params.commentId
    }
  })
})

router.delete('/:id/comments/:commentId', isEditor('id'), async function (ctx, next) {
  await Actions.deleteComment(ctx.params.commentId)

  if (ctx.accepts('html')) {
    ctx.redirect(`/actions/${ctx.params.id}`)
  } else {
    ctx.redirect(`/actions/${ctx.params.id}/comments`)
  }

  Log.create({
    userId: ctx.state.user._id,
    category: 'Action Comments',
    type: 'delete',
    data: ctx.params
  })
})

router.post('/', body(), async function (ctx, next) {
  ctx.assert(ctx.isAuthenticated(), 401)

  const body = ctx.request.body
  ctx.assert(!isNaN(Date.parse(body.date)), 400)

  const cooperative = await Cooperatives.get(body.cooperative)
  const editor = cooperative.editors.find(function (item) {
    return item._id.toString() === ctx.state.user._id.toString()
  })

  if (!editor) {
    if (ctx.accepts('html')) return ctx.redirect('/auth')
    else ctx.throw(401)
  }

  const action = await Actions.create(body, ctx.state.user, cooperative)
  if (!ctx.accepts('html')) ctx.body = action
  else ctx.redirect(`/cooperatives/${cooperative._id}`)

  Log.create({
    userId: ctx.state.user._id,
    category: 'Action',
    type: 'create',
    data: body
  })
})

router.put('/:id', isEditor('id'), body(), async function (ctx, next) {
  const { request, params } = ctx

  await Actions.update(params.id, request.body)
  const action = await Actions.get(params.id)

  if (ctx.accepts('html')) {
    ctx.state.cooperatives = [action.cooperative.toJSON()]
    ctx.state.actions = [action.toJSON()]
  } else {
    ctx.body = action
  }

  Log.create({
    userId: ctx.state.user._id,
    category: 'Cooperative',
    type: 'updateAction',
    data: {
      actionId: params.id,
      action: request.body
    }
  })
})

router.get('/:id', async function (ctx, next) {
  const action = await Actions.get(ctx.params.id)

  if (ctx.accepts('html')) {
    ctx.state.cooperatives = [action.cooperative.toJSON()]
    ctx.state.actions = [action.toJSON()]
  } else {
    ctx.body = action
  }

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Action',
    type: 'get',
    data: {
      actionId: ctx.params.id
    }
  })
})

router.get('/:id/edit', isEditor('id'), async function (ctx, next) {
  if (!ctx.accepts('html')) return ctx.redirect(`/actions/${ctx.params.id}`)

  const action = await Actions.get(ctx.params.id)
  ctx.state.cooperatives = [action.cooperative.toJSON()]
  ctx.state.actions = [action.toJSON()]

  Log.create({
    userId: ctx.state.user._id,
    category: 'Action',
    type: 'edit',
    data: {
      actionId: ctx.params.id
    }
  })
})

router.delete('/:id', isEditor('id'), async function (ctx, next) {
  const action = await Actions.get(ctx.params.id)
  await Actions.delete(ctx.params.id)

  if (ctx.accepts('html')) {
    ctx.redirect(`/cooperatives/${action.cooperative._id}`)
  } else {
    ctx.body = {}
  }

  Log.create({
    userId: ctx.state.user._id,
    category: 'Action',
    type: 'delete',
    data: {
      actionId: ctx.params.id
    }
  })
})

router.get('/', function (ctx, next) {
  ctx.assert(ctx.accepts('html'), 405)
  ctx.redirect('/')
})

router.get('/search', async function (ctx, next) {
  ctx.body = await Actions.search(ctx.query.q)

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'Action',
    type: 'search',
    data: ctx.query
  })
})

function isEditor (param) {
  return async function (ctx, next) {
    ctx.assert(ctx.isAuthenticated(), 401)

    const action = await Actions.get(ctx.params[param])
    const cooperative = await Cooperatives.get(action.cooperative._id)
    const editor = cooperative.editors.find(editor => {
      return editor._id.toString() === ctx.state.user._id.toString()
    })

    if (!editor) ctx.throw(401)
    return next()
  }
}

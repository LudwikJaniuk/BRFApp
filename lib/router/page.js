const Router = require('koa-router')
const Log = require('../models/logs')

const router = module.exports = new Router()

router.get('/:slug', async function (ctx, next) {
  const uid = lookup(ctx.params.slug)
  const doc = await ctx.prismic.api.getSingle(uid)
  ctx.state.content = ctx.state.content || {}
  ctx.state.content[uid] = doc

  Log.create({
    userId: ctx.state.user && ctx.state.user._id,
    category: 'page',
    type: 'get',
    data: { uid }
  })
})

function lookup (uid) {
  switch (uid) {
    case 'how-it-works': return 'faq'
    case 'about-the-project': return 'about'
    default: {
      const err = new Error('Could not find page')
      err.status = 404
      throw err
    }
  }
}

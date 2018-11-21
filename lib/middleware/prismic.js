const Prismic = require('prismic-javascript')
const resolve = require('../resolve')

module.exports = prismic

async function prismic (ctx, next) {
  ctx.state.content = ctx.state.content || {}
  await Prismic.api(process.env.PRISMIC_API).then(api => {
    ctx.prismic = { api, linkResolver }
  })
  return next()
}

function linkResolver (doc) {
  return resolve(doc.slug || '/')
}

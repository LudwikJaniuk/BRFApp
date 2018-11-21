module.exports = config

function config (ctx) {
  const plugins = [require('postcss-custom-media')]

  if (ctx.env !== 'development') {
    plugins.push(require('postcss-custom-properties'))
  }

  return { plugins }
}

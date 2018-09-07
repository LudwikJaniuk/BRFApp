const fs = require('fs')
const path = require('path')
const postcss = require('postcss')
const browserify = require('browserify')
const watchify = require('watchify-middleware')
const chokidar = require('chokidar')

const ROOT = path.resolve(__dirname, '..')
let jsBundler = browserify('app/index.js', {
  basedir: ROOT,
  debug: true,
  transform: [
    [require('localenvify'), { envfile: '.env.client-public' }]
  ],
  filter: (moduleName) => moduleName !== 'electron' // 'got' can load it dynamically so browserify thinks it's required.
})
jsBundler.add(require.resolve('source-map-support/register'))
jsBundler = watchify.emitter(jsBundler)

jsBundler.on('update', function (buff) {
  clearModuleCache(path.resolve(ROOT, 'app/index.js'))
})

const cssBundler = postcss([
  require('postcss-import')(),
  require('postcss-custom-media')(),
  require('autoprefixer')()
])

let deferred = processCSS()
const watcher = chokidar.watch('**/*.css', { cwd: ROOT, ignoreInitial: true })
watcher.on('all', () => { deferred = processCSS() })

function processCSS () {
  return new Promise((resolve, reject) => {
    const file = path.resolve(ROOT, 'app/index.css')
    fs.readFile(file, (err, css) => {
      if (err) { return reject(err) }
      cssBundler.process(css, { from: file, to: file }).then(resolve, reject)
    })
  })
}

function cssmiddleware (req, res) {
  deferred.then(result => {
    res.set('Content-Type', 'text/css')
    res.send(result.css)
  }, err => res.status(500).send(err))
}

module.exports = function (req, res, next) {
  if (/\/index-[\d.]+(?:-[\w]+)?\.js/.test(req.url)) {
    jsBundler.middleware(req, res)
  } else if (/\/index-[\d.]+(?:-[\w]+)?\.css/.test(req.url)) {
    cssmiddleware(req, res)
  } else {
    next()
  }
}

// test module name for native faile ending
// str -> bool
function isNotNativeModulePath (file) {
  return /\.node$/.test(file.id) === false
}

// test if file is in node_modules dir
// str -> bool
function isNotInNodeModules (file) {
  return /node_modules/.test(file.id) === false
}

// recursively clear module cache for given module name
// str -> void
function clearModuleCache (key) {
  if (!require.cache[key]) return

  require.cache[key].children
    .filter(isNotNativeModulePath)
    .filter(isNotInNodeModules)
    .forEach(function (child) {
      clearModuleCache(child.id)
    })

  delete require.cache[key]
}

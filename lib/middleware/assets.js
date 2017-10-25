const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const browserify = require('browserify');
const watchify = require('watchify-middleware');
const chokidar = require('chokidar');

const ROOT = path.resolve(__dirname, '..');
const bundler = browserify('app/index.js', {
  basedir: ROOT,
  debug: true,
  transform: [
    require('localenvify'),
    require('babelify').configure({
      plugins: [ 'babel-plugin-stack-trace-sourcemap' ]
    })
  ]
});
const jsmiddleware = watchify(bundler);

const cssBundler = postcss([
  require('postcss-import')(),
  require('postcss-custom-media')(),
  require('autoprefixer')()
]);

let deferred = processCSS();
const watcher = chokidar.watch('**/*.css', { cwd: ROOT, ignoreInitial: true });
watcher.on('all', () => { deferred = processCSS(); });

function processCSS() {
  return new Promise((resolve, reject) => {
    const file = path.resolve(ROOT, 'app/index.css');
    fs.readFile(file, (err, css) => {
      if (err) { return reject(err); }
      cssBundler.process(css, { from: file, to: file }).then(resolve, reject);
    });
  });
}

function cssmiddleware(req, res) {
  deferred.then(result => {
    res.set('Content-Type', 'text/css');
    res.send(result.css);
  }, err => res.status(500).send(err));
}

module.exports = function (req, res, next) {
  if (/\/index-[\d.]+\.js/.test(req.url)) {
    jsmiddleware(req, res);
  } else if (/\/index-[\d.]+\.css/.test(req.url)) {
    cssmiddleware(req, res);
  } else {
    next();
  }
};

const util = require('util')
const html = require('choo/html')
const raw = require('choo/html/raw')
const { Elements } = require('prismic-richtext')
const nodemailer = require('nodemailer')
const Log = require('./models/logs')
const assert = require('./assert')
const resolvePath = require('./resolve')

exports.send = async function send (opts) {
  assert(typeof opts.to === 'string', 500, 'email: to should be a string')
  assert(typeof opts.subject === 'string', 500, 'email: subject should be a string')

  opts.from = opts.from || `Brf Energy <${process.env.EMAIL_ADDRESS}>`

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  })

  const sendMail = util.promisify(transporter.sendMail.bind(transporter))
  const info = await sendMail(opts)

  Log.create({
    category: 'Email',
    type: 'send',
    data: info
  })
}

exports.serialize = function serialize (data) {
  return function (element, content, children) {
    switch (element.type) {
      case Elements.span: {
        if (content && content.indexOf('\n') !== -1) {
          content = raw(content.replace(/\n/g, '<br />'))
        }

        return content.replace(/{{\s*(.+?)\s*}}/g, function (match, path) {
          return reduce(path, data)
        })
      }
      case Elements.preformatted: {
        return html`
          <pre style="padding: 20px; background-color: #efefef;">
            ${children}
          </pre>
        `
      }
      default: return null
    }
  }
}

exports.resolve = function resolve (doc) {
  return process.env.BRFENERGI_SERVICE_URL + resolvePath(doc)
}

/**
 * Reduce object path to value in src obj
 * Given string `foo.bar.0` and src `{foo: {bar: ['baz']}}` return `baz`
 * @param {string} path
 * @param {object} src
 * @return {any}
 */

function reduce (path, src) {
  const value = path.split('.').reduce((node, key) => node[key], src)
  return JSON.stringify(value, null, 2).replace(/^"|"$/g, '')
}

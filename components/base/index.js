const html = require('choo/html')

const CONSUMPTION_BASELINES = [115, 100, 80, 70]
const DECIMAL_SIGN = (0.5 + '').match(/0(.{1})5/)[1]

/**
 * Calculate energy class based on cooperative performance
 * @param  {Object} cooperative Cooperative for which to get energy class
 * @return {String}             Grade from A-G or `null`
 */

exports.getEnergyClass = function getEnergyClass (cooperative) {
  const performance = getPerformance(cooperative)
  const zone = cooperative.climateZone || CONSUMPTION_BASELINES.length
  const baseline = CONSUMPTION_BASELINES[zone - 1]

  if (!performance) {
    return null
  }

  const value = performance.value
  if (value <= baseline * 0.5) {
    return 'A'
  } else if (value > baseline * 0.5 && value <= baseline * 0.75) {
    return 'B'
  } else if (value > baseline * 0.75 && value <= baseline * 1.0) {
    return 'C'
  } else if (value > baseline * 1.0 && value <= baseline * 1.35) {
    return 'D'
  } else if (value > baseline * 1.35 && value <= baseline * 1.8) {
    return 'E'
  } else if (value > baseline * 1.8 && value <= baseline * 2.35) {
    return 'F'
  } else if (value > baseline * 2.35) {
    return 'G'
  }

  return null
}

/**
 * Get most recent performance entry for cooperative
 * @param  {Object} cooperative Cooperative model
 * @return {Number}             Value of most recent entry
 */

exports.getPerformance = getPerformance
function getPerformance (cooperative) {
  let latest
  for (let i = 0, len = cooperative.performances.length, entry; i < len; i++) {
    entry = cooperative.performances[i]
    if (!latest) latest = entry
    else if (entry.year > latest.year) latest = entry
    else if (entry.year === latest.year && entry.month > latest.month) {
      latest = entry
    }
  }

  return latest
}

/**
 * Format number with localized decimal sign, spaced by thousands and no more
 * than two decimals
 * @param  {Number} src Number to be formated
 * @return {String}     Formated string
 */

exports.format = function format (src) {
  if (isNaN(src)) { return src }

  const factor = src > 1 ? 10 : 100
  const [ whole, decimal ] = ((Math.round(src * factor) / factor) + '').split(/,|\./)
  const spaced = whole
    // Get individual numbers in reversed order
    .split('').reverse()
    // Inject a space before every third number
    .reduce((sum, num, index) => sum + (index % 3 === 0 ? ` ${num}` : num), '')
    // Put it back together in order
    .split('').reverse().join('').trim()

  if (decimal) {
    return `${spaced}${DECIMAL_SIGN}${decimal}`
  }

  return spaced
}

/**
 * Generate a random 15 character long id
 * @return {String}
 */

exports.id = function id () {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 15)
}

/**
 * Override choo link handler and follow link href
 */

exports.follow = function follow (event) {
  window.location.assign(event.target.href)
  event.preventDefault()
}

/**
 * Compile class name based on booleans.
 * Takes either a default class and an object with switches or just the object
 *
 * @example
 * const classList = className('Foo', { 'Foo-bar': true, 'Foo-baz': false });
 * const classList = className({ 'is-open': true, 'in-transition': false });
 *
 * @param  {Mixed} args  String and Object or just Object
 * @return {String}      Space speerated list of class names
 */

exports.className = function className (...args) {
  const classList = typeof args[0] === 'string' ? args[0].split(' ') : []
  const hash = typeof args[0] === 'object' ? args[0] : args[1] || {}

  Object.keys(hash).forEach(key => {
    if (hash[key]) {
      classList.push(key)
    }
  })

  return classList.filter(Boolean).join(' ')
}

/**
 * Load external resource
 * @param  {String}  source URI of resource
 * @return {Promise}        Resolves to resource module
 */

const cache = {}
exports.load = function load (source) {
  if (cache[source]) {
    return Promise.resolve(cache[source])
  }

  if (Array.isArray(source)) {
    return Promise.all(source.map(loadResource))
  }

  return loadResource(source)
}

function loadResource (source) {
  return new Promise((resolve, reject) => {
    if (/\.css$/.test(source)) {
      const link = html`<link rel="stylesheet" href="${source}?v=${process.env.npm_package_version}" />`
      link.onload = () => {
        cache[source] = true
        resolve()
      }
      document.head.insertBefore(link, document.head.querySelector('link'))
    } else {
      const script = html`<script async></script>`
      let href
      try {
        href = (new window.URL(source)).href
      } catch (err) {
        href = `/${source}.js`
      }
      href += `?v=${process.env.npm_package_version}`

      script.onerror = reject
      script.onload = () => {
        try {
          cache[source] = require(source)
          script.parentNode.removeChild(script)
          resolve(cache[source])
        } catch (err) {
          resolve()
        }
      }
      document.head.appendChild(script)
      script.src = href
    }
  })
}

/**
 * Get viewport width
 * @return {Number}
 */

exports.vw = function vw () {
  return Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
}

/**
 * Get viewport height
 * @return {Number}
 */

exports.vh = function vh () {
  return Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
}

/**
 * Convert degrees to radius
 */

function deg2rad (deg) {
  return deg * (Math.PI / 180)
}

/**
 * Calculate distance between two lat/lng points in km
 * @param {Array} posA lng, lat of position
 * @param {Array} posB lng, lat of another position
 * @return {number} Distance in km
 */

exports.distance = function distance (posA, posB) {
  const [lng1, lat1] = posA
  const [lng2, lat2] = posB

  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1) // deg2rad above
  const dLon = deg2rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c // Distance in km

  return d
}

/**
 * Capture click event on anchor link and scroll target into view
 * @param {Object} event Click event
 */

exports.captureAnchor = function captureAnchor (event) {
  const el = document.getElementById(event.target.hash.substr(1))
  if (!el) return
  el.scrollIntoView({behavior: 'smooth', block: 'start'})
  event.preventDefault()
}

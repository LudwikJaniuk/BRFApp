const html = require('choo/html')
const map = require('./map')
const modal = require('../modal')
const { follow } = require('../utils')
const { loader } = require('../icons')
const { __ } = require('../../locale')
const resolve = require('../../resolve')

let hasModal = false

module.exports = function (state, emit) {
  let center
  const { cooperatives, user, geoip } = state

  if (user.isAuthenticated) {
    const home = cooperatives.find(item => item._id === user.cooperative)
    center = home && { longitude: home.lng, latitude: home.lat }
  }

  if ((!center || geoip.precision === 'exact') && geoip.longitude) {
    center = {
      longitude: geoip.longitude,
      latitude: geoip.latitude,
      isLoading: geoip.isLoading,
      precision: geoip.precision
    }
  }

  if (typeof window !== 'undefined' && !center) {
    emit('geoip:fetch')
  }

  if (hasModal) {
    modal.render(signup(), function () { hasModal = false })
  }

  return html`
    <div class="Map u-hiddenNoScript" id="map-container">
      ${map(state.cooperatives.slice(), center, emit)}

      ${!state.user.isAuthenticated ? html`
        <div class="Map-recruit" id="map-recruit">
          <div class="Map-recruitPanel" id="map-recruit-panel">
            <div class="Type">
              <p>${__('Missing your cooperative?') + ' '} <a href="${resolve('/auth/sign-up')}" onclick=${onclick}>${__('Add your cooperative')}</a></p>
            </div>
          </div>
          <div class="Map-recruitButton" id="map-recruit-button">
            <a href="${resolve('/auth/sign-up')}" onclick=${onclick} class="Button u-block">
              ${__('Add your cooperative')}
            </a>
          </div>
        </div>
      ` : null}
    </div>
  `

  function onclick (event) {
    hasModal = true
    modal.render(signup(), function () { hasModal = false })
    event.preventDefault()
  }

  function signup () {
    const doc = state.content.registration

    if (!doc) {
      emit('content:fetch', 'registration')
      return html`
        <div class="u-marginVl u-textCenter u-colorSky">
          ${loader()}
        </div>
      `
    }

    return html`
      <div class="u-flex u-flexCol u-sizeFullV">
        <div class="u-flexGrow1 u-paddingVl u-paddingHm">
          <h1 class="Display Display--2 u-textCenter">
            ${doc.getStructuredText('registration.disclaimer_title').asText()}
          </h1>
          <div class="Type">
            ${doc.getStructuredText('registration.disclaimer_body').asElement()}
          </div>
        </div>
        <a href="${resolve('/auth/metry/sign-up')}" onclick=${follow} class="Button u-flexShrink0">
          ${__('Create an account')}
        </a>
      </div>
    `
  }
}

const html = require('choo/html');
const map = require('./map');
const { follow } = require('../utils');
const { __ } = require('../../locale');
const resolve = require('../../resolve');

module.exports = function (state, emit) {
  let center;
  const { cooperatives, user, geoip } = state;

  if (user.isAuthenticated) {
    const home = cooperatives.find(item => item._id === user.cooperative);
    center = home && { longitude: home.lng, latitude: home.lat };
  }

  if ((!center || geoip.precission === 'exact') && geoip.longitude) {
    center = {
      longitude: geoip.longitude,
      latitude: geoip.latitude,
      isLoading: geoip.isLoading,
      precission: geoip.precission
    };
  }

  if (typeof window !== 'undefined' && !center) {
    emit('geoip:fetch');
  }

  return html`
    <div class="Map u-hiddenNoScript" id="map-container">
      ${ map(state.cooperatives.slice(), center, emit)  }

      ${ !state.user.isAuthenticated ? html`
        <div class="Map-recruit" id="map-recruit">
          <div class="Map-recruitPanel" id="map-recruit-panel">
            <div class="Type">
              <p>${ __('Missing your cooperative?') + ' ' } <a href="${ resolve('/auth/signup') }" onclick=${ follow }>${ __('Add your cooperative') }</a></p>
            </div>
          </div>
          <div class="Map-recruitButton" id="map-recruit-button">
            <a href="${ resolve('/auth/signup') }" onclick=${ follow } class="Button u-block">
              ${ __('Add your cooperative') }
            </a>
          </div>
        </div>
      ` : null }
    </div>
  `;
};

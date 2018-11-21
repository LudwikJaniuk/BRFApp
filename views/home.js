const html = require('choo/html')
const view = require('../components/view')
const MapExplorer = require('../components/map')
const popup = require('../components/map/popup')
const { getEnergyClass, getPerformance } = require('../components/base')

module.exports = view(home)

function home (state, emit) {
  return html`
    <div class="View-container" id="map-coverall">
      <div class="View-container View-container--lg u-hiddenHasScript" id="map-static">
        <ul class="Map u-flex u-flexWrap u-flexAlignItemsStart u-sizeFull">
          ${state.cooperatives.map(cooperative => {
            const { value: performance } = getPerformance(cooperative) || {}

            return html`
              <li class="Sheet u-paddingAs u-marginAb">
                ${popup({
                  properties: Object.assign({
                    flat: true,
                    performance: performance,
                    energyClass: (getEnergyClass(cooperative) || 'unknown').toLowerCase()
                  }, cooperative)
                })}
              </li>
            `
          })}
        </ul>
      </div>
      ${state.cache(MapExplorer, 'homepage-map').render()}
    </div>
  `
}

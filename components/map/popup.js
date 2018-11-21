const html = require('choo/html')
const { __, __n } = require('../../lib/locale')
const resolve = require('../../lib/resolve')
const icons = require('../icons')

const INITIATIVES = [
  [ 'hasRepresentative', 'Energy representative', icons.energyRepresentative ],
  [ 'hasConsumptionMapping', 'Consumption mapping', icons.energyMap ],
  [ 'hasGoalManagement', 'Energy management', icons.target ],
  [ 'hasBelysningsutmaningen', 'Belysningsutmaningen', icons.lightChallenge ],
  [ 'hasCharger', 'Charger for electric cars', icons.electricCar ],
  [
    ['hasEnergyProduction', 'hasSolarPanels', 'hasGeothermalHeating'],
    'Energy production',
    icons.solarPanel
  ]
]

module.exports = function popup (feature) {
  const { properties: props } = feature
  const classNames = [ 'Map-popup' ]

  if (props.flat) {
    classNames.push('Map-popup--flat')
  }

  let actions = props.actions
  if (typeof props.actions === 'string') {
    // Mapbox casts nested json objects to string
    actions = JSON.parse(props.actions)
  }

  const completedInitiatives = INITIATIVES.reduce((total, [prop]) => {
    return total + (props[prop] ? 1 : 0)
  }, 0)

  return html`
    <div class="${classNames.join(' ')}">
      <div class="u-nbfc">
        <a class="u-textBold" href="${resolve(`/cooperatives/${props._id}`)}">
          ${props.name}
        </a>
        ${props.performance
          ? html`
            <div>
              <span class="u-textBold">${Math.round(props.performance)}</span> kWh/m<sup>2</sup>
            </div>
          `
          : html`
            <div>
              <em class="u-colorDim">${__('No consumtion data')}</em>
            </div>
          `
        }
        ${actions.length
          ? html`
            <span>
              <span class="u-textBold">${actions.length}</span>
              ${' ' + __n('Energy action', 'Energy actions', actions.length)}
            </span>
          `
          : html`<em class="u-colorDim">${__('No energy actions')}</em>`
        }
        <div class="Map-coopProps">
          ${INITIATIVES.map(([ prop, label, icon ]) => {
            const hasProp = Array.isArray(prop) ? prop.find(key => props[key]) : props[prop]
            return html`
              <div class="Map-coopProp u-color${hasProp ? 'Current' : 'Pale'}" data-title="${__(label)}">${icon(22)}</div>
            `
          })}
          <span class="Map-propsSum">
            ${completedInitiatives} / ${INITIATIVES.length} ${' ' + __('Energy initiatives').toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  `
}

const html = require('choo/html')
const Component = require('choo/component')
const resolve = require('../../lib/resolve')
const { getEnergyClass, getPerformance } = require('../base')
const { __ } = require('../../lib/locale')

const UNKNOWN_ENERGY_CLASS = '#bbbbbb'
const ENERGY_CLASSES = {
  A: '#009036',
  B: '#55AB26',
  C: '#C8D200',
  D: '#FFED00',
  E: '#FBBA00',
  F: '#EB6909',
  G: '#E2001A'
}

module.exports = class Performance extends Component {
  update (cooperative) {
    return false
  }

  createElement (cooperative, user) {
    const performance = getPerformance(cooperative)
    const energyClass = getEnergyClass(cooperative)
    const classPosition = energyClass ? Object.keys(ENERGY_CLASSES).indexOf(energyClass) : 3

    let disclaimer = null
    if (performance && performance.isGuesstimate) {
      disclaimer = html`
        <div class="Performance-disclaimer">
          ${__('This figure may be misleading due to the coopeartive not having supplied sufficient information.') + ' '} ${user.cooperative === cooperative._id ? html`
            <a href="${resolve(`/cooperatives/${cooperative._id}/edit`)}">${__('Update information')}</a>
          ` : null}
        </div>
      `
    }

    return html`
      <div class="Performance">
        <figure>
          <svg class="Performance-graph" viewBox="0 0 512 93">
            <defs>
              <path id="def-single-building-small" d="M16,42 L23.0272375,42 L23.0272375,34.8525992 L27.2511797,34.8525992 L27.2511797,42 L34.2784172,42 L34.2784172,10 L16,10 L16,42 Z M26.4214431,13.7712076 L30.6453033,13.7712076 L30.6453033,17.972531 L26.4214431,17.972531 L26.4214431,13.7712076 Z M26.4214431,20.5233491 L30.6453033,20.5233491 L30.6453033,24.7246726 L26.4214431,24.7246726 L26.4214431,20.5233491 Z M26.4214431,27.2753274 L30.6453033,27.2753274 L30.6453033,31.4766509 L26.4214431,31.4766509 L26.4214431,27.2753274 Z M19.6330319,13.7712076 L23.8568921,13.7712076 L23.8568921,17.972531 L19.6330319,17.972531 L19.6330319,13.7712076 Z M19.6330319,20.5233491 L23.8568921,20.5233491 L23.8568921,24.7246726 L19.6330319,24.7246726 L19.6330319,20.5233491 Z M19.6330319,27.2753274 L23.8568921,27.2753274 L23.8568921,31.4766509 L19.6330319,31.4766509 L19.6330319,27.2753274 Z" />
              <path id="def-single-building-large" d="M28.8627451,75.1153846 L41.5393304,75.1153846 L41.5393304,62.3325332 L49.1589909,62.3325332 L49.1589909,75.1153846 L61.8355762,75.1153846 L61.8355762,17.8846154 L28.8627451,17.8846154 L28.8627451,75.1153846 Z M47.6622111,24.6292751 L55.2817236,24.6292751 L55.2817236,32.1431805 L47.6622111,32.1431805 L47.6622111,24.6292751 Z M47.6622111,36.7052206 L55.2817236,36.7052206 L55.2817236,44.219126 L47.6622111,44.219126 L47.6622111,36.7052206 Z M47.6622111,48.780874 L55.2817236,48.780874 L55.2817236,56.2947794 L47.6622111,56.2947794 L47.6622111,48.780874 Z M35.4164497,24.6292751 L43.0359622,24.6292751 L43.0359622,32.1431805 L35.4164497,32.1431805 L35.4164497,24.6292751 Z M35.4164497,36.7052206 L43.0359622,36.7052206 L43.0359622,44.219126 L35.4164497,44.219126 L35.4164497,36.7052206 Z M35.4164497,48.780874 L43.0359622,48.780874 L43.0359622,56.2947794 L35.4164497,56.2947794 L35.4164497,48.780874 Z" />
              <filter id="def-drop-shadow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
                <feOffset dx="2" dy="2" in="SourceAlpha" result="shadowOffsetOuter" />
                <feColorMatrix values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.0789741848 0" type="matrix" in="shadowOffsetOuter" />
              </filter>
            </defs>
            <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
              <g opacity="0.25" transform="translate(12.000000, 20.000000)">
                ${Object.keys(ENERGY_CLASSES).map((className, index) => html`
                  <g transform="translate(${index * 70}, 0)">
                    <polygon fill="${energyClass ? ENERGY_CLASSES[className] : UNKNOWN_ENERGY_CLASS}" points="0 0 68 0 68 52 0 52" />
                    <use width="18" height="32" transform="translate(9, 0)" fill-opacity="0.25" fill="#FFFFFF" xlink:href="#def-single-building-small" />
                  </g>
                `)}
              </g>
              <g transform="translate(${(classPosition * 70)}, 0)">
                <ellipse fill="${energyClass ? ENERGY_CLASSES[energyClass] : UNKNOWN_ENERGY_CLASS}" fill-rule="evenodd" cx="46" cy="47.3942308" rx="46" ry="45.6057692" stroke="#ffffff" stroke-width="2" />
                <g>
                  <use fill="black" fill-opacity="1" filter="url(#def-drop-shadow)" xlink:href="#def-single-building-large" />
                  <use fill="#FFFFFF" fill-rule="evenodd" xlink:href="#def-single-building-large" />
                </g>
              </g>
            </g>
          </svg>
          ${energyClass ? html`
            <figcaption class="u-textCenter">
              <h2 class="Performance-title">
                ${Math.round(performance.value)} kWh/m<sup>2</sup>
              </h2>
              <a href="${resolve('/how-it-works#energijaemfoerelser-i-brf-energi')}" class="Performance-link" title="${__('Learn about how we calculate energy performance')}">
                ${__('What\'s this?')}
              </a>
            </figcaption>
          ` : null}
        </figure>
        ${disclaimer}
      </div>
    `
  }
}

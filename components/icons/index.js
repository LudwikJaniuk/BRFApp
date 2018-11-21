const html = require('choo/html')

exports.chevron = function chevron (direction) {
  const deg = {
    up: '90 9 11',
    right: '180 7 9',
    down: '270 7 10',
    left: 0
  }

  return html`
    <svg class="Icon">
      <use width="0.75em" height="0.75em" y="0.25em" class="Icon-path" xlink:href="#icon-chevron" transform="rotate(${deg[direction] || 0})" />
    </svg>
  `
}

exports.loader = function loader () {
  return html`
    <div class="Icon Icon--loader"></div>
  `
}

exports.energyRepresentative = function energyRepresentative (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-energyRepresentative" />
    </svg>
  `
}

exports.energyMap = function energyMap (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-energyMap" />
    </svg>
  `
}

exports.target = function target (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-target" />
    </svg>
  `
}

exports.lightChallenge = function lightChallenge (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-lightChallenge" />
    </svg>
  `
}

exports.electricCar = function electricCar (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-electricCar" />
    </svg>
  `
}

exports.checkmark = function checkmark (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-checkmark" />
    </svg>
  `
}

exports.solarPanel = function solarPanel (size = 18) {
  return html`
    <svg class="Icon" style="width: ${size}px; height: ${size}px;">
      <use class="Icon-path" xlink:href="#icon-solarpanel" />
    </svg>
  `
}

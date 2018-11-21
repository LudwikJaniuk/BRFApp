const html = require('choo/html')
const { className } = require('../base')
const { __ } = require('../../lib/locale')

const RESERVED = [
  'label',
  'children',
  'description',
  'suffix',
  'unit',
  'multiple'
]

exports.input = function input (props) {
  const attributes = Object.assign({}, props, {
    class: className('Form-input', {
      'Form-input--date': props.type === 'date' || props.type === 'month'
    })
  })

  return html`
    <label class="${className('Form-item', { 'Form-item--required': props.required, [props.className]: props.className })}">
      <span class="Form-label Form-label--sup" title="${props.required ? __('This field is required') : null}">${props.label}</span>
      <input ${scrub(attributes)} />
      ${props.unit ? html`
        <span class="Form-unit">
          <span class="u-colorTransparent">${props.value}</span>${props.unit}
        </span>
      ` : null}
      ${props.suffix ? html`<span class="Form-suffix">${props.suffix}</span>` : null}
    </label>
  `
}

exports.textarea = function textarea (props) {
  const value = props.value
  const attributes = Object.assign({}, props, {
    class: 'Form-input Form-input--textarea'
  })

  delete attributes.value

  return html`
    <label class="${className('Form-item', { 'Form-item--required': props.required, [props.className]: props.className })}">
      <span class="Form-label Form-label--sup" title="${props.required ? __('This field is required') : null}">${props.label}</span>
      <textarea ${scrub(attributes)}>${value}</textarea>
    </label>
  `
}

exports.select = function (props) {
  const attributes = Object.assign({}, props, {
    class: 'Form-select',
    title: props.required ? __('This field is required') : null
  })

  return html`
    <div class="${className('Form-item Form-item--select', { 'Form-item--required': props.required, [props.className]: props.className })}">
      <label class="u-block u-sizeFull u-flex">
        <span class="Form-label Form-label--sup u-clickthrough">${props.label}</span>
        <select ${scrub(attributes)}>${props.children}</select>
      </label>
    </div>
  `
}

exports.checkbox = function checkbox (props) {
  const attributes = Object.assign({}, props, {
    class: 'Form-toggle'
  })

  return html`
    <label class="${className('Form-item Form-item--toggle', { 'Form-item--required': props.required, [props.className]: props.className })}" onselectstart=${event => event.preventDefault()}>
      <span class="u-flexGrow1">
        <span class="Form-label Form-label--lg" title="${props.required ? __('This field is required') : null}">${props.label}</span>
        ${props.description ? html`<span class="Form-label Form-label--description u-colorDark">${props.description}</span>` : null}
      </span>
      <input type="checkbox" ${scrub(attributes)} />
      <span class="Form-proxy Form-proxy--checkbox"></span>
    </label>
  `
}

exports.radiogroup = function radiogroup (options) {
  return options.map(option => {
    const attributes = Object.assign({}, option, {
      class: 'Form-toggle'
    })

    return html`
      <label class="Form-item Form-item--toggle" onselectstart=${event => event.preventDefault()}>
        <span class="u-flexGrow1">
          <span class="Form-label Form-label--lg">${option.label}</span>
          ${option.description ? html`<span class="Form-label Form-label--description u-colorDark">${option.description}</span>` : null}
        </span>
        <input type="radio" ${scrub(attributes)} />
        <span class="Form-proxy Form-proxy--radio"></span>
      </label>
    `
  })
}

function scrub (attrs) {
  return Object.keys(attrs).reduce((obj, key) => {
    if (!RESERVED.includes(key) && attrs[key]) {
      obj[key] = attrs[key]
    }
    return obj
  }, {})
}

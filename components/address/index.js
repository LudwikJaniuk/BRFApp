const html = require('choo/html')
const Component = require('choo/component')
const { input } = require('../form')
const { __ } = require('../../lib/locale')
const { className } = require('../base')

module.exports = class Address extends Component {
  constructor (id) {
    super(id)
    this.isLoading = false
    this.props = {
      isValid: true,
      address: '',
      postalTown: '',
      postalCode: ''
    }
  }

  update (props) {
    return Object.keys(props).reduce((shouldUpdate, key) => {
      return shouldUpdate || props[key] !== this.props[key]
    }, false)
  }

  unload () {
    this.isLoading = false
    this.props = {
      isValid: true,
      address: '',
      postalTown: '',
      postalCode: ''
    }
  }

  createElement (props, onlocate) {
    Object.assign(this.props, props)

    let timeout
    const oninput = event => {
      if (event.key === 'Enter') return event.preventDefault()
      if (event.target.name === 'address' && event.target.value.length < 3) {
        delete props.address
        return
      }

      props[event.target.name] = event.target.value

      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (!props.address || !props.postalCode || !props.postalTown) return

        this.isLoading = true
        this.render(props, onlocate)
        window.fetch(getGeocodeURL(props))
          .then(response => response.json())
          .then(data => {
            this.isLoading = false
            if (!data.results.length) {
              return this.render(Object.assign({}, props, {
                isValid: false
              }), onlocate)
            }

            const components = data.results[0].address_components
            const num = getComponent('street_number', components)
            const street = getComponent('route', components)
            onlocate(Object.assign({
              address: `${street} ${num}`,
              postalCode: getComponent('postal_code', components),
              postalTown: getComponent('postal_town', components)
            }, data.results[0].geometry.location))
          })
      }, 400)
    }

    var element = this.element
    const validity = className('Address-validity', {
      'is-valid': element && !this.isLoading && props.isValid,
      'is-invalid': element && !this.isLoading && !props.isValid,
      'is-loading': element && this.isLoading
    })

    return html`
      <div class="Address">
        <div class="Form-collapse">
          ${input({ label: __('Address'), className: 'Address-street', required: true, name: 'address', value: props.address || '', autocomplete: 'street-address', oninput: oninput })}
          ${input({ label: __('Postnummer'), className: 'Address-postalCode', required: true, name: 'postalCode', value: props.postalCode || '', autocomplete: 'postal-code', oninput: oninput })}
          ${input({ label: __('Ort'), className: 'Address-postalTown', required: true, name: 'postalTown', value: props.postalTown || '', autocomplete: 'address-level2', oninput: oninput })}
        </div>
        <div class="${validity}">
          ${!this.isLoading && !props.isValid && props.address && props.postalCode && props.postalTown ? __('Did not recognize the address') : null}
        </div>
      </div>
    `
  }
}

// get component by type
// (str, arr) -> str
function getComponent (type, components) {
  const component = components.find(item => item.types.includes(type))
  return component ? component.long_name : ''
}

// get geocode resource url
// obj -> str
function getGeocodeURL (values) {
  return [
    `https://maps.googleapis.com/maps/api/geocode/json?address=${values.address}`,
    'language=sv',
    'region=sv',
    `components=postal_code:${values.postalCode}|postal_town:${values.postalTown}|country:SE`,
    `key=${process.env.GOOGLE_GEOCODE_KEY}`
  ].join('&')
}

const html = require('choo/html')
const pick = require('lodash.pick')
const component = require('fun-component')
const app = require('../components/app')
const address = require('../components/address')
const { input, checkbox, radiogroup } = require('../components/form')
const { loader } = require('../components/icons')
const { __ } = require('../locale')

const IGNORE = 'IGNORE'
const VENTILATION_TYPES = [ 'FTX', 'FVP', 'F', 'FT', 'S', 'OTHER' ]

module.exports = app(view, title)

const form = component({
  name: 'registration-form',
  hasGeoip: false,
  props: {
    reuse: false,
    needUpdate: false,
    hasRegistered: true
  },

  update (element, [cooperative, state], [prev]) {
    if (state.geoip.precision && !this.hasGeoip) {
      this.hasGeoip = true
      return true
    }
    return cooperative !== prev
  },

  render (cooperative, state, emit) {
    const doc = state.content.registration
    const url = `/cooperatives/${cooperative._id}`

    const onreuse = event => {
      this.props.reuse = event.target.checked
      this.render(cooperative, state, emit)
    }

    const stash = event => {
      const { target } = event
      const isBoolean = (/checkbox|radio/).test(target.type)
      const cast = target.dataset.cast
      let value = isBoolean ? target.checked : target.value

      if (cast && value) {
        if (cast === 'number' || target.type === 'number') {
          value = parseInt(value.replace(/\s/g, ''))

          if (isNaN(value)) {
            value = ''
          }
        }
      }

      this.props[event.target.name] = value
      this.render(cooperative, state, emit)
    }

    const onHousholdUsageChange = event => {
      let value = +event.target.value

      if (value === 0) {
        this.props.incHouseholdElectricity = false
      } else if (value === 1) {
        this.props.incHouseholdElectricity = true
      } else {
        delete this.props.incHouseholdElectricity
      }

      this.render(cooperative, state, emit)
    }

    const onsubmit = event => {
      const data = pick(Object.assign({}, cooperative, this.props), [
        'needUpdate', 'hasRegistered', 'name', 'numOfApartments', 'yearOfConst',
        'area', 'email', 'ventilationType', 'incHouseholdElectricity',
        'hasLaundryRoom', 'hasGarage', 'hasCharger', 'hasEnergyProduction',
        'hasRepresentative', 'hasConsumptionMapping', 'hasGoalManagement',
        'hasBelysningsutmaningen'
      ])

      if (data.incHouseholdElectricity === IGNORE) {
        delete data.incHouseholdElectricity
      }

      emit('cooperatives:update', { cooperative, data })

      event.preventDefault()
    }

    const onclick = event => {
      const form = event.target.form

      if (form && form.checkValidity && !form.checkValidity()) {
        emit('error', new Error(__('Some required fields need to be filled in or are malformatted')))

        if (form.reportValidity) {
          form.reportValidity()
        }

        event.preventDefault()
      } else {
        emit('error:dismiss')
      }
    }

    const props = Object.assign({
      hasLaundryRoom: false,
      hasGarage: false,
      hasCharger: false,
      hasEnergyProduction: false,
      hasRepresentative: false,
      hasConsumptionMapping: false,
      hasGoalManagement: false,
      hasBelysningsutmaningen: false
    }, cooperative, this.props)

    const householdUsageOptions = [
      ['All household have individual contracts and can choose energy provider'],
      [
        'The cooperative has a contract covering all energy use',
        'Households are charged by usage or fixed ammount'
      ]
    ].map((label, index) => {
      let checked = false
      let { incHouseholdElectricity } = props

      if (index === 1) {
        checked = incHouseholdElectricity
      } else if (index === 0) {
        checked = incHouseholdElectricity === false
      }

      return {
        label: __(label[0]),
        description: label[1] ? __(label[1]) : null,
        value: index.toString(),
        checked: checked,
        name: 'incHouseholdElectricity',
        onchange: onHousholdUsageChange
      }
    })

    if (typeof cooperative.incHouseholdElectricity === 'undefined') {
      householdUsageOptions.push({
        label: __('Don\'t know'),
        value: IGNORE,
        checked: typeof props.incHouseholdElectricity === 'undefined',
        name: 'incHouseholdElectricity',
        onchange: onHousholdUsageChange
      })
    }

    const invalid = cooperative.meters.filter(meter => !meter.valid)
    if (invalid.length && !state.geoip.precision && typeof window !== 'undefined') {
      emit('geoip:fetch')
    }

    console.log(state.geoip.precision)

    return html`
      <form action="${url}" method="POST" class="Form" enctype="application/x-www-form-urlencoded" onsubmit=${onsubmit}>
        <fieldset disabled=${state.isLoading || false}>
          <input type="hidden" name="_method" value="PUT" />
          ${!cooperative.hasRegistered ? html`<input type="hidden" name="hasRegistered" value="true" />` : null}
          <input type="hidden" name="needUpdate" value="${props.needUpdate ? 'true' : 'false'}" />

          <div class="Type">
             ${doc.getStructuredText('registration.cooperative-properties').asElement()}
          </div>

          ${invalid.length ? html`
            <div class="Type u-marginVm">
              ${doc.getStructuredText('registration.meters-need-update').asElement()}
              <ul class="List List--disc">
                ${invalid.map(meter => {
                  const href = process.env.METRY_METER_VIEW.replace(/{{\s?meter_id\s?}}/, meter.meterId)
                  return html`
                    <li class="List-item">
                      <a href="${href}" target="_blank">${__('Meter #%s', meter.meterId)}</a>
                    </li>
                  `
                })}
              </ul>
              <div class="u-marginVm">
                ${address(state.geoip.precision ? state.geoip : null)}
              </div>
            </div>
          ` : null}

          <div class="Form-collapse u-marginTm u-marginBg">
            ${input({ label: __('Cooperative name'), name: 'name', oninput: stash, required: true, value: props.name })}
            ${input({ label: __('Number of apartments'), type: 'number', name: 'numOfApartments', oninput: stash, value: props.numOfApartments })}
            ${input({ label: __('Year of construction'), type: 'number', name: 'yearOfConst', oninput: stash, max: (new Date()).getFullYear(), pattern: '\\d{4}', value: props.yearOfConst })}
            ${input({ label: __('Heated area'), type: 'number', name: 'area', oninput: stash, 'data-cast': 'number', suffix: html`<span>m<sup>2</sup></span>`, value: props.area })}
            ${!cooperative.hasRegistered ? checkbox({ label: __('Reuse e-mail address from registration'), description: __('Register using %s', state.user.email), onchange: onreuse, checked: props.reuse }) : null}
            ${input({ label: __('E-mail address of energy representative'), type: 'email', name: 'email', oninput: stash, readonly: props.reuse, value: (props.reuse && state.user.email) || this.props.email })}
          </div>

          <div class="Type">
            <h2>${__('What type of ventilation is installed?')}
              <br />
              <span class="u-textS u-colorDark">${__('Pick one or more')}</span>
            </h2>
          </div>

          <div class="Form-collapse u-marginTm u-marginBg">
            ${VENTILATION_TYPES.map(type => checkbox({
              label: __(`VENTILATION_TYPE_${type}`),
              checked: props.ventilationType.includes(type),
              name: `ventilationType[][${type}]`,
              onchange: event => {
                this.props.ventilationType = props.ventilationType || []

                if (event.target.checked) {
                  this.props.ventilationType.push(type)
                } else {
                  const index = this.props.ventilationType.findIndex(item => item === type)
                  this.props.ventilationType.splice(index, 1)
                }

                this.render(cooperative, state, emit)
              }
            }))}
          </div>

          <div class="Type">
            <h2>${__('How do households pay for their electricity?')}</h2>
          </div>

          <div class="Form-collapse u-marginTm u-marginBg">
            ${radiogroup(householdUsageOptions)}
          </div>

          <div class="Type">
             ${doc.getStructuredText('registration.cooperative-utilities').asElement()}
          </div>

          <div class="Form-collapse u-marginTm u-marginBg">
            ${checkbox({ label: __('Shared laundry room'), onchange: stash, name: 'hasLaundryRoom', checked: props.hasLaundryRoom })}
            ${checkbox({ label: __('Garage'), onchange: stash, name: 'hasGarage', checked: props.hasGarage })}
            ${checkbox({ label: __('Charger for electric cars'), onchange: stash, name: 'hasCharger', checked: props.hasCharger })}
            ${checkbox({ label: __('Renewable energy production'), onchange: stash, name: 'hasEnergyProduction', checked: props.hasEnergyProduction })}
          </div>

          <div class="Type">
             ${doc.getStructuredText('registration.cooperative-initiatives').asElement()}
          </div>

          <div class="Form-collapse u-marginTm u-marginBg">
            ${checkbox({ label: __('Assigned energy representative'), onchange: stash, name: 'hasRepresentative', checked: props.hasRepresentative })}
            ${checkbox({ label: __('Energy consumption mapping'), onchange: stash, name: 'hasConsumptionMapping', checked: props.hasConsumptionMapping })}
            ${checkbox({ label: __('Goal oriented energy management'), onchange: stash, name: 'hasGoalManagement', checked: props.hasGoalManagement })}
            ${checkbox({ label: __('Participating in belysningsutmaningen'),
              onchange: stash,
              name: 'hasBelysningsutmaningen',
              checked: props.hasBelysningsutmaningen,
              description: html`
              <span>${__('Read more about the intiative') + ' '}
                <a href="http://www.energimyndigheten.se/belysningsutmaningen/" target="_blank">
                  ${__('Here').toLowerCase()}
                </a>
              </span>
            ` })}
          </div>

          <button type="submit" class="Button u-block u-sizeFull" onclick=${onclick}>
            ${__('Save')}
          </button>
        </fieldset>
      </form>
    `
  }
})

function view (state, emit) {
  const { params: { cooperative: id } } = state
  const cooperative = state.cooperatives.find(item => item._id === id)

  if (!state.content.registration) {
    emit('content:fetch', 'registration')
  }

  return html`
    <div class="App-container App-container--sm u-flexExpand">
      ${state.content.registration ? html`
        <div class="u-marginVm">
          ${form(cooperative, state, emit)}
        </div>
      ` : html`
        <div class="u-marginVl u-textCenter">
          ${loader()}
        </div>
      `}
    </div>
  `
}

function title (state) {
  const { params: { cooperative: id } } = state
  const cooperative = state.cooperatives.find(item => item._id === id)

  if (cooperative && cooperative.hasRegistered) {
    return `${__('Edit')} ${cooperative.name}`
  }

  return __('Add cooperative')
}

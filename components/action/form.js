const moment = require('moment')
const html = require('choo/html')
const Component = require('choo/component')
const { select, input, textarea } = require('../form')
const { __ } = require('../../lib/locale')

const DATE_FORMAT = 'YYYY-MM'
const TYPES_PER_CATEGORY = [ 14, 3, 10, 4, 4, 7 ]

module.exports = class ActionForm extends Component {
  constructor (id, state, emit) {
    super(id)
    this.emit = emit
    this.props = {
      category: null
    }
  }

  update (action) {
    return true
  }

  onload () {
    this.props = {
      category: null
    }
  }

  createElement (action) {
    this.action = action._id
    const emit = this.emit
    const onchange = event => {
      this.props[event.target.name] = event.target.value
      this.rerender()
    }

    const props = Object.assign({
      type: action.type || null,
      date: action.date || Date.now(),
      cost: action.cost || null,
      contractor: action.contractor || null,
      description: action.description || null
    }, this.props)

    if (!props.category && props.type) {
      const match = props.type.match(/^(\d+)_/)
      props.category = match && match[1]
    }

    const types = []
    if (props.category) {
      for (let i = 0; i < TYPES_PER_CATEGORY[+props.category - 1]; i += 1) {
        const value = `${props.category}_${i + 1}`
        types.push({
          value: value,
          selected: props.type === value,
          label: __(`ACTION_TYPE_${value}`)
        })
      }

      const other = `${props.category}_x`
      types.push({
        value: other,
        selected: props.type === other,
        label: __(`ACTION_TYPE_${other}`)
      })
    }

    return html`
      <form action="/actions${action._id ? `/${action._id}` : ''}?_method=PUT" method="POST" class="Form" enctype="application/x-www-form-urlencoded" onsubmit=${onsubmit}>
        ${!action._id ? html`
          <input type="hidden" name="cooperative" value=${action.cooperative} />
        ` : null}

        <div class="Form-collapse u-marginBb">

          ${select({ label: __('Type of action'),
            name: 'category',
            required: true,
            onchange: onchange,
            pattern: '[\\d_]+',
            children: [
              html`<option disabled selected=${!props.category} label=${__('Pick one')}></option>`
            ].concat(TYPES_PER_CATEGORY.map((total, index) => {
              const category = (index + 1) + ''
              return html`
              <option value=${category} selected=${props.category === category}>
                ${__(`ACTION_TYPE_${category}`)}
              </option>
            `
            }))})}

          ${props.category ? select({ label: __('Åtgärd'),
            name: 'type',
            required: true,
            onchange: onchange,
            children: [
              html`<option disabled selected=${!props.type} label=${__('Pick one')}></option>`
            ].concat(types.map(option => html`
            <option value=${option.value} selected=${option.selected}>${option.label}</option>
          `))}) : null}

          ${input({ label: __('Date'), type: 'month', name: 'date', required: true, onchange: onchange, value: props.date ? moment(props.date).format(DATE_FORMAT) : null })}
          ${input({ label: __('Cost'), type: 'number', name: 'cost', onchange: onchange, value: props.cost, suffix: 'kr' })}
          ${input({ label: __('Contractor'), type: 'text', name: 'contractor', onchange: onchange, value: props.contractor })}
          ${textarea({ label: __('Description'), rows: 3, name: 'description', onchange: onchange, value: props.description })}
        </div>

        <button type="submit" class="Button u-block u-sizeFull" onclick=${onclick}>${__('Save')}</button>
      </form>
    `

    function onclick (event) {
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

    function onsubmit (event) {
      const data = Object.assign(
        {},
        action,
        serialize(new window.FormData(event.target))
      )
      emit(`actions:${action._id ? 'update' : 'add'}`, data)
      event.preventDefault()
    }
  }
}

function serialize (data) {
  const obj = {}
  data.forEach((value, key) => {
    if (value) obj[key] = value
  })
  return obj
}

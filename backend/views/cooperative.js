const html = require('choo/html');
const header = require('../components/page-head');
const performance = require('../components/performance');
const { defintion, numbered } = require('../components/list');
const { format } = require('../components/utils');
const { summary } = require('../components/action');
const footer = require('../components/app/footer');
const { __, __n } = require('../locale');

module.exports = function (state, prev, send) {
  return html`
    <div class="App">
      ${ header(state, prev, send) }

      <div class="App-container">
        <h1 class="App-title">${ state.name }</h1>

        ${ performance({ performance: state.performance }) }

        <hr class="u-marginVm" />

        <div class="u-flex u-flexJustifyCenter u-marginVm u-textItalic">
          ${ state.actions.length ? html`
            <div>
              <span class="u-floatLeft u-textG u-marginRb">${ state.actions.length }</span>
              <span class="u-textL">${ __n('Energy action', 'Energy actions', state.actions.length) }</span>
              <br />
              <a href="#actions-${ state._id }">${ __('Show') }</a>
            </div>
          ` : html`<span class="u-textL">${ __('No energy actions') }</span>` }
        </div>

        <hr class="u-marginVm" />

        ${ defintion({
          [__('Apartments')]: format(state.numOfApartments),
          [__('Heated area')]: html`<span>${ format(state.area) } m<sup>2</sup></span>`,
          [__('Constructed')]: state.yearOfConst,
          [__('Ventilation type')]: state.ventilationType.join(', ')
        }) }

        <div class="u-marginVm" id="actions-${ state._id }">
          ${ state.actions && numbered(state.actions.map(action => {
            const props = Object.assign({ cooperativeId: state._id }, action);
            return summary(props);
          })) }
        </div>
      </div>

      ${ footer(state, prev, send) }
    </div>
  `;
};

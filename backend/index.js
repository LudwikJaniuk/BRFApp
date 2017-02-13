const choo = require('choo');

const app = module.exports = choo();
const routes = [
  [ '/', require('./views/landing') ],
  [ '/auth', require('./views/auth') ],
  [ '/user', require('./views/user') ],
  [ '/cooperatives', require('./views/map'), [
    [ '/:id', require('./views/cooperative'), [
      [ '/consumption', require('./views/consumption') ],
      [ '/actions', require('./views/actions'), [
        [ '/:id', require('./views/action'), [
          [ '/comments', require('./views/comments'), [
            [ '/:id', require('./views/comment') ]
          ]]
        ]]
      ]],
    ]],
  ]],
  [ '/404', require('./views/error') ],
  [ '/error', require('./views/error') ]
];

app.model({
  reducers: {},
  state: {
    lang: 'sv'
  }
});

app.router({ default: '/404' }, [
  ...routes,
  ...routes.map(localize('en'))
]);

/**
 * Create an iterator that adds a prefix to all root routes with language
 * @param  {String}   lang Language code
 * @return {Function}      Iterator for mapping routes
 */

function localize(lang) {
  return ([ route, view, branches ]) => [
    // Extend route with lang prefix
    `${ lang }${ route }`.replace(/\/$/, ''),
    // Inject lang prop in state
    (state, prev, send) => view(Object.assign({}, state, lang), prev, send),
    // Forward branches as is
    branches
  ];
}
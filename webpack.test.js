const base = require('./webpack.config');
base.entry.push('babel-polyfill');

module.exports = base;

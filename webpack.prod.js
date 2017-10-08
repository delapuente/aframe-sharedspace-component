const base = require('./webpack.config');
const merge = require('webpack-merge');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = merge(base, {
  output: {
    filename: 'aframe-sharedspace-component.min.js'
  },
  plugins: [new UglifyJSPlugin({ sourceMap: true })].concat(base.plugins)
});

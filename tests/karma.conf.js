const webpackConfig = require('../webpack.config.js');

module.exports = function (config) {
  config.set({
    basePath: '../',
    frameworks: ['mocha', 'sinon-chai', 'chai-shallow-deep-equal'],
    files: [
      { pattern: 'tests/**/*.js', watched: false }
    ],
    preprocessors: {
      'tests/**/*.js': ['webpack', 'sourcemap']
    },
    browsers: ['Firefox', 'Chrome'],
    client: {
      captureConsole: true,
      mocha: { ui: 'tdd' }
    },
    webpack: Object.assign(webpackConfig, {
      externals: undefined
    }),
    reporters: ['mocha']
  });
};

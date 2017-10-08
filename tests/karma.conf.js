const webpackConfig = require('../webpack.test.js');

module.exports = function (config) {
  config.set({
    basePath: '../',
    frameworks: ['mocha', 'sinon-chai', 'chai-shallow-deep-equal'],
    files: [
      { pattern: 'tests/index.test.js', watched: false }
    ],
    preprocessors: {
      'tests/**/*.js': ['webpack']
    },
    browsers: ['Firefox', 'Chrome'],
    client: {
      captureConsole: true,
      mocha: { ui: 'tdd' }
    },
    webpack: Object.assign(webpackConfig, {
      externals: undefined
    }),
    coverageIstanbulReporter: {
      reports: [ 'text-summary', 'html' ],
      fixWebpackSourcePaths: true
    },
    reporters: ['mocha', 'coverage-istanbul']
  });
};

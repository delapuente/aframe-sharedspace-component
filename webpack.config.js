const path = require('path');
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

var plugins = [];
process.env.SIZE_ANALYSIS && plugins.push(new BundleAnalyzerPlugin());

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'aframe-sharedspace-component.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'dist'
  },
  externals: {
    aframe: 'AFRAME'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  devtool: 'source-map',
  devServer: {
    contentBase: [path.resolve(__dirname), path.resolve(__dirname, 'assets')],
    watchContentBase: true,
    disableHostCheck: true
  },
  plugins: plugins
};

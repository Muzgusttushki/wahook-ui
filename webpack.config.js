const path = require('path');

module.exports = {
  entry: './src/wahook.js',
  mode: '',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'dist/wahook.js'
  },

  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ["syntax-async-functions", "transform-regenerator", '@babel/plugin-transform-runtime']
          }
        }
      }
    ]
  }
};
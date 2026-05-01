const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const DEFAULT_SERENIDAD_API =
  process.env.SERENIDAD_API_URL ||
  'http://iokwcc8o0s4cw4s48ockoc8g.5.78.111.174.sslip.io';

module.exports = {
  entry: {
    main: './src/index.js',  // Entry point for index.html
    projectViewer: './src/projectViewer.js',  // Entry point for project-viewer.html
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',  // Output each entry point's bundle with its name
    // Required for Electron loadFile(file://.../dist/index.html) — avoids broken chunk/asset URLs
    publicPath: './',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.SERENIDAD_API_URL': JSON.stringify(DEFAULT_SERENIDAD_API),
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',  // Output file name
      template: './public/index.html',  // Template file
      chunks: ['main'],  // Entry point chunk to include
    }),
    new HtmlWebpackPlugin({
      filename: 'project-viewer.html',  // Output file name
      template: './public/project-viewer.html',  // Template file
      chunks: ['projectViewer'],  // Entry point chunk to include
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/icons', to: 'icons' },  // Only copy the directories that exist
        // Remove or comment out this line if 'other-assets' doesn't exist
        // { from: 'public/other-assets', to: 'assets' },
      ],
    }),
  ],
  target: 'electron-renderer',
  devtool: 'source-map',  // Optional for better debugging
};

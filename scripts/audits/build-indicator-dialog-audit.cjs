const fs = require('fs'), path = require('path'), webpack = require('next/dist/compiled/webpack/webpack').webpack;
const root = process.cwd(), stub = path.join(root, 'scripts/audits/indicator-dialog-next.tsx');
webpack({ mode: 'development', target: 'node', devtool: false, entry: path.join(root, 'scripts/audits/indicator-dialog-harness.tsx'), output: { path: path.join(root, 'tmp/indicator-settings-unit'), filename: 'audit.cjs', library: { type: 'commonjs2' } }, externals: [({ request }, cb) => request === 'react' || request === 'react-dom/client' || request === 'react-dom' || request === 'react/jsx-runtime' ? cb(null, 'commonjs ' + request) : cb()], resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { 'next/link$': stub, 'next/navigation$': stub, 'next/dynamic$': path.join(root, 'scripts/audits/indicator-dialog-dynamic.tsx'), '@': path.join(root, 'src') } }, module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(root, 'scripts/audits/indicator-dialog-loader.cjs') }] }, optimization: { minimize: false } }, (error, stats) => { if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
}
else
    console.log('Unit interaction bundle built'); });

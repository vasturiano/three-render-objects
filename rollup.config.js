import resolve from '@rollup/plugin-node-resolve';
import commonJs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import postCss from 'rollup-plugin-postcss';
import terser from "@rollup/plugin-terser";
import dts from 'rollup-plugin-dts';

import pkg from './package.json' with { type: 'json' };
const { name, homepage, version, dependencies, peerDependencies } = pkg;

const umdConf = {
  format: 'umd',
  name: 'ThreeRenderObjects',
  globals: { three: 'THREE' },
  banner: `// Version ${version} ${name} - ${homepage}`
};

export default [
  {
    external: ['three'],
    input: 'src/index.js',
    output: [
      { // umd
        ...umdConf,
        file: `dist/${name}.js`,
        sourcemap: true,
      },
      { // minify
        ...umdConf,
        file: `dist/${name}.min.js`,
        plugins: [terser({
          output: { comments: '/Version/' }
        })]
      }
    ],
    plugins: [
      postCss(),
      resolve(),
      commonJs(),
      babel({ exclude: 'node_modules/**' })
    ]
  },
  { // ES module
    input: 'src/index.js',
    output: [
      {
        format: 'es',
        file: `dist/${name}.mjs`
      }
    ],
    external: [
      ...Object.keys(dependencies || {}),
      ...Object.keys(peerDependencies || {}),
      'three/examples/jsm/controls/TrackballControls.js',
      'three/examples/jsm/controls/OrbitControls.js',
      'three/examples/jsm/controls/FlyControls.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/RenderPass.js'
    ],
    plugins: [
      postCss(),
      babel()
    ]
  },
  { // expose TS declarations
    input: 'src/index.d.ts',
    output: [{
      file: `dist/${name}.d.ts`,
      format: 'es'
    }],
    plugins: [dts()]
  }
];

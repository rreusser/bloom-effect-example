'use strict';

module.exports = function (regl) {
  return regl({
    frag: `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D src, kernel;
      void main () {
        vec4 a = texture2D(src, uv);
        vec4 b = texture2D(kernel, uv);
        gl_FragColor = vec4(
          a.xz * b.xz - a.yw * b.yw,
          a.xz * b.yw + a.yw * b.xz
        ).xzyw;
      }
    `,
    uniforms: {
      src: regl.prop('src'),
      kernel: regl.prop('kernel'),
    },
    framebuffer: regl.prop('dst'),
  });
};

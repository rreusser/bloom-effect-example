'use strict';

module.exports = function (regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec2 xy;
      varying vec2 uv;
      void main () {
        uv = xy * 0.5 + 0.5;
        gl_Position = vec4(xy, 0, 1);
      }
    `,
    frag: `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D src;
      uniform float threshold, pixelRatio;

      vec3 rgb2yuv (vec3 rgb) {
        return vec3 (
          rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114,
          rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5,
          rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081
        );
      }

      void main () {
        vec3 c = texture2D(src, uv).rgb;
        vec3 yuv = rgb2yuv(c);
        float strength = smoothstep(threshold - 0.02, threshold + 0.02, yuv.x);
        gl_FragColor = vec4(vec3(strength), 1);
      }
    `,
    uniforms: {
      pixelRatio: regl.context('pixelRatio'),
      src: regl.prop('src'),
      threshold: regl.prop('threshold'),
    },
    framebuffer: regl.prop('dst'),
  });
};

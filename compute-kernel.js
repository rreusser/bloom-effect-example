'use strict';

module.exports = function (regl) {
  return regl({
    frag: `
      precision highp float;
      #define PI ${Math.PI}
      varying vec2 uv;
      uniform float aspectRatio;
      uniform float radius;
      void main () {
        vec2 uvL = (fract(uv + 0.5) - 0.5) * vec2(aspectRatio, 1);
        float theta = atan(uvL.y, uvL.x);
        float blades = pow(0.5 + 0.5 * cos(8.0 * theta), 2.0);
        gl_FragColor = vec4(
          vec2(exp(-dot(uvL, uvL) / pow(8.0 * radius / 1024.0, 2.0)) / (radius * radius) * 64.0 * 2.0) * blades,
          vec2(0)
        ).xzyw;
      }
    `,
    framebuffer: regl.prop('dst'),
    uniforms: {
      radius: regl.prop('radius')
    }
  });
};

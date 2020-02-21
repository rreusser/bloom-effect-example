'use strict';

module.exports = function (regl) {
  return regl({
    frag: `
      precision highp float;
      #define PI ${Math.PI}
      varying vec2 uv;
      uniform float aspectRatio, magnitude;
      uniform vec2 viewport;
      uniform float radius, points, star, power;
      void main () {
        // Do some modulo arithmetic to put (0, 0) at each of the four corners, which will place the convolution
        // kernel origin at each respective pixel of the image
        vec2 uvL = (fract(uv + 0.5) - 0.5) * vec2(aspectRatio, 1) * viewport.y;

        float theta = atan(uvL.y, uvL.x);
        float blades = pow(0.5 + 0.5 * cos(points * theta), power);

        float scaledRadius2 = dot(uvL / radius, uvL / radius);
        float scaledRadius = sqrt(scaledRadius2);

        float falloff = exp(-scaledRadius2);

        // This step is really important!! This is our convolution kernel. We convolve complex variables in a
        // vec4, stored as vec4(a_r, a_i, b_r, b_i). That means our convolution kernel for something like a
        // blur is vec4(value, 0, value, 0) and *not* vec4(value). The former is just a scalar that will keep
        // channels separate when we convolve it with vec4(r, g, b, a). The latter is a complex number 
        // (value + value * i) which will rotate the phase and mix r-g and b-a, which is *not* what we want
        // for a simple convolution. This is easy to mix up. I do it almost every time.
        gl_FragColor = vec4(
          vec2(falloff * mix(1.0, blades, star)) * magnitude,
          vec2(0)
        ).xzyw;
      }
    `,
    framebuffer: regl.prop('dst'),
    uniforms: {
      viewport: ctx => [ctx.framebufferWidth, ctx.framebufferHeight],
      star: regl.prop('star'),
      points: regl.prop('points'),
      power: regl.prop('power'),
      radius: regl.prop('radius'),
      magnitude: regl.prop('magnitude')
    }
  });
};

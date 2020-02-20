'use strict';

module.exports = function (regl) {
  return regl({ 
    frag: `
      // Retrieved from: https://github.com/rreusser/glsl-fft
      //
      // The MIT License (MIT)
      // 
      // Copyright (c) 2017 Ricky Reusser
      // 
      // Permission is hereby granted, free of charge, to any person obtaining a copy
      // of this software and associated documentation files (the "Software"), to deal
      // in the Software without restriction, including without limitation the rights
      // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      // copies of the Software, and to permit persons to whom the Software is
      // furnished to do so, subject to the following conditions:
      // 
      // The above copyright notice and this permission notice shall be included in all
      // copies or substantial portions of the Software.
      // 
      // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      // SOFTWARE.
      // 
      // Original License:
      // 
      // The MIT License (MIT)
      // 
      // Copyright (c) 2014 David Li (http://david.li)
      // 
      // Permission is hereby granted, free of charge, to any person obtaining a copy
      // of this software and associated documentation files (the "Software"), to deal
      // in the Software without restriction, including without limitation the rights
      // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      // copies of the Software, and to permit persons to whom the Software is
      // furnished to do so, subject to the following conditions:
      // 
      // The above copyright notice and this permission notice shall be included in all
      // copies or substantial portions of the Software.
      // 
      // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      // SOFTWARE.
      precision highp float;

      uniform sampler2D src;
      uniform vec2 resolution;
      uniform float subtransformSize, normalization;
      uniform bool horizontal, forward;

      const float TWOPI = 6.283185307179586;

      vec4 fft (
        sampler2D src,
        vec2 resolution,
        float subtransformSize,
        bool horizontal,
        bool forward,
        float normalization
      ) {
        vec2 evenPos, oddPos, twiddle, outputA, outputB;
        vec4 even, odd;
        float index, evenIndex, twiddleArgument;

        index = (horizontal ? gl_FragCoord.x : gl_FragCoord.y) - 0.5;

        evenIndex = floor(index / subtransformSize) *
          (subtransformSize * 0.5) +
          mod(index, subtransformSize * 0.5) +
          0.5;

        if (horizontal) {
          evenPos = vec2(evenIndex, gl_FragCoord.y);
          oddPos = vec2(evenIndex, gl_FragCoord.y);
        } else {
          evenPos = vec2(gl_FragCoord.x, evenIndex);
          oddPos = vec2(gl_FragCoord.x, evenIndex);
        }

        evenPos *= resolution;
        oddPos *= resolution;

        if (horizontal) {
          oddPos.x += 0.5;
        } else {
          oddPos.y += 0.5;
        }

        even = texture2D(src, evenPos);
        odd = texture2D(src, oddPos);

        twiddleArgument = (forward ? TWOPI : -TWOPI) * (index / subtransformSize);
        twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

        return (even.rgba + vec4(
          twiddle.x * odd.xz - twiddle.y * odd.yw,
          twiddle.y * odd.xz + twiddle.x * odd.yw
        ).xzyw) * normalization;
      }

      void main () {
        gl_FragColor = fft(src, resolution, subtransformSize, horizontal, forward, normalization);
      }
    `,
    uniforms: {
      src: regl.prop('src'),
      resolution: regl.prop('resolution'),
      forward: regl.prop('forward'),
      subtransformSize: regl.prop('subtransformSize'),
      horizontal: regl.prop('horizontal'),
      normalization: regl.prop('normalization'),
    },
    framebuffer: regl.prop('dst'),
  });
};

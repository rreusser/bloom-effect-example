'use strict';

module.exports = function (regl) {
  return regl({
    frag: `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D src, bloomTex;
      uniform bool dither;
      uniform float strength;

      /*
       * https://github.com/mattdesl/glsl-random
       *
       * Copyright (c) 2014, Matt DesLauriers
       *
       * All rights reserved.
       *
       * Redistribution and use in source and binary forms, with or without modification,
       * are permitted provided that the following conditions are met:
       * 
       *     * Redistributions of source code must retain the above copyright notice,
       *       this list of conditions and the following disclaimer.
       *     * Redistributions in binary form must reproduce the above copyright notice,
       *       this list of conditions and the following disclaimer in the documentation
       *       and/or other materials provided with the distribution.
       *     * Neither the name of glsl-random nor the names of its contributors
       *       may be used to endorse or promote products derived from this software
       *       without specific prior written permission.
       * 
       * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
       * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
       * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
       * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
       * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
       * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
       * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
       * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
       * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
       * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
       * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
       */
      highp float random(vec2 co) {
          highp float a = 12.9898;
          highp float b = 78.233;
          highp float c = 43758.5453;
          highp float dt= dot(co.xy ,vec2(a,b));
          highp float sn= mod(dt,3.14);
          return fract(sin(sn) * c);
      }

      void main () {
        vec3 color = texture2D(src, uv).rgb;
        vec3 bloom = texture2D(bloomTex, uv).rgb;
        color += bloom * strength;
        color.r = pow(color.r, 2.2);
        color.g = pow(color.g, 2.2);
        color.b = pow(color.b, 2.2);

        // This doesn't seem so necessary with float/half float
        // color += (random(gl_FragCoord.xy) - 0.5) * (dither ? 1.0 / 255.0 : 0.0);

        gl_FragColor = vec4(color, 1);
      }
    `,
    uniforms: {
      src: regl.prop('src'),
      //dither: regl.prop('dither'),
      strength: regl.prop('strength'),
      bloomTex: regl.prop('bloom'),
    },
  });
};

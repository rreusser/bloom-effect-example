module.exports = function (regl) {
  return regl({
    vert: `
      precision highp float;
      attribute vec2 xy;
      uniform mat4 viewInv;
      varying vec3 reflectDir;
      uniform float aspectRatio;
      void main() {
        reflectDir = (viewInv * vec4(-xy * vec2(aspectRatio, 1), 1, 0)).xyz;
        gl_Position = vec4(xy, 0, 1);
      }
    `,
    frag: `
      precision highp float;
      uniform sampler2D envmap;
      uniform float environment;
      varying vec3 reflectDir;
      #define PI ${Math.PI}

      vec4 lookupEnv (vec3 dir) {
        float lat = atan(dir.z, dir.x);
        float lon = acos(dir.y / length(dir));
        return texture2D(envmap, vec2(0.5 + lat / (2.0 * PI), lon / PI));
      }

      void main () {
        vec3 color = lookupEnv(reflectDir).rgb;
        color = mix(vec3(pow(0.3, 2.2)), color, environment);
        float power = 0.454;
        color.r = pow(color.r, power);
        color.g = pow(color.g, power);
        color.b = pow(color.b, power);
        gl_FragColor = vec4(color, 1);
      }
    `,
    uniforms: {
      envmap: regl.prop('envmap'),
      environment: regl.prop('environment'),
    }
  })
}

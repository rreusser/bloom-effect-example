module.exports = function (regl, mesh) {
  return regl({
    vert: `
      precision highp float;
      attribute vec3 aPosition, aNormal;
      uniform mat4 projection, view;
      uniform vec3 lightPosition;
      varying vec3 vNormal, vPosition;
      uniform vec3 eye;
      void main () {
        vNormal = aNormal;
        vPosition = aPosition;
        gl_Position = projection * view * vec4(aPosition, 1);
      }
    `,
    frag: `
      precision highp float;
      varying vec3 vNormal, vPosition;
      uniform vec3 eye, lightPosition;
      uniform sampler2D envmap;
      uniform float shininess, specular, albedo, reflectivity, environment;

      #define PI ${Math.PI}

      float blinnPhongSpecular(vec3 lightDirection, vec3 viewDirection, vec3 surfaceNormal, float shininess) { 
        vec3 H = normalize(viewDirection + lightDirection);
        return pow(max(0.0, dot(surfaceNormal, H)), shininess);
      }

      vec4 lookupEnv (vec3 dir) {
        float lat = atan(dir.z, dir.x);
        float lon = acos(dir.y / length(dir));
        return texture2D(envmap, vec2(0.5 + lat / (2.0 * PI), lon / PI));
      }

      void main () {
        vec3 eyeDirection = normalize(eye - vPosition);
        vec3 lightDirection = normalize(lightPosition - vPosition);
        vec3 normal = normalize(vNormal);

        vec3 reflectDir = reflect(eyeDirection, normal);
        vec3 refl = lookupEnv(reflectDir).rgb * environment;
        refl.r = pow(refl.r, 1.0 / 2.2);
        refl.g = pow(refl.g, 1.0 / 2.2);
        refl.b = pow(refl.b, 1.0 / 2.2);

        vec3 color = (0.6 + 0.3 * normal) * albedo * (1.0 - reflectivity) + reflectivity * refl;

        float power = blinnPhongSpecular(lightDirection, eyeDirection, normal, shininess);
        color += specular * power;

        gl_FragColor = vec4(color, 1);
      }
    `,
    attributes: {
      aPosition: mesh.positions,
      aNormal: mesh.normals,
    },
    uniforms: {
      lightPosition: [140, 130, 100],
      shininess: regl.prop('shininess'),
      albedo: regl.prop('albedo'),
      specular: regl.prop('specular'),
      reflectivity: regl.prop('reflectivity'),
      envmap: regl.prop('envmap'),
      environment: regl.prop('environment'),
    },
    elements: mesh.cells,
    count: mesh.cells.length * 3,
  });
}

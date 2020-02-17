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
      uniform float shininess, specular, emissive;

      float blinnPhongSpecular(vec3 lightDirection, vec3 viewDirection, vec3 surfaceNormal, float shininess) { 
        vec3 H = normalize(viewDirection + lightDirection);
        return pow(max(0.0, dot(surfaceNormal, H)), shininess);
      }

      void main () {

        vec3 eyeDirection = normalize(eye - vPosition);
        vec3 lightDirection = normalize(lightPosition - vPosition);
        vec3 normal = normalize(vNormal);

        vec3 color = (0.6 + 0.3 * normal) * emissive;

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
      emissive: regl.prop('emissive'),
      specular: regl.prop('specular'),
    },
    elements: mesh.cells,
    count: mesh.cells.length * 3,
  });
}

'use strict';

var Controls = require('controls-state');
var Gui = require('controls-gui');
var angleNormals = require('angle-normals');
var createCamera = require('./regl-turntable-camera');
var isMobile = require('is-mobile')()
var nextPow2 = require('next-pow-2');

var pixelRatio = Math.min(window.devicePixelRatio, 2.0);

require('regl')({
  pixelRatio: pixelRatio,
  extensions: [
    'OES_texture_float',
    'OES_texture_float_linear',
  ],
  optionalExtensions: [
    'OES_texture_half_float',
    'OES_texture_half_float_linear',
  ],
  attributes: {
    antialias: false
  },
  onDone: require('fail-nicely')(run)
});

function run (regl) {
  var hasHalfFloat = regl.hasExtension('OES_texture_half_float') && regl.hasExtension('OES_texture_half_float_linear');

  var bunny = require('bunny');
  bunny.normals = angleNormals(bunny.cells, bunny.positions);

  var camera = createCamera(regl, {
    center: [0, 4, 0],
    theta: 0.4,
    phi: 0.1,
    damping: 0,
    distance: 20,
    noScroll: true,
    renderOnDirty: true,
  });

  var initialBlurSize = Math.round(window.innerHeight / 100)

  var state = Gui(Controls({
    material: Controls.Section({
      shininess: Controls.Slider(128.0, { mapping: x => Math.pow(2, x), inverseMapping: Math.log2, min: 1, max: 512, steps: 64 }),
      specular: Controls.Slider(0.5, { min: 0, max: 1, step: 0.01 }),
      emissive: Controls.Slider(1.0, { min: 0, max: 1, step: 0.01 }),
    }, {expanded: !isMobile}),
    bloom: Controls.Section({
      strength: Controls.Slider(4.0, { min: 0, max: 20, step: 0.1 }),
      passes: Controls.Slider(1, {min: 1, max: 4, step: 1}),
      radius: Controls.Slider(initialBlurSize, { mapping: x => Math.pow(2, x), inverseMapping: Math.log2, min: 1, max: 64, steps: 12 }),
      threshold: Controls.Slider(0.9, { min: 0, max: 1, step: 0.01 }),
      downsample: Controls.Slider(4, { mapping: x => Math.pow(2, x), inverseMapping: Math.log2, min: 1, max: 16, steps: 4 }),
      kernelSize: Controls.Select(9, {options: [5, 9, 13]}),
      //dither: true,
    }, {expanded: !isMobile})
  }));

  // Redraw when config or window size change
  state.$onChange(camera.taint);
  window.addEventListener('resize', camera.taint);

  // Create a framebuffer to which to draw the scene
  var fbo = regl.framebuffer({
    radius: 1,
    type: hasHalfFloat ? 'half float' : 'uint',
  });

  // Create two ping-pong framebuffers for blurring the bloom
  var bloomFbo = [0, 1].map(() => regl.framebuffer({
    color: regl.texture({
      radius: 1,
      type: hasHalfFloat ? 'half float' : 'float',
      mag: 'linear'
    })
  }));

  // Create a command to draw the mesh. Since we're only drawing one mesh, we'll just pass it
  // the data and let regl create the buffers rather than managing them ourselves.
  var drawMesh = require('./draw-mesh')(regl, bunny);

  // Create a shader which sets up a single fullscreen triangle which we'll use to wrap the
  // subsequent shaders so they are configured to draw all fragments.
  var blit = require('./blit')(regl);

  // Create a command to compute the initial un-blurred bloom with the scene fbo as input.
  // This could be avoided with some clever overloading of shaders or with webgl draw buffers
  // to write to this *while* drawing the scene.
  var initializeBloom = require('./initialize-bloom')(regl);

  // Create a command for a single pass of a blur kernel
  var blur = require('./blur')(regl);

  // Finally a command to composite the fbo and bloom to the screen
  var composite = require('./composite')(regl);

  regl.frame(({tick, viewportWidth, viewportHeight, pixelRatio}) => {
    // Resize the framebuffers to match the window size. If the size hasn't changed these
    // are no-ops.
    fbo.resize(viewportWidth, viewportHeight);

    // Downsample the bloom framebuffer as necessary to save computation for what's heavily
    // blurred anyway.
    bloomFbo.forEach(fbo => fbo.resize(
      Math.floor(viewportWidth / state.bloom.downsample),
      Math.floor(viewportHeight / state.bloom.downsample)
    ));

    camera(() => {
      // Draw the mesh to the "fbo" framebuffer
      fbo.use(() => {
        regl.clear({color: [0.3, 0.3, 0.3, 1], depth: 1});
        drawMesh(state.material);
      });

      // Configure a full-screen triangle
      blit(() => {
        // Threshold the fbo and initialize the bloom
        initializeBloom({
          src: fbo,
          dst: bloomFbo[0],
          threshold: state.bloom.threshold
        });

        // Construct the blur passes
        var passes = [];
        var radii = [Math.round(Math.max(1, state.bloom.radius * pixelRatio))];
        for (var radius = nextPow2(radii[0]) / 2; radius >= 1; radius /= 2) {
          radii.push(radius);
        }
        radii.forEach(radius => {
          for (var pass = 0; pass < state.bloom.passes; pass++) {
            passes.push({
              kernel: state.bloom.kernelSize,
              src: bloomFbo[0],
              dst: bloomFbo[1],
              direction: [radius, 0]
            }, {
              kernel: state.bloom.kernelSize,
              src: bloomFbo[1],
              dst: bloomFbo[0],
              direction: [0, radius]
            });
          }
        });

        blur(passes);

        // Composite everything to the screen!
        composite({
          src: fbo,
          bloom: bloomFbo[0],
          //dither: state.bloom.dither,
          strength: state.bloom.strength
        });
      });
    });
  });
}

'use strict';

var Controls = require('controls-state');
var Gui = require('controls-gui');
var angleNormals = require('angle-normals');
var createCamera = require('./regl-turntable-camera');
var isMobile = require('is-mobile')()
var nextPow2 = require('next-pow-2');

var pixelRatio = Math.min(window.devicePixelRatio, 2.0);

require('resl')({
  manifest: {
    envmap: {
      type: 'image',
      src: 'assets/ogd-oregon-360.jpg',
    }
  },
  onDone: assets => {
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
      onDone: require('fail-nicely')(regl => run(regl, assets))
    });
  }
})

function run (regl, assets) {
  regl._gl.canvas.style.position = 'fixed'
  var hasHalfFloat = regl.hasExtension('OES_texture_half_float') && regl.hasExtension('OES_texture_half_float_linear');
  var envmap = regl.texture({
    data: assets.envmap,
    min: 'linear',
    mag: 'linear',
    flipY: true
  });

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

  var initialBlurSize = Math.round(window.innerHeight / 40)
  var needsNewKernel = true;

  var state = Gui(Controls({
    material: Controls.Section({
      shininess: Controls.Slider(2000.0, { mapping: x => Math.pow(10, x), inverseMapping: Math.log10, min: 1, max: 10000, steps: 4 * 10}),
      specular: Controls.Slider(2.0, { min: 0, max: 5, step: 0.01 }),
      reflectivity: Controls.Slider(0.5, { min: 0, max: 1, step: 0.01 }),
      albedo: Controls.Slider(1.0, { min: 0, max: 1, step: 0.01 }),
      environment: Controls.Slider(1.0, { min: 0, max: 1, step: 0.01 }),
    }, {expanded: !isMobile}),
    bloom: Controls.Section({
      strength: Controls.Slider(2.0, { min: 0, max: 20, step: 0.1 }),
      radius: Controls.Slider(initialBlurSize, { mapping: x => Math.pow(2, x), inverseMapping: Math.log2, min: 1, max: 64, steps: 12 * 2 }).onChange(() => needsNewKernel = true),
      threshold: Controls.Slider(2.0, { min: 0, max: 10, step: 0.01 }),
      downsample: Controls.Slider(1, { mapping: x => Math.pow(2, x), inverseMapping: Math.log2, min: 1, max: 16, steps: 4 }),
      method: Controls.Select('FFT convolution', {options: [
        'Gaussian blur',
        'FFT convolution'
      ]}),
      dither: true,
      blur: Controls.Section({
        passes: Controls.Slider(1, {min: 1, max: 4, step: 1}),
        kernelSize: Controls.Select(13, {options: [5, 9, 13]}),
      }, {
        label: 'Gaussian blur parameters'
      }),
      convolution: Controls.Section({
        star: Controls.Slider(0.7, {min: 0, max: 1, step: 0.01}),
        points: Controls.Slider(10, {min: 2, max: 24, step: 1}),
        power: Controls.Slider(2.0, {min: 0, max: 4, step: 0.01}),
      }, {
        label: 'Convolution kernel parameters'
      }).onChange(() => needsNewKernel = true),
    }, {expanded: !isMobile})
  }), {
    containerCSS: `position: absolute; top: 0; right: 0;`
  });

  // Redraw when config or window size change
  state.$onChange(camera.taint);
  window.addEventListener('resize', () => {
    needsNewKernel = true;
    camera.taint()
  });

  // Create a framebuffer to which to draw the scene
  var fbo = regl.framebuffer({
    radius: 1,
    colorType: hasHalfFloat ? 'half float' : 'float',
  });

  // Create two ping-pong framebuffers for blurring the bloom
  var bloomFbo = [0, 1, 2, 3].map(() => regl.framebuffer({
    color: regl.texture({
      radius: 1,
      type: hasHalfFloat ? 'half float' : 'float',
      mag: 'linear'
    })
  }));

  var kernel = regl.framebuffer({
    color: regl.texture({
      radius: 1,
      type: hasHalfFloat ? 'half float' : 'float',
      mag: 'nearest'
    })
  });

  var kernelFFT = regl.framebuffer({
    color: regl.texture({
      radius: 1,
      type: hasHalfFloat ? 'half float' : 'float',
      mag: 'nearest'
    })
  });

  // Create a command to draw the mesh. Since we're only drawing one mesh, we'll just pass it
  // the data and let regl create the buffers rather than managing them ourselves.
  var drawMesh = require('./draw-mesh')(regl, bunny);
  
  var drawEnv = require('./draw-env')(regl);

  var planFFT = require('./fft');
  var fftKernel = require('./fft-kernel')(regl);
  var initializeKernel = require('./initialize-kernel')(regl);
  var convolve = require('./convolve')(regl);
  var plannedFFTWidth, plannedFFTHeight;
  var forwardFFTPlan, inverseFFTPlan, kernelFFTPlan;

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

  var loop = regl.frame(({tick, viewportWidth, viewportHeight, pixelRatio}) => {
    try {
      // Resize the framebuffers to match the window size. If the size hasn't changed these
      // are no-ops.
      fbo.resize(viewportWidth, viewportHeight);

      if (state.bloom.method === 'FFT convolution') {
        var fftWidth = nextPow2(viewportWidth / state.bloom.downsample) / 2;
        var fftHeight = nextPow2(viewportHeight / state.bloom.downsample) / 2;

        bloomFbo.forEach(fbo => fbo.resize(fftWidth, fftHeight));
        kernel.resize(fftWidth, fftHeight);
        kernelFFT.resize(fftWidth, fftHeight);

        if (plannedFFTWidth !== fftWidth || plannedFFTHeight !== fftHeight || needsNewKernel) {
          plannedFFTWidth = fftWidth;
          plannedFFTHeight = fftHeight;

          forwardFFTPlan = planFFT({
            width: plannedFFTWidth,
            height: plannedFFTHeight,
            input: bloomFbo[0],
            ping: bloomFbo[1],
            pong: bloomFbo[2],
            output: bloomFbo[0],
            splitNormalization: true,
            forward: true
          });

          inverseFFTPlan = planFFT({
            width: plannedFFTWidth,
            height: plannedFFTHeight,
            input: bloomFbo[3],
            ping: bloomFbo[1],
            pong: bloomFbo[2],
            output: bloomFbo[0],
            splitNormalization: true,
            forward: false
          });

          kernelFFTPlan = planFFT({
            width: plannedFFTWidth,
            height: plannedFFTHeight,
            input: kernel,
            ping: bloomFbo[1],
            pong: bloomFbo[2],
            output: kernelFFT,
            splitNormalization: true,
            forward: true
          });

          blit(() => {
            camera(() => {
              initializeKernel({
                dst: kernel,
                points: state.bloom.convolution.points,
                power: state.bloom.convolution.power,
                star: state.bloom.convolution.star,
                radius: state.bloom.radius / state.bloom.downsample * 2.0,
                magnitude: 1.0 / Math.pow(state.bloom.downsample, 0.5)
              });
            });
            fftKernel(kernelFFTPlan);
          });
          needsNewKernel = false;
        }
      } else {
        // Downsample the bloom framebuffer as necessary to save computation for what's heavily
        // blurred anyway.
        bloomFbo.forEach(fbo => fbo.resize(
          Math.floor(viewportWidth / state.bloom.downsample),
          Math.floor(viewportHeight / state.bloom.downsample)
        ));
      }

      camera(() => {
        // Draw the mesh to the "fbo" framebuffer
        fbo.use(() => {
          regl.clear({color: [0.3, 0.3, 0.3, 1.0], depth: 1});
          if (state.material.environment) {
            blit(() => {
              drawEnv({
                envmap: envmap,
                environment: state.material.environment,
              });
            });
          }
          drawMesh(Object.assign({}, state.material, {envmap}));
        });

        // Configure a full-screen triangle
        blit(() => {
          // Threshold the fbo and initialize the bloom
          initializeBloom({
            src: fbo,
            dst: bloomFbo[0],
            threshold: state.bloom.threshold
          });

          if (state.bloom.method === 'FFT convolution') {
            fftKernel(forwardFFTPlan);

            convolve({
              src: bloomFbo[0],
              kernel: kernelFFT,
              dst: bloomFbo[3]
            });

            fftKernel(inverseFFTPlan);

          } else {
            // Construct the blur passes
            var passes = [];
            var radii = [Math.round(Math.max(1, state.bloom.radius * pixelRatio / state.bloom.downsample))];
            for (var radius = nextPow2(radii[0]) / 2; radius >= 1; radius /= 2) {
              radii.push(radius);
            }
            radii.forEach(radius => {
              for (var pass = 0; pass < state.bloom.blur.passes; pass++) {
                passes.push({
                  kernel: state.bloom.blur.kernelSize,
                  src: bloomFbo[0],
                  dst: bloomFbo[1],
                  direction: [radius, 0]
                }, {
                  kernel: state.bloom.blur.kernelSize,
                  src: bloomFbo[1],
                  dst: bloomFbo[0],
                  direction: [0, radius]
                });
              }
            });

            blur(passes);
          }

          // Composite everything to the screen!
          composite({
            src: fbo,
            bloom: bloomFbo[0],
            dither: state.bloom.dither,
            strength: state.bloom.strength
          });
        });
      });
    } catch (e) {
      loop.cancel();
      console.error(e);
    }
  });
}

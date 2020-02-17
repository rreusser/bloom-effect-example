'use strict';

var createCamera = require('inertial-turntable-camera');
var interactionEvents = require('normalized-interaction-events');

var RADIANS_PER_HALF_SCREEN_WIDTH = Math.PI * 2 * 0.4;

module.exports = function createReglCamera (regl, opts) {
  var element = regl._gl.canvas;

  function getAspectRatio () {
    return element.clientWidth / element.clientHeight;
  }

  var camera = createCamera(Object.assign({}, {
    aspectRatio: getAspectRatio(),
  }, opts || {}));

  var setCameraUniforms = regl({
    context: {
      projection: () => camera.state.projection,
      view: () => camera.state.view,
      viewInv: () => camera.state.viewInv,
      eye: () => camera.state.eye,
    },
    uniforms: {
      projection: regl.context('projection'),
      view: regl.context('view'),
      viewInv: regl.context('viewInv'),
      eye: regl.context('eye')
    }
  });

  interactionEvents(element)
    .on('wheel', function (ev) {
      camera.zoom(ev.x, ev.y, Math.exp(-ev.dy) - 1.0);
      ev.originalEvent.preventDefault();
    })
    .on('mousemove', function (ev) {
      if (!ev.active || ev.buttons !== 1) return;

      if (ev.mods.alt) {
        camera.zoom(ev.x0, ev.y0, Math.exp(ev.dy) - 1.0);
      } else if (ev.mods.shift) {
        camera.pan(ev.dx, ev.dy);
      } else if (ev.mods.meta) {
        camera.pivot(ev.dx, ev.dy);
      } else {
        camera.rotate(
          -ev.dx * RADIANS_PER_HALF_SCREEN_WIDTH,
          -ev.dy * RADIANS_PER_HALF_SCREEN_WIDTH
        );
      }
      ev.originalEvent.preventDefault();
    })
    .on('touchmove', function (ev) {
      if (!ev.active) return;
      camera.rotate(
        -ev.dx * RADIANS_PER_HALF_SCREEN_WIDTH,
        -ev.dy * RADIANS_PER_HALF_SCREEN_WIDTH
      );
      ev.originalEvent.preventDefault();
    })
    .on('pinchmove', function (ev) {
      if (!ev.active) return;
      camera.zoom(ev.x, ev.y, 1 - ev.zoomx);
      camera.pan(ev.dx, ev.dy);
    })
    .on('touchstart', ev => ev.originalEvent.preventDefault())
    .on('pinchstart', ev => ev.originalEvent.preventDefault())


  function invokeCamera (props, callback) {
    if (!callback) {
      callback = props;
      props = {};
    }

    camera.tick(props);

    setCameraUniforms(function () {
      callback(camera.state, camera.params);
    });
  }

  invokeCamera.taint = camera.taint;
  invokeCamera.resize = camera.resize;
  invokeCamera.tick = camera.tick;
  invokeCamera.setUniforms = setCameraUniforms;

  Object.defineProperties(invokeCamera, {
    state: {
      get: function () { return camera.state; },
      set: function (value) { camera.state = value; }
    },
    params: {
      get: function () { return camera.params; },
      set: function (value) { camera.params = value; }
    },
  });

  window.addEventListener('resize', function () {
    camera.resize(getAspectRatio());
  }, false);
  
  return invokeCamera;
};

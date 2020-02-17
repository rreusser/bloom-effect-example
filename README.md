# Bloom Effect Example

> [regl](https://github.com/regl-project/regl)-based bloom effect in nearly-vanilla WebGL

## Introduction

This example performs a bloom effect in WebGL using a [separable Gaussian blur](https://github.com/Jam3/glsl-fast-gaussian-blur). To achieve a relatively smooth blur with relatively few passes, it downsamples the full-size framebuffer when computing the blur and performs blur passes of, for example, radius 32, 16, 8, 4, 2, and finally 1 pixel. That makes it not really an exact Gaussian blur, but seems to get the job done.

[Live example](https://rreusser.github.io/bloom-effect-example/)

![bloom](./docs/bloom.jpg)

## License

&copy; 2020 Ricky Reusser. MIT License.

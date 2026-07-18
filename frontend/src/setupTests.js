// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

global.OffscreenCanvas = class {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {
      drawImage: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      createImageData: jest.fn(),
    };
  }
  toDataURL() {
    return "";
  }
};


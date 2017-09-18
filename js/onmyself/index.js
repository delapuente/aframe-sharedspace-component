import { registerComponent } from 'aframe';

export default registerComponent('onmyself', {
  schema: {
    share: { type: 'array', default: [] }
  }
});

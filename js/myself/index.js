import { registerComponent } from 'aframe';

export default registerComponent('myself', {
  schema: {
    share: { type: 'array', default: [] }
  }
});

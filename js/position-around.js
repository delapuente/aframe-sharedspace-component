import { registerComponent, utils } from 'aframe';

export default registerComponent('position-around', {
  dependencies: ['position'],

  schema: {
    radius: { default: 1.6 },
    height: { default: 1.6 },
    position: { default: 1 }
  },

  init() {
    this.update();
  },

  update() {
    this.el.setAttribute('position', this._getPosition(this.data.position));
  },

  _getPosition(roomPosition) {
    const { height, radius } = this.data;
    const isEven = roomPosition % 2 === 0;
    if (isEven) {
      return this._inFrontOf(this._getPosition(roomPosition - 1));
    }

    const layer = Math.ceil(Math.log2(roomPosition));
    const capacity = Math.pow(2, layer);
    const previousCapacity = layer > 1 ? Math.pow(2, layer - 1) : 0;
    const positionInLayer = roomPosition - previousCapacity;
    const positionAroundTable = 2 * Math.PI / capacity * positionInLayer;
    return {
      x: Math.cos(positionAroundTable) * radius,
      y: height,
      z: Math.sin(positionAroundTable) * radius
    };
  },

  _inFrontOf({ x, y, z }) {
    return { x: -x, y, z: -z };
  }
});

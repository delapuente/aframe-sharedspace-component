
class GuestList {
  constructor(timestamp, list=[]) {
    this.timestamp = timestamp;
    this._list = list;
  }

  add(guest) {
    if (this._list.indexOf(guest) < 0) {
      this._list.push(guest);
    }
  }

  remove(guest) {
    const index = this._list.indexOf(guest);
    this._list[index] = null;
  }

  get length() {
    return this._list.length;
  }

  equals(another) {
    if (this === another) { return true; }
    if (this.timestamp !== another.timestamp) { return false; }
    if (this._list.length !== another._list.length) { return false; }
    for (let i = 0, l = this._list.length; i < l; i++) {
      if (this._list[i] !== another._list[i]) { return false; }
    }
    return true;
  }

  host() {
    for (let i = 0, l = this._list.length; i < l; i++) {
      const guest = this._list[i];
      if (guest) { return guest; }
    }
    return;
  }

  /*
   * XXX: Assumes the target list is contained up to the length of the former
   * one. So it computes removals of participants up to this point and
   * additions until the end of the target list.
   */
  computeChanges(target) {
    const changes = [];
    const length = this._list.length;
    const newLength = target._list.length;
    for (let index = 0; index < length; index++) {
      if (!target._list[index]) {
        const id = this._list[index];
        changes.push({
          id,
          role: this.getRole(id),
          position: index + 1,
          action: 'exit'
        });
      }
    }
    for (let index = length; index < newLength; index++) {
      if (!this._list[index]) {
        const id = target._list[index];
        changes.push({
          id,
          role: target.getRole(id),
          position: index + 1,
          action: 'enter'
        });
      }
    }
    return changes;
  }

  nextHost() {
    let hostIndex = this._list.indexOf(this.host());
    for (let i = hostIndex + 1, l = this._list.length; i < l; i++) {
      const guest = this._list[i];
      if (guest) { return guest; }
    }
    return;
  }

  isPresent(id) {
    return this.indexOf(id) >= 0;
  }

  position(id) {
    return this.indexOf(id) + 1;
  }

  indexOf(id) {
    return this._list.indexOf(id);
  }

  getRole(id) {
    return this.isPresent(id) ?
           (this.isHost(id) ? 'host' : 'guest') : 'unknown';
  }

  isHost(id) {
    return id === this.host();
  }

  clear() {
    this._list = [];
  }

  static serialize(list) {
    return { timestamp: list.timestamp, list: list._list.slice(0) };
  }

  static deserialize(json) {
    return new GuestList(json.timestamp, json.list);
  }

  static transformationCost(origin, destination) {
    return (destination.timestamp - origin.timestamp);
  }

  static copy(list) {
    return GuestList.deserialize(GuestList.serialize(list));
  }
}

export { GuestList };

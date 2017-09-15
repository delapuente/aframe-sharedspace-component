
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
    const index =  this._list.indexOf(guest);
    this._list[guest] = null;
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

  nextHost() {
    let hostIndex = this._list.indexOf(this.host());
    for (let i = hostIndex + 1, l = this._list.length; i < l; i++) {
      const guest = this._list[i];
      if (guest) { return guest; }
    }
    return;
  }
}

export { GuestList };

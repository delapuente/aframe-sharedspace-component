
class GuestList {
  constructor(timestamp, list=[]) {
    this.timestamp = timestamp;
    this._list = list;
  }

  add(guest) {
    this._list.push(guest);
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
}

export { GuestList };

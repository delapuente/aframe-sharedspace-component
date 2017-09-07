import signalhub from 'signalhub';
import webRtcSwarm from 'webrtc-swarm';

class NetworkAdapter {

  constructor(name, server, { capacity=undefined } = {}) {
    this._ondata = this._ondata.bind(this);

    const hub = signalhub(name, [server]);
    this._swarm = webRtcSwarm(hub);
    this._swarm.on('peer', this._addNewPeer.bind(this));
    this._swarm.on('disconnect', this._removePeer.bind(this));
  }

  sendUpdates(updates) {
    this._broadcast(updates);
  }

  _broadcast(things) {
    const data = JSON.stringify(things);
    this._swarm.peers.forEach(peer => peer.send(data));
  }

  _addNewPeer(peer, id) {
    console.log(`Connecting peer ${id}`);
    peer.on('data', this._ondata);
  }

  _removePeer(peer, id) {
    console.log(`Disconnecting peer ${id}`);
  }

  _ondata(data) {
    if (typeof this.onupdates === 'function') {
      this.onupdates(JSON.parse(data));
    }
  }

}

export { NetworkAdapter };

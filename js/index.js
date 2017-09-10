import * as AFRAME from 'aframe';
import 'aframe-look-at-component';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';

const scene = document.querySelector('a-scene');
const table = scene.querySelector('.table');
const placementHeight = 1.5;
const placementRadius = parseInt(table.getAttribute('radius')) + 0.3;
const [roomName, host] = location.search.substr(1).split(':');
const amIHost = !host;
const server = 'localhost:9000';
const peers = new Map();
const participantList = [];

let swarm;
let nextRoomPosition = 1;
let syncCounter = 1;

if (scene.hasLoaded) { initP2P(); }
else { scene.addEventListener('loaded', () => initP2P()); }

function initP2P() {
  const hub = signalhub(roomName || 'room-101', [server]);
  window.swarm = swarm = new WebRtcSwarm(hub);
  swarm.on('peer', onPeer);
  swarm.on('disconnect', onDisconnect);
  initMyself();
}

function initMyself() {
  if (amIHost) {
    const me = swarm.me;
    addParticipant(me, me);
    const url = new URL(location.href);
    url.search += `:${me}`;
    history.pushState({} , '', url.href);
  }
}

function onPeer(peer, id) {
  console.log(`Connecting with peer ${id}`);
  peers.set(id, { peer });
  (amIHost ? onGuess(peer, id) : onCandidate(peer, id));
}

function onDisconnect(peer, id) {
  console.log(`Peer ${id} is leaving`);
}

function onGuess(peer, id) {
  addParticipant(id, id);
  broadcast(listMessage(participantList));
}

function listMessage(list) {
  return { list };
}

function broadcast(msg) {
  msg.sync = syncCounter;
  swarm.peers.forEach(peer => peer.send(JSON.stringify(msg)));
  syncCounter++;
}

function onCandidate(peer, id) {
  const isHost = host === id;
  if (isHost) {
    peer.on('data', getHostData);
  }
}

function getHostData(data) {
  data = JSON.parse(data);
  const isOutOfDate = data.sync <= syncCounter;
  if (isOutOfDate) { return; }

  const currentParticipants = participantList.length;
  const newParticipants = data.list.slice(currentParticipants);
  newParticipants.forEach(id => addParticipant(id, id));
}

function addParticipant(name, id) {
  participantList.push(id);
  const folk = document.createElement('a-plane');
  folk.setAttribute('width', '0.5');
  folk.setAttribute('height', '0.5');
  folk.setAttribute('text', `value: ${name}`);
  folk.setAttribute('look-at', getStraightSight());
  folk.setAttribute('position', getPosition(nextRoomPosition));
  folk.id = `peer:${id}`;
  scene.appendChild(folk);
  requestAnimationFrame(() => {
    folk.removeAttribute('look-at');
    if (swarm.me === id) {
      const camera = document.createElement('a-entity');
      camera.setAttribute('camera', 'userHeight: 0');
      camera.setAttribute('look-controls', 'enabled:true');
      camera.setAttribute('rotation', '0 180 0');
      folk.appendChild(camera);
    }
  });
  nextRoomPosition++;
}

function getStraightSight() {
  const { x, z } = table.getAttribute('position');
  return { x, y: placementHeight, z};
}

function getPosition(roomPosition) {
  const isEven = roomPosition % 2 === 0;
  if (isEven) {
    return inFrontOf(getPosition(roomPosition - 1));
  }

  const layer = Math.ceil(Math.log2(roomPosition));
  const capacity = Math.pow(2, layer);
  const previousCapacity = layer > 1 ? Math.pow(2, layer - 1) : 0;
  const positionInLayer = roomPosition - previousCapacity;
  const positionAroundTable = 2 * Math.PI / capacity * positionInLayer;
  return {
    x: Math.cos(positionAroundTable) * placementRadius,
    y: placementHeight,
    z: Math.sin(positionAroundTable) * placementRadius
  };
}

function inFrontOf({ x, y, z }) {
  return { x: -x, y, z: -z };
}

import './positional-audio-patch';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';

const scene = document.querySelector('a-scene');
const assets = document.querySelector('a-assets');
const table = scene.querySelector('.table');
const placementHeight = 1.5;
const placementRadius = parseFloat(table.getAttribute('radius')) + 0.3;
const [roomName, host] = location.search.substr(1).split(':');
const amIHost = !host;
const server = 'localhost:9000';
const peers = new Map();
const participantList = [];

let swarm;
let nextRoomPosition = 1;
let syncCounter = 0;

if (scene.hasLoaded) { initP2P(); }
else { scene.addEventListener('loaded', () => initP2P()); }

function initP2P() {
  navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const hub = signalhub(roomName || 'room-101', [server]);
    window.swarm = swarm = new WebRtcSwarm(hub, { stream });
    swarm.on('peer', onPeer);
    swarm.on('disconnect', onDisconnect);
    initMyself();
  }, () => console.log('algo fue mal'));
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
  addParticipant(id, id, peer.stream);
  broadcast(listMessage(participantList));
}

function listMessage(list) {
  return { type: 'list', list };
}

function broadcast(msg) {
  syncCounter++;
  msg.sync = syncCounter;
  swarm.peers.forEach(peer => peer.send(JSON.stringify(msg)));
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
  syncCounter = data.sync;
}

function addParticipant(name, id, stream) {
  const isMe = swarm.me === id;

  participantList.push(id);

  const folk = document.createElement('a-plane');
  folk.id = `peer:${id}`;
  folk.setAttribute('width', '0.5');
  folk.setAttribute('height', '0.5');
  folk.setAttribute('text', `value: ${name}`);

  if (stream) {
    console.log('Streaming from ', stream);
    const audio = document.createElement('audio');
    audio.id = `peer-source:${id}`;
    audio.srcObject = stream;
    assets.appendChild(audio);
    folk.setAttribute('sound', `src: #${audio.id}; autoplay: true`);
  }

  const position = getPosition(nextRoomPosition);

  if (isMe) {
    const camera = document.createElement('a-entity');
    camera.setAttribute('camera', 'user-height: 0');
    camera.setAttribute('look-controls', 'enabled: true');
    camera.setAttribute('position', position);
    camera.appendChild(folk);
    folk.setAttribute('rotation', '0 180 0');
    scene.appendChild(camera);
  }
  else {
    folk.setAttribute('position', position);
    scene.appendChild(folk);
  }

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

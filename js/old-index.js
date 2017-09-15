import './positional-audio-patch';
import { registerComponent } from 'aframe';
import signalhub from 'signalhub';
import WebRtcSwarm from 'webrtc-swarm';

localStorage.removeItem('debug');

const scene = document.querySelector('a-scene');
const assets = document.querySelector('a-assets');
const table = scene.querySelector('.table');
const placementHeight = 1.5;
const placementRadius = parseFloat(table.getAttribute('radius')) + 0.3;
const [roomName, host] = location.search.substr(1).split(':');
const amIHost = !host;
const server = 'https://signaling.eu.ngrok.io' || 'localhost:9000';
const peers = window.peers = new Map();
const participantList = [];

let swarm;
let nextRoomPosition = 1;
let syncCounter = 0;

if (scene.hasLoaded) { initP2P(); }
else { scene.addEventListener('loaded', () => initP2P()); }

registerComponent('peer', {
  tick() {
    broadcast(rotationMessage(this.el.getAttribute('rotation')));
  }
});

function initP2P() {
  navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const hub = signalhub(roomName || 'room-101', [server]);
    window.swarm = swarm = new WebRtcSwarm(hub, {
      stream,
      offerConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }
    });
    console.log('Me:', swarm.me);
    console.log(`Publishing audio ${stream.id}`);
    swarm.on('peer', onPeer);
    swarm.on('disconnect', onDisconnect);
    initMyself();
  }, (e) => console.log('getUserMedia() failed:', e));
}

function initMyself() {
  if (amIHost) {
    const me = swarm.me;
    addParticipant(me, me, null, nextRoomPosition++);
    const url = new URL(location.href);
    url.search += `:${me}`;
    history.pushState({} , '', url.href);
  }
}

function onPeer(peer, id) {
  console.log(`Connecting with peer ${id}`);
  peers.set(id, peer);
  peer.on('stream', stream => peer.stream = stream);
  peer.on('data', updateRotation.bind(undefined, id));
  (amIHost ? onGuess(peer, id) : onCandidate(peer, id));
  checkWaitingLists();
}

function updateRotation(id, data) {
  data = JSON.parse(data);
  if (data.type !== 'rotation') { return; }
  const el = document.getElementById(`peer-${id}`);
  if (!el) { return; }

  const { x, y, z } = data.rotation;
  el.setAttribute('rotation', { x: -x, y: y + 180, z });
}

function onDisconnect(peer, id) {
  console.log(`Peer ${id} is leaving`);
}

function onGuess(peer, id) {
  addParticipant(id, id, peer.stream, nextRoomPosition++);
  broadcast(listMessage(participantList));
}

function listMessage(list) {
  return { type: 'list', list };
}

function rotationMessage(rotation) {
  return { type: 'rotation', rotation };
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
  if (data.type !== 'list') { return; }
  const isOutOfDate = data.sync <= syncCounter;
  if (isOutOfDate) { return; }

  syncCounter = data.sync;
  const currentParticipants = participantList.length;
  const newParticipants = data.list.slice(currentParticipants);
  newParticipants.forEach(id => {
    const roomPosition = nextRoomPosition++;
    waitForParticipants([id]).then(() => {
      const stream = peers.get(id) && peers.get(id).stream;
      addParticipant(id, id, stream, roomPosition);
    });
  });
}

var waitingLists = [];

function waitForParticipants(participants) {
  const waitingList = new Set(participants);
  updateWaitingList(waitingList);

  const stillWaiting = waitingList.size > 0;
  return stillWaiting ? (new Promise(fulfill => {
    waitingLists.push([waitingList, fulfill]);
  })) : Promise.resolve();
}

function checkWaitingLists() {
  for (let i = 0, l = waitingLists.length; i < l; i++) {
    const [waitingList, fulfill] = waitingLists.shift();
    updateWaitingList(waitingList);

    const stillWaiting = waitingList.size > 0;
    if (stillWaiting) {
      waitingLists.push([waitingList, fulfill]);
    }
    else {
      fulfill();
    }
  }
}

function updateWaitingList(waitingList) {
  for (const id of waitingList) {
    if (peers.has(id) || id === swarm.me) {
      waitingList.delete(id);
    }
  }
}

function addParticipant(name, id, stream, roomPosition) {
  const isMe = swarm.me === id;

  participantList.push(id);

  const folk = document.createElement('a-plane');
  folk.id = `peer-${id}`;
  folk.setAttribute('width', '0.5');
  folk.setAttribute('height', '0.5');
  folk.setAttribute('text', `value: ${name}`);

  if (stream) {
    console.log('Streaming from', stream);
    const audio = new Audio();
    audio.id = `peer-${id}-source`;
    audio.srcObject = stream;
    assets.appendChild(audio);
    folk.setAttribute('sound', `src: #${audio.id}`);
  }

  const position = getPosition(roomPosition);

  if (isMe) {
    const camera = document.createElement('a-entity');
    camera.setAttribute('peer', '');
    camera.setAttribute('camera', 'user-height: 0');
    camera.setAttribute('look-controls', 'enabled: true');
    camera.setAttribute('position', position);
    camera.appendChild(folk);
    scene.appendChild(camera);
  }
  else {
    folk.setAttribute('position', position);
    scene.appendChild(folk);
  }
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

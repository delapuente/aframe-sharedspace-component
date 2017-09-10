import signalhub from 'signalhub';
import webRtcSwarm from 'webrtc-swarm';

const scene = document.querySelector('a-scene');
const table = scene.querySelector('.table');

if (scene.hasLoaded) { init(); }
else { scene.addEventListener('loaded', () => init()); }

function init() {
  const hub = signalhub('room-101', ['localhost:9000']);
  const swarm = webRtcSwarm(hub);
  swarm.on('peer', addParticipant);
}

function addParticipant(peer, id) {

}

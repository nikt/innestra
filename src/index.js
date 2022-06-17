import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import cells from './cells.geojson';

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.z = 100;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animation);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );

controls.target.set(0, 1, 0);
controls.update();

const extrudeSettings = {
    steps: 2,
    depth: 2,
    bevelEnabled: false,
}

let group = new THREE.Group();
let meshes = [];
for (var i = 0; i < cells.features.length; i++) {
    let f = cells.features[i];
    let shape = new THREE.Shape();

    // start at first coordinate
    const coords = f.geometry.coordinates[0];
    const first = coords[0];
    shape.moveTo(first[0], first[1]);

    // visit rest of coordinates
    for (var j = 1; j < coords.length; j++) {
        const c = coords[j];
        shape.lineTo(c[0], c[1]);

        // NOTE: last coordinate closes shape on its own
    }

    let settings = {
        ...extrudeSettings,
        depth: extrudeSettings.depth + (Math.max(0, f.properties.height) / 1000.0),
    }

    const r = rgbToHex(i % 256, 255 - (i % 256), 0);
    const mat = new THREE.MeshBasicMaterial({color: (f.properties.height > 0) ? r : '#0000ff'});
    const geometry = new THREE.ExtrudeGeometry(shape, settings);
    const cell = new THREE.Mesh(geometry, mat);
    group.add(cell);

    console.log('adding cell %d', i);
    meshes.push(cell);
}
scene.add(group);

console.log(meshes[0]);

// animation

function animation(time) {
    // group.rotation.x = time / 2000;
    // group.rotation.y = time / 1000;

    renderer.render(scene, camera);
}

var msg = 'app.js - Hello World';
console.log(msg);

console.log(cells.type);

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
  
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
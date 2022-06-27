import './style.css';
import _ from 'lodash';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/OrbitControls'
import { Header } from './map/header.js';
import { MapModel } from './map/mapModel';

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 12.5, -5);

const scene = new THREE.Scene();

let header = new Header();
header.buildHeader();

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animation);
document.body.appendChild(renderer.domElement);

const controls = new MapControls( camera, renderer.domElement );

// controls.enableDamping = true;
// controls.dampingFactor = 0.05;

controls.screenSpacePanning = false;

controls.minDistance = 3;
controls.maxDistance = 100;

controls.maxPolarAngle = Math.PI / 2;

controls.target.set(0, 5, -12.5);
controls.update();

// raycaster vars
let targetCell;
let raycaster = new THREE.Raycaster();
raycaster.layers.set(1);
const pointer = new THREE.Vector2();
document.addEventListener('mousemove', onPointerMove);

let particleLight;
buildLights();

let map = new MapModel();
map.init();

scene.add(map);

function buildLights() {
    particleLight = new THREE.Mesh(
        new THREE.SphereGeometry(4, 8, 8),
        new THREE.MeshBasicMaterial( { color: 0xffffbf } )
    );
    particleLight.position.set(100, 50, 0);
    scene.add(particleLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 800);
    particleLight.add(pointLight);

    // lighting
    const ambient = new THREE.AmbientLight(0xbbbbbb);
    scene.add(ambient);
}

// animation
function animation(time) {
    controls.update();

    checkRaycast();

    renderer.render(scene, camera);
}

function checkRaycast() {
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(scene.children, true);

    if (intersections.length > 0) {
        if (targetCell != intersections[0].object) {
            if (targetCell) {
                // reset color
                targetCell.material.color.setHex(targetCell.currentHex);
            }

            // highlight color
            targetCell = intersections[0].object;
            targetCell.currentHex = targetCell.material.color.getHex();
            targetCell.material.color.setHex(0xff0000);

            // figure out what user is pointing at (cell or marker)
            if (targetCell.definition.geometry.type == "Point") {
                // marker
                header.setInnerHTML(
                    _.join([
                        '<h1>' + targetCell.definition.properties.name + '</h1>',
                        targetCell.definition.properties.legend,
                    ], ' ')
                );
            } else if (targetCell.definition.geometry.type == "Polygon") {
                // cell
                header.setInnerHTML(
                    _.join([
                        'Target cell:',
                        targetCell.definition.properties.id,
                        'height:',
                        getCellHeightInScene(targetCell.definition.properties.height),
                    ], ' ')
                );
            }
        }
    } else {
        // not targeting any cell right now
        if (targetCell) {
            // reset color
            targetCell.material.color.setHex(targetCell.currentHex);
        }

        targetCell = null;
    }
}

////////////
// EVENTS //
////////////

// keep track of pointer position
function onPointerMove(event) {
    pointer.x =  (event.clientX / renderer.domElement.width ) * 2 - 1;
    pointer.y = -(event.clientY / renderer.domElement.height) * 2 + 1;
}

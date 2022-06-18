import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/OrbitControls'
import { clamp } from 'three/src/math/mathutils';
import cells from './cells.geojson';
import rivers from './rivers.geojson';

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.y = 15;
camera.position.z = 0;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animation);
document.body.appendChild(renderer.domElement);

const controls = new MapControls( camera, renderer.domElement );

controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.screenSpacePanning = false;

controls.minDistance = 7;
controls.maxDistance = 100;

controls.maxPolarAngle = Math.PI / 2;

controls.target.set(0, 0, 0);
controls.update();

let group = new THREE.Group();
let cellMeshes = [];
let riverMeshes = [];

buildCells();
buildRivers();

scene.add(group);

function buildCells() {
    const extrudeSettings = {
        steps: 1,
        depth: 1,
        bevelEnabled: false,
    }
    
    let bounds = {minX: 1000, maxX: 0, minY: 1000, maxY: 0};
    const maxHeight = 6724;
    const heightScale = maxHeight / 2;

    // peak color: #A71147
    // hill color: #FBF8B0
    // valley color: #69BDA9
    // water: #6B8BBB

    const peak = new THREE.Color(0xA71147);
    const hill = new THREE.Color(0xFBF8B0);
    const vall = new THREE.Color(0x69BDA9);
    const water = new THREE.Color(0x6B8BBB);
    
    // random color variations
    const landVariation = 0.03;
    const waterVariation = 0.04;

    // const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } );
    const lineMaterial = new THREE.LineBasicMaterial( { color: 0xFFFFFF, opacity: 0.2, transparent: true } );

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

            // track bounds to center map after
            bounds.minX = Math.min(bounds.minX, c[0]);
            bounds.maxX = Math.max(bounds.maxX, c[0]);

            bounds.minY = Math.min(bounds.minY, c[1]);
            bounds.maxY = Math.min(bounds.maxY, c[1]);
        }

        let settings = {
            ...extrudeSettings,
            depth: extrudeSettings.depth + (Math.max(0, f.properties.height) / heightScale),
        }
        // maxHeight = Math.max(maxHeight, f.properties.height);

        // calculate proper heightmap color
        const percent = f.properties.height / maxHeight;
        let top = hill;
        let bot = vall;
        if (percent > 0.5) {
            top = peak;
            bot = hill;
        }

        let r;
        if (f.properties.height > 0) {
            // land colors
            r = new THREE.Color(
                componentVariation(bot.r + (top.r - bot.r) * percent, landVariation),
                componentVariation(bot.g + (top.g - bot.g) * percent, landVariation),
                componentVariation(bot.b + (top.b - bot.b) * percent, landVariation)
            );
        } else {
            // water colors with random variation
            r = new THREE.Color(
                componentVariation(water.r, waterVariation),
                componentVariation(water.g, waterVariation),
                componentVariation(water.b, waterVariation)
            )
        }
        // const r = rgbToHex(i % 256, 255 - (i % 256), 0);

        // cell geometry
        const mat = new THREE.MeshBasicMaterial({color: r});
        const geometry = new THREE.ExtrudeGeometry(shape, settings);

        const cell = new THREE.Mesh(geometry, mat);
        group.add(cell);

        // add border line
        const points = shape.getPoints();
        const geometryPoints = new THREE.BufferGeometry().setFromPoints(points);
        //new THREE.LineBasicMaterial( { color: color }
        let wire = new THREE.Line(geometryPoints, lineMaterial);
        wire.position.z = settings.depth + 0.01;
        group.add(wire);

        // add cell reference to array
        cellMeshes.push(cell);
    }

    // center map position
    group.position.set(-(bounds.minX + bounds.maxX) / 2.0, 0, (bounds.minY + bounds.maxY) / 2.0);
    group.rotation.x = -Math.PI / 2;
}

function buildRivers() {
    for (var i = 0; i < rivers.features.length; i++) {
        let f = rivers.features[i];
        const coords = f.geometry.coordinates;

        const geometry = new THREE.BufferGeometry();

        let vertices = [];
        let normals = [];

        let p1 = new THREE.Vector2();
        let p2 = new THREE.Vector2();
        let dir = new THREE.Vector2();
        let per = new THREE.Vector2();

        // const startWidth = f.properties.sourceWidth;
        const startWidth = .1;
        const endWidth = startWidth * f.properties.widthFactor;
        console.log('start: ' + startWidth);
        // const endWidth = startWidth * 5;

        let lastP1, lastP2;
        for (var j = 0; j < coords.length - 1 && j < 4000; j++) {
            const c1 = coords[j];
            const c2 = coords[j + 1];

            p1.set(c1[0], c1[1]);
            p2.set(c2[0], c2[1]);

            if (p1.equals(p2)) {
                // points are the same, no triangles to be drawn
                continue;
            }

            dir = p2.sub(p1);
            per.set(dir.x, -dir.y);

            // river width scales up to maximum
            const progress = j / coords.length;
            const currentWidth = startWidth + (endWidth - startWidth) * progress;
            per.normalize().multiplyScalar(currentWidth);

            if (!lastP1 || !lastP2) {
                vertices.push(c1[0] - per.x / 2, c1[1] - per.y / 2, 1.1);
                vertices.push(c1[0] + per.x / 2, c1[1] + per.y / 2, 1.1);
                vertices.push(c2[0] - per.x / 2, c2[1] - per.y / 2, 1.1);

                vertices.push(c2[0] - per.x / 2, c2[1] - per.y / 2, 1.1);
                vertices.push(c1[0] + per.x / 2, c1[1] + per.y / 2, 1.1);
                vertices.push(c2[0] + per.x / 2, c2[1] + per.y / 2, 1.1);

                lastP1 = new THREE.Vector2(c2[0] - per.x / 2, c2[1] - per.y / 2);
                lastP2 = new THREE.Vector2(c2[0] + per.x / 2, c2[1] + per.y / 2);
            } else {
                console.log(lastP1);
                console.log(lastP2);

                vertices.push(lastP1.x, lastP1.y, 1.1);
                vertices.push(lastP2.x, lastP2.y, 1.1);
                vertices.push(c2[0] - per.x / 2, c2[1] - per.y / 2, 1.1);

                vertices.push(c2[0] - per.x / 2, c2[1] - per.y / 2, 1.1);
                vertices.push(lastP2.x, lastP2.y, 1.1);
                vertices.push(c2[0] + per.x / 2, c2[1] + per.y / 2, 1.1);

                lastP1 = new THREE.Vector2(c2[0] - per.x / 2, c2[1] - per.y / 2);
                lastP2 = new THREE.Vector2(c2[0] + per.x / 2, c2[1] + per.y / 2);
            }

            

            normals.push(0, 0, 1);
            normals.push(0, 0, 1);
            normals.push(0, 0, 1);
            normals.push(0, 0, 1);
            normals.push(0, 0, 1);
            normals.push(0, 0, 1);
        }

        // console.log('vertices length: ' + vertices.length);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        const riverMaterial = new THREE.LineBasicMaterial( { color: 0x6B8BBB } );
        const river = new THREE.Line(geometry, riverMaterial);

        // const riverMaterial = new THREE.MeshBasicMaterial({color: 0x6B8BBB});
        // const river = new THREE.Mesh(geometry, riverMaterial);

        // const edges = new THREE.EdgesGeometry( geometry );
        // const river = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0x000000 } ) );

        riverMeshes.push(river);
        group.add(river);

        // TODO: remove
        // break;
    }
}

// animation
function animation(time) {
    // camera.position.y = Math.max(camera.position.y, 0);
    controls.update();

    renderer.render(scene, camera);
}

// color helpers
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
  
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function componentVariation(c, v) {
    return clamp(c + (Math.random() * v - v / 2), 0, 1);
}

// finds a cell definition from a given id
function getCellByID(id) {
    return cells.features.find(cell => {
        return (cell.properties.id == id);
    });
}

// calculates a cells location using the mean value of geometry coordinates (THREE.Vector2)
function getCellLocation(cell) {
    let loc = new THREE.Vector2();

    if (cell) {
        const coords = cell.geometry.coordinates[0];
        const count = coords.length;

        for (var i = 0; i < count; i++) {
            loc.x += coords[i][0];
            loc.y += coords[i][1];
        }

        loc.divideScalar(count);
    }

    return loc;
}
import * as THREE from 'three';
import cells from '../res/cells.geojson';
import rivers from '../res/rivers3.geojson';
import markers from '../res/markers.geojson';
import { clamp } from 'three/src/math/mathutils';

// setup for phong material
const phongParameters = {
    shininess: 15,
}

// cell height settings
const seaLevel = 1;
const maxHeight = 6724;
const heightScale = maxHeight / 2;

export class MapModel extends THREE.Group {
    constructor() {
        super();

        this.cellMeshes = [];
        this.riverMeshes = [];
        this.markerMeshes = [];
    };

    init() {
        this.buildCells();
        this.buildRivers();
        this.buildMarkers();
    }

    buildCells() {
        const extrudeSettings = {
            steps: 1,
            depth: seaLevel,
            bevelEnabled: true,
            bevelThickness: .01,
            bevelSize: .01,
        }
        
        let bounds = {minX: 1000, maxX: 0, minY: 1000, maxY: 0};
    
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
                depth: this.getCellHeightInScene(f.properties.height),
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
            const mat = new THREE.MeshPhongMaterial({
                ...phongParameters,
                color: r
            });
            const geometry = new THREE.ExtrudeGeometry(shape, settings);
    
            const cell = new THREE.Mesh(geometry, mat);
            // cell.layers.enable(1);  // raycasting layer
            cell.definition = f;
            this.add(cell);
    
            // add border line
            const points = shape.getPoints();
            const geometryPoints = new THREE.BufferGeometry().setFromPoints(points);
            //new THREE.LineBasicMaterial( { color: color }
            let wire = new THREE.Line(geometryPoints, lineMaterial);
            wire.position.z = settings.depth + 0.02;
            this.add(wire);
    
            // add cell reference to array
            this.cellMeshes.push(cell);
        }
    
        // center map position
        this.position.set(-(bounds.minX + bounds.maxX) / 2.0, 0, (bounds.minY + bounds.maxY) / 2.0);
        this.rotation.x = -Math.PI / 2;
        this.scale.set(2, 2, 2);
    }

    buildRivers() {
        for (var i = 0; i < rivers.features.length; i++) {
            let f = rivers.features[i];
            // const coords = f.geometry.coordinates;
            const cellList = f.properties.cells;
    
            const geometry = new THREE.BufferGeometry();
    
            let vertices = [];
            let normals = [];
    
            let dir = new THREE.Vector2();
            let per = new THREE.Vector2();
    
            // const startWidth = f.properties.sourceWidth;
            const startWidth = .1;
            const endWidth = startWidth * f.properties.widthFactor;
            // console.log('start: ' + startWidth);
            // const endWidth = startWidth * 5;
    
            let lastP1, lastP2;
            for (var j = 0; j < cellList.length - 1; j++) {
                const cell1 = this.getCellByID(cellList[j]);
                const cell2 = this.getCellByID(cellList[j + 1]);
    
                const c1 = this.getCellLocation(cell1);
                const c2 = this.getCellLocation(cell2);
    
                // calculate z height from cell, will need to change this later because
                // it causes rivers to go uphill...
                const z1 = this.getCellHeightInScene(cell1.properties.height) + 0.1;
                const z2 = this.getCellHeightInScene(cell2.properties.height) + 0.1;
    
                if (c1.equals(c2)) {
                    // points are the same, no triangles to be drawn
                    continue;
                }
    
                // calculate direction and perpindicular vectors
                dir.set(c2.x - c1.x, c2.y - c1.y);
                per.set(dir.x, -dir.y);
    
                // river width scales up to maximum
                const progress = j / cellList.length;
                const currentWidth = startWidth + (endWidth - startWidth) * progress;
                per.normalize().multiplyScalar(currentWidth);
    
                if (!lastP1 || !lastP2) {
                    vertices.push(c1.x - per.x / 2, c1.y - per.y / 2, z1);
                    vertices.push(c1.x + per.x / 2, c1.y + per.y / 2, z1);
                    vertices.push(c2.x - per.x / 2, c2.y - per.y / 2, z2);
    
                    vertices.push(c2.x - per.x / 2, c2.y - per.y / 2, z2);
                    vertices.push(c1.x + per.x / 2, c1.y + per.y / 2, z1);
                    vertices.push(c2.x + per.x / 2, c2.y + per.y / 2, z2);
    
                    lastP1 = new THREE.Vector2(c2.x - per.x / 2, c2.y - per.y / 2);
                    lastP2 = new THREE.Vector2(c2.x + per.x / 2, c2.y + per.y / 2);
                } else {
                    vertices.push(lastP1.x, lastP1.y, z1);
                    vertices.push(lastP2.x, lastP2.y, z1);
                    vertices.push(c2.x - per.x / 2, c2.y - per.y / 2, z2);
    
                    vertices.push(c2.x - per.x / 2, c2.y - per.y / 2, z2);
                    vertices.push(lastP2.x, lastP2.y, z1);
                    vertices.push(c2.x + per.x / 2, c2.y + per.y / 2, z2);
    
                    lastP1 = new THREE.Vector2(c2.x - per.x / 2, c2.y - per.y / 2);
                    lastP2 = new THREE.Vector2(c2.x + per.x / 2, c2.y + per.y / 2);
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
    
            // const riverMaterial = new THREE.LineBasicMaterial( { color: 0x6B8BBB } );
            // const river = new THREE.Line(geometry, riverMaterial);
    
            const riverMaterial = new THREE.MeshBasicMaterial({color: 0x6B8BBB, side: THREE.DoubleSide});
            const river = new THREE.Mesh(geometry, riverMaterial);
    
            // const edges = new THREE.EdgesGeometry( geometry );
            // const river = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0x000000 } ) );
    
            this.riverMeshes.push(river);
            this.add(river);
        }
    }
    
    buildMarkers() {
        const cityGeo       = new THREE.ConeGeometry(.15, .3, 5);
        const militaryGeo   = new THREE.ConeGeometry(.22, .5, 4);
        const capitalGeo    = new THREE.ConeGeometry(.27, .7, 6);
        const hoverHeight = 0.05;   // height above the ground
    
        const lineGeo = new THREE.BoxGeometry(.01, .01, .7);
        const lineMat = new THREE.MeshBasicMaterial( {color: 0x000000} );
    
        const info = {
            City: {
                geometry: cityGeo,
                color: 0xffff00,
            },
            Military: {
                geometry: militaryGeo,
                color: 0x04822a,
            },
            Capital: {
                geometry: capitalGeo,
                color: 0x800000,
            },
        };
    
        for (var i = 0; i < markers.features.length; i++) {
            let f = markers.features[i];
    
            // pick proper geometry
            let geometry = info[f.properties.type].geometry;
    
            // use cell beneath to calculate proper height
            const cell = this.getCellByID(f.properties.cell);
            const baseHeight = this.getCellHeightInScene(cell.properties.height);
            const finalHeight = baseHeight + hoverHeight + geometry.parameters.height;
    
            // use a seperate material instance for each mesh so we can highlight them individually
            const material = new THREE.MeshPhongMaterial({
                ...phongParameters,
                color: info[f.properties.type].color
            });
            const cone = new THREE.Mesh(geometry, material);
            cone.position.set(f.geometry.coordinates[0], f.geometry.coordinates[1], finalHeight);
            cone.rotation.x = -Math.PI / 2;
            cone.layers.enable(1);  // raycasting layer
            cone.definition = f;
    
            // position line down to map
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.position.set(f.geometry.coordinates[0], f.geometry.coordinates[1], baseHeight + hoverHeight);
    
            this.markerMeshes.push(cone);
            this.add(cone);
            this.add(line);
        }
    }

    // animation
    tick(dT) {
        const rps = 0.5;
        for (let i = 0; i < this.markerMeshes.length; i++) {
            let m = this.markerMeshes[i];
            if (m.hovered) {
                m.rotation.y = (m.rotation.y + (rps * Math.PI * 2.0 * dT)) % (Math.PI * 2.0);

                // can only be one marker hovered, so stop looking for others
                break;
            }
        }
    }

    //////////////////
    // CELL HELPERS //
    //////////////////

    // finds a cell definition from a given id
    getCellByID(id) {
        return cells.features.find(cell => {
            return (cell.properties.id == id);
        });
    }

    // calculates a cells location using the mean value of geometry coordinates (THREE.Vector2)
    getCellLocation(cell) {
        let loc = new THREE.Vector2();

        if (cell) {
            const coords = cell.geometry.coordinates[0];
            const count = coords.length - 1;

            for (var i = 0; i < count; i++) {
                loc.x += coords[i][0];
                loc.y += coords[i][1];
            }

            loc.divideScalar(count);
        }

        return loc;
    }

    getCellHeightInScene(height) {
        return seaLevel + (Math.max(0, height) / heightScale);
    }
};

///////////////////
// COLOR HELPERS //
///////////////////

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

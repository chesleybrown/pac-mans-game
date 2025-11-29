import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Game state
const gameState = {
    started: false,
    over: false,
    ghostsSaved: 0,
    ghostsAlive: 4,
    totalGhosts: 4,
    pacmanPowered: false,
    powerTimer: 0,
    collectedGhosts: [] // Ghosts the player is carrying
};

// Player spawn position (also the safe zone for delivering ghosts)
const PLAYER_SPAWN = { x: 1, z: 19 };

// Constants
const CELL_SIZE = 4;
const WALL_HEIGHT = 5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_SPEED = 2.5; // Slower player speed
const PACMAN_SPEED = 5;
const GHOST_SPEED = 2.5;
const GHOST_FLEE_SPEED = 3.5;
const GHOST_TARGET_SNAP_DISTANCE = 0.5; // Distance at which ghosts snap to cell center
const REVERSE_MOVEMENT_PENALTY = 100; // Penalty for ghosts reversing direction
const WALL_PUSH_BUFFER = 0.1; // Extra distance to push player away from walls

// Ghost navigation helpers
const GHOST_DIRECTION_VECTORS = [
    { x: 0, z: -1 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 1, z: 0 }
];

// Slime trail constants
const SLIME_TRAIL_INTERVAL = 0.35; // Time between slime drops (seconds)
const SLIME_TRAIL_LIFETIME = 20; // How long slime lasts (seconds)
const SLIME_TRAIL_SIZE = 0.35; // Base size of slime drops
const SLIME_TRAIL_SPREAD = 0.6; // How far slime can drift from the ghost's path

// Audio
let audioContext;
let soundEffects = {};

// Classic PAC-MAN maze layout (1 = wall, 0 = path, 2 = dot, 3 = power pellet, 4 = safe zone)
const MAZE_LAYOUT = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 2, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 2, 1, 1, 1, 1],
    [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0],
    [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
    [0, 0, 0, 0, 2, 0, 0, 1, 4, 4, 4, 4, 4, 1, 0, 0, 2, 0, 0, 0, 0],
    [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
    [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0],
    [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1],
    [1, 3, 2, 1, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 1, 2, 3, 1],
    [1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1],
    [1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const MAZE_WIDTH = MAZE_LAYOUT[0].length;
const MAZE_HEIGHT = MAZE_LAYOUT.length;

function isCellWalkable(x, z) {
    return x >= 0 && x < MAZE_WIDTH && z >= 0 && z < MAZE_HEIGHT && MAZE_LAYOUT[z][x] !== 1;
}

function findNearestWalkableCell(startX, startZ) {
    if (isCellWalkable(startX, startZ)) {
        return { x: startX, z: startZ };
    }

    const queue = [{ x: startX, z: startZ }];
    const visited = new Set([`${startX},${startZ}`]);
    let steps = 0;

    while (queue.length && steps < 1000) {
        const { x, z } = queue.shift();
        steps++;

        for (const dir of GHOST_DIRECTION_VECTORS) {
            const nx = x + dir.x;
            const nz = z + dir.z;
            const key = `${nx},${nz}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (isCellWalkable(nx, nz)) {
                return { x: nx, z: nz };
            }

            if (nx >= 0 && nx < MAZE_WIDTH && nz >= 0 && nz < MAZE_HEIGHT) {
                queue.push({ x: nx, z: nz });
            }
        }
    }

    return { x: startX, z: startZ };
}

function getInitialGhostDirection(x, z) {
    for (const dir of GHOST_DIRECTION_VECTORS) {
        if (isCellWalkable(x + dir.x, z + dir.z)) {
            return { ...dir };
        }
    }
    return { x: 0, z: 0 };
}

// Three.js setup
let scene, camera, renderer, controls;
let playerHands, playerFeet;
let pacman, ghosts = [];
let dots = [];
let powerPellets = [];
let safeZones = [];
let walls = [];
let slimeTrails = []; // Ghost slime trail particles

// Movement
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

// Clock for delta time
const clock = new THREE.Clock();

// Music intensity tracking
let musicIntensity = 0; // 0 = normal, 1 = max intensity
let intenseMusicActive = false;

// PAC-MAN geometry constants
const PACMAN_BODY_RADIUS = 1.5;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.08); // Darker, thicker fog

    // Camera (first-person) - Start in bottom-left corner, away from ghosts and PAC-MAN
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(PLAYER_SPAWN.x * CELL_SIZE + CELL_SIZE / 2, PLAYER_HEIGHT, PLAYER_SPAWN.z * CELL_SIZE + CELL_SIZE / 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Controls
    controls = new PointerLockControls(camera, document.body);

    // Lighting - horror atmosphere
    setupLighting();

    // Create maze
    createMaze();

    // Create player body parts (hands and feet)
    createPlayerBody();

    // Create PAC-MAN
    createPacman();

    // Create ghosts
    createGhosts();

    // Event listeners
    setupEventListeners();

    // Start render loop
    animate();
}

function setupLighting() {
    // Very dim ambient light - flashlight is the main light source
    const ambientLight = new THREE.AmbientLight(0x050505);
    scene.add(ambientLight);

    // Player flashlight - more powerful, main light source
    const flashlight = new THREE.SpotLight(0xffffee, 5, 50, Math.PI / 5, 0.3, 1);
    flashlight.position.set(0, 0, 0);
    flashlight.target.position.set(0, 0, -1);
    flashlight.castShadow = true;
    camera.add(flashlight);
    camera.add(flashlight.target);
    scene.add(camera);
}

function createMaze() {
    // Seeded random for consistent textures
    let seed = 12345;
    const seededRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Create base wall texture (clean neon blue)
    const createWallTexture = (addHorror, horrorType) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base neon blue color
        ctx.fillStyle = '#0033aa';
        ctx.fillRect(0, 0, 256, 256);

        // Add grid lines for retro look
        ctx.strokeStyle = '#0055ff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 256; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 256);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(256, i);
            ctx.stroke();
        }

        // Add horror elements only on some textures
        if (addHorror) {
            if (horrorType === 'blood') {
                // Blood splatters - vary size and count
                ctx.fillStyle = '#8b0000';
                const splatterCount = 1 + Math.floor(seededRandom() * 3);
                for (let i = 0; i < splatterCount; i++) {
                    const x = 30 + seededRandom() * 196;
                    const y = 30 + seededRandom() * 196;
                    const radius = 5 + seededRandom() * 25; // Varied size
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    // Drips (varied)
                    const dripCount = Math.floor(seededRandom() * 4);
                    for (let j = 0; j < dripCount; j++) {
                        ctx.fillRect(x - 5 + seededRandom() * 10, y, 2 + seededRandom() * 3, 15 + seededRandom() * 50);
                    }
                }
            } else if (horrorType === 'claw') {
                // Claw marks
                ctx.strokeStyle = '#330000';
                ctx.lineWidth = 2 + seededRandom() * 2;
                const x = 40 + seededRandom() * 120;
                const y = 30 + seededRandom() * 80;
                const clawCount = 2 + Math.floor(seededRandom() * 2);
                for (let j = 0; j < clawCount; j++) {
                    ctx.beginPath();
                    ctx.moveTo(x + j * (12 + seededRandom() * 8), y);
                    ctx.lineTo(x + j * (12 + seededRandom() * 8) + 5 + seededRandom() * 10, y + 40 + seededRandom() * 60);
                    ctx.stroke();
                }
            } else if (horrorType === 'teeth') {
                // Small tooth-like shapes
                ctx.fillStyle = '#ddcccc';
                const teethX = 50 + seededRandom() * 150;
                const teethY = 80 + seededRandom() * 100;
                const teethCount = 3 + Math.floor(seededRandom() * 4);
                for (let j = 0; j < teethCount; j++) {
                    ctx.beginPath();
                    ctx.moveTo(teethX + j * 15, teethY);
                    ctx.lineTo(teethX + j * 15 + 5, teethY + 15 + seededRandom() * 10);
                    ctx.lineTo(teethX + j * 15 + 10, teethY);
                    ctx.fill();
                }
            }
        }

        return new THREE.CanvasTexture(canvas);
    };

    // Create several wall material variations
    const wallMaterials = [];
    // Clean walls (majority)
    for (let i = 0; i < 5; i++) {
        const texture = createWallTexture(false, null);
        wallMaterials.push(new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0x001166,
            emissiveIntensity: 0.2,
            roughness: 0.8,
            metalness: 0.2
        }));
    }
    // Horror walls (minority)
    const horrorTypes = ['blood', 'claw', 'teeth', 'blood', 'claw'];
    for (let i = 0; i < 5; i++) {
        const texture = createWallTexture(true, horrorTypes[i]);
        wallMaterials.push(new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0x001166,
            emissiveIntensity: 0.2,
            roughness: 0.8,
            metalness: 0.2
        }));
    }

    // Create horror floor texture with variation
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const floorCtx = floorCanvas.getContext('2d');

    // Dark base
    floorCtx.fillStyle = '#0a0a15';
    floorCtx.fillRect(0, 0, 512, 512);

    // Tile pattern
    floorCtx.strokeStyle = '#151525';
    floorCtx.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) {
        floorCtx.beginPath();
        floorCtx.moveTo(i, 0);
        floorCtx.lineTo(i, 512);
        floorCtx.stroke();
        floorCtx.beginPath();
        floorCtx.moveTo(0, i);
        floorCtx.lineTo(512, i);
        floorCtx.stroke();
    }

    // Blood pools - fewer and more varied in size
    floorCtx.fillStyle = '#3a0000';
    const bloodPoolCount = 3 + Math.floor(seededRandom() * 3);
    for (let i = 0; i < bloodPoolCount; i++) {
        const x = 50 + seededRandom() * 412;
        const y = 50 + seededRandom() * 412;
        const rx = 15 + seededRandom() * 50; // Varied radius X
        const ry = 10 + seededRandom() * 35; // Varied radius Y
        floorCtx.beginPath();
        floorCtx.ellipse(x, y, rx, ry, seededRandom() * Math.PI, 0, Math.PI * 2);
        floorCtx.fill();
    }

    // Skull symbols - fewer
    floorCtx.fillStyle = '#1a1a2a';
    const skullCount = 1 + Math.floor(seededRandom() * 2);
    for (let i = 0; i < skullCount; i++) {
        const x = 100 + seededRandom() * 312;
        const y = 100 + seededRandom() * 312;
        const size = 15 + seededRandom() * 15;
        // Simple skull shape
        floorCtx.beginPath();
        floorCtx.arc(x, y, size, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.fillRect(x - size * 0.5, y + size * 0.75, size, size * 0.75);
        // Eye sockets
        floorCtx.fillStyle = '#0a0a15';
        floorCtx.beginPath();
        floorCtx.arc(x - size * 0.35, y - size * 0.15, size * 0.25, 0, Math.PI * 2);
        floorCtx.arc(x + size * 0.35, y - size * 0.15, size * 0.25, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.fillStyle = '#1a1a2a';
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);

    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: 0.9,
        metalness: 0
    });

    const dotMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });

    const powerPelletMaterial = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff6600,
        emissiveIntensity: 1
    });

    // Safe zone is at player spawn position
    const safeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.4
    });

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((MAZE_WIDTH * CELL_SIZE) / 2, 0, (MAZE_HEIGHT * CELL_SIZE) / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling with horror texture
    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 256;
    ceilingCanvas.height = 256;
    const ceilingCtx = ceilingCanvas.getContext('2d');
    ceilingCtx.fillStyle = '#050508';
    ceilingCtx.fillRect(0, 0, 256, 256);
    // Add some dripping effects (deterministic positions)
    ceilingCtx.fillStyle = '#200000';
    for (let i = 0; i < 10; i++) {
        const x = seededRandom() * 256;
        ceilingCtx.fillRect(x, 0, 2, 30 + seededRandom() * 50);
    }

    const ceilingTexture = new THREE.CanvasTexture(ceilingCanvas);
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(8, 8);

    const ceilingMaterial = new THREE.MeshStandardMaterial({
        map: ceilingTexture,
        roughness: 1
    });
    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((MAZE_WIDTH * CELL_SIZE) / 2, WALL_HEIGHT, (MAZE_HEIGHT * CELL_SIZE) / 2);
    scene.add(ceiling);

    // Create walls, dots, and safe zones
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const dotGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const powerPelletGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const safeZoneGeometry = new THREE.BoxGeometry(CELL_SIZE * 2, 0.1, CELL_SIZE * 2);

    // Add safe zone at player spawn location
    const safeZone = new THREE.Mesh(safeZoneGeometry, safeMaterial);
    safeZone.position.set(PLAYER_SPAWN.x * CELL_SIZE + CELL_SIZE / 2, 0.1, PLAYER_SPAWN.z * CELL_SIZE + CELL_SIZE / 2);
    scene.add(safeZone);
    safeZones.push({ mesh: safeZone, x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z });

    // Add a glowing pillar to mark the safe zone
    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, WALL_HEIGHT, 16);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6
    });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(PLAYER_SPAWN.x * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, PLAYER_SPAWN.z * CELL_SIZE + CELL_SIZE / 2);
    scene.add(pillar);

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            const cell = MAZE_LAYOUT[z][x];
            const posX = x * CELL_SIZE + CELL_SIZE / 2;
            const posZ = z * CELL_SIZE + CELL_SIZE / 2;

            if (cell === 1) {
                // Wall - pick material based on position (deterministic variation)
                // About 30% of walls get horror textures
                const wallSeed = (x * 31 + z * 17) % 100;
                let materialIndex;
                if (wallSeed < 70) {
                    // Clean wall (majority)
                    materialIndex = wallSeed % 5;
                } else {
                    // Horror wall (minority)
                    materialIndex = 5 + (wallSeed % 5);
                }
                const wall = new THREE.Mesh(wallGeometry, wallMaterials[materialIndex]);
                wall.position.set(posX, WALL_HEIGHT / 2, posZ);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                walls.push({
                    mesh: wall,
                    x: x,
                    z: z,
                    minX: posX - CELL_SIZE / 2,
                    maxX: posX + CELL_SIZE / 2,
                    minZ: posZ - CELL_SIZE / 2,
                    maxZ: posZ + CELL_SIZE / 2
                });
            } else if (cell === 2) {
                // Dot
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.position.set(posX, 1, posZ);
                scene.add(dot);
                dots.push({ mesh: dot, x: x, z: z, eaten: false });
            } else if (cell === 3) {
                // Power pellet
                const pellet = new THREE.Mesh(powerPelletGeometry, powerPelletMaterial);
                pellet.position.set(posX, 1, posZ);
                scene.add(pellet);
                powerPellets.push({ mesh: pellet, x: x, z: z, eaten: false });
            }
            // Note: cell === 4 (old safe zones in ghost house) are now just empty paths
        }
    }
}

function createPlayerBody() {
    // Create hands with beige skin color
    const handMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5deb3, // Beige/wheat skin tone
        roughness: 0.6
    });

    const handGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.3);
    const fingerGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.15);

    // Left hand
    playerHands = new THREE.Group();

    const leftHand = new THREE.Group();
    const leftPalm = new THREE.Mesh(handGeometry, handMaterial);
    leftHand.add(leftPalm);

    // Add fingers to left hand
    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(fingerGeometry, handMaterial);
        finger.position.set(-0.045 + i * 0.03, 0, -0.2);
        leftHand.add(finger);
    }
    // Thumb
    const leftThumb = new THREE.Mesh(fingerGeometry, handMaterial);
    leftThumb.rotation.z = Math.PI / 4;
    leftThumb.position.set(0.1, 0, -0.05);
    leftHand.add(leftThumb);

    leftHand.position.set(-0.35, -0.3, -0.5);
    leftHand.rotation.x = -0.3;
    playerHands.add(leftHand);

    // Right hand
    const rightHand = new THREE.Group();
    const rightPalm = new THREE.Mesh(handGeometry, handMaterial);
    rightHand.add(rightPalm);

    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(fingerGeometry, handMaterial);
        finger.position.set(-0.045 + i * 0.03, 0, -0.2);
        rightHand.add(finger);
    }
    const rightThumb = new THREE.Mesh(fingerGeometry, handMaterial);
    rightThumb.rotation.z = -Math.PI / 4;
    rightThumb.position.set(-0.1, 0, -0.05);
    rightHand.add(rightThumb);

    rightHand.position.set(0.35, -0.3, -0.5);
    rightHand.rotation.x = -0.3;
    playerHands.add(rightHand);

    camera.add(playerHands);

    // Create feet (visible when looking down)
    const footMaterial = new THREE.MeshStandardMaterial({
        color: 0x2f2f2f,
        roughness: 0.8
    });

    const footGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.4);

    playerFeet = new THREE.Group();

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.15, -PLAYER_HEIGHT + 0.05, 0);
    playerFeet.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.15, -PLAYER_HEIGHT + 0.05, 0);
    playerFeet.add(rightFoot);

    // Feet follow camera but stay on ground
    scene.add(playerFeet);
}

function createPacman() {
    // PAC-MAN as a classic yellow sphere with a mouth
    const pacmanGroup = new THREE.Group();

    const pacmanMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.0,
        side: THREE.DoubleSide
    });

    // Top half (hemisphere)
    const topGeometry = new THREE.SphereGeometry(PACMAN_BODY_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topHalf = new THREE.Mesh(topGeometry, pacmanMaterial);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.6, 0.8, 1.0);
    topHalf.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.6, 0.8, 1.0);
    topHalf.add(rightEye);

    // Bottom half (hemisphere)
    const bottomGeometry = new THREE.SphereGeometry(PACMAN_BODY_RADIUS, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bottomHalf = new THREE.Mesh(bottomGeometry, pacmanMaterial);

    pacmanGroup.add(topHalf);
    pacmanGroup.add(bottomHalf);

    // Point light to make PAC-MAN glow
    const pacmanLight = new THREE.PointLight(0xffff00, 1, 10);
    pacmanLight.position.set(0, 0, 0);
    pacmanGroup.add(pacmanLight);

    // PAC-MAN starts at classic position (bottom center, below ghost house)
    pacmanGroup.position.set(10 * CELL_SIZE + CELL_SIZE / 2, 1.5, 15 * CELL_SIZE + CELL_SIZE / 2);

    pacman = {
        mesh: pacmanGroup,
        topHalf: topHalf,
        bottomHalf: bottomHalf,
        x: 10,
        z: 15,
        targetX: 10,
        targetZ: 15,
        direction: { x: 1, z: 0 },
        mouthOpen: 0,
        speed: PACMAN_SPEED
    };

    scene.add(pacmanGroup);
}

function createGhosts() {
    const ghostColors = [0xff0000, 0x00ffff, 0xffb8ff, 0xffb852]; // Blinky, Inky, Pinky, Clyde
    const ghostNames = ['Blinky', 'Inky', 'Pinky', 'Clyde'];
    // Ghost spawn positions - spread around the maze in valid path cells (value 0 or 2)
    const startPositions = [
        { x: 9, z: 9 },   // Blinky - inside ghost house (cell value 4)
        { x: 11, z: 9 },  // Inky - inside ghost house (cell value 4)
        { x: 10, z: 9 },  // Pinky - inside ghost house (cell value 4)
        { x: 12, z: 9 }   // Clyde - inside ghost house (cell value 4, was spawning in wall!)
    ];

    // Unique movement patterns for each ghost (scatter targets when fleeing)
    const scatterTargets = [
        { x: 19, z: 1 },  // Blinky - top right corner
        { x: 1, z: 19 },  // Inky - bottom left corner
        { x: 1, z: 1 },   // Pinky - top left corner
        { x: 19, z: 19 }  // Clyde - bottom right corner
    ];

    ghostColors.forEach((color, index) => {
        const ghostGroup = new THREE.Group();

        // Ghost body (dome + cylinder base)
        const headGeometry = new THREE.SphereGeometry(0.8, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
        const bodyGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 32);
        const tentacleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8);

        const ghostMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9
        });

        const head = new THREE.Mesh(headGeometry, ghostMaterial);
        head.position.y = 0.4;

        const body = new THREE.Mesh(bodyGeometry, ghostMaterial);
        body.position.y = 0;

        // Tentacles
        for (let i = 0; i < 4; i++) {
            const tentacle = new THREE.Mesh(tentacleGeometry, ghostMaterial);
            const angle = (i / 4) * Math.PI * 2;
            tentacle.position.set(Math.cos(angle) * 0.4, -0.6, Math.sin(angle) * 0.4);
            ghostGroup.add(tentacle);
        }

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.25, 0.5, 0.6);
        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), pupilMaterial);
        leftPupil.position.set(-0.25, 0.5, 0.75);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.25, 0.5, 0.6);
        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), pupilMaterial);
        rightPupil.position.set(0.25, 0.5, 0.75);

        ghostGroup.add(head);
        ghostGroup.add(body);
        ghostGroup.add(leftEye);
        ghostGroup.add(leftPupil);
        ghostGroup.add(rightEye);
        ghostGroup.add(rightPupil);

        // Ghost light
        const ghostLight = new THREE.PointLight(color, 0.5, 10);
        ghostLight.position.set(0, 0, 0);
        ghostGroup.add(ghostLight);

        const rawPos = startPositions[index];
        const spawnPos = findNearestWalkableCell(rawPos.x, rawPos.z);
        if (spawnPos.x !== rawPos.x || spawnPos.z !== rawPos.z) {
            console.warn(`Adjusted spawn for ${ghostNames[index]} from (${rawPos.x},${rawPos.z}) to (${spawnPos.x},${spawnPos.z})`);
        }

        ghostGroup.position.set(spawnPos.x * CELL_SIZE + CELL_SIZE / 2, 1, spawnPos.z * CELL_SIZE + CELL_SIZE / 2);

        const initialDirection = getInitialGhostDirection(spawnPos.x, spawnPos.z);
        const initialTargetX = (initialDirection.x !== 0 || initialDirection.z !== 0)
            ? spawnPos.x + initialDirection.x
            : spawnPos.x;
        const initialTargetZ = (initialDirection.x !== 0 || initialDirection.z !== 0)
            ? spawnPos.z + initialDirection.z
            : spawnPos.z;

        ghosts.push({
            mesh: ghostGroup,
            name: ghostNames[index],
            color: color,
            x: spawnPos.x,
            z: spawnPos.z,
            targetX: initialTargetX,
            targetZ: initialTargetZ,
            direction: initialDirection,
            alive: true,
            saved: false,
            collected: false, // Player has collected this ghost
            guideTarget: null,
            speed: GHOST_SPEED,
            scatterTarget: scatterTargets[index], // Unique escape direction
            lastSlimeTime: 0 // Timer for slime trail
        });

        scene.add(ghostGroup);
    });
}

function setupEventListeners() {
    // Start button
    document.getElementById('start-button').addEventListener('click', startGame);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (!gameState.started || gameState.over) return;

        switch (e.code) {
            case 'KeyW': moveState.forward = true; break;
            case 'KeyS': moveState.backward = true; break;
            case 'KeyA': moveState.left = true; break;
            case 'KeyD': moveState.right = true; break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveState.forward = false; break;
            case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break;
            case 'KeyD': moveState.right = false; break;
        }
    });

    // Click to collect ghosts (removed - now automatic on proximity)
    document.addEventListener('click', () => {
        if (!gameState.started || gameState.over) return;

        if (!controls.isLocked) {
            controls.lock();
            return;
        }

        // Try to collect a nearby ghost
        collectNearestGhost();
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Audio system using Web Audio API for retro sounds
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create retro sound effects
    soundEffects = {
        wakawaka: createWakaWakaSound(),
        powerUp: createPowerUpSound(),
        ghostEaten: createGhostEatenSound(),
        save: createSaveSound(),
        warning: createWarningSound()
    };

    // Start background music
    startBackgroundMusic();
}

function createOscillator(frequency, type, duration, startTime) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    osc.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    return { osc, gain };
}

function createWakaWakaSound() {
    return () => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        const { osc, gain } = createOscillator(300, 'square', 0.1, now);
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(400, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.1);
    };
}

function createPowerUpSound() {
    return () => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        for (let i = 0; i < 4; i++) {
            const { osc } = createOscillator(200 + i * 100, 'square', 0.15, now + i * 0.1);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.15);
        }
    };
}

function createGhostEatenSound() {
    return () => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        const { osc } = createOscillator(800, 'sawtooth', 0.3, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    };
}

function createSaveSound() {
    return () => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        // Happy ascending arpeggio
        const notes = [261, 329, 392, 523]; // C, E, G, C
        notes.forEach((freq, i) => {
            const { osc } = createOscillator(freq, 'sine', 0.2, now + i * 0.1);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
        });
    };
}

function createWarningSound() {
    return () => {
        if (!audioContext) return;
        const now = audioContext.currentTime;
        const { osc } = createOscillator(150, 'sawtooth', 0.5, now);
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(100, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.5);
    };
}

function startBackgroundMusic() {
    if (!audioContext) return;

    // Create a spooky ambient loop with intensity variations
    const playLoop = () => {
        if (!gameState.started || gameState.over) return;

        const now = audioContext.currentTime;

        // Calculate intensity based on distance to PAC-MAN
        const baseVolume = 0.05 + musicIntensity * 0.1;
        const tempo = intenseMusicActive ? 0.15 : 0.25; // Faster when near PAC-MAN

        // Bass drone - louder and lower when intense
        const bass = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(intenseMusicActive ? 45 : 55, now); // Lower bass when intense
        bass.connect(bassGain);
        bassGain.connect(audioContext.destination);
        bassGain.gain.setValueAtTime(baseVolume, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 2);
        bass.start(now);
        bass.stop(now + 2);

        // Eerie melody notes (minor scale) - faster and more dissonant when intense
        const normalNotes = [220, 196, 175, 165, 147, 165, 175, 196];
        const intenseNotes = [233, 220, 196, 175, 165, 147, 139, 131]; // More dissonant
        const melodyNotes = intenseMusicActive ? intenseNotes : normalNotes;

        melodyNotes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = intenseMusicActive ? 'sawtooth' : 'triangle'; // Harsher sound when intense
            osc.frequency.setValueAtTime(freq, now + i * tempo);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            const noteVolume = 0.03 + musicIntensity * 0.04;
            gain.gain.setValueAtTime(noteVolume, now + i * tempo);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * tempo + tempo * 0.8);
            osc.start(now + i * tempo);
            osc.stop(now + i * tempo + tempo);
        });

        // Add heartbeat-like pulse when near PAC-MAN
        if (intenseMusicActive) {
            // First beat
            const beat1 = audioContext.createOscillator();
            const beat1Gain = audioContext.createGain();
            beat1.type = 'sine';
            beat1.frequency.setValueAtTime(60, now);
            beat1.connect(beat1Gain);
            beat1Gain.connect(audioContext.destination);
            beat1Gain.gain.setValueAtTime(0.15, now);
            beat1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            beat1.start(now);
            beat1.stop(now + 0.15);

            // Second beat (slightly quieter)
            const beat2 = audioContext.createOscillator();
            const beat2Gain = audioContext.createGain();
            beat2.type = 'sine';
            beat2.frequency.setValueAtTime(60, now + 0.2);
            beat2.connect(beat2Gain);
            beat2Gain.connect(audioContext.destination);
            beat2Gain.gain.setValueAtTime(0.1, now + 0.2);
            beat2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            beat2.start(now + 0.2);
            beat2.stop(now + 0.35);
        }

        // Schedule next loop - faster when intense
        const loopInterval = intenseMusicActive ? 1200 : 2000;
        setTimeout(playLoop, loopInterval);
    };

    playLoop();
}

function updateMusicIntensity() {
    // Calculate music intensity based on distance to PAC-MAN
    const dist = camera.position.distanceTo(pacman.mesh.position);
    const intensityThreshold = 15;

    if (dist < intensityThreshold) {
        musicIntensity = Math.max(0, 1 - dist / intensityThreshold);
        intenseMusicActive = true; // Sync with warning message
    } else {
        musicIntensity = 0;
        intenseMusicActive = false;
    }
}

function playSound(soundName) {
    if (soundEffects[soundName]) {
        soundEffects[soundName]();
    }
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    gameState.started = true;
    controls.lock();

    // Initialize audio on user interaction
    initAudio();
}

function collectNearestGhost() {
    // Player touches a ghost to collect it
    const playerPos = camera.position;

    ghosts.forEach(ghost => {
        if (!ghost.alive || ghost.saved || ghost.collected) return;

        const dist = playerPos.distanceTo(ghost.mesh.position);
        if (dist < 3) { // Close enough to collect
            // Collect the ghost
            ghost.collected = true;
            gameState.collectedGhosts.push(ghost);

            // Hide the ghost (it's now following the player)
            ghost.mesh.visible = false;

            // Play collect sound
            playSound('save');

            // Update HUD
            updateCollectedGhostsHUD();
        }
    });
}

function updateCollectedGhostsHUD() {
    const collectedEl = document.getElementById('ghosts-collected');
    if (collectedEl) {
        const ghostNames = gameState.collectedGhosts.map(g => g.name).join(', ');
        collectedEl.textContent = gameState.collectedGhosts.length > 0 ? ghostNames : 'None';
    }
}

function checkPlayerAtSafeZone() {
    // Check if player is at the safe zone (player spawn)
    const playerCellX = Math.floor(camera.position.x / CELL_SIZE);
    const playerCellZ = Math.floor(camera.position.z / CELL_SIZE);

    if (playerCellX === PLAYER_SPAWN.x && playerCellZ === PLAYER_SPAWN.z) {
        // Deliver all collected ghosts
        if (gameState.collectedGhosts.length > 0) {
            gameState.collectedGhosts.forEach(ghost => {
                ghost.saved = true;
                gameState.ghostsSaved++;
                scene.remove(ghost.mesh);
            });

            // Play save sound
            playSound('powerUp');

            // Clear collected ghosts
            gameState.collectedGhosts = [];

            // Update HUD
            document.getElementById('ghosts-saved').textContent = gameState.ghostsSaved;
            updateCollectedGhostsHUD();

            // Check for win
            if (gameState.ghostsSaved === gameState.totalGhosts) {
                endGame(true);
            }
        }
    }
}

function checkPlayerPacmanCollision() {
    // Player dies if they touch PAC-MAN
    const dist = camera.position.distanceTo(pacman.mesh.position);
    if (dist < 2.5) {
        // Player caught by PAC-MAN!
        playSound('ghostEaten');
        endGame(false, true); // true = killed by pacman
    }
}

function updatePlayer(delta) {
    if (!controls.isLocked) return;

    const speed = PLAYER_SPEED;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    if (moveState.forward || moveState.backward) {
        velocity.z += direction.z * speed * delta * 50;
    }
    if (moveState.left || moveState.right) {
        velocity.x += direction.x * speed * delta * 50;
    }

    // Get movement direction in world space
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const moveX = forward.x * velocity.z * delta + right.x * velocity.x * delta;
    const moveZ = forward.z * velocity.z * delta + right.z * velocity.x * delta;

    // Collision detection
    const newPosX = camera.position.x + moveX;
    const newPosZ = camera.position.z + moveZ;

    if (!checkWallCollision(newPosX, camera.position.z, 0.4)) {
        camera.position.x = newPosX;
    }
    if (!checkWallCollision(camera.position.x, newPosZ, 0.4)) {
        camera.position.z = newPosZ;
    }

    // Push player out if stuck
    pushPlayerOutOfWalls();

    // Clamp to maze bounds
    camera.position.x = Math.max(CELL_SIZE + 0.5, Math.min((MAZE_WIDTH - 1) * CELL_SIZE - 0.5, camera.position.x));
    camera.position.z = Math.max(CELL_SIZE + 0.5, Math.min((MAZE_HEIGHT - 1) * CELL_SIZE - 0.5, camera.position.z));

    // Update feet position
    playerFeet.position.set(camera.position.x, 0, camera.position.z);
    playerFeet.rotation.y = Math.atan2(forward.x, forward.z);

    // Animate hands based on movement
    const handBob = Math.sin(Date.now() * 0.005) * 0.02;
    const movementBob = (moveState.forward || moveState.backward || moveState.left || moveState.right)
        ? Math.sin(Date.now() * 0.01) * 0.05
        : 0;

    playerHands.children[0].position.y = -0.3 + handBob + movementBob;
    playerHands.children[1].position.y = -0.3 + handBob - movementBob;
}

function checkWallCollision(x, z, radius) {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellZ = Math.floor(z / CELL_SIZE);

    // Check surrounding cells
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const checkX = cellX + dx;
            const checkZ = cellZ + dz;

            if (checkX < 0 || checkX >= MAZE_WIDTH || checkZ < 0 || checkZ >= MAZE_HEIGHT) {
                // Treat out of bounds as wall
                return true;
            }

            if (MAZE_LAYOUT[checkZ][checkX] === 1) {
                const wallMinX = checkX * CELL_SIZE;
                const wallMaxX = (checkX + 1) * CELL_SIZE;
                const wallMinZ = checkZ * CELL_SIZE;
                const wallMaxZ = (checkZ + 1) * CELL_SIZE;

                // Find closest point on wall to player position
                const closestX = Math.max(wallMinX, Math.min(x, wallMaxX));
                const closestZ = Math.max(wallMinZ, Math.min(z, wallMaxZ));

                const distX = x - closestX;
                const distZ = z - closestZ;
                const dist = Math.sqrt(distX * distX + distZ * distZ);

                if (dist < radius) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Push player out of walls if stuck
function pushPlayerOutOfWalls() {
    const radius = 0.5;
    const cellX = Math.floor(camera.position.x / CELL_SIZE);
    const cellZ = Math.floor(camera.position.z / CELL_SIZE);

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const checkX = cellX + dx;
            const checkZ = cellZ + dz;

            if (checkX < 0 || checkX >= MAZE_WIDTH || checkZ < 0 || checkZ >= MAZE_HEIGHT) continue;

            if (MAZE_LAYOUT[checkZ][checkX] === 1) {
                const wallMinX = checkX * CELL_SIZE;
                const wallMaxX = (checkX + 1) * CELL_SIZE;
                const wallMinZ = checkZ * CELL_SIZE;
                const wallMaxZ = (checkZ + 1) * CELL_SIZE;

                const closestX = Math.max(wallMinX, Math.min(camera.position.x, wallMaxX));
                const closestZ = Math.max(wallMinZ, Math.min(camera.position.z, wallMaxZ));

                const distX = camera.position.x - closestX;
                const distZ = camera.position.z - closestZ;
                const dist = Math.sqrt(distX * distX + distZ * distZ);

                if (dist < radius && dist > 0.001) {
                    // Push player away from wall
                    const pushX = (distX / dist) * (radius - dist + WALL_PUSH_BUFFER);
                    const pushZ = (distZ / dist) * (radius - dist + WALL_PUSH_BUFFER);
                    camera.position.x += pushX;
                    camera.position.z += pushZ;
                }
            }
        }
    }
}

function updatePacman(delta) {
    // Animate mouth
    const mouthSpeed = 15;
    pacman.mouthOpen = (Math.sin(Date.now() * 0.01 * mouthSpeed) + 1) / 2;

    const maxMouthAngle = Math.PI / 4;
    const currentAngle = pacman.mouthOpen * maxMouthAngle;

    if (pacman.topHalf && pacman.bottomHalf) {
        pacman.topHalf.rotation.x = -currentAngle;
        pacman.bottomHalf.rotation.x = currentAngle;
    }

    // Move towards target
    const targetWorldX = pacman.targetX * CELL_SIZE + CELL_SIZE / 2;
    const targetWorldZ = pacman.targetZ * CELL_SIZE + CELL_SIZE / 2;

    const dx = targetWorldX - pacman.mesh.position.x;
    const dz = targetWorldZ - pacman.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.1) {
        // Reached target, pick new direction
        pickPacmanDirection();

        // Check for dot eating
        eatDots();

        // Check for power pellet eating
        eatPowerPellets();
    } else {
        // Move towards target
        const speed = gameState.pacmanPowered ? pacman.speed * 1.5 : pacman.speed;
        pacman.mesh.position.x += (dx / dist) * speed * delta;
        pacman.mesh.position.z += (dz / dist) * speed * delta;

        // Rotate to face direction
        pacman.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Check for ghost collision
    checkPacmanGhostCollision();

    // Update power timer
    if (gameState.pacmanPowered) {
        gameState.powerTimer -= delta;
        if (gameState.powerTimer <= 0) {
            gameState.pacmanPowered = false;
            document.getElementById('pacman-power').textContent = 'NORMAL';
            document.getElementById('pacman-power').style.color = '#fff';

            // Reset PAC-MAN appearance
            if (pacman.topHalf && pacman.bottomHalf) {
                pacman.topHalf.material.emissiveIntensity = 0.3;
                pacman.bottomHalf.material.emissiveIntensity = 0.3;
            }
        }
    }
}

function pickPacmanDirection() {
    const possibleDirections = [];
    const dirs = [
        { x: 0, z: -1 },
        { x: 0, z: 1 },
        { x: -1, z: 0 },
        { x: 1, z: 0 }
    ];

    dirs.forEach(dir => {
        const newX = pacman.x + dir.x;
        const newZ = pacman.z + dir.z;

        if (newX >= 0 && newX < MAZE_WIDTH && newZ >= 0 && newZ < MAZE_HEIGHT) {
            if (MAZE_LAYOUT[newZ][newX] !== 1) {
                // Prefer not going back
                if (dir.x !== -pacman.direction.x || dir.z !== -pacman.direction.z) {
                    possibleDirections.push(dir);
                }
            }
        }
    });

    if (possibleDirections.length === 0) {
        // Must go back
        possibleDirections.push({ x: -pacman.direction.x, z: -pacman.direction.z });
    }

    // If powered, chase ghosts
    if (gameState.pacmanPowered) {
        let closestGhost = null;
        let closestDist = Infinity;

        ghosts.forEach(ghost => {
            if (!ghost.alive || ghost.saved) return;
            const dist = Math.abs(ghost.x - pacman.x) + Math.abs(ghost.z - pacman.z);
            if (dist < closestDist) {
                closestDist = dist;
                closestGhost = ghost;
            }
        });

        if (closestGhost) {
            // Pick direction towards ghost
            let bestDir = possibleDirections[0];
            let bestDist = Infinity;

            possibleDirections.forEach(dir => {
                const newX = pacman.x + dir.x;
                const newZ = pacman.z + dir.z;
                const dist = Math.abs(newX - closestGhost.x) + Math.abs(newZ - closestGhost.z);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDir = dir;
                }
            });

            pacman.direction = bestDir;
        } else {
            pacman.direction = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
        }
    } else {
        // Random direction (with preference for dots)
        let bestDir = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];

        // Check if any direction has a dot
        possibleDirections.forEach(dir => {
            const newX = pacman.x + dir.x;
            const newZ = pacman.z + dir.z;
            const hasDot = dots.some(d => d.x === newX && d.z === newZ && !d.eaten);
            const hasPellet = powerPellets.some(p => p.x === newX && p.z === newZ && !p.eaten);
            if (hasDot || hasPellet) {
                bestDir = dir;
            }
        });

        pacman.direction = bestDir;
    }

    pacman.x += pacman.direction.x;
    pacman.z += pacman.direction.z;
    pacman.targetX = pacman.x;
    pacman.targetZ = pacman.z;

    // Handle wraparound
    if (pacman.x < 0) pacman.x = MAZE_WIDTH - 1;
    if (pacman.x >= MAZE_WIDTH) pacman.x = 0;
    if (pacman.z < 0) pacman.z = MAZE_HEIGHT - 1;
    if (pacman.z >= MAZE_HEIGHT) pacman.z = 0;
}

function eatDots() {
    dots.forEach(dot => {
        if (!dot.eaten && dot.x === pacman.x && dot.z === pacman.z) {
            dot.eaten = true;
            scene.remove(dot.mesh);
            playSound('wakawaka');
        }
    });
}

function eatPowerPellets() {
    powerPellets.forEach(pellet => {
        if (!pellet.eaten && pellet.x === pacman.x && pellet.z === pacman.z) {
            pellet.eaten = true;
            scene.remove(pellet.mesh);

            // Play power up sound
            playSound('powerUp');

            // Activate power mode
            gameState.pacmanPowered = true;
            gameState.powerTimer = 10; // 10 seconds
            document.getElementById('pacman-power').textContent = 'POWERED UP!';
            document.getElementById('pacman-power').style.color = '#f00';

            // Make PAC-MAN scarier
            if (pacman.topHalf && pacman.bottomHalf) {
                pacman.topHalf.material.emissiveIntensity = 1;
                pacman.bottomHalf.material.emissiveIntensity = 1;
            }
        }
    });
}

function checkPacmanGhostCollision() {
    ghosts.forEach(ghost => {
        if (!ghost.alive || ghost.saved || ghost.collected) return;

        const dist = pacman.mesh.position.distanceTo(ghost.mesh.position);
        if (dist < 2) {
            // PAC-MAN caught a ghost!
            ghost.alive = false;
            scene.remove(ghost.mesh);
            gameState.ghostsAlive--;
            document.getElementById('ghosts-alive').textContent = gameState.ghostsAlive;

            // Play ghost eaten sound
            playSound('ghostEaten');

            // Check for game over (all ghosts dead and none collected)
            const remainingGhosts = ghosts.filter(g => g.alive && !g.saved && !g.collected).length;
            if (remainingGhosts === 0 && gameState.collectedGhosts.length === 0) {
                endGame(false);
            }
        }
    });
}

function updateGhosts(delta) {
    ghosts.forEach(ghost => {
        if (!ghost.alive || ghost.saved || ghost.collected) return;

        // Get current cell center position
        const currentCellX = ghost.x * CELL_SIZE + CELL_SIZE / 2;
        const currentCellZ = ghost.z * CELL_SIZE + CELL_SIZE / 2;

        // Calculate target cell center if we have a target
        const targetCellX = ghost.targetX * CELL_SIZE + CELL_SIZE / 2;
        const targetCellZ = ghost.targetZ * CELL_SIZE + CELL_SIZE / 2;

        // Distance to current target cell
        const dx = targetCellX - ghost.mesh.position.x;
        const dz = targetCellZ - ghost.mesh.position.z;
        const distToTarget = Math.sqrt(dx * dx + dz * dz);

        // If we've reached the target cell (or close enough), pick new direction
        if (distToTarget < GHOST_TARGET_SNAP_DISTANCE) {
            // Snap to cell center
            ghost.mesh.position.x = targetCellX;
            ghost.mesh.position.z = targetCellZ;
            ghost.x = ghost.targetX;
            ghost.z = ghost.targetZ;

            // Determine escape target
            let escapeTargetX, escapeTargetZ;
            const distToPacman = Math.abs(ghost.x - pacman.x) + Math.abs(ghost.z - pacman.z);

            if (distToPacman < 8) {
                // PAC-MAN is close - flee directly away
                const awayX = ghost.x + (ghost.x - pacman.x) * 2;
                const awayZ = ghost.z + (ghost.z - pacman.z) * 2;
                escapeTargetX = Math.max(1, Math.min(MAZE_WIDTH - 2, awayX));
                escapeTargetZ = Math.max(1, Math.min(MAZE_HEIGHT - 2, awayZ));
            } else {
                // Move towards scatter target (unique corner for each ghost)
                escapeTargetX = ghost.scatterTarget.x;
                escapeTargetZ = ghost.scatterTarget.z;
            }

            // Pick next direction from valid options, avoiding walls
            const accessibleDirs = GHOST_DIRECTION_VECTORS.filter(dir => isCellWalkable(ghost.x + dir.x, ghost.z + dir.z));

            let bestDir = null;
            let bestDist = Infinity;

            accessibleDirs.forEach(dir => {
                const newX = ghost.x + dir.x;
                const newZ = ghost.z + dir.z;
                const isReverse = (dir.x === -ghost.direction.x && dir.z === -ghost.direction.z);
                const manhattan = Math.abs(newX - escapeTargetX) + Math.abs(newZ - escapeTargetZ);
                const adjustedDist = isReverse ? manhattan + REVERSE_MOVEMENT_PENALTY : manhattan;

                if (adjustedDist < bestDist) {
                    bestDist = adjustedDist;
                    bestDir = dir;
                }
            });

            if (!bestDir && accessibleDirs.length > 0) {
                bestDir = accessibleDirs[Math.floor(Math.random() * accessibleDirs.length)];
            }

            if (bestDir) {
                ghost.direction = bestDir;
                ghost.targetX = ghost.x + bestDir.x;
                ghost.targetZ = ghost.z + bestDir.z;
            }
        } else {
            // Move towards target cell center
            const speed = GHOST_SPEED;
            const moveAmount = speed * delta;

            if (distToTarget > 0.01) {
                ghost.mesh.position.x += (dx / distToTarget) * Math.min(moveAmount, distToTarget);
                ghost.mesh.position.z += (dz / distToTarget) * Math.min(moveAmount, distToTarget);
            }
        }

        // Floating animation
        ghost.mesh.position.y = 1 + Math.sin(Date.now() * 0.003 + ghosts.indexOf(ghost)) * 0.2;

        // Create slime trail
        const currentTime = Date.now() / 1000;
        if (currentTime - ghost.lastSlimeTime > SLIME_TRAIL_INTERVAL) {
            createSlimeDrop(ghost);
            ghost.lastSlimeTime = currentTime;
        }

        // Look at player if close
        const distToPlayer = ghost.mesh.position.distanceTo(camera.position);
        if (distToPlayer < 8) {
            ghost.mesh.lookAt(camera.position.x, ghost.mesh.position.y, camera.position.z);
        }
    });
}

// Slime trail functions
// Shared geometry for better performance
const slimeGeometry = new THREE.CircleGeometry(SLIME_TRAIL_SIZE, 8);

function createSlimeDrop(ghost) {
    // Create a glowing slime drop at the ghost's position
    // Each slime gets its own material for individual opacity control
    const slimeMaterial = new THREE.MeshStandardMaterial({
        color: ghost.color,
        emissive: ghost.color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });

    const slime = new THREE.Mesh(slimeGeometry, slimeMaterial);
    slime.rotation.x = -Math.PI / 2; // Lay flat on ground

    // Vary size via scale instead of creating new geometry
    const sizeVariation = 0.7 + Math.random() * 0.35;
    slime.scale.set(sizeVariation, sizeVariation, 1);

    slime.position.set(
        ghost.mesh.position.x + (Math.random() - 0.5) * SLIME_TRAIL_SPREAD,
        0.05, // Just above the floor
        ghost.mesh.position.z + (Math.random() - 0.5) * SLIME_TRAIL_SPREAD
    );

    scene.add(slime);
    slimeTrails.push({
        mesh: slime,
        createdAt: Date.now() / 1000,
        color: ghost.color,
        baseScale: sizeVariation
    });
}

function updateSlimeTrails() {
    const currentTime = Date.now() / 1000;

    // Update and remove expired slime
    for (let i = slimeTrails.length - 1; i >= 0; i--) {
        const slime = slimeTrails[i];
        const age = currentTime - slime.createdAt;

        if (age > SLIME_TRAIL_LIFETIME) {
            // Remove expired slime
            scene.remove(slime.mesh);
            // Dispose only the material (geometry is shared)
            slime.mesh.material.dispose();
            slimeTrails.splice(i, 1);
        } else {
            // Fade out slime based on age
            const fadeProgress = age / SLIME_TRAIL_LIFETIME;
            slime.mesh.material.opacity = 0.8 * (1 - fadeProgress);
            slime.mesh.material.emissiveIntensity = 0.5 * (1 - fadeProgress);
            const scale = slime.baseScale * (1 + fadeProgress * 0.3);
            slime.mesh.scale.set(scale, scale, 1);
        }
    }
}

let lastWarningTime = 0;

function updateWarning() {
    const warningEl = document.getElementById('pacman-warning');
    const dist = camera.position.distanceTo(pacman.mesh.position);

    if (dist < 15) {
        warningEl.style.display = 'block';
        warningEl.style.opacity = Math.max(0, 1 - dist / 15);

        // Play warning sound periodically
        const now = Date.now();
        if (dist < 10 && now - lastWarningTime > 2000) {
            playSound('warning');
            lastWarningTime = now;
        }
    } else {
        warningEl.style.display = 'none';
    }
}

function endGame(won, killedByPacman = false) {
    gameState.over = true;
    controls.unlock();

    const gameOverEl = document.getElementById('game-over');
    const titleEl = document.getElementById('game-over-title');
    const messageEl = document.getElementById('game-over-message');

    gameOverEl.style.display = 'flex';

    if (won) {
        gameOverEl.classList.add('win');
        gameOverEl.classList.remove('lose');
        titleEl.textContent = 'YOU SAVED THEM ALL!';
        messageEl.textContent = `All ${gameState.totalGhosts} ghosts have been safely delivered!`;
    } else if (killedByPacman) {
        gameOverEl.classList.add('lose');
        gameOverEl.classList.remove('win');
        titleEl.textContent = 'YOU WERE DEVOURED!';
        messageEl.textContent = `PAC-MAN caught you! You saved ${gameState.ghostsSaved} of ${gameState.totalGhosts} ghosts.`;
    } else {
        gameOverEl.classList.add('lose');
        gameOverEl.classList.remove('win');
        titleEl.textContent = 'GAME OVER';
        messageEl.textContent = `PAC-MAN consumed all the ghosts. You saved ${gameState.ghostsSaved} of ${gameState.totalGhosts}.`;
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameState.started || gameState.over) {
        renderer.render(scene, camera);
        return;
    }

    const delta = clock.getDelta();

    updatePlayer(delta);
    updatePacman(delta);
    updateGhosts(delta);
    updateSlimeTrails();
    updateWarning();
    updateMusicIntensity();
    checkPlayerPacmanCollision();
    checkPlayerAtSafeZone();

    renderer.render(scene, camera);
}

// Start the game
init();

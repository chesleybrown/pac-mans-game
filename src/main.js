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
const PLAYER_SPEED = 4;
const PLAYER_RUN_SPEED = 7;
const PACMAN_SPEED = 5;
const GHOST_SPEED = 3;
const GHOST_FLEE_SPEED = 5;

// Audio
let audioContext;
let soundEffects = {};

// Classic PAC-MAN maze layout (1 = wall, 0 = path, 2 = dot, 3 = power pellet, 4 = safe zone)
const MAZE_LAYOUT = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,1,2,1,2,1,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,1,0,1,0,1,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,0,1,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,4,4,4,4,4,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,1,2,1,2,1,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const MAZE_WIDTH = MAZE_LAYOUT[0].length;
const MAZE_HEIGHT = MAZE_LAYOUT.length;

// Three.js setup
let scene, camera, renderer, controls;
let playerHands, playerFeet;
let pacman, ghosts = [];
let dots = [];
let powerPellets = [];
let safeZones = [];
let walls = [];

// Movement
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    running: false
};

// Clock for delta time
const clock = new THREE.Clock();

// PAC-MAN geometry constants
const PACMAN_BODY_RADIUS = 1.5;
const PACMAN_MOUTH_RADIUS = 1.6;
const PACMAN_MOUTH_HEIGHT = 2;

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
    
    // Create horror-style wall texture with blood splatters and claw marks
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 256;
    wallCanvas.height = 256;
    const wallCtx = wallCanvas.getContext('2d');
    
    // Base neon blue color
    wallCtx.fillStyle = '#0033aa';
    wallCtx.fillRect(0, 0, 256, 256);
    
    // Add grid lines for retro look
    wallCtx.strokeStyle = '#0055ff';
    wallCtx.lineWidth = 2;
    for (let i = 0; i < 256; i += 32) {
        wallCtx.beginPath();
        wallCtx.moveTo(i, 0);
        wallCtx.lineTo(i, 256);
        wallCtx.stroke();
        wallCtx.beginPath();
        wallCtx.moveTo(0, i);
        wallCtx.lineTo(256, i);
        wallCtx.stroke();
    }
    
    // Add blood splatters (deterministic positions)
    wallCtx.fillStyle = '#8b0000';
    for (let i = 0; i < 5; i++) {
        const x = seededRandom() * 256;
        const y = seededRandom() * 256;
        const radius = 10 + seededRandom() * 20;
        wallCtx.beginPath();
        wallCtx.arc(x, y, radius, 0, Math.PI * 2);
        wallCtx.fill();
        // Drips
        for (let j = 0; j < 3; j++) {
            wallCtx.fillRect(x - 2 + seededRandom() * 4, y, 3, 20 + seededRandom() * 40);
        }
    }
    
    // Add claw marks (deterministic positions)
    wallCtx.strokeStyle = '#330000';
    wallCtx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
        const x = 50 + seededRandom() * 150;
        const y = 50 + seededRandom() * 100;
        for (let j = 0; j < 3; j++) {
            wallCtx.beginPath();
            wallCtx.moveTo(x + j * 15, y);
            wallCtx.lineTo(x + j * 15 + 10, y + 60);
            wallCtx.stroke();
        }
    }
    
    const wallTexture = new THREE.CanvasTexture(wallCanvas);
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        emissive: 0x001166,
        emissiveIntensity: 0.2,
        roughness: 0.8,
        metalness: 0.2
    });
    
    // Create horror floor texture
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
    
    // Blood pools (deterministic positions)
    floorCtx.fillStyle = '#3a0000';
    for (let i = 0; i < 8; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        floorCtx.beginPath();
        floorCtx.ellipse(x, y, 30 + seededRandom() * 40, 20 + seededRandom() * 30, seededRandom() * Math.PI, 0, Math.PI * 2);
        floorCtx.fill();
    }
    
    // Skull symbols (deterministic positions)
    floorCtx.fillStyle = '#1a1a2a';
    for (let i = 0; i < 4; i++) {
        const x = 100 + seededRandom() * 300;
        const y = 100 + seededRandom() * 300;
        // Simple skull shape
        floorCtx.beginPath();
        floorCtx.arc(x, y, 20, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.fillRect(x - 10, y + 15, 20, 15);
        // Eye sockets
        floorCtx.fillStyle = '#0a0a15';
        floorCtx.beginPath();
        floorCtx.arc(x - 7, y - 3, 5, 0, Math.PI * 2);
        floorCtx.arc(x + 7, y - 3, 5, 0, Math.PI * 2);
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
                // Wall
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
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
    // PAC-MAN as a creepy, larger-than-life sphere with a mouth
    const pacmanGroup = new THREE.Group();
    
    // Main body
    const bodyGeometry = new THREE.SphereGeometry(PACMAN_BODY_RADIUS, 32, 32, 0, Math.PI * 2, 0, Math.PI);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3
    });
    
    // Create PAC-MAN shape with mouth
    const pacmanGeometry = new THREE.SphereGeometry(PACMAN_BODY_RADIUS, 32, 32);
    const pacmanMesh = new THREE.Mesh(pacmanGeometry, bodyMaterial);
    
    // Eye (single, creepy eye)
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const eyePupilMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x000000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    
    const eyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    eyeWhite.position.set(0, 0.8, 1.2);
    
    const eyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), eyePupilMaterial);
    eyePupil.position.set(0, 0.8, 1.4);
    
    // Mouth (wedge cut out)
    const mouthGeometry = new THREE.ConeGeometry(PACMAN_MOUTH_RADIUS, PACMAN_MOUTH_HEIGHT, 32, 1, true, 0, Math.PI / 3);
    const mouthMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a0000,
        side: THREE.DoubleSide
    });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 0, 0.5);
    
    pacmanGroup.add(pacmanMesh);
    pacmanGroup.add(eyeWhite);
    pacmanGroup.add(eyePupil);
    pacmanGroup.add(mouth);
    
    // Point light to make PAC-MAN glow ominously
    const pacmanLight = new THREE.PointLight(0xffff00, 1, 15);
    pacmanLight.position.set(0, 0, 0);
    pacmanGroup.add(pacmanLight);
    
    // PAC-MAN starts at classic position (bottom center, below ghost house)
    pacmanGroup.position.set(10 * CELL_SIZE + CELL_SIZE / 2, 1.5, 15 * CELL_SIZE + CELL_SIZE / 2);
    
    pacman = {
        mesh: pacmanGroup,
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
    // Ghost house positions (center of maze, in the safe zone area)
    const startPositions = [
        { x: 9, z: 9 },   // Blinky - left side of ghost house
        { x: 11, z: 9 },  // Inky - right side of ghost house
        { x: 10, z: 9 },  // Pinky - center of ghost house
        { x: 10, z: 10 }  // Clyde - below center
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
        
        const pos = startPositions[index];
        ghostGroup.position.set(pos.x * CELL_SIZE + CELL_SIZE / 2, 1, pos.z * CELL_SIZE + CELL_SIZE / 2);
        
        ghosts.push({
            mesh: ghostGroup,
            name: ghostNames[index],
            color: color,
            x: pos.x,
            z: pos.z,
            targetX: pos.x,
            targetZ: pos.z,
            direction: { x: 0, z: 0 },
            alive: true,
            saved: false,
            collected: false, // Player has collected this ghost
            guideTarget: null,
            speed: GHOST_SPEED,
            scatterTarget: scatterTargets[index] // Unique escape direction
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
            case 'ShiftLeft':
            case 'ShiftRight':
                moveState.running = true;
                break;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': moveState.forward = false; break;
            case 'KeyS': moveState.backward = false; break;
            case 'KeyA': moveState.left = false; break;
            case 'KeyD': moveState.right = false; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                moveState.running = false;
                break;
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
    
    // Create a spooky ambient loop
    const playLoop = () => {
        if (!gameState.started || gameState.over) return;
        
        const now = audioContext.currentTime;
        
        // Bass drone
        const bass = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(55, now); // Low A
        bass.connect(bassGain);
        bassGain.connect(audioContext.destination);
        bassGain.gain.setValueAtTime(0.05, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 2);
        bass.start(now);
        bass.stop(now + 2);
        
        // Eerie melody notes (minor scale)
        const melodyNotes = [220, 196, 175, 165, 147, 165, 175, 196];
        melodyNotes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.25);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            gain.gain.setValueAtTime(0.03, now + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.25 + 0.2);
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.25);
        });
        
        // Schedule next loop
        setTimeout(playLoop, 2000);
    };
    
    playLoop();
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
    
    const speed = moveState.running ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    
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
    
    if (!checkWallCollision(newPosX, camera.position.z, 0.3)) {
        camera.position.x = newPosX;
    }
    if (!checkWallCollision(camera.position.x, newPosZ, 0.3)) {
        camera.position.z = newPosZ;
    }
    
    // Clamp to maze bounds
    camera.position.x = Math.max(CELL_SIZE, Math.min((MAZE_WIDTH - 1) * CELL_SIZE, camera.position.x));
    camera.position.z = Math.max(CELL_SIZE, Math.min((MAZE_HEIGHT - 1) * CELL_SIZE, camera.position.z));
    
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
            
            if (checkX < 0 || checkX >= MAZE_WIDTH || checkZ < 0 || checkZ >= MAZE_HEIGHT) continue;
            
            if (MAZE_LAYOUT[checkZ][checkX] === 1) {
                const wallCenterX = checkX * CELL_SIZE + CELL_SIZE / 2;
                const wallCenterZ = checkZ * CELL_SIZE + CELL_SIZE / 2;
                
                const closestX = Math.max(wallCenterX - CELL_SIZE / 2, Math.min(x, wallCenterX + CELL_SIZE / 2));
                const closestZ = Math.max(wallCenterZ - CELL_SIZE / 2, Math.min(z, wallCenterZ + CELL_SIZE / 2));
                
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

function updatePacman(delta) {
    // Animate mouth
    pacman.mouthOpen = (Math.sin(Date.now() * 0.01) + 1) / 2;
    
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
            pacman.mesh.children[0].material.emissiveIntensity = 1;
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
        
        // Movement logic - ghosts are always trying to escape PAC-MAN
        let targetX, targetZ;
        
        // Flee from PAC-MAN using unique scatter patterns
        const distToPacman = Math.abs(ghost.x - pacman.x) + Math.abs(ghost.z - pacman.z);
        
        if (distToPacman < 8) {
            // PAC-MAN is close - flee directly away
            const awayX = ghost.x + (ghost.x - pacman.x) * 2;
            const awayZ = ghost.z + (ghost.z - pacman.z) * 2;
            targetX = Math.max(1, Math.min(MAZE_WIDTH - 2, awayX));
            targetZ = Math.max(1, Math.min(MAZE_HEIGHT - 2, awayZ));
        } else {
            // Move towards scatter target (unique corner for each ghost)
            targetX = ghost.scatterTarget.x;
            targetZ = ghost.scatterTarget.z;
        }
        
        // Simple pathfinding
        const dirs = [
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: 0 },
            { x: 1, z: 0 }
        ];
        
        let bestDir = null;
        let bestDist = Infinity;
        
        dirs.forEach(dir => {
            const newX = Math.floor(ghost.mesh.position.x / CELL_SIZE) + dir.x;
            const newZ = Math.floor(ghost.mesh.position.z / CELL_SIZE) + dir.z;
            
            if (newX >= 0 && newX < MAZE_WIDTH && newZ >= 0 && newZ < MAZE_HEIGHT) {
                if (MAZE_LAYOUT[newZ][newX] !== 1) {
                    const dist = Math.abs(newX - targetX) + Math.abs(newZ - targetZ);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestDir = dir;
                    }
                }
            }
        });
        
        if (bestDir) {
            const speed = ghost.guideTarget ? GHOST_FLEE_SPEED : GHOST_SPEED;
            ghost.mesh.position.x += bestDir.x * speed * delta;
            ghost.mesh.position.z += bestDir.z * speed * delta;
            
            // Update cell position
            ghost.x = Math.floor(ghost.mesh.position.x / CELL_SIZE);
            ghost.z = Math.floor(ghost.mesh.position.z / CELL_SIZE);
        }
        
        // Floating animation
        ghost.mesh.position.y = 1 + Math.sin(Date.now() * 0.003 + ghosts.indexOf(ghost)) * 0.2;
        
        // Look at player if close
        const distToPlayer = ghost.mesh.position.distanceTo(camera.position);
        if (distToPlayer < 8) {
            ghost.mesh.lookAt(camera.position.x, ghost.mesh.position.y, camera.position.z);
        }
    });
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
    updateWarning();
    checkPlayerPacmanCollision();
    checkPlayerAtSafeZone();
    
    renderer.render(scene, camera);
}

// Start the game
init();

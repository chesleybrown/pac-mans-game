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
    powerTimer: 0
};

// Constants
const CELL_SIZE = 4;
const WALL_HEIGHT = 5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_SPEED = 8;
const PLAYER_RUN_SPEED = 14;
const PACMAN_SPEED = 5;
const GHOST_SPEED = 3;
const GHOST_FLEE_SPEED = 5;

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
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);
    
    // Camera (first-person)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10 * CELL_SIZE, PLAYER_HEIGHT, 10 * CELL_SIZE);
    
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
    // Dim ambient light for horror atmosphere
    const ambientLight = new THREE.AmbientLight(0x111111);
    scene.add(ambientLight);
    
    // Eerie point lights
    const eerieLight1 = new THREE.PointLight(0xff0000, 0.5, 50);
    eerieLight1.position.set(5 * CELL_SIZE, 4, 5 * CELL_SIZE);
    scene.add(eerieLight1);
    
    const eerieLight2 = new THREE.PointLight(0x0000ff, 0.5, 50);
    eerieLight2.position.set(15 * CELL_SIZE, 4, 15 * CELL_SIZE);
    scene.add(eerieLight2);
    
    // Player flashlight
    const flashlight = new THREE.SpotLight(0xffffaa, 2, 30, Math.PI / 6, 0.5, 1);
    flashlight.position.set(0, 0, 0);
    flashlight.target.position.set(0, 0, -1);
    camera.add(flashlight);
    camera.add(flashlight.target);
    scene.add(camera);
}

function createMaze() {
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.9,
        metalness: 0.1
    });
    
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x0f0f1a,
        roughness: 1,
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
    
    const safeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.3
    });
    
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((MAZE_WIDTH * CELL_SIZE) / 2, 0, (MAZE_HEIGHT * CELL_SIZE) / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Ceiling
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: 0x050510,
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
    const safeZoneGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.8, 0.1, CELL_SIZE * 0.8);
    
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
            } else if (cell === 4) {
                // Safe zone for ghosts
                const safeZone = new THREE.Mesh(safeZoneGeometry, safeMaterial);
                safeZone.position.set(posX, 0.1, posZ);
                scene.add(safeZone);
                safeZones.push({ mesh: safeZone, x: x, z: z });
            }
        }
    }
}

function createPlayerBody() {
    // Create hands
    const handMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdeb887,
        roughness: 0.7
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
    
    pacmanGroup.position.set(10 * CELL_SIZE + CELL_SIZE / 2, 1.5, 9 * CELL_SIZE + CELL_SIZE / 2);
    
    pacman = {
        mesh: pacmanGroup,
        x: 10,
        z: 9,
        targetX: 10,
        targetZ: 9,
        direction: { x: 1, z: 0 },
        mouthOpen: 0,
        speed: PACMAN_SPEED
    };
    
    scene.add(pacmanGroup);
}

function createGhosts() {
    const ghostColors = [0xff0000, 0x00ffff, 0xffb8ff, 0xffb852]; // Blinky, Inky, Pinky, Clyde
    const ghostNames = ['Blinky', 'Inky', 'Pinky', 'Clyde'];
    const startPositions = [
        { x: 9, z: 9 },
        { x: 10, z: 9 },
        { x: 11, z: 9 },
        { x: 10, z: 10 }
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
            fleeing: false,
            guideTarget: null,
            speed: GHOST_SPEED
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
    
    // Click to guide ghosts
    document.addEventListener('click', () => {
        if (!gameState.started || gameState.over) return;
        
        if (!controls.isLocked) {
            controls.lock();
            return;
        }
        
        guideNearestGhost();
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    gameState.started = true;
    controls.lock();
}

function guideNearestGhost() {
    // Find nearest alive ghost and set a guide target for it
    const playerPos = camera.position;
    let nearestGhost = null;
    let nearestDist = Infinity;
    
    ghosts.forEach(ghost => {
        if (!ghost.alive || ghost.saved) return;
        
        const dist = playerPos.distanceTo(ghost.mesh.position);
        if (dist < nearestDist && dist < 10) { // Only guide ghosts within 10 units
            nearestDist = dist;
            nearestGhost = ghost;
        }
    });
    
    if (nearestGhost) {
        // Find nearest safe zone
        let nearestSafe = null;
        let nearestSafeDist = Infinity;
        
        safeZones.forEach(zone => {
            const dist = nearestGhost.mesh.position.distanceTo(
                new THREE.Vector3(zone.x * CELL_SIZE + CELL_SIZE / 2, 0, zone.z * CELL_SIZE + CELL_SIZE / 2)
            );
            if (dist < nearestSafeDist) {
                nearestSafeDist = dist;
                nearestSafe = zone;
            }
        });
        
        if (nearestSafe) {
            nearestGhost.guideTarget = nearestSafe;
            nearestGhost.fleeing = true;
            
            // Visual feedback
            const flashMaterial = nearestGhost.mesh.children[0].material.clone();
            flashMaterial.emissiveIntensity = 1;
            nearestGhost.mesh.children[0].material = flashMaterial;
            setTimeout(() => {
                flashMaterial.emissiveIntensity = 0.3;
            }, 200);
        }
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
        velocity.z -= direction.z * speed * delta * 50;
    }
    if (moveState.left || moveState.right) {
        velocity.x -= direction.x * speed * delta * 50;
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
        }
    });
}

function eatPowerPellets() {
    powerPellets.forEach(pellet => {
        if (!pellet.eaten && pellet.x === pacman.x && pellet.z === pacman.z) {
            pellet.eaten = true;
            scene.remove(pellet.mesh);
            
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
        if (!ghost.alive || ghost.saved) return;
        
        const dist = pacman.mesh.position.distanceTo(ghost.mesh.position);
        if (dist < 2) {
            // PAC-MAN caught a ghost!
            ghost.alive = false;
            scene.remove(ghost.mesh);
            gameState.ghostsAlive--;
            document.getElementById('ghosts-alive').textContent = gameState.ghostsAlive;
            
            // Check for game over
            if (gameState.ghostsAlive === 0) {
                endGame(false);
            }
        }
    });
}

function updateGhosts(delta) {
    ghosts.forEach(ghost => {
        if (!ghost.alive || ghost.saved) return;
        
        // Check if in safe zone
        const inSafeZone = safeZones.some(zone => 
            zone.x === Math.floor(ghost.mesh.position.x / CELL_SIZE) &&
            zone.z === Math.floor(ghost.mesh.position.z / CELL_SIZE)
        );
        
        if (inSafeZone && ghost.fleeing) {
            // Ghost is saved!
            ghost.saved = true;
            ghost.fleeing = false;
            gameState.ghostsSaved++;
            document.getElementById('ghosts-saved').textContent = gameState.ghostsSaved;
            
            // Visual effect
            ghost.mesh.children.forEach(child => {
                if (child.material) {
                    child.material.emissive = new THREE.Color(0x00ff00);
                    child.material.emissiveIntensity = 1;
                }
            });
            
            // Check for win
            if (gameState.ghostsSaved === gameState.totalGhosts) {
                endGame(true);
            }
            return;
        }
        
        // Movement logic
        let targetX, targetZ;
        
        if (ghost.guideTarget) {
            // Move towards guide target (safe zone)
            targetX = ghost.guideTarget.x;
            targetZ = ghost.guideTarget.z;
        } else if (gameState.pacmanPowered) {
            // Flee from PAC-MAN
            const awayX = ghost.x + (ghost.x - pacman.x);
            const awayZ = ghost.z + (ghost.z - pacman.z);
            targetX = Math.max(0, Math.min(MAZE_WIDTH - 1, awayX));
            targetZ = Math.max(0, Math.min(MAZE_HEIGHT - 1, awayZ));
        } else {
            // Wander randomly
            targetX = ghost.x + (Math.random() > 0.5 ? 1 : -1);
            targetZ = ghost.z + (Math.random() > 0.5 ? 1 : -1);
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
            const speed = ghost.fleeing ? GHOST_FLEE_SPEED : GHOST_SPEED;
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

function updateWarning() {
    const warningEl = document.getElementById('pacman-warning');
    const dist = camera.position.distanceTo(pacman.mesh.position);
    
    if (dist < 15) {
        warningEl.style.display = 'block';
        warningEl.style.opacity = Math.max(0, 1 - dist / 15);
    } else {
        warningEl.style.display = 'none';
    }
}

function endGame(won) {
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
        messageEl.textContent = `All ${gameState.totalGhosts} ghosts have been guided to safety.`;
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
    
    renderer.render(scene, camera);
}

// Start the game
init();

import * as THREE from 'three';
import { MeshLine, MeshLineMaterial } from './THREE.MeshLine.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FlyPointerLockControls } from './controls.js';
import * as maze from './maze.js';
import { storageGetItem, storageSetItem } from './storage.js';
import DustEffect from './dust.js';
import TrailEffect from './trail.js';
import CompassManager from './compassManagager.js';
import VRManager from './VRManager.js';
import TutorialManager from './TutorialManager.js';
import MenuManager from './MenuManager.js';
import GoalDotEffect from './goalDots.js';
import celebration from './celebration.js';
import MenuBackground from './menuBackground.js';
import {
    generateWallUVs,
    createSciFiWallDiffuseTexture,
    createSciFiWallBumpTexture,
    createSciFiPillarDiffuseTexture,
    createSciFiPillarBumpTexture
} from './textures.js';

// webpage objects

var renderer;
// var compassRenderer;

// var compassScene;
// var compassCamera;
var compassManager;

// ui variables
var menuManager = null;
var menuBackground = null;

// basic objects
var fpsClock;
var timerStartMillis;
var timerRunning;

const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    VICTORY: 'VICTORY'
};
var currentGameState = GAME_STATE.MENU;
var missionElapsedTime = 0;
var missionLastFrameTime = 0;

var scene;
var cameraNode;
var cameraCompensationNode;
var camera;

var spectator;

var tmpColor;

// Pre-allocated scratch vectors for hot paths (avoid per-frame GC pressure)
var _scratchNear;   // used in collisionUpdate
var _scratchFar;    // used in collisionUpdate
var _scratchInterp; // used in history interpolation
const _scratchOldPos = new THREE.Vector3();
const _scratchDelta = new THREE.Vector3();

// DOM telemetry cache to eliminate per-frame layout thrashing
let _cachedTimerSpan = null;
let _cachedDistSpan = null;
let _lastTimerFormatted = '';
let _lastDistFormatted = '';

// Dev-only lightweight diagnostic instrumentation (zero DOM overhead)
window.__PERF__ = {
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    _frames: 0,
    _lastTime: performance.now(),
    sample(frameDeltaMs, r) {
        this.frameTimeMs = frameDeltaMs;
        this._frames++;
        const now = performance.now();
        if (now - this._lastTime >= 1000) {
            this.fps = this._frames;
            this._frames = 0;
            this._lastTime = now;
        }
        if (r && r.info) {
            this.drawCalls = r.info.render.calls;
            this.triangles = r.info.render.triangles;
            this.geometries = r.info.memory.geometries;
            this.textures = r.info.memory.textures;
        }
    }
};

const _cameraAimMatrix = new THREE.Matrix4();
const _camAimTarget = new THREE.Vector3();

/**
 * Aims an Object3D container (such as cameraNode) so that its internal
 * PerspectiveCamera (which looks down its local -Z axis) looks directly at target.
 * Unlike Object3D.lookAt (which aligns local +Z to target), Matrix4.lookAt(eye, target, up)
 * establishes a standard camera view matrix looking towards -Z.
 */
function aimCameraNode(node, target) {
    _cameraAimMatrix.lookAt(node.position, target, node.up);
    node.quaternion.setFromRotationMatrix(_cameraAimMatrix);
    if (controls && controls.object === node && typeof controls.syncOrientation === 'function') {
        controls.syncOrientation();
    }
}

const PI_2 = Math.PI / 2;

// models
var blockGeometry;
var wallGeometry;

var arrowMesh;

// vr state
var vrManager;
var vrMirrorEnabled = false;

// materials
var dotSprite;

var wallMaterial;
var darkMaterial;

// controls
var controls;

// goal particles
var goalDots;

var lastTrailCameraPosition;

var tmpVector;

// maze variables
var mazeSize;
var mazeData;
var mazeGroup;
// checkpoints
var startedMaze;
var finishedMaze;
var isInFreeLook = false;
// save the positions of the entrance and exit of the maze
var startPos;
var segments;
var endPos;
// collisions
var mazePosNear;
var mazePosFar;
// history
var historyPositions;
var	historyLineMaterial;
var historyLine;
var historyMesh;

var dust;
var trail;

var dustSize   = 0.025;
var dustSizeVR = 0.0075;

var tutorialManager;

var masterVolumeLevel = 0.8;


function loadSavedVariables()
{
    const lastMazeCompletionDate = Number(storageGetItem('lastMazeCompletionDate', '0'));

    // show tutorial if more than 30 days have passed since the last maze completion
    const showTutorial = (Date.now() - lastMazeCompletionDate) > (1000 * 60 * 60 * 24 * 30);

    const tutorialCallbacks = {
        intro: {
            conditions: {
                0: (tutorialData) => {
                    return cameraNode && cameraNode.getWorldDirection(tmpVector).z > -0.975;
                },
                1: (tutorialData) => {
                    return cameraNode && cameraNode.position.distanceToSquared(tutorialData.cameraPos) > 4;
                },
                2: (tutorialData) => {
                    return Date.now() - tutorialData.lastLoggedTime > 6000;
                }
            },
            setup: {
                0: (tutorialData) => {
                    if (isMobile) {
                        const el = document.querySelector('#touch-tutorial-look');
                        el.style.display = '';
                        el.style.animationName = 'touch-tutorial-animation-look';
                    }
                },
                1: (tutorialData) => {
                    tutorialData.cameraPos = cameraNode.position.clone();

                    if (isMobile) {
                        const el = document.querySelector('#touch-tutorial-look');
                        el.style.display = 'none';
                        el.style.animationName = '';
                        const moveEl = document.querySelector('#touch-tutorial-move');
                        moveEl.style.display = '';
                        moveEl.style.animationName = 'touch-tutorial-animation-move';
                    }
                },
                2: (tutorialData) => {
                    tutorialData.lastLoggedTime = Date.now();

                    if (isMobile) {
                        document.querySelector('#touch-tutorial-move').style.display = 'none';
                        document.querySelector('#touch-tutorial-move').style.animationName = '';
                    }

                    document.querySelector('#computer-tutorial-compass').style.animationFillMode = 'forwards';
                    document.querySelector('#compass-container').style.animationName = 'compass-tutorial-highlight';
                }
            },
            teardown: (tutorialData) => {
                document.querySelector('#compass-container').style.animationName = '';
            }
        },
        vr: {
            conditions: {
                0: (tutorialData) => {
                    return cameraNode && cameraNode.position.distanceToSquared(tutorialData.cameraPos) > 1;
                },
                1: (tutorialData) => {
                    if (vrManager.isUsingGazeControls) {
                        // For gaze controls, they can't rotate so just wait 6 seconds
                        return Date.now() - tutorialData.lastLoggedTime > 6000;
                    }

                    if (cameraNode && cameraNode.rotation.y != tutorialData.rotationStart)
                        tutorialData.rotateCondition = true;
                    return (tutorialData.rotateCondition && Date.now() - tutorialData.lastLoggedTime > 4000);
                },
                2: (tutorialData) => {
                    return Date.now() - tutorialData.lastLoggedTime > 6000;
                },
                3: (tutorialData) => {
                    return Date.now() - tutorialData.lastLoggedTime > 6000;
                }
            },
            setup: {
                0: (tutorialData) => {
                    tutorialData.cameraPos = cameraNode.position.clone();
                    vrManager.updateControlSchemeDisplay();
                },
                1: (tutorialData) => {
                    tutorialData.lastLoggedTime = Date.now();
                    tutorialData.rotationStart = cameraNode.rotation.y;
                    tutorialData.rotateCondition = false;
                },
                2: (tutorialData) => {
                    tutorialData.lastLoggedTime = Date.now();
                },
                3: (tutorialData) => {
                    tutorialData.lastLoggedTime = Date.now();
                }
            }
        }
    };

    tutorialManager = new TutorialManager({
        showTutorial,
        callbacks: tutorialCallbacks
    });

    document.querySelectorAll('.menu-experienced').forEach((el) => {
        el.style.display = '';
    });

    const vrTeleport = storageGetItem('vr-setting-movement', 'teleport');
    controls.vrControlOptions.teleportationEnabled = vrTeleport == 'teleport';
    document.querySelectorAll('[name="vr-setting-movement"]').forEach((el) => {
        el.checked = el.value == vrTeleport;
    });

    const vrRotation = storageGetItem('vr-setting-rotation', 'instant');
    controls.vrControlOptions.rotationSmoothing = vrRotation == 'smooth';
    document.querySelectorAll('[name="vr-setting-rotation"]').forEach((el) => {
        el.checked = el.value == vrRotation;
    });

    updateVrRotateSpeedSettingEnabled();

    const vrRotationSpeed = Number(storageGetItem('vr-setting-rotation-speed', '0'));
    vrManager.rotationSpeed = Math.pow(3, vrRotationSpeed);
    document.querySelector('#vr-setting-rotation-speed').value = vrRotationSpeed;

    const vrMirroringDefault = getVrDeviceType() === 'vr-device-enabled' ? 'true' : 'false';
    vrMirrorEnabled = storageGetItem('vr-setting-mirror', vrMirroringDefault) === 'true';
    document.querySelector('#vr-setting-mirror').checked = vrMirrorEnabled;

    // Load flight, audio, and graphics settings
    const savedFixedCam = storageGetItem('setting-fixed-camera', 'true') === 'true';
    const fixedCamEl = document.querySelector('#setting-fixed-camera');
    if (fixedCamEl) fixedCamEl.checked = savedFixedCam;
    if (controls) controls.setGimbalLocked(savedFixedCam);

    const savedSens = storageGetItem('setting-mouse-sensitivity', '1.0');
    const sensVal = parseFloat(savedSens) || 1.0;
    if (controls) {
        controls.sensitivityMultiplier = sensVal;
        controls.rollSpeed = sensVal;
    }
    const sensInput = document.querySelector('#setting-mouse-sensitivity');
    if (sensInput) sensInput.value = sensVal;
    const sensBadge = document.querySelector('#valSensitivityBadge');
    if (sensBadge) sensBadge.textContent = `${sensVal.toFixed(1)}×`;

    const savedVol = storageGetItem('setting-master-volume', '80');
    const volNum = parseInt(savedVol, 10);
    masterVolumeLevel = isNaN(volNum) ? 0.8 : volNum / 100;
    if (celebration) celebration.volume = masterVolumeLevel;
    const volInput = document.querySelector('#setting-master-volume');
    if (volInput) volInput.value = isNaN(volNum) ? 80 : volNum;
    const volBadge = document.querySelector('#valVolumeBadge');
    if (volBadge) volBadge.textContent = `${isNaN(volNum) ? 80 : volNum}%`;

    const savedDust = storageGetItem('setting-dust-particles', 'true') === 'true';
    const dustObj = dust ? (dust.object || dust._mesh) : null;
    if (dustObj) dustObj.visible = savedDust;
    const dustInput = document.querySelector('#setting-dust-particles');
    if (dustInput) dustInput.checked = savedDust;

    const savedTrail = storageGetItem('setting-trail-effect', 'true') === 'true';
    const trailObj = trail ? (trail.object || trail._mesh) : null;
    if (trailObj) trailObj.visible = savedTrail;
    const trailInput = document.querySelector('#setting-trail-effect');
    if (trailInput) trailInput.checked = savedTrail;
}

function init() {

    renderer = new THREE.WebGLRenderer( { antialias: true, powerPreference: "high-performance" } );
    renderer.setPixelRatio( Math.min(window.devicePixelRatio || 1, 1.75) );
    renderer.setSize( window.innerWidth, window.innerHeight, false );
    renderer.domElement.id = "mainCanvas";
    renderer.setAnimationLoop( animate );
    document.body.appendChild( renderer.domElement );

    // add 3d compass
    compassManager = new CompassManager();
    compassManager.renderer.setPixelRatio( Math.min(window.devicePixelRatio || 1, 1.5) );

    // Browser lifecycle visibility management (pauses when backgrounded, flushes delta time)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (currentGameState === GAME_STATE.PLAYING && controls && controls.isLocked) {
                controls.disableLock(new Event(''));
            }
            if (fpsClock) fpsClock.getDelta();
        } else {
            if (fpsClock) fpsClock.getDelta();
            if (currentGameState === GAME_STATE.PLAYING) {
                missionLastFrameTime = performance.now();
            }
        }
    });

    // setup basic objects
    fpsClock = new THREE.Clock();
    timerStartMillis = 0;
    timerRunning = false;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    // put camera inside a camera node so it can be transformed as a unit
    cameraNode = new THREE.Object3D();
    cameraCompensationNode = new THREE.Object3D();
    cameraNode.add( cameraCompensationNode );
    cameraCompensationNode.add( camera );

    spectator = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    cameraCompensationNode.add( spectator );

    tmpColor = new THREE.Color();

    // load models
    blockGeometry = new THREE.InstancedBufferGeometry();
    THREE.BufferGeometry.prototype.copy.call( blockGeometry, new THREE.BoxGeometry() );
    let loader = new GLTFLoader();
    wallGeometry = new THREE.InstancedBufferGeometry();
    let arrowGeometry = new THREE.BufferGeometry();

    loader.load( 'models/wall.glb', function ( gltf ) {
        let modelWall = gltf.scene.getObjectByName('wall');
        THREE.BufferGeometry.prototype.copy.call(wallGeometry, modelWall.geometry);
        generateWallUVs(wallGeometry);

        // build maze for first time
        // (must wait for this model to load or the colors don't work)
        buildMaze();
    }, undefined, function ( error ) {

        console.error( error );

    } );

    // load texture
    dotSprite = new THREE.TextureLoader().load( 'textures/dot.png' );

    // textures
    const wallDiffuseTex = createSciFiWallDiffuseTexture();
    const wallBumpTex = createSciFiWallBumpTexture();
    const pillarDiffuseTex = createSciFiPillarDiffuseTexture();
    const pillarBumpTex = createSciFiPillarBumpTexture();

    // materials
    wallMaterial = new THREE.MeshStandardMaterial( {
        vertexColors: true,
        map: wallDiffuseTex,
        bumpMap: wallBumpTex,
        bumpScale: 0.04,
        roughness: 0.45,
        metalness: 0.45
    } );
    darkMaterial = new THREE.MeshStandardMaterial( {
        color: 0xffffff,
        map: pillarDiffuseTex,
        bumpMap: pillarBumpTex,
        bumpScale: 0.035,
        roughness: 0.4,
        metalness: 0.75
    } );

    // set up lights
    let localLight = new THREE.PointLight( 0xffffff, 5, 0, 0.2 );
    camera.add( localLight );
    scene.add( cameraNode );
    let ambLight = new THREE.AmbientLight( 0x808080 );
    scene.add( ambLight );

    // Start Menu Living Cubic Labyrinth Background Environment
    menuBackground = new MenuBackground();
    scene.add( menuBackground.group );

    // Position menu background and aim camera immediately on startup (do not wait for wall.glb)
    if (menuBackground) {
        menuBackground.group.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2.6) );
        menuBackground.setVisible(true);
    }
    if (window.innerWidth >= 960 && !renderer.xr.isPresenting) {
        cameraNode.position.set( maze.getOffset(1) - 1.2, maze.getOffset(1) + 0.35, maze.getOffset(-2.6) );
    } else {
        cameraNode.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2.6) );
    }
    _camAimTarget.set( maze.getOffset(1) + 1.8, maze.getOffset(1) + 0.2, maze.getOffset(-2.6) - 6.0 );
    aimCameraNode( cameraNode, _camAimTarget );

    // init controls
    if (isMobile) {
        document.body.classList.add('is-formfactor-non-desktop');
        document.querySelectorAll('.formfactor-desktop').forEach((e => {
            e.style.display = 'none';
        }));
        document.querySelectorAll('.formfactor-non-desktop:not(.tutorial-element)').forEach((e => {
            e.style.display = '';
        }));
    }
    controls = new FlyPointerLockControls(cameraNode, renderer.domElement);
    controls.movementSpeed = maze.majorWidth;
    controls.rollSpeed = 1;
    controls.addEventListener( 'lock', function() {
        document.querySelector('#blocker').style.display = 'none';

        // Reveal in-game flight telemetry HUD and 3D navigation compass
        const hud = document.querySelector('#gameplay-hud');
        if (hud) hud.style.display = 'flex';
        const compassEl = document.querySelector('#compass-container');
        if (compassEl) compassEl.style.display = '';
        if (compassManager) compassManager.setVisible(true);
        const hudSector = document.querySelector('#hudSectorSpan');
        if (hudSector) hudSector.textContent = (mazeSize || '3') + '³';

        mazeGroup.visible = true;
        if (menuBackground) {
            menuBackground.setVisible(false);
        }

        if (currentGameState === GAME_STATE.PAUSED) {
            // RESUME from pause: seamlessly continue with exact saved position and camera orientation
            currentGameState = GAME_STATE.PLAYING;
            startedMaze = true;
            missionLastFrameTime = performance.now();
            if (controls && typeof controls.syncOrientation === 'function') {
                controls.syncOrientation();
            }
        } else if (currentGameState === GAME_STATE.MENU || !startedMaze) {
            // MISSION LAUNCH: Spawn inside fully enclosed starting chamber facing into maze
            currentGameState = GAME_STATE.PLAYING;
            startedMaze = true;
            finishedMaze = false;
            missionElapsedTime = 0;
            missionLastFrameTime = performance.now();

            if (!renderer.xr.isPresenting) {
                cameraNode.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-1) );
                _camAimTarget.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(1) );
                aimCameraNode( cameraNode, _camAimTarget );
                camera.rotation.set(0, 0, 0);
            }
            if (controls && typeof controls.syncOrientation === 'function') {
                controls.syncOrientation();
            }
        } else if (isInFreeLook) {
            currentGameState = GAME_STATE.VICTORY;
        }

        vrManager.setUiInteraction(false);
    } );
    controls.addEventListener( 'unlock', function() {
        // Hide in-game flight telemetry HUD
        const hud = document.querySelector('#gameplay-hud');
        if (hud) hud.style.display = 'none';
        if (compassManager) compassManager.setVisible(false);

        if (finishedMaze) {
            // Only re-open victory modal if player was actively in Free Look mode and pressed Esc to unlock
            if (isInFreeLook) {
                isInFreeLook = false;
                document.querySelector('#blocker').style.display = 'none';
                document.querySelector('#completionMessage').style.display = 'flex';
                document.querySelector('#victoryReopenBtn').style.display = 'none';
                celebration.startConfetti();
            }
            vrManager.setUiInteraction(true);
            vrManager.recenterUI();
            return;
        }

        // If in active flight, pause gameplay and freeze timer
        if (currentGameState === GAME_STATE.PLAYING) {
            currentGameState = GAME_STATE.PAUSED;
            missionLastFrameTime = 0; // freeze timer

            // Zero out movement states so player velocity immediately stops
            if (controls && controls.moveState) {
                controls.moveState.forward = 0;
                controls.moveState.back = 0;
                controls.moveState.left = 0;
                controls.moveState.right = 0;
                controls.moveState.up = 0;
                controls.moveState.down = 0;
                controls.updateMovementVector();
                controls.updateRotationVector();
            }
        }

        document.querySelector('#blocker').style.display = '';

        // Update main menu launch button text depending on resumable flight state
        const launchBtnSpan = document.querySelector('#menu-intro .button-play span');
        if (launchBtnSpan) {
            launchBtnSpan.textContent = (currentGameState === GAME_STATE.PAUSED) ? 'RESUME FLIGHT' : 'LAUNCH MISSION';
        }

        if (currentGameState === GAME_STATE.PAUSED) {
            if (!tutorialManager.inTutorial && menuManager.focusedMenu !== 'menu-rotate-phone') {
                menuManager.focusRootMenu('menu-pause');
            }
            const pauseSizeSpan = document.querySelector('#mazeSizeSpan');
            if (pauseSizeSpan) pauseSizeSpan.textContent = mazeSize;
            mazeGroup.visible = true;
            if (menuBackground) menuBackground.setVisible(false);
        } else {
            // In main menu state (not paused)
            mazeGroup.visible = false;
            const compassEl = document.querySelector('#compass-container');
            if (compassEl) compassEl.style.display = 'none';
            if (menuBackground) {
                menuBackground.setVisible(true);
            }
            if (window.innerWidth >= 960 && !renderer.xr.isPresenting) {
                cameraNode.position.set( maze.getOffset(1) - 1.2, maze.getOffset(1) + 0.35, maze.getOffset(-2.6) );
            } else {
                cameraNode.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2.6) );
            }
            _camAimTarget.set( maze.getOffset(1) + 1.8, maze.getOffset(1) + 0.2, maze.getOffset(-2.6) - 6.0 );
            aimCameraNode( cameraNode, _camAimTarget );
        }

        updateMenuCentering();

        vrManager.setUiInteraction(true);
        vrManager.recenterUI();
    } );
    // Keyboard listeners
    document.addEventListener('keydown', (event) => {
        const completionMsg = document.querySelector('#completionMessage');
        const isVictoryOpen = completionMsg && completionMsg.style.display !== 'none';
        const isFreeLookActive = document.querySelector('#victoryReopenBtn').style.display !== 'none';

        if (isVictoryOpen) {
            // M key: toggle audio mute
            if (event.code === 'KeyM') {
                event.preventDefault();
                document.querySelector('#btnVictoryMute').click();
                return;
            }
            // N key: trigger next level if available
            if (event.code === 'KeyN') {
                const btnNext = document.querySelector('#btnVictoryNextLevel');
                if (btnNext && btnNext.style.display !== 'none') {
                    event.preventDefault();
                    btnNext.click();
                    return;
                }
            }
            // Space or Enter
            if (event.code === 'Space' || event.code === 'Enter') {
                // If focus is currently on an interactive button inside the card, let standard activation occur
                const active = document.activeElement;
                if (active && active.tagName === 'BUTTON' && active.closest('#completionMessage')) {
                    return;
                }
                event.preventDefault();
                document.querySelector('#btnVictoryPlayAgain').click();
                return;
            }
            // Escape: toggle into Free Look mode
            if (event.code === 'Escape') {
                event.preventDefault();
                document.querySelector('#btnVictoryFreeLook').click();
                return;
            }
        } else if (isFreeLookActive) {
            // Escape while in Free Look returns to victory stats modal
            if (event.code === 'Escape') {
                event.preventDefault();
                document.querySelector('#victoryReopenBtn').click();
                return;
            }
        }

        // When paused, pressing P, Escape, Space, or Enter resumes flight
        if (currentGameState === GAME_STATE.PAUSED) {
            if (event.code === 'KeyP' || event.code === 'Escape' || event.code === 'Space' || event.code === 'Enter') {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
                    return;
                }
                event.preventDefault();
                menuLockControls();
                return;
            }
        }

        if (event.code === 'KeyP' && controls.isLocked)
        {
            controls.disableLock(new Event(''));
        }
        if (event.code === 'Escape' && controls.isLocked)
        {
            controls.disableLock(new Event(''));
        }
    });
    // change end text for Mac
    if (navigator.userAgent.indexOf('Mac OS X') != -1)
    {
        document.querySelectorAll('.os-not-mac').forEach((e => {
            e.style.display = 'none';
        }));
        document.querySelectorAll('.os-mac').forEach((e => {
            e.style.display = '';
        }));
    }

    // goal particles
    goalDots = new GoalDotEffect({
        count:    20,
        map:      dotSprite,
        sizes:    [ maze.minorWidth * 4, maze.minorWidth * 1.5 ],
        sizesVR:  [ maze.minorWidth * 5, maze.minorWidth * 2   ],
    });
    goalDots.addTo( scene );

    tmpVector = new THREE.Vector3();
    // Initialize hot-path scratch vectors (prevents GC pauses from per-frame allocs)
    _scratchNear   = new THREE.Vector3();
    _scratchFar    = new THREE.Vector3();
    _scratchInterp = new THREE.Vector3();

    // dust effect
    dust = new DustEffect({
        count: 350,
        spawnRadius: maze.majorWidth * 5,
        map: dotSprite,
        size: dustSize
    });
    dust.followObject(cameraNode);
    dust.addTo(scene);

    // trail effect (sci-fi glowing orb trail — shader-rendered, no texture needed)
    trail = new TrailEffect({
        count: 400,
        collisionDistance: collisionDistance
    });
    trail.followObject(cameraNode);
    trail.addTo(scene);

    compassManager.followObject(cameraNode);

    // init VR manager
    vrManager = new VRManager(renderer, cameraNode, cameraCompensationNode, camera, scene, dotSprite, controls);

    vrManager.addEventListener('pause', () => {
        if (controls.isLocked) {
            controls.disableLock(new Event(''));
        }
        else if (controls.isLocked === false) {
            controls.lock(new Event(''));
        }
    });

    // Setup VR event listeners
    renderer.xr.addEventListener('sessionstart', (event) => {
        controls.setXRPresenting(true);
        dust._material.size = dustSizeVR;
        goalDots.setVR( true );

        tutorialManager.useAnimations = false;
        tutorialManager.showTutorials['vr'] = true;
        tutorialManager.setTutorialType('vr');
    });

    renderer.xr.addEventListener('sessionend', (event) => {
        controls.setXRPresenting(false);
        controls.disableLock(new Event(''));
        dust._material.size = dustSize;
        goalDots.setVR( false );
        tutorialManager.useAnimations = true;
        tutorialManager.setTutorialType('intro');
        onWindowResize();
    });

    // setup vr ui elements
    const vrDeviceType = getVrDeviceType();
    for (const type of ['vr-device-first', 'vr-device-enabled', 'vr-device-last']) {
        document.querySelectorAll(`.${type}`).forEach((el) => {
            el.style.display = 'none';
        });
    }
    document.querySelectorAll(`.${vrDeviceType}`).forEach((el) => {
        el.style.display = '';
    });

    // maze variables
    mazeSize = 3;
    mazeData = null;
    mazeGroup = new THREE.Group();
    scene.add( mazeGroup );
    // checkpoints
    startedMaze = false;
    finishedMaze = false;
    // save the positions of the entrance and exit of the maze
    startPos = new THREE.Vector3( maze.getOffset(1), maze.getOffset(1), maze.getOffset(1) );
    segments = mazeSize * 2 - 0.5;
    endPos = new THREE.Vector3();
    // collisions
    mazePosNear = null; // closer to 0,0,0 (-)
    mazePosFar = null;
    // history
    historyPositions = [];
    historyLineMaterial = new MeshLineMaterial( {
        useMap: true,
        map: dotSprite,
		opacity: 1,
		resolution: new THREE.Vector2( window.innerWidth, window.innerHeight ),
		sizeAttenuation: true,
		lineWidth: 0.01,
        vertexColors: true
	});
    historyLine = new MeshLine(); // this is a geometry;

    historyMesh = new THREE.Mesh(historyLine, historyLineMaterial);
    scene.add( historyMesh );

    // setup window resize handlers
    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'orientationchange', onWindowResize, false );

    // init UI
    menuManager = new MenuManager();
    menuManager.addEventListener('menuChanged', (evt) => {
        updateMenuCentering();
    });
    document.querySelectorAll('.button-play').forEach((button) => {
        button.addEventListener('click', () => {
            if (vrDeviceType === 'vr-device-first' && !renderer.xr.isPresenting) {
                vrManager.toggleVR();
                // Defer until after sessionstart, which allows vr tutorial to initialize correctly.
                renderer.xr.addEventListener('sessionstart', () => menuLockControls(), { once: true });
            } else {
                menuLockControls();
            }
        });
    });

    updateUIDeviceRotation();
    document.querySelectorAll('.focusable-menu').forEach((el) => {
        el.addEventListener('click', (evt) => {
            evt.stopPropagation();
        });
    });

    // Tactile menu sound feedback
    let menuAudioCtx = null;
    function playMenuFeedback(isConfirm = false) {
        try {
            if (masterVolumeLevel <= 0.001) return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!menuAudioCtx) {
                menuAudioCtx = new AudioCtx();
            }
            if (menuAudioCtx.state === 'suspended') {
                menuAudioCtx.resume();
            }
            const osc = menuAudioCtx.createOscillator();
            const gain = menuAudioCtx.createGain();
            const now = menuAudioCtx.currentTime;
            if (isConfirm) {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
                gain.gain.setValueAtTime(0.04 * masterVolumeLevel, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                osc.connect(gain);
                gain.connect(menuAudioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1100, now);
                osc.frequency.exponentialRampToValueAtTime(1600, now + 0.03);
                gain.gain.setValueAtTime(0.012 * masterVolumeLevel, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
                osc.connect(gain);
                gain.connect(menuAudioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.03);
            }
        } catch (_) {}
    }

    document.querySelectorAll('#blocker button, .gameplay-hud button, .victory-actions button').forEach((btn) => {
        btn.addEventListener('mouseenter', () => playMenuFeedback(false));
        btn.addEventListener('click', () => playMenuFeedback(true));
    });

    updateMenuCentering();

    loadSavedVariables();

    const compassContainer = document.querySelector('#compass-container');
    if (compassContainer) {
        compassContainer.style.display = 'none';
        compassContainer.addEventListener('click', (event) => {
            event.stopPropagation();
            if (controls && controls.isLocked) {
                controls.disableLock(new Event(''));
            }
        });
    }

    tutorialManager.cameraNode = cameraNode;
}

function buildMaze(size=mazeSize) {
    mazeSize = size;

    currentGameState = GAME_STATE.MENU;
    startedMaze = false;
    finishedMaze = false;
    isInFreeLook = false;
    missionElapsedTime = 0;
    missionLastFrameTime = 0;

    const launchBtnSpan = document.querySelector('#menu-intro .button-play span');
    if (launchBtnSpan) launchBtnSpan.textContent = 'LAUNCH MISSION';

    mazePosNear = null;
    mazePosFar = null;

    segments = mazeSize * 2 - 1;
    // Position end completion goal with a generous, cinematic distance from the maze outer blocks
    const goalZSegment = segments + 6;
    endPos.set( maze.getOffset(segments), maze.getOffset(segments), maze.getOffset(goalZSegment) );
    compassManager.setEndPos( endPos );

    goalDots.setPosition( endPos );
    goalDots.randomize();

    // set the camera in front of the maze, looking in (framing the maze on the right when at the desktop main menu)
    if (!startedMaze && window.innerWidth >= 960 && !renderer.xr.isPresenting) {
        cameraNode.position.set( maze.getOffset(1) - 1.2, maze.getOffset(1) + 0.35, maze.getOffset(-2.6) );
        _camAimTarget.set( maze.getOffset(1) + 1.8, maze.getOffset(1) + 0.2, maze.getOffset(-2.6) - 6.0 );
        aimCameraNode( cameraNode, _camAimTarget );
    } else if (!startedMaze) {
        cameraNode.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2.6));
        _camAimTarget.set( maze.getOffset(1) + 1.8, maze.getOffset(1) + 0.2, maze.getOffset(-2.6) - 6.0 );
        aimCameraNode( cameraNode, _camAimTarget );
    } else {
        cameraNode.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2));
        _camAimTarget.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(1) );
        aimCameraNode( cameraNode, _camAimTarget );
    }
    if (menuBackground) {
        menuBackground.group.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2.6) );
        menuBackground.setVisible(!startedMaze);
    }
    mazeGroup.visible = startedMaze;
    if (!renderer.xr.isPresenting) {
        camera.rotation.set(0,0,0);
    } else {
        // get the camera's forward vector
        const forward = tmpVector.set(0, 0, 1).applyQuaternion(camera.quaternion);
        const targetRotation = Math.atan2(forward.x, forward.z);
        // adjust cameraNode's rotation
        cameraNode.rotation.y -= targetRotation;
    }

    historyPositions = [];
    if (historyLine) {
        historyLine.dispose();
        historyLine = new MeshLine();
        if (historyMesh) {
            historyMesh.geometry = historyLine;
        }
    }
    if (historyMesh) historyMesh.visible = false;

    dust.respawnAllParticles();
    trail.reset();

    // Dispose previous instanced meshes safely if supported, then clear group
    mazeGroup.traverse((child) => {
        if (child.isInstancedMesh && typeof child.dispose === 'function') {
            child.dispose();
        }
    });
    mazeGroup.clear();

    mazeData = maze.generateMaze(mazeSize);

    // Pass 1: Pre-count wall and block instances to eliminate array allocations and Matrix4 clones
    // Starting chamber adds 5 walls, 12 blocks
    // Exit runway adds 12 walls, 12 blocks (3 steps * 4 walls/beams)
    let totalWalls = 17;
    let totalBlocks = 24;

    for (let i = 0; i < mazeData.collision_map.length; i++) {
        for (let j = 0; j < mazeData.collision_map[i].length; j++) {
            for (let k = 0; k < mazeData.collision_map[i][j].length; k++) {
                if (!mazeData.collision_map[i][j][k] ||
                    (i!=0 && i!=mazeData.bounds[0]*2 && j!=0 && j!=mazeData.bounds[1]*2 && k!=0 && k!=mazeData.bounds[2]*2 &&
                        i%2==0 && j%2==0 && k%2==0))
                    continue;

                let iWidth = maze.getWidth(i);
                let jWidth = maze.getWidth(j);
                let kWidth = maze.getWidth(k);

                if (iWidth + jWidth + kWidth >= 2 * maze.majorWidth + maze.minorWidth) {
                    totalWalls++;
                } else {
                    totalBlocks++;
                }
            }
        }
    }

    let dummyWall = new THREE.Object3D();
    let wallInstancedMesh = new THREE.InstancedMesh( wallGeometry, wallMaterial, totalWalls );
    let blockInstanceMesh = new THREE.InstancedMesh( blockGeometry, darkMaterial, totalBlocks );
    let wallColors = new Float32Array( totalWalls * 3 );
    let wallIdx = 0;
    let blockIdx = 0;

    for (let i = 0; i < mazeData.collision_map.length; i++) {
        for (let j = 0; j < mazeData.collision_map[i].length; j++) {
            for (let k = 0; k < mazeData.collision_map[i][j].length; k++) {
                if (!mazeData.collision_map[i][j][k] ||
                    (i!=0 && i!=mazeData.bounds[0]*2 && j!=0 && j!=mazeData.bounds[1]*2 && k!=0 && k!=mazeData.bounds[2]*2 &&
                        i%2==0 && j%2==0 && k%2==0))
                    continue;

                let iWidth = maze.getWidth(i);
                let jWidth = maze.getWidth(j);
                let kWidth = maze.getWidth(k);

                let colorful = (iWidth + jWidth + kWidth >= 2 * maze.majorWidth + maze.minorWidth);

                if (colorful) {
                    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
                    dummyWall.position.set( maze.getOffset(i), maze.getOffset(j), maze.getOffset(k) );

                    if (iWidth == maze.minorWidth) {
                        dummyWall.rotation.z = PI_2;
                    } else if (kWidth == maze.minorWidth) {
                        dummyWall.rotation.x = PI_2;
                    }

                    dummyWall.updateMatrix();
                    dummyWall.rotation.set(0, 0, 0);

                    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
                    wallColors[wallIdx * 3 + 0] = 0.05 + 0.9 * (i-1)/(mazeData.segments[0]);
                    wallColors[wallIdx * 3 + 1] = 0.05 + 0.9 * (j-1)/(mazeData.segments[1]);
                    wallColors[wallIdx * 3 + 2] = 0.05 + 0.9 * (k-1)/(mazeData.segments[2]);
                    wallIdx++;
                } else {
                    dummyWall.scale.set( iWidth, jWidth, kWidth );
                    dummyWall.position.set( maze.getOffset(i), maze.getOffset(j), maze.getOffset(k) );
                    dummyWall.updateMatrix();

                    blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );
                }
            }
        }
    }

    // --- CONSTRUCT FULLY ENCLOSED STARTING CHAMBER (k = -2 to k = 0) ---
    // Encloses room cell (1, 1, -1) with solid textured walls, floor, ceiling, and edge beams.
    // Has one intentional exit doorway opening at Z = 0 into maze cell (1, 1, 1).
    const chamberColor = [0.15, 0.17, 0.22];

    // 1. Solid Back Wall at k = -2 (facing Z)
    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
    dummyWall.position.set( maze.getOffset(1), maze.getOffset(1), maze.getOffset(-2) );
    dummyWall.rotation.set( PI_2, 0, 0 );
    dummyWall.updateMatrix();
    dummyWall.rotation.set( 0, 0, 0 );
    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
    wallColors[wallIdx * 3 + 0] = chamberColor[0];
    wallColors[wallIdx * 3 + 1] = chamberColor[1];
    wallColors[wallIdx * 3 + 2] = chamberColor[2];
    wallIdx++;

    // 2. Solid Left Wall at i = 0, k = -1 (facing X)
    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
    dummyWall.position.set( maze.getOffset(0), maze.getOffset(1), maze.getOffset(-1) );
    dummyWall.rotation.set( 0, 0, PI_2 );
    dummyWall.updateMatrix();
    dummyWall.rotation.set( 0, 0, 0 );
    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
    wallColors[wallIdx * 3 + 0] = chamberColor[0];
    wallColors[wallIdx * 3 + 1] = chamberColor[1];
    wallColors[wallIdx * 3 + 2] = chamberColor[2];
    wallIdx++;

    // 3. Solid Right Wall at i = 2, k = -1 (facing X)
    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
    dummyWall.position.set( maze.getOffset(2), maze.getOffset(1), maze.getOffset(-1) );
    dummyWall.rotation.set( 0, 0, PI_2 );
    dummyWall.updateMatrix();
    dummyWall.rotation.set( 0, 0, 0 );
    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
    wallColors[wallIdx * 3 + 0] = chamberColor[0];
    wallColors[wallIdx * 3 + 1] = chamberColor[1];
    wallColors[wallIdx * 3 + 2] = chamberColor[2];
    wallIdx++;

    // 4. Solid Floor at j = 0, k = -1 (facing Y)
    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
    dummyWall.position.set( maze.getOffset(1), maze.getOffset(0), maze.getOffset(-1) );
    dummyWall.rotation.set( 0, 0, 0 );
    dummyWall.updateMatrix();
    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
    wallColors[wallIdx * 3 + 0] = chamberColor[0];
    wallColors[wallIdx * 3 + 1] = chamberColor[1];
    wallColors[wallIdx * 3 + 2] = chamberColor[2];
    wallIdx++;

    // 5. Solid Ceiling at j = 2, k = -1 (facing Y)
    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
    dummyWall.position.set( maze.getOffset(1), maze.getOffset(2), maze.getOffset(-1) );
    dummyWall.rotation.set( 0, 0, 0 );
    dummyWall.updateMatrix();
    wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
    wallColors[wallIdx * 3 + 0] = chamberColor[0];
    wallColors[wallIdx * 3 + 1] = chamberColor[1];
    wallColors[wallIdx * 3 + 2] = chamberColor[2];
    wallIdx++;

    // 6. Starting Chamber Framing Beams & Corner Blocks
    const scCorners = [[0, 0], [2, 0], [0, 2], [2, 2]];
    for (const [ci, cj] of scCorners) {
        // Longitudinal beams at k = -1
        dummyWall.scale.set( maze.minorWidth, maze.minorWidth, maze.majorWidth );
        dummyWall.position.set( maze.getOffset(ci), maze.getOffset(cj), maze.getOffset(-1) );
        dummyWall.rotation.set( 0, 0, 0 );
        dummyWall.updateMatrix();
        blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );

        // Back corner blocks at k = -2
        dummyWall.scale.set( maze.minorWidth, maze.minorWidth, maze.minorWidth );
        dummyWall.position.set( maze.getOffset(ci), maze.getOffset(cj), maze.getOffset(-2) );
        dummyWall.rotation.set( 0, 0, 0 );
        dummyWall.updateMatrix();
        blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );
    }
    // Back frame beams at k = -2
    dummyWall.scale.set( maze.minorWidth, maze.majorWidth, maze.minorWidth );
    dummyWall.position.set( maze.getOffset(0), maze.getOffset(1), maze.getOffset(-2) );
    dummyWall.updateMatrix();
    blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );
    dummyWall.position.set( maze.getOffset(2), maze.getOffset(1), maze.getOffset(-2) );
    dummyWall.updateMatrix();
    blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );

    dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.minorWidth );
    dummyWall.position.set( maze.getOffset(1), maze.getOffset(0), maze.getOffset(-2) );
    dummyWall.updateMatrix();
    blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );
    dummyWall.position.set( maze.getOffset(1), maze.getOffset(2), maze.getOffset(-2) );
    dummyWall.updateMatrix();
    blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );

    // --- CONSTRUCT EXIT RUNWAY TO QUANTUM GATEWAY (k = maxK to maxK + 5) ---
    const maxK = mazeData.bounds[2] * 2;
    const exI = mazeData.bounds[0] * 2 - 1;
    const exJ = mazeData.bounds[1] * 2 - 1;
    const exitColor = [0.08, 0.40, 0.60];

    for (let kStep = maxK + 1; kStep <= maxK + 5; kStep += 2) {
        // Floor
        dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
        dummyWall.position.set( maze.getOffset(exI), maze.getOffset(exJ - 1), maze.getOffset(kStep) );
        dummyWall.rotation.set( 0, 0, 0 );
        dummyWall.updateMatrix();
        wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
        wallColors[wallIdx * 3 + 0] = exitColor[0];
        wallColors[wallIdx * 3 + 1] = exitColor[1];
        wallColors[wallIdx * 3 + 2] = exitColor[2];
        wallIdx++;

        // Ceiling
        dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
        dummyWall.position.set( maze.getOffset(exI), maze.getOffset(exJ + 1), maze.getOffset(kStep) );
        dummyWall.rotation.set( 0, 0, 0 );
        dummyWall.updateMatrix();
        wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
        wallColors[wallIdx * 3 + 0] = exitColor[0];
        wallColors[wallIdx * 3 + 1] = exitColor[1];
        wallColors[wallIdx * 3 + 2] = exitColor[2];
        wallIdx++;

        // Left wall
        dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
        dummyWall.position.set( maze.getOffset(exI - 1), maze.getOffset(exJ), maze.getOffset(kStep) );
        dummyWall.rotation.set( 0, 0, PI_2 );
        dummyWall.updateMatrix();
        dummyWall.rotation.set( 0, 0, 0 );
        wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
        wallColors[wallIdx * 3 + 0] = exitColor[0];
        wallColors[wallIdx * 3 + 1] = exitColor[1];
        wallColors[wallIdx * 3 + 2] = exitColor[2];
        wallIdx++;

        // Right wall
        dummyWall.scale.set( maze.majorWidth, maze.minorWidth, maze.majorWidth );
        dummyWall.position.set( maze.getOffset(exI + 1), maze.getOffset(exJ), maze.getOffset(kStep) );
        dummyWall.rotation.set( 0, 0, PI_2 );
        dummyWall.updateMatrix();
        dummyWall.rotation.set( 0, 0, 0 );
        wallInstancedMesh.setMatrixAt( wallIdx, dummyWall.matrix );
        wallColors[wallIdx * 3 + 0] = exitColor[0];
        wallColors[wallIdx * 3 + 1] = exitColor[1];
        wallColors[wallIdx * 3 + 2] = exitColor[2];
        wallIdx++;

        // Longitudinal edge beams
        const exCornerCoords = [
            [exI - 1, exJ - 1],
            [exI + 1, exJ - 1],
            [exI - 1, exJ + 1],
            [exI + 1, exJ + 1]
        ];
        for (const [ci, cj] of exCornerCoords) {
            dummyWall.scale.set( maze.minorWidth, maze.minorWidth, maze.majorWidth );
            dummyWall.position.set( maze.getOffset(ci), maze.getOffset(cj), maze.getOffset(kStep) );
            dummyWall.rotation.set( 0, 0, 0 );
            dummyWall.updateMatrix();
            blockInstanceMesh.setMatrixAt( blockIdx++, dummyWall.matrix );
        }
    }

        // Dispose previous color attribute on wallGeometry to prevent GPU buffer leak
        const oldColor = wallGeometry.getAttribute('color');
        if (oldColor && typeof oldColor.dispose === 'function') {
            oldColor.dispose();
        }

        wallGeometry.setAttribute( 'color', new THREE.InstancedBufferAttribute( wallColors, 3 ) );
        wallInstancedMesh.instanceMatrix.needsUpdate = true;
        blockInstanceMesh.instanceMatrix.needsUpdate = true;

    mazeGroup.add( wallInstancedMesh );
    mazeGroup.add( blockInstanceMesh );

    timerRunning = false;
};

const collisionDistance = 0.25;

/**
 * Authoritative segment solidity test.
 * Enforces solid external boundaries around the entire maze structure,
 * solid chamber boundaries (except doorway at k=0 into maze),
 * solid exit runway boundaries (except path directly into quantum gateway).
 */
function isSegmentSolid(i, j, k) {
    if (!mazeData || !mazeData.collision_map) return false;
    const maxI = mazeData.bounds[0] * 2;
    const maxJ = mazeData.bounds[1] * 2;
    const maxK = mazeData.bounds[2] * 2;

    // Within standard maze grid [0, maxK]
    if (k >= 0 && k <= maxK) {
        // Lateral external boundaries
        if (i < 0 || i > maxI || j < 0 || j > maxJ) {
            return true;
        }
        // Front boundary plane (k = 0)
        if (k === 0) {
            // Intentional entrance opening from starting chamber into maze cell (1, 1, 1)
            if (i === 1 && j === 1) return false;
            return true;
        }
        // Exit boundary plane (k = maxK)
        if (k === maxK) {
            // Intentional exit opening from maze into gateway runway
            if (i === maxI - 1 && j === maxJ - 1) return false;
            return true;
        }
        return !!mazeData.collision_map[i][j][k];
    }

    // Starting Chamber (k < 0)
    if (k < 0) {
        if (k < -2) return true; // Outside back of chamber
        if (k === -2) return true; // Solid chamber back wall
        if (k === -1) {
            // Room interior at (1, 1) is open; enclosed by solid walls/floor/ceiling
            return !(i === 1 && j === 1);
        }
        return true;
    }

    // Exit Runway to Quantum Gateway (k > maxK)
    if (k > maxK) {
        const kGatewayEnd = maxK + 6;
        if (k <= kGatewayEnd) {
            return !(i === maxI - 1 && j === maxJ - 1);
        }
        return true; // Solid boundary beyond gateway
    }

    return true;
}

/**
 * Checks whether an axis-aligned bounding volume of radius r around (x, y, z)
 * overlaps any solid cell or external boundary.
 */
function isPositionBlocked(x, y, z, r) {
    const minI = maze.getSegment(x - r);
    const maxI = maze.getSegment(x + r);
    const minJ = maze.getSegment(y - r);
    const maxJ = maze.getSegment(y + r);
    const minK = maze.getSegment(z - r);
    const maxK = maze.getSegment(z + r);

    for (let i = minI; i <= maxI; i++) {
        for (let j = minJ; j <= maxJ; j++) {
            for (let k = minK; k <= maxK; k++) {
                if (isSegmentSolid(i, j, k)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Continuous sub-stepped sliding collision solver.
 * Divides displacement into small sub-steps <= 0.04m (well below wall thickness 0.0625m).
 * Resolves collisions independently along X, Y, and Z axes to allow smooth wall sliding
 * and corner navigation without tunneling or sticking.
 */
function resolvePlayerMovement(deltaVec, radius) {
    const totalDist = deltaVec.length();
    if (totalDist < 1e-7) return;

    const maxStep = 0.04;
    const numSteps = Math.min(Math.max(1, Math.ceil(totalDist / maxStep)), 32);
    const sx = deltaVec.x / numSteps;
    const sy = deltaVec.y / numSteps;
    const sz = deltaVec.z / numSteps;

    const currentPos = cameraNode.position;

    for (let s = 0; s < numSteps; s++) {
        // Resolve X (slide along YZ plane)
        if (Math.abs(sx) > 1e-7) {
            if (!isPositionBlocked(currentPos.x + sx, currentPos.y, currentPos.z, radius)) {
                currentPos.x += sx;
            }
        }
        // Resolve Y (slide along XZ plane / floor & ceiling)
        if (Math.abs(sy) > 1e-7) {
            if (!isPositionBlocked(currentPos.x, currentPos.y + sy, currentPos.z, radius)) {
                currentPos.y += sy;
            }
        }
        // Resolve Z (slide along XY plane)
        if (Math.abs(sz) > 1e-7) {
            if (!isPositionBlocked(currentPos.x, currentPos.y, currentPos.z + sz, radius)) {
                currentPos.z += sz;
            }
        }
    }
}

/**
 * Validates player entry into the quantum gateway trigger volume.
 * Triggers victory completion when the distance between the player and the portal
 * of the end completion goal becomes less than 0.4 m (or player passes the portal plane).
 */
function checkGatewayCompletion() {
    if (finishedMaze || currentGameState !== GAME_STATE.PLAYING) return;
    if (!endPos) return;

    const distToEnd = cameraNode.position.distanceTo(endPos);
    const distInMeters = distToEnd / maze.majorWidth;
    if (distInMeters < 0.4 || cameraNode.position.z >= endPos.z) {
        onMazeCompletion();
    }
}

function buildHistoryLineAsync() {
    if (!historyPositions || historyPositions.length < 2) return;

    // Subsample points to a maximum of 400 points to keep MeshLine generation under 2ms
    const total = historyPositions.length;
    const maxPoints = 400;
    const step = total > maxPoints ? Math.ceil(total / maxPoints) : 1;
    const sampledPositions = [];
    for (let i = 0; i < total; i += step) {
        sampledPositions.push(historyPositions[i]);
    }
    if (sampledPositions[sampledPositions.length - 1] !== historyPositions[total - 1]) {
        sampledPositions.push(historyPositions[total - 1]);
    }

    const n = sampledPositions.length;
    const historyVerts = new Float32Array( 3 * n );
    const historyCols  = new Float32Array( 6 * n );

    for (let i = 0; i < n; i++)
    {
        historyVerts[i*3 + 0] = sampledPositions[i].x;
        historyVerts[i*3 + 1] = sampledPositions[i].y;
        historyVerts[i*3 + 2] = sampledPositions[i].z;

        tmpColor.setHSL( i / n, 1.0, 0.75);

        historyCols[ i*6 + 0 ] = tmpColor.r;
        historyCols[ i*6 + 1 ] = tmpColor.g;
        historyCols[ i*6 + 2 ] = tmpColor.b;
        historyCols[ i*6 + 0+3 ] = tmpColor.r;
        historyCols[ i*6 + 1+3 ] = tmpColor.g;
        historyCols[ i*6 + 2+3 ] = tmpColor.b;
    }

    historyLine.setPoints(historyVerts);
    historyLine.setAttribute( 'color', new THREE.BufferAttribute( historyCols, 3 ) );
    historyMesh.visible = true;
}

function onMazeCompletion()
{
    if (finishedMaze) return;
    finishedMaze = true;
    currentGameState = GAME_STATE.VICTORY;
    isInFreeLook = false;
    goalDots.finish();

    // Release controls lock immediately so cursor is available for celebration popup
    if (controls.isLocked) {
        controls.disableLock(new Event(''));
    }

    // Hide HUD and background blocker menu and show celebration modal
    const hud = document.querySelector('#gameplay-hud');
    if (hud) hud.style.display = 'none';
    const compassEl = document.querySelector('#compass-container');
    if (compassEl) compassEl.style.display = 'none';
    document.querySelector('#blocker').style.display = 'none';
    const completionElem = document.querySelector('#completionMessage');
    completionElem.style.display = 'flex';
    document.querySelector('#victoryReopenBtn').style.display = 'none';

    // Update mute icon display
    const muteIcon = document.querySelector('#victoryMuteIcon');
    if (muteIcon) {
        muteIcon.textContent = celebration.getMuted() ? '🔇' : '🔊';
    }

    // Start celebration effects: confetti + victory audio fanfare
    celebration.initCanvas(document.querySelector('#celebrationConfettiCanvas'));
    celebration.startConfetti();
    celebration.playVictorySound();

    // switch menu screens for VR / background
    vrManager.recenterUI();
    menuManager.focusRootMenu('menu-new-maze');

    let rawSeconds = missionElapsedTime > 0 ? (missionElapsedTime / 1000) : ((Date.now() - timerStartMillis) / 1000);
    let seconds = rawSeconds.toFixed(2);
    let timeString = seconds;
    if (rawSeconds >= 60) {
        let minutes = Math.floor(rawSeconds / 60);
        let remSec = (rawSeconds % 60).toFixed(2);
        let secondString = parseFloat(remSec) < 10 ? `0${remSec}` : `${remSec}`;
        secondString = secondString.substring(0, 5);
        timeString = `${minutes}:${secondString}`;
    } else {
        timeString = seconds.substring(0, rawSeconds >= 10 ? 5 : 4);
    }
    document.querySelector('#mazeTimeSpan').textContent = timeString;
    document.querySelector('#mazeCompSizeSpan').textContent = (mazeData && mazeData.size_string) ? mazeData.size_string : (mazeSize || '3');

    // Rating and rank calculation
    const currentSize = parseInt(mazeSize) || 3;
    const rating = celebration.getRating(rawSeconds, currentSize);
    document.querySelector('#victoryStarsSpan').textContent = rating.starsString;
    document.querySelector('#victoryRankSpan').textContent = rating.rank;
    document.querySelector('#victoryTrophyBadge').textContent = rating.badge;

    // Next level button setup
    const nextSize = Math.min(12, currentSize + 1);
    document.querySelector('#nextLevelSizeSpan').textContent = nextSize;
    const btnNext = document.querySelector('#btnVictoryNextLevel');
    if (currentSize >= 12) {
        btnNext.style.display = 'none';
    } else {
        btnNext.style.display = 'inline-flex';
    }

    // Best record tracking (per maze dimension)
    const bestKey = 'best_time_size_' + currentSize;
    const prevBest = storageGetItem(bestKey, null);
    const bestElem = document.querySelector('#mazeBestTimeSpan');
    if (!prevBest || rawSeconds < parseFloat(prevBest)) {
        storageSetItem(bestKey, rawSeconds.toFixed(2));
        bestElem.textContent = prevBest ? '🏆 New Best!' : timeString;
    } else {
        bestElem.textContent = parseFloat(prevBest).toFixed(2) + 's';
    }

    // Defer history trail mesh generation to next animation frame so victory modal renders instantaneously
    requestAnimationFrame(() => {
        buildHistoryLineAsync();
    });

    // complete tutorial
    if (tutorialManager) {
        tutorialManager.resetTutorial(true);
        storageSetItem('lastMazeCompletionDate', Date.now());
    }

    if (typeof gtag === 'function') {
        try {
            gtag('event', 'maze_completed', {
                'event_category': '3d-maze',
                'value': mazeData.size_string,
                'solution_length': mazeData.analytics.distance_to_end,
                'branches_on_solution': mazeData.analytics.branches_on_solution,
                'branches_total': mazeData.analytics.branches_on_solution,
                'time_since_start': Date.now() - timerStartMillis
            });
        } catch (_) {}
    }
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio( Math.min(window.devicePixelRatio || 1, 1.75) );
    renderer.setSize( width, height, false );

    if (compassManager) {
        compassManager.onWindowResize();
    }

    updateUIDeviceRotation();
    updateMenuCentering();
}

// returns false if the device is in portrait and has a screen ratio steeper than 4:3
function isValidMobileAspectRatio()
{
    return window.innerWidth * 3.95 / 3.0 > window.innerHeight;
}

function updateUIDeviceRotation()
{
    // if mobile and the aspect ratio is steeper than 4:3, require the user to rotate the phone
    if (isMobile && !isValidMobileAspectRatio())
    {
        if (controls.isLocked)
        {
            controls.disableLock(new Event(''));
        }

        menuManager.focusMenu('menu-rotate-phone');
    }
    // if the rotation hint is showing and the user has rotated, restore the menu
    else if (!document.querySelector('#menu-rotate-phone').style.display || document.querySelector('#menu-rotate-phone').style.display != 'none')
    {
        document.querySelector('#menu-rotate-phone').style.display = 'none';
        menuManager.focusPreviousMenu();
    }
}

var animate = function () {
    // Authoritative clamped delta time (max 50ms / 20fps step) prevents movement jumps and stalls
    let delta = Math.min(fpsClock.getDelta(), 0.05);

    const isVictoryStationary = finishedMaze && !isInFreeLook;

    if (!isVictoryStationary) {
        vrManager.update(delta);
        tutorialManager.update();

        // 1. MENU STATE: Idle camera drift outside maze looking in
        if (currentGameState === GAME_STATE.MENU) {
            if (menuBackground) {
                menuBackground.update(delta, performance.now() * 0.001);
            }
            const time = performance.now() * 0.0003;
            if (window.innerWidth >= 960) {
                cameraNode.position.x = (maze.getOffset(1) - 1.2) + Math.sin(time) * 0.12;
                cameraNode.position.y = (maze.getOffset(1) + 0.35) + Math.cos(time * 0.75) * 0.1;
                cameraNode.position.z = (maze.getOffset(-2.6)) + Math.sin(time * 0.4) * 0.08;
            } else {
                cameraNode.position.x = maze.getOffset(1) + Math.sin(time) * 0.2;
                cameraNode.position.y = maze.getOffset(1) + Math.cos(time * 0.7) * 0.15;
                cameraNode.position.z = maze.getOffset(-2.6);
            }
            _camAimTarget.set( maze.getOffset(1) + 1.8, maze.getOffset(1) + 0.2, maze.getOffset(-2.6) - 6.0 );
            aimCameraNode( cameraNode, _camAimTarget );
        }

        // 2. ACTIVE PLAYING STATE: Controls movement with authoritative continuous sliding collision
        if (currentGameState === GAME_STATE.PLAYING && controls.isLocked) {
            // Update gameplay particles and trails only during active gameplay
            dust.update(delta);
            trail.update(delta);

            // Mission timer accumulation
            const now = performance.now();
            if (missionLastFrameTime > 0) {
                missionElapsedTime += (now - missionLastFrameTime);
            }
            missionLastFrameTime = now;

            // Update live telemetry HUD with DOM diff caching
            if (!_cachedTimerSpan) _cachedTimerSpan = document.querySelector('#hudTimerSpan');
            if (_cachedTimerSpan) {
                const elapsedSec = missionElapsedTime / 1000;
                const m = Math.floor(elapsedSec / 60);
                const s = (elapsedSec % 60).toFixed(1);
                const formatted = `${m > 0 ? m + ':' : ''}${m > 0 && s < 10 ? '0' : ''}${s}s`;
                if (formatted !== _lastTimerFormatted) {
                    _cachedTimerSpan.textContent = formatted;
                    _lastTimerFormatted = formatted;
                }
            }

            const distSpan = _cachedDistSpan || (_cachedDistSpan = document.querySelector('#hudDistSpan'));
            if (distSpan && endPos) {
                const distM = (cameraNode.position.distanceTo(endPos) / maze.majorWidth).toFixed(1);
                const formatted = `${distM}m`;
                if (formatted !== _lastDistFormatted) {
                    distSpan.textContent = formatted;
                    _lastDistFormatted = formatted;
                }
            }

            // Save old position before controls calculate desired movement
            _scratchOldPos.copy(cameraNode.position);

            // Execute controls movement & mouse steering
            controls.update(delta);

            // Calculate desired displacement vector
            _scratchDelta.subVectors(cameraNode.position, _scratchOldPos);

            // Revert position to old safe position
            cameraNode.position.copy(_scratchOldPos);

            // Authoritative sub-stepped sliding collision resolution
            resolvePlayerMovement(_scratchDelta, collisionDistance);

            // Update 3D navigational compass arrow towards exit gateway
            compassManager.update();

            // Record flight trail history (bounded with periodic compaction to prevent unbounded GC spikes)
            const historyDistSq = (0.4 * collisionDistance)**2;
            if (historyPositions.length === 0 || historyPositions[historyPositions.length - 1].distanceToSquared(cameraNode.position) > historyDistSq) {
                const newHistoryPosition = tmpVector.copy(cameraNode.position);
                let lastPos = historyPositions.length > 0 ? historyPositions[historyPositions.length - 1] : cameraNode.position;
                let distance = lastPos.distanceTo(newHistoryPosition);
                let numPoints = Math.max(1, Math.ceil(distance / collisionDistance));
                for (let i = 0; i < numPoints; i++) {
                    let t = numPoints > 1 ? i / (numPoints - 1) : 1;
                    _scratchInterp.lerpVectors(lastPos, newHistoryPosition, t);
                    historyPositions.push(new THREE.Vector3(_scratchInterp.x, _scratchInterp.y, _scratchInterp.z));
                }

                if (historyPositions.length >= 2000) {
                    const compacted = [];
                    for (let i = 0; i < historyPositions.length; i += 2) {
                        compacted.push(historyPositions[i]);
                    }
                    historyPositions = compacted;
                }
            }

            // Check quantum gateway completion
            checkGatewayCompletion();
        }

        // 3. FREE LOOK IN VICTORY STATE:
        if (isInFreeLook && controls.isLocked) {
            controls.update(delta);
            compassManager.update();
        }

        // When in PAUSED state:
        // Position, velocity, and timer are completely frozen.
        // No drift runs, no controls move the camera.

        goalDots.update( delta );

        renderer.render( scene, camera );
        compassManager.render();

        if (renderer.xr.isPresenting && vrMirrorEnabled) {
            mirrorRender();
        }
    } else {
        // Victory modal is open in stationary mode:
        goalDots.update( delta );
        renderer.render( scene, camera );
        if (renderer.xr.isPresenting) {
            vrManager.update(delta);
            if (vrMirrorEnabled) mirrorRender();
        }
    }

    if (window.__PERF__) {
        window.__PERF__.sample(delta * 1000, renderer);
    }
};

function mirrorRender() {
    // Copy the camera's position and rotation
    const xrCam = camera;
    spectator.position.copy(xrCam.position);
    spectator.quaternion.copy(xrCam.quaternion);
    spectator.aspect = window.innerWidth / window.innerHeight;

    // turn off the WebXR rendering
    const currentRenderTarget = renderer.getRenderTarget();
    renderer.xr.isPresenting = false;

    // render to the main display canvas
    renderer.setRenderTarget(null);
    renderer.render(scene, spectator);

    // restore to WebXR render target
    renderer.setRenderTarget(currentRenderTarget);
    renderer.xr.isPresenting = true;
}

init();

function buildMazeAndUpdateUI(size)
{
    verifyAndReportAbandonedMaze();

    isInFreeLook = false;
    if (compassManager) compassManager.setVisible(false);
    buildMaze(size);

    celebration.stopConfetti();
    celebration.stopActiveAudio();
    document.querySelector('#completionMessage').style.display = 'none';
    document.querySelector('#victoryReopenBtn').style.display = 'none';

    menuManager.focusRootMenu('menu-pause');

    document.querySelector('#mazeSizeSpan').innerHTML = mazeSize;

    updateMenuCentering();

    if (tutorialManager) tutorialManager.resetTutorial();

    if (typeof gtag === 'function') {
        try {
            gtag('event', 'maze_built', {'event_category': '3d-maze', 'value': mazeSize});
        } catch (_) {}
    }
}

function verifyAndReportAbandonedMaze()
{
    // check if maze was started and if time has passed
    const elapsed_time = Date.now() - timerStartMillis;
    if (startedMaze && !finishedMaze && elapsed_time > 7000)
    {
        gtag('event', 'maze_abandoned', {
                'event_category': '3d-maze',
                'value': mazeData.size_string,
                'solution_length': mazeData.analytics.distance_to_end,
                'branches_on_solution': mazeData.analytics.branches_on_solution,
                'branches_total': mazeData.analytics.branches_on_solution,
                'time_since_start': elapsed_time
        });
    }
}

function updateMenuCentering()
{
    const menu_title = document.querySelector('#menu-title');
    menu_title.style.display = '';

    let menu_height = document.querySelector('#menu-body').offsetHeight;
    const menu_space_to_fit = document.querySelector('#blocker').offsetHeight;

    // if there is not enough room, hide the title
    if (menu_space_to_fit < menu_height)
    {
        // check if completion menu is showing
        const completionMessage = document.querySelector('#completionMessage');
        if (!completionMessage.style.display || completionMessage.style.display == 'none') {
            completionMessage.style.display = 'none';
        }

        menu_title.style.display = 'none';
    }

    document.querySelector('#blocker').classList.toggle('center-menu', menu_space_to_fit > menu_height);

    // if mobile and the new maze menu is showing, make sure the slider is visible
    if (isMobile && (!document.querySelector('#menu-new-maze').style.display || document.querySelector('#menu-new-maze').style.display != 'none'))
    {
        document.querySelector('#menu-new-maze-size-slider').scrollIntoView({ block: 'nearest' });
    }
}

function menuLockControls()
{
    // do not allow locking on mobile when in portrait mode
    if (!isMobile || isValidMobileAspectRatio())
        controls.lock();

    if (tutorialManager && !tutorialManager.inTutorial) {
        tutorialManager.startTutorial();
    }
}

document.querySelector('#menu-new-maze-button').addEventListener('click', (event) =>
{
    buildMazeAndUpdateUI( document.querySelector('#menu-new-maze-size-slider').value );

    menuLockControls();
});

document.querySelector('#setting-fixed-camera').addEventListener('change', (event) => {
    controls.setGimbalLocked( event.target.checked );
    storageSetItem('setting-fixed-camera', event.target.checked ? 'true' : 'false');
});

const mouseSensEl = document.querySelector('#setting-mouse-sensitivity');
if (mouseSensEl) {
    mouseSensEl.addEventListener('input', (event) => {
        const val = parseFloat(event.target.value) || 1.0;
        if (controls) {
            controls.sensitivityMultiplier = val;
            controls.rollSpeed = val;
        }
        const badge = document.querySelector('#valSensitivityBadge');
        if (badge) badge.textContent = `${val.toFixed(1)}×`;
        storageSetItem('setting-mouse-sensitivity', event.target.value);
    });
}

const masterVolEl = document.querySelector('#setting-master-volume');
if (masterVolEl) {
    masterVolEl.addEventListener('input', (event) => {
        const val = parseInt(event.target.value, 10);
        masterVolumeLevel = isNaN(val) ? 0.8 : val / 100;
        if (celebration) celebration.volume = masterVolumeLevel;
        const badge = document.querySelector('#valVolumeBadge');
        if (badge) badge.textContent = `${val}%`;
        storageSetItem('setting-master-volume', event.target.value);
    });
}

const dustSettingEl = document.querySelector('#setting-dust-particles');
if (dustSettingEl) {
    dustSettingEl.addEventListener('change', (event) => {
        const dustObj = dust ? (dust.object || dust._mesh) : null;
        if (dustObj) dustObj.visible = event.target.checked;
        storageSetItem('setting-dust-particles', event.target.checked ? 'true' : 'false');
    });
}

const trailSettingEl = document.querySelector('#setting-trail-effect');
if (trailSettingEl) {
    trailSettingEl.addEventListener('change', (event) => {
        const trailObj = trail ? (trail.object || trail._mesh) : null;
        if (trailObj) trailObj.visible = event.target.checked;
        storageSetItem('setting-trail-effect', event.target.checked ? 'true' : 'false');
    });
}

const hudPause = document.querySelector('#hudPauseBtn');
if (hudPause) {
    hudPause.addEventListener('click', (event) => {
        event.stopPropagation();
        if (controls.isLocked) {
            controls.disableLock(new Event(''));
        }
    });
}

document.querySelector('#vr-setting-mirror').addEventListener('change', (event) => {
    storageSetItem('vr-setting-mirror', event.target.checked ? 'true' : 'false');
    vrMirrorEnabled = event.target.checked;
});

document.querySelectorAll('.menu-radio-button').forEach((el) => {
    el.addEventListener('change', (event) => {
        if (event.target.name == 'vr-setting-movement') {
            controls.vrControlOptions.teleportationEnabled = event.target.value == 'teleport';
            storageSetItem('vr-setting-movement', event.target.value);
        }
        if (event.target.name == 'vr-setting-rotation') {
            controls.vrControlOptions.rotationSmoothing = event.target.value == 'smooth';
            updateVrRotateSpeedSettingEnabled();
            storageSetItem('vr-setting-rotation', event.target.value);
        }
    });
});

function updateVrRotateSpeedSettingEnabled() {
    const vrRotationSpeedSetting = document.querySelector('#vr-setting-rotation-speed');
    vrRotationSpeedSetting.disabled = !controls.vrControlOptions.rotationSmoothing;
}

function getVrDeviceType() {
    if (navigator.userAgent.indexOf('OculusBrowser') !== -1) {
        return 'vr-device-first';
    }
    if (isMobile) {
        return 'vr-device-last';
    }
    return 'vr-device-enabled';
}

document.querySelectorAll('.menu-slider').forEach((el) => {
    el.addEventListener('input', (event) => {
        const value = event.target.value;
        if (event.target.id == 'vr-setting-rotation-speed') {
            const expValue = Math.pow(3, value);
            vrManager.rotationSpeed = expValue;
            storageSetItem('vr-setting-rotation-speed', value);
        }
        vrManager.uiMesh.material.map.update();
    });
});

document.querySelectorAll('.xr-force-redraw').forEach((el) => {
    el.addEventListener('change', (event) => {
        if (renderer.xr.isPresenting) {
            vrManager.uiMesh.material.map.update();
        }
    });
});

window.addEventListener('beforeunload', verifyAndReportAbandonedMaze);

// Victory Celebration Event Handlers with Rapid-Click Debounce Guard
let isActionProcessing = false;
function executeVictoryAction(actionFn) {
    if (isActionProcessing) return;
    isActionProcessing = true;
    try {
        actionFn();
    } catch (err) {
        console.error('Error executing victory action:', err);
    } finally {
        setTimeout(() => { isActionProcessing = false; }, 100);
    }
}

document.querySelector('#btnVictoryPlayAgain').addEventListener('click', () => {
    executeVictoryAction(() => {
        isInFreeLook = false;
        finishedMaze = false;
        celebration.stopConfetti();
        celebration.stopActiveAudio();
        document.querySelector('#completionMessage').style.display = 'none';
        buildMazeAndUpdateUI(mazeSize);
        menuLockControls();
    });
});

document.querySelector('#btnVictoryNextLevel').addEventListener('click', () => {
    executeVictoryAction(() => {
        isInFreeLook = false;
        finishedMaze = false;
        celebration.stopConfetti();
        celebration.stopActiveAudio();
        document.querySelector('#completionMessage').style.display = 'none';
        const currentSize = parseInt(mazeSize) || 3;
        const nextSize = Math.min(12, currentSize + 1);
        buildMazeAndUpdateUI(nextSize);
        menuLockControls();
    });
});

document.querySelector('#btnVictoryChangeSize').addEventListener('click', () => {
    executeVictoryAction(() => {
        isInFreeLook = false;
        finishedMaze = false;
        startedMaze = false;
        currentGameState = GAME_STATE.MENU;
        celebration.stopConfetti();
        celebration.stopActiveAudio();
        document.querySelector('#completionMessage').style.display = 'none';
        document.querySelector('#blocker').style.display = '';
        menuManager.focusRootMenu('menu-new-maze');
        updateMenuCentering();
    });
});

document.querySelector('#btnVictoryFreeLook').addEventListener('click', () => {
    executeVictoryAction(() => {
        isInFreeLook = true;
        celebration.stopConfetti();
        const compassEl = document.querySelector('#compass-container');
        if (compassEl) compassEl.style.display = '';
        document.querySelector('#completionMessage').style.display = 'none';
        document.querySelector('#victoryReopenBtn').style.display = 'flex';
        menuLockControls();
    });
});

document.querySelector('#victoryReopenBtn').addEventListener('click', () => {
    executeVictoryAction(() => {
        isInFreeLook = false;
        const compassEl = document.querySelector('#compass-container');
        if (compassEl) compassEl.style.display = 'none';
        if (controls.isLocked) {
            controls.disableLock(new Event(''));
        }
        document.querySelector('#victoryReopenBtn').style.display = 'none';
        document.querySelector('#completionMessage').style.display = 'flex';
        celebration.startConfetti();
    });
});

const btnVictoryMute = document.querySelector('#btnVictoryMute');
if (btnVictoryMute) {
    btnVictoryMute.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMuted = celebration.toggleMute();
        document.querySelector('#victoryMuteIcon').textContent = isMuted ? '🔇' : '🔊';
    });
}

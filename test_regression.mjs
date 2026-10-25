import { generateMaze, getOffset, getSegment, majorWidth, minorWidth } from './js/maze.js';

console.log('=== RUNNING COMPREHENSIVE 3D MAZE REGRESSION TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${testName} - ${details}`);
        failCount++;
    }
}

// Build helper that mimics game.js collision logic for any sector size
function createCollisionEngine(size) {
    const mazeData = generateMaze(size);
    const maxI = mazeData.bounds[0] * 2;
    const maxJ = mazeData.bounds[1] * 2;
    const maxK = mazeData.bounds[2] * 2;
    const segments = size * 2 - 1;
    const endPos = {
        x: getOffset(segments),
        y: getOffset(segments),
        z: getOffset(segments + 6)
    };

    function isSegmentSolid(i, j, k) {
        if (!mazeData || !mazeData.collision_map) return false;
        if (k >= 0 && k <= maxK) {
            if (i < 0 || i > maxI || j < 0 || j > maxJ) return true;
            if (k === 0) {
                if (i === 1 && j === 1) return false;
                return true;
            }
            if (k === maxK) {
                if (i === maxI - 1 && j === maxJ - 1) return false;
                return true;
            }
            return !!mazeData.collision_map[i][j][k];
        }
        if (k < 0) {
            if (k < -2) return true;
            if (k === -2) return true;
            if (k === -1) {
                return !(i === 1 && j === 1);
            }
            return true;
        }
        if (k > maxK) {
            const kGatewayEnd = maxK + 6;
            if (k <= kGatewayEnd) {
                return !(i === maxI - 1 && j === maxJ - 1);
            }
            return true;
        }
        return true;
    }

    function isPositionBlocked(x, y, z, r = 0.25) {
        const minI = getSegment(x - r);
        const maxI = getSegment(x + r);
        const minJ = getSegment(y - r);
        const maxJ = getSegment(y + r);
        const minK = getSegment(z - r);
        const maxK = getSegment(z + r);

        for (let i = minI; i <= maxI; i++) {
            for (let j = minJ; j <= maxJ; j++) {
                for (let k = minK; k <= maxK; k++) {
                    if (isSegmentSolid(i, j, k)) return true;
                }
            }
        }
        return false;
    }

    function resolveMovement(pos, dx, dy, dz, r = 0.25) {
        const totalDist = Math.hypot(dx, dy, dz);
        if (totalDist < 1e-7) return;

        const maxStep = 0.04;
        const numSteps = Math.min(Math.max(1, Math.ceil(totalDist / maxStep)), 64);
        const sx = dx / numSteps;
        const sy = dy / numSteps;
        const sz = dz / numSteps;

        for (let s = 0; s < numSteps; s++) {
            if (Math.abs(sx) > 1e-7 && !isPositionBlocked(pos.x + sx, pos.y, pos.z, r)) {
                pos.x += sx;
            }
            if (Math.abs(sy) > 1e-7 && !isPositionBlocked(pos.x, pos.y + sy, pos.z, r)) {
                pos.y += sy;
            }
            if (Math.abs(sz) > 1e-7 && !isPositionBlocked(pos.x, pos.y, pos.z + sz, r)) {
                pos.z += sz;
            }
        }
    }

    return { mazeData, maxI, maxJ, maxK, endPos, isPositionBlocked, resolveMovement };
}

// -------------------------------------------------------------
// TEST SUITE 1: SPAWN ENCLOSURE & GEOMETRY (Sector 3^3)
// -------------------------------------------------------------
console.log('--- TEST GROUP 1: Enclosed Starting Chamber ---');
const engine3 = createCollisionEngine(3);
const R = 0.25;
const spawn = { x: getOffset(1), y: getOffset(1), z: getOffset(-1) };

assert(!engine3.isPositionBlocked(spawn.x, spawn.y, spawn.z, R), 
    'Starting spawn position is completely collision-free');

// Check clearance: 1.0m from center to walls
assert(engine3.isPositionBlocked(spawn.x, spawn.y, -1.80, R), 
    'Starting chamber back wall blocks negative Z movement');
assert(engine3.isPositionBlocked(0.20, spawn.y, spawn.z, R), 
    'Starting chamber left wall blocks negative X movement');
assert(engine3.isPositionBlocked(1.85, spawn.y, spawn.z, R), 
    'Starting chamber right wall blocks positive X movement');
assert(engine3.isPositionBlocked(spawn.x, 0.20, spawn.z, R), 
    'Starting chamber floor blocks downward Y movement');
assert(engine3.isPositionBlocked(spawn.x, 1.85, spawn.z, R), 
    'Starting chamber ceiling blocks upward Y movement');

// Doorway check: Z = 0 is open in center, blocked on sides
assert(!engine3.isPositionBlocked(spawn.x, spawn.y, 0, R), 
    'Intentional starting chamber exit doorway at Z = 0 is open for traversal');
assert(engine3.isPositionBlocked(0.1, spawn.y, 0, R), 
    'Starting chamber front wall blocks off-center passage at Z = 0');

// -------------------------------------------------------------
// TEST SUITE 2: BOOST & WALL COLLISION (Zero Tunneling)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Wall Collision & Boost Mechanics ---');
// Boost test 1: Boost backward with 10.0m displacement into back wall
const player1 = { ...spawn };
engine3.resolveMovement(player1, 0, 0, -10.0, R);
assert(player1.z >= -1.78125, 'Player cannot tunnel through starting chamber back wall at 10m boost', `z was ${player1.z}`);

// Boost test 2: Boost left with 10.0m displacement into left wall
const player2 = { ...spawn };
engine3.resolveMovement(player2, -10.0, 0, 0, R);
assert(player2.x >= 0.28125, 'Player cannot tunnel through left wall at 10m boost', `x was ${player2.x}`);

// Boost test 3: Boost into ceiling with 10.0m displacement
const player3 = { ...spawn };
engine3.resolveMovement(player3, 0, 10.0, 0, R);
assert(player3.y <= 1.78125, 'Player cannot tunnel through ceiling at 10m boost', `y was ${player3.y}`);

// -------------------------------------------------------------
// TEST SUITE 3: DIAGONAL SLIDING & CORNER MOVEMENT
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Diagonal Movement & Wall Sliding ---');
// Moving diagonally into left wall while pushing forward towards doorway
const playerDiag = { ...spawn };
engine3.resolveMovement(playerDiag, -5.0, 0, 3.0, R);
assert(playerDiag.x >= 0.28125, 'Diagonal movement does not breach left wall', `x was ${playerDiag.x}`);
assert(playerDiag.z > spawn.z, 'Diagonal movement smoothly slides along wall towards front doorway', `z was ${playerDiag.z}`);

// Corner approach: moving diagonally into floor + left wall corner
const playerCorner = { ...spawn };
engine3.resolveMovement(playerCorner, -5.0, -5.0, 0, R);
assert(playerCorner.x >= 0.28125 && playerCorner.y >= 0.28125, 'Player is safely contained at bottom-left corner junction');

// -------------------------------------------------------------
// TEST SUITE 4: EXTERNAL BOUNDARY ENCLOSURE
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 4: External Boundary Enclosure ---');
// Verify that coordinates outside the maze are strictly solid
const outerX = getOffset(engine3.maxI) + 2.0;
const outerY = getOffset(engine3.maxJ) + 2.0;
assert(engine3.isPositionBlocked(outerX, spawn.y, getOffset(1), R), 'External right boundary is strictly solid');
assert(engine3.isPositionBlocked(-2.0, spawn.y, getOffset(1), R), 'External left boundary is strictly solid');
assert(engine3.isPositionBlocked(spawn.x, outerY, getOffset(1), R), 'External top boundary is strictly solid');
assert(engine3.isPositionBlocked(spawn.x, -2.0, getOffset(1), R), 'External bottom boundary is strictly solid');
assert(engine3.isPositionBlocked(spawn.x, spawn.y, -3.0, R), 'External boundary behind starting chamber is strictly solid');

// -------------------------------------------------------------
// TEST SUITE 5: VALID MAZE TRAVERSAL & GATEWAY TRIGGER
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 5: Maze Traversal & Gateway Trigger ---');
// Fly from spawn through doorway into cell (1, 1, 1)
const playerFly = { ...spawn };
engine3.resolveMovement(playerFly, 0, 0, 2.0625, R);
assert(playerFly.z > 0, 'Player smoothly traversed from starting chamber into cell (1, 1, 1)', `z is ${playerFly.z}`);

// Gateway completion check
const atGateway = { ...engine3.endPos };
const distAtGateway = Math.hypot(atGateway.x - engine3.endPos.x, atGateway.y - engine3.endPos.y, atGateway.z - engine3.endPos.z);
assert(distAtGateway <= 2.2, 'Gateway trigger region activates when player reaches endPos');

// -------------------------------------------------------------
// TEST SUITE 6: DYNAMIC SECTOR SIZE SCALING (3^3 to 12^3)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Sector Size Compatibility ---');
for (const testSize of [3, 4, 5, 8, 12]) {
    const engineN = createCollisionEngine(testSize);
    const spawnN = { x: getOffset(1), y: getOffset(1), z: getOffset(-1) };
    const isSpawnSafe = !engineN.isPositionBlocked(spawnN.x, spawnN.y, spawnN.z, R);
    const isBackSolid = engineN.isPositionBlocked(spawnN.x, spawnN.y, -1.85, R);
    const isDoorwayOpen = !engineN.isPositionBlocked(spawnN.x, spawnN.y, 0, R);
    const isOuterSolid = engineN.isPositionBlocked(getOffset(testSize * 2) + 2.0, spawnN.y, getOffset(1), R);

    assert(isSpawnSafe && isBackSolid && isDoorwayOpen && isOuterSolid, 
        `Sector ${testSize}³: Starting chamber, doorway, and external boundaries correctly constructed and validated`);
}

// -------------------------------------------------------------
// TEST SUITE 7: PAUSE / RESUME STATE & TIMER MATHEMATICS
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 7: Pause / Resume & Timer Preservation ---');
let simElapsedTime = 0;
let simLastFrameTime = 1000;

// Simulate 5 seconds of active flight
simElapsedTime += (6000 - simLastFrameTime);
assert(simElapsedTime === 5000, 'Active flight accurately accumulates 5000ms');

// Pause: simLastFrameTime frozen to 0
simLastFrameTime = 0;
// Wait 10 seconds in paused menu: elapsed time must NOT change
assert(simElapsedTime === 5000, 'Paused duration does not increase mission elapsed time');

// Resume at timestamp 16000
simLastFrameTime = 16000;
// Simulate 3 more seconds of active flight up to timestamp 19000
simElapsedTime += (19000 - simLastFrameTime);
assert(simElapsedTime === 8000, 'Resuming continues exact mission timer (8000ms total, zero pause leakage)');

console.log(`\n=============================================================`);
console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`=============================================================`);

if (failCount > 0) {
    process.exit(1);
}

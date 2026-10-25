/**
 * pointerlock controls:    https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
 * fly controls:            https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/FlyControls.js
 */

import {
    Euler,
    EventDispatcher,
    Quaternion,
    Vector3
} from "https://unpkg.com/three@0.181.0/build/three.module.js";

function clamp(val, min, max) {
    return Math.min( Math.max( val, min ), max );
}

const WORLD_Y = new Vector3( 0, 1, 0 );
const MAX_PITCH = Math.PI * 0.49; // ~88.2 deg (prevents Euler singularity & flipping)
const MIN_PITCH = -Math.PI * 0.49;

var FlyPointerLockControls = function ( object, domElement ) {

    if ( domElement === undefined ) {
        console.warn( 'THREE.FlyControls: The second parameter "domElement" is now mandatory.' );
        domElement = document;
    }

    this.object = object;
    this.domElement = domElement;

    if ( domElement ) this.domElement.setAttribute( 'tabindex', - 1 );

    // API
    this.movementSpeed = 1.0;
    this.rollSpeed = 0.005;
    this.mouseSensitivity = 0.002;
    this.sensitivityMultiplier = 1.0;

    this.isBoosting = false;
    this.boostMultiplier = 2.2;

    this.autoForward = false;
    this.isLocked = false;

    // Single source of truth for orientation in first-person mode
    this.yaw = 0;
    this.pitch = 0;

    this.vrControlOptions = {
        teleportationEnabled: true,
        rotationSmoothing: false
    };
    this.vrTeleportTimeout = 500;
    this.vrLastTeleportTime = 0;
    this.vrTeleportRecentered = false;

    // VR rotation state
    this.vrRotationSmoothSpeed = 6.0; // radians per second
    this.vrLastRotateTime = 0;

    // on first page load, android lets the pointer lock work
    this.lastLockDate = undefined;

    this.gimbalLocked = true;
    this.isXRPresenting = false;

    // internals
    this.tmpQuaternion = new Quaternion();
    this.tmpEulerAngle = new Euler(0, 0, 0, 'YXZ');

    this.mouseStatus = 0;

    this.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
    this.moveVector = new Vector3( 0, 0, 0 );
    this.rotationVector = new Vector3( 0, 0, 0 );
    this.tmpVector = new Vector3( 0, 0, 0 );

    var scope = this;

    var changeEvent = { type: 'change' };
    var lockEvent = { type: 'lock' };
    var unlockEvent = { type: 'unlock' };
    var teleportEvent = { type: 'teleport' };

    function is_touch_device() {
        try {
            document.createEvent("TouchEvent");
            return true;
        } catch (e) {
            return false;
        }
    }

    this.touchable = is_touch_device();

    var touchDOM = null;

    var panTouchDragging = false;
    var panLastTouchX = 0;
    var panLastTouchY = 0;
    var panTouchIdentifier = 0;

    var moveTouchDragging = false;
    var moveStartX = 0;
    var moveStartY = 0;
    var moveLastX = 0;
    var moveLastY = 0;
    var moveTouchIdentifier = 0;

    var accumulatedMouseRotationY = 0;
    var lastMouseMoveTime = 0;
    const mouseInstantRotateThreshold = (b) => b ? 0.5 : 0.1;
    var firstRotationApplied = false;

    /**
     * Synchronize internal yaw and pitch angles from object's current quaternion.
     * Prevents rotational jumps when taking control of the camera.
     */
    this.syncOrientation = function() {
        if (!scope.object) return;
        scope.tmpEulerAngle.setFromQuaternion(scope.object.quaternion, 'YXZ');
        scope.pitch = clamp(scope.tmpEulerAngle.x, MIN_PITCH, MAX_PITCH);
        scope.yaw = scope.tmpEulerAngle.y;
        if (scope.gimbalLocked && !scope.isXRPresenting) {
            scope.object.rotation.order = 'YXZ';
            scope.object.rotation.set(scope.pitch, scope.yaw, 0, 'YXZ');
        }
    };

    function onMouseMove( event ) {
        if ( scope.isLocked === false ) return;

        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        // Discard extreme delta spikes during pointerlock acquisition/re-entry
        if (Math.abs(movementX) > 600 || Math.abs(movementY) > 600) return;

        const effectiveSensitivity = scope.mouseSensitivity * scope.sensitivityMultiplier;

        const shouldInstantRotate = scope.isXRPresenting && !scope.vrControlOptions.rotationSmoothing;
        if (!shouldInstantRotate) {
            if (scope.gimbalLocked && !scope.isXRPresenting) {
                // Direct yaw & pitch calculation — zero gimbal lock, zero Euler drift
                scope.yaw -= movementX * effectiveSensitivity;
                scope.pitch -= movementY * effectiveSensitivity;
                scope.pitch = clamp(scope.pitch, MIN_PITCH, MAX_PITCH);

                // Seamlessly wrap yaw within [-PI, PI]
                if (scope.yaw > Math.PI) scope.yaw -= Math.PI * 2;
                else if (scope.yaw < -Math.PI) scope.yaw += Math.PI * 2;

                scope.object.rotation.order = 'YXZ';
                scope.object.rotation.set(scope.pitch, scope.yaw, 0, 'YXZ');

                scope.dispatchEvent( changeEvent );
            } else {
                scope.tmpVector.set( - movementY * (scope.isXRPresenting ? 0 : 1), - movementX, 0 );
                scope.applyRotation( scope.tmpVector, effectiveSensitivity );
                scope.dispatchEvent( changeEvent );
            }
        } else {
            if (Date.now() - lastMouseMoveTime > 500) {
                accumulatedMouseRotationY = 0;
                firstRotationApplied = false;
            }

            lastMouseMoveTime = Date.now();

            // for mouse in VR snap mode, accumulate rotation and apply snap
            accumulatedMouseRotationY -= movementX * effectiveSensitivity;
            if (Math.abs(accumulatedMouseRotationY) > mouseInstantRotateThreshold(firstRotationApplied)) {
                const rotationAmount = Math.sign(accumulatedMouseRotationY) * Math.PI / 4;
                scope.doInstantRotate(rotationAmount);
                if (firstRotationApplied) {
                    accumulatedMouseRotationY -= 1.5 * mouseInstantRotateThreshold(true) * Math.sign(accumulatedMouseRotationY);
                } else {
                    firstRotationApplied = true;
                }
            }
        }
    }

    function onTouchStart( event ) {
        if ( scope.isLocked === false ) return;

        event.preventDefault();

        for (let i = 0; i < event.changedTouches.length; i++) {
            let t = event.changedTouches[i];
            if (t.clientX >= touchDOM.clientWidth / 2 && !panTouchDragging && (!moveTouchDragging || moveTouchIdentifier != t.identifier)) {
                panTouchDragging = true;
                panLastTouchX = t.clientX;
                panLastTouchY = t.clientY;
                panTouchIdentifier = t.identifier;
            }
            if (t.clientX < touchDOM.clientWidth / 2 && !moveTouchDragging && (!panTouchDragging || panTouchIdentifier != t.identifier)) {
                moveTouchDragging = true;
                moveStartX = t.clientX;
                moveStartY = t.clientY;
                moveLastX = t.clientX;
                moveLastY = t.clientY;
                moveTouchIdentifier = t.identifier;
            }
        }
    }

    function onTouchEnd( event ) {
        if ( scope.isLocked === false ) return;

        event.preventDefault();

        for (let i = 0; i < event.changedTouches.length; i++) {
            let t = event.changedTouches[i];
            if (t.identifier == panTouchIdentifier && panTouchDragging) {
                panTouchDragging = false;
            } else if (t.identifier == moveTouchIdentifier && moveTouchDragging) {
                moveTouchDragging = false;
            }
        }
    }

    function onTouchMove( event ) {
        if ( scope.isLocked === false ) return;

        event.preventDefault();

        for (let i = 0; i < event.touches.length; i++) {
            let t = event.touches[i];
            if (t.identifier == panTouchIdentifier && panTouchDragging) {
                let movementX = (t.clientX - panLastTouchX) || event.mozMovementX || event.webkitMovementX || 0;
                let movementY = (t.clientY - panLastTouchY) || event.mozMovementY || event.webkitMovementY || 0;

                panLastTouchX = t.clientX;
                panLastTouchY = t.clientY;

                scope.tmpVector.set( - movementY, - movementX, 0 );
                scope.applyRotation( scope.tmpVector, 0.006 );
                scope.dispatchEvent( changeEvent );
            } else if (t.identifier == moveTouchIdentifier && moveTouchDragging) {
                moveLastX = t.clientX;
                moveLastY = t.clientY;
            }
        }
    }

    function onPointerlockChange() {
        if ( (scope.touchable && scope.lastLockDate !== undefined && (new Date().getTime() - scope.lastLockDate) < 250) ||
              (moveTouchDragging || panTouchDragging) ) {
            return;
        }

        if ( scope.domElement.ownerDocument.pointerLockElement === scope.domElement ) {
            scope.isLocked = true;
            scope.syncOrientation();
            scope.dispatchEvent( lockEvent );
        } else {
            scope.isLocked = false;
            scope.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
            scope.isBoosting = false;
            scope.updateMovementVector();
            scope.updateRotationVector();
            scope.dispatchEvent( unlockEvent );
        }
    }

    function onWindowBlur() {
        scope.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
        scope.isBoosting = false;
        scope.updateMovementVector();
        scope.updateRotationVector();
    }

    this.disableLock = function( event ) {
        try {
            scope.domElement.ownerDocument.exitPointerLock();
        }
        catch {}

        if (scope.isLocked) {
            scope.isLocked = false;
            scope.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
            scope.isBoosting = false;
            scope.updateMovementVector();
            scope.updateRotationVector();
            scope.dispatchEvent( unlockEvent );
        }

        if (event && event.preventDefault) event.preventDefault();
    };

    function onPointerlockError() {
        console.error( 'FlyPointerlockControls: Unable to use Pointer Lock API' );
    }

    this.connect = function() {
        scope.domElement.ownerDocument.addEventListener( 'mousemove', onMouseMove, false);
        scope.domElement.ownerDocument.addEventListener( 'pointerlockchange', onPointerlockChange, false);
        scope.domElement.ownerDocument.addEventListener( 'pointerlockerror', onPointerlockError, false);
        window.addEventListener( 'blur', onWindowBlur, false );

        touchDOM = scope.domElement.ownerDocument.getElementById('mainCanvas');
        if (touchDOM) {
            touchDOM.addEventListener( 'touchstart', onTouchStart, false);
            touchDOM.addEventListener( 'touchmove', onTouchMove, false);
            touchDOM.addEventListener( 'touchend', onTouchEnd, false);
            touchDOM.addEventListener( 'touchcancel', onTouchEnd, false);
        }

        let exitDOM = scope.domElement.ownerDocument.getElementById('completionMessage');
        if (exitDOM) exitDOM.addEventListener( 'touchstart', scope.disableLock , false );
        exitDOM = scope.domElement.ownerDocument.getElementById('compass');
        if (exitDOM) exitDOM.addEventListener( 'touchstart', scope.disableLock , false );

        scope.domElement.ownerDocument.addEventListener('keydown', onKeyDown, false);
        scope.domElement.ownerDocument.addEventListener('keyup', onKeyUp, false);
    };

    this.disconnect = function() {
        scope.domElement.ownerDocument.removeEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.ownerDocument.removeEventListener( 'pointerlockchange', onPointerlockChange, false );
        scope.domElement.ownerDocument.removeEventListener( 'pointerlockerror', onPointerlockError, false );
        window.removeEventListener( 'blur', onWindowBlur, false );

        if (touchDOM) {
            touchDOM.removeEventListener( 'touchstart', onTouchStart, false);
            touchDOM.removeEventListener( 'touchmove', onTouchMove, false);
            touchDOM.removeEventListener( 'touchend', onTouchEnd, false);
            touchDOM.removeEventListener( 'touchcancel', onTouchEnd, false);
        }

        let exitDOM = scope.domElement.ownerDocument.getElementById('completionMessage');
        if (exitDOM) exitDOM.removeEventListener( 'touchstart', scope.disableLock , false );
        exitDOM = scope.domElement.ownerDocument.getElementById('compass');
        if (exitDOM) exitDOM.removeEventListener( 'touchstart', scope.disableLock , false );

        scope.domElement.ownerDocument.removeEventListener('keydown', onKeyDown, false);
        scope.domElement.ownerDocument.removeEventListener('keyup', onKeyUp, false);
    };

    this.dispose = function() {
        this.disconnect();
    };

    this.update = function ( delta ) {
        if ( scope.isLocked === false ) return;

        this.tmpVector.copy(this.moveVector);

        if (moveTouchDragging) {
            this.tmpVector.x += (moveLastX - moveStartX) * 4 / touchDOM.clientHeight;
            this.tmpVector.z += (moveLastY - moveStartY) * 4 / touchDOM.clientHeight;
        }
        this.tmpVector.x = clamp (this.tmpVector.x, -1, 1);
        this.tmpVector.z = clamp (this.tmpVector.z, -1, 1);

        // If player is boosting with Space and no directional keys are held, propel forward
        if (this.isBoosting && this.tmpVector.lengthSq() < 1e-6) {
            this.tmpVector.z = -1;
        }

        if (this.tmpVector.lengthSq() > 1.0)
            this.tmpVector.normalize();

        const shouldTeleport = this.vrControlOptions.teleportationEnabled && this.isXRPresenting;
        if (!shouldTeleport) {
            const currentSpeed = this.movementSpeed * (this.isBoosting ? this.boostMultiplier : 1.0);
            let moveMult = delta * currentSpeed;

            // Move relative to current camera heading
            this.object.translateX( this.tmpVector.x * moveMult );
            this.object.translateY( this.tmpVector.y * moveMult );
            this.object.translateZ( this.tmpVector.z * moveMult );
        } else {
            // VR teleportation logic
            const currentTime = new Date().getTime();
            const canTelport = this.vrTeleportRecentered || ((currentTime - this.vrLastTeleportTime) > this.vrTeleportTimeout);
            if (this.tmpVector.lengthSq() > 0.7 && canTelport) {
                this.tmpVector.normalize();

                const teleportTime = Math.min(this.vrTeleportTimeout, Date.now() - this.vrLastTeleportTime) / 1000;
                const teleportDistance = this.movementSpeed * teleportTime;
                this.tmpVector.multiplyScalar(teleportDistance);

                this.object.translateX( this.tmpVector.x );
                this.object.translateY( this.tmpVector.y );
                this.object.translateZ( this.tmpVector.z );

                this.vrLastTeleportTime = currentTime;
                this.vrTeleportRecentered = false;

                this.dispatchEvent( teleportEvent );
            } else if (this.moveVector.lengthSq() < 0.1) {
                this.vrTeleportRecentered = true;
            }
        }

        // Apply keyboard rotation only when rotation keys are actively pressed (avoids zero-vector Matrix churn)
        if (this.rotationVector.lengthSq() > 1e-6) {
            let rotMult = delta * this.rollSpeed;
            this.applyRotation( this.rotationVector, rotMult );
        }
    };

    this.handleVRRotation = function ( stickInput, delta ) {
        if (Math.abs(stickInput) < 0.1) return;

        if (this.vrControlOptions.rotationSmoothing) {
            const rotationAmount = stickInput * this.vrRotationSmoothSpeed * delta;
            this.object.rotateOnWorldAxis(WORLD_Y, -rotationAmount);
        }
    };

    this.applyRotation = function ( rotationVector_, scaleFactor = 1 ) {
        if (rotationVector_.lengthSq() < 1e-7) return;

        if (scope.gimbalLocked) {
            const shouldInstantRotate = this.isXRPresenting && !this.vrControlOptions.rotationSmoothing;
            if (!shouldInstantRotate) {
                scope.yaw += rotationVector_.y * scaleFactor;
                scope.pitch += rotationVector_.x * scaleFactor;
                scope.pitch = clamp(scope.pitch, MIN_PITCH, MAX_PITCH);

                if (scope.yaw > Math.PI) scope.yaw -= Math.PI * 2;
                else if (scope.yaw < -Math.PI) scope.yaw += Math.PI * 2;

                scope.object.rotation.order = 'YXZ';
                scope.object.rotation.set(scope.pitch, scope.yaw, 0, 'YXZ');
            } else {
                const elapsedTime = Date.now() - this.vrLastRotateTime;
                const threshold = 0.7;
                if (Math.abs(this.rotationVector.y) > threshold && elapsedTime > 500) {
                    this.vrLastRotateTime = Date.now();
                    const rotationAmount = Math.sign(this.rotationVector.y) * Math.PI / 4;
                    this.doInstantRotate(rotationAmount);
                } else if (Math.abs(this.rotationVector.y) < 0.2) {
                    this.vrLastRotateTime = 0;
                }
            }
        } else {
            scope.tmpQuaternion.set( rotationVector_.x * scaleFactor, rotationVector_.y * scaleFactor, rotationVector_.z * scaleFactor, 1 ).normalize();
            scope.object.quaternion.multiply( scope.tmpQuaternion );
            scope.object.rotation.setFromQuaternion( scope.object.quaternion, scope.object.rotation.order );
        }
    };

    this.doInstantRotate = function(rotationAmount) {
        scope.object.rotateOnWorldAxis(WORLD_Y, rotationAmount);
        scope.syncOrientation();
        scope.dispatchEvent( teleportEvent );
    };

    this.setGimbalLocked = function(setting) {
        if (scope.gimbalLocked && !setting) {
            scope.gimbalLocked = false;
        } else if (setting && !scope.gimbalLocked) {
            scope.syncOrientation();
            scope.gimbalLocked = true;
        }
    };

    this.setXRPresenting = function(presenting) {
        if (presenting) {
            scope.syncOrientation();
            scope.pitch = 0;
            scope.object.rotation.set(scope.pitch, scope.yaw, 0, 'YXZ');

            if (!scope.gimbalLocked) {
                scope.setGimbalLocked(true);
            }
        }
        scope.isXRPresenting = presenting;
    };

    this.updateMovementVector = function () {
        var forward = ( this.moveState.forward || ( this.autoForward && ! this.moveState.back ) ) ? 1 : 0;
        this.moveVector.x = ( - this.moveState.left + this.moveState.right );
        this.moveVector.y = ( - this.moveState.down + this.moveState.up );
        this.moveVector.z = ( - forward + this.moveState.back );
    };

    this.updateRotationVector = function () {
        this.rotationVector.x = ( - this.moveState.pitchDown + this.moveState.pitchUp) * (this.isXRPresenting ? 0 : 1);
        this.rotationVector.y = ( - this.moveState.yawRight + this.moveState.yawLeft );
        this.rotationVector.z = ( - this.moveState.rollRight + this.moveState.rollLeft );
    };

    function contextmenu( event ) {
        event.preventDefault();
    }

    this.lock = function() {
        let lockPromise = null;
        try {
            lockPromise = this.domElement.requestPointerLock();
        }
        catch (e) {
            console.warn('Pointer lock request failed synchronously, fallback to direct flight:', e);
            if (!scope.isLocked) {
                scope.isLocked = true;
                scope.syncOrientation();
                scope.dispatchEvent( lockEvent );
                return;
            }
        }

        if (lockPromise && typeof lockPromise.catch === 'function') {
            lockPromise.catch(() => {
                if (!scope.isLocked) {
                    scope.isLocked = true;
                    scope.syncOrientation();
                    scope.dispatchEvent( lockEvent );
                }
            });
        }

        if (!this.isLocked && (this.touchable || this.isXRPresenting)) {
            scope.isLocked = true;
            scope.syncOrientation();
            scope.dispatchEvent( lockEvent );
            scope.lastLockDate = new Date().getTime();
        }
    };

    this.unlock = function() {
        try {
            scope.domElement.ownerDocument.exitPointerLock();
        } catch (_) {}

        if (scope.isLocked) {
            scope.isLocked = false;
            scope.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
            scope.isBoosting = false;
            scope.updateMovementVector();
            scope.updateRotationVector();
            scope.dispatchEvent( unlockEvent );
        }
    };

    this.domElement.addEventListener( 'contextmenu', contextmenu, false );

    this.updateMovementVector();
    this.updateRotationVector();

    var onKeyDown = function ( event ) {
        if ( !scope.isLocked ) return;
        if ( event.altKey ) return;

        switch ( event.code || event.keyCode ) {
            case 'KeyW':
            case 87: /*W*/ scope.moveState.forward = 1; break;
            case 'KeyS':
            case 83: /*S*/ scope.moveState.back = 1; break;

            case 'KeyA':
            case 65: /*A*/ scope.moveState.left = 1; break;
            case 'KeyD':
            case 68: /*D*/ scope.moveState.right = 1; break;

            case 'Space':
            case 32: /* space */
                scope.isBoosting = true;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
            case 16: /* shift */
                scope.moveState.down = 1;
                break;

            case 'ArrowUp':
            case 38: /*up*/ scope.moveState.pitchUp = 1; break;
            case 'ArrowDown':
            case 40: /*down*/ scope.moveState.pitchDown = 1; break;

            case 'ArrowLeft':
            case 37: /*left*/ scope.moveState.yawLeft = 1; break;
            case 'ArrowRight':
            case 39: /*right*/ scope.moveState.yawRight = 1; break;

            case 'KeyQ':
            case 81: /*Q*/ scope.moveState.rollLeft = 1; break;
            case 'KeyE':
            case 69: /*E*/ scope.moveState.rollRight = 1; break;
        }

        if (scope.gimbalLocked) {
            scope.moveState.rollLeft = 0;
            scope.moveState.rollRight = 0;
        }

        scope.updateMovementVector();
        scope.updateRotationVector();
    };

    var onKeyUp = function ( event ) {
        switch ( event.code || event.keyCode ) {
            case 'KeyW':
            case 87: /*W*/ scope.moveState.forward = 0; break;
            case 'KeyS':
            case 83: /*S*/ scope.moveState.back = 0; break;

            case 'KeyA':
            case 65: /*A*/ scope.moveState.left = 0; break;
            case 'KeyD':
            case 68: /*D*/ scope.moveState.right = 0; break;

            case 'Space':
            case 32: /* space */
                scope.isBoosting = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
            case 16: /* shift */
                scope.moveState.down = 0;
                break;

            case 'ArrowUp':
            case 38: /*up*/ scope.moveState.pitchUp = 0; break;
            case 'ArrowDown':
            case 40: /*down*/ scope.moveState.pitchDown = 0; break;

            case 'ArrowLeft':
            case 37: /*left*/ scope.moveState.yawLeft = 0; break;
            case 'ArrowRight':
            case 39: /*right*/ scope.moveState.yawRight = 0; break;

            case 'KeyQ':
            case 81: /*Q*/ scope.moveState.rollLeft = 0; break;
            case 'KeyE':
            case 69: /*E*/ scope.moveState.rollRight = 0; break;
        }

        scope.updateMovementVector();
        scope.updateRotationVector();
    };

    this.connect();
};

FlyPointerLockControls.prototype = Object.create( EventDispatcher.prototype );
FlyPointerLockControls.prototype.constructor = FlyPointerLockControls;

export { FlyPointerLockControls };
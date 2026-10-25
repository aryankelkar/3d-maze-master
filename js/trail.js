import * as THREE from 'three';
import * as maze from './maze.js';
import sampleUniformSphere from './sampleUniformSphere.js';

/**
 * TrailEffect — Sci-Fi Glowing Orb Trail
 *
 * Spawns glowing additive point particles behind the player,
 * with soft circular sprites, proper fade-in/out over lifetime,
 * size attenuation, and a cyan-blue-purple sci-fi palette.
 *
 * Usage (ESM):
 *   import TrailEffect from './trail.js';
 *   const trail = new TrailEffect({ count: 600, collisionDistance: 0.25 });
 *   trail.addTo(scene);
 *   trail.followObject(cameraNode);
 *   // In render loop: trail.update(deltaSeconds);
 */

// Sci-Fi palette: hue buckets in HSL (0–1 range)
// Concentrated in cyan (0.50), electric blue (0.58–0.64), teal (0.47), and violet (0.72–0.78)
const PALETTE_HUES = [0.47, 0.50, 0.54, 0.58, 0.62, 0.64, 0.68, 0.72, 0.76];
const _scratchTrailMotion = [0, 0, 0];

export default class TrailEffect {
    constructor(opts = {}) {
        const o = Object.assign({
            count: 800,
            collisionDistance: 0.5
        }, opts);

        this.count             = o.count;
        this.collisionDistance = o.collisionDistance;

        this.lastTrailCameraPosition = new THREE.Vector3();
        this._nextSpawnIndex         = 0;
        this._didReset               = false;

        // Per-particle attribute arrays
        this._positions  = new Float32Array(this.count * 3);
        this._spawnTime  = new Float32Array(this.count).fill(-999); // inactive by default
        this._lifeTime   = new Float32Array(this.count).fill(3.0);
        this._direction  = new Float32Array(this.count * 3);
        this._colors     = new Float32Array(this.count * 3);
        this._sizes      = new Float32Array(this.count);

        this._geometry = new THREE.BufferGeometry();
        this._geometry.setAttribute('position',  new THREE.BufferAttribute(this._positions, 3));
        this._geometry.setAttribute('spawnTime', new THREE.BufferAttribute(this._spawnTime, 1));
        this._geometry.setAttribute('lifeTime',  new THREE.BufferAttribute(this._lifeTime,  1));
        this._geometry.setAttribute('direction', new THREE.BufferAttribute(this._direction, 3));
        this._geometry.setAttribute('color',     new THREE.BufferAttribute(this._colors,    3));
        this._geometry.setAttribute('a_size',    new THREE.BufferAttribute(this._sizes,     1));

        // Use PointsMaterial as base; override via onBeforeCompile
        this._material = new THREE.PointsMaterial({
            transparent:     true,
            vertexColors:    true,
            depthWrite:      false,
            blending:        THREE.AdditiveBlending,
            sizeAttenuation: true,
            size:            0.08, // world-space base size; overridden per-particle in shader
        });

        this._material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, {
                u_time:    { value: 0 },
                u_fadeIn:  { value: 0.15 },
                u_fadeOut: { value: 0.60 },
            });

            // ── Vertex Shader ──────────────────────────────────────────────
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `
                    #include <common>
                    uniform float u_time;
                    uniform float u_fadeIn;
                    uniform float u_fadeOut;

                    attribute float spawnTime;
                    attribute float lifeTime;
                    attribute vec3  direction;
                    attribute float a_size;

                    varying float v_alpha;
                    varying vec3  v_color;
                `)
                .replace('#include <color_vertex>', `
                    #include <color_vertex>
                    v_color = color;
                `)
                .replace('#include <begin_vertex>', `
                    float age = u_time - spawnTime;
                    float t   = clamp(age / lifeTime, 0.0, 1.0);

                    // Drift position along pre-baked direction
                    vec3 transformed = position + direction * age;

                    // Fade in at start, fade out toward end
                    float fadeIn  = smoothstep(0.0,     u_fadeIn,  t);
                    float fadeOut = 1.0 - smoothstep(u_fadeOut, 1.0, t);
                    float ageFade = fadeIn * fadeOut;

                    // Proximity fade — hide particles that are right on the camera
                    vec3  worldPos  = (modelMatrix * vec4(transformed, 1.0)).xyz;
                    float dist      = length(worldPos - cameraPosition);
                    float proxFade  = smoothstep(0.0, 0.5, dist);

                    v_alpha = ageFade * proxFade;
                `)
                .replace('gl_PointSize = size;', `
                    // Set world size; Three's USE_SIZEATTENUATION will attenuate by distance
                    gl_PointSize = a_size * (1.0 - t * 0.55);
                `);

            // ── Fragment Shader — soft glowing circular orb ────────────────
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `
                    #include <common>
                    varying float v_alpha;
                    varying vec3  v_color;
                `)
                .replace('#include <premultiplied_alpha_fragment>', `
                    // Soft radial glow: bright core, dim halo
                    vec2  uv     = gl_PointCoord - vec2(0.5);
                    float dist2  = dot(uv, uv); // 0 at centre, 0.25 at edge
                    if (dist2 > 0.25) discard;

                    // Core brightness falloff
                    float coreFade = 1.0 - smoothstep(0.0, 0.16, dist2);
                    // Wide soft halo
                    float haloFade = 1.0 - smoothstep(0.01, 0.25, dist2);
                    float shape    = coreFade * 0.75 + haloFade * 0.25;

                    float alpha = shape * v_alpha;
                    // Additive sci-fi glow
                    gl_FragColor = vec4(v_color * (alpha * 1.8), alpha);
                `);

            this._shader = shader;
        };

        // Pre-allocated scratch objects — no per-frame heap allocations
        this.tmpVector  = new THREE.Vector3();
        this.tmpVector2 = new THREE.Vector3();
        this._tmpColor  = new THREE.Color();
        this._paletteIdx = 0;

        this.object = new THREE.Points(this._geometry, this._material);
        this.object.frustumCulled = false;
        this.object.renderOrder   = 1; // draw after opaque geometry
    }

    // Adds the particle system to a scene or object3D
    addTo(parent) {
        parent.add(this.object);
        this.parent = parent;
    }

    // Object to trail (usually the camera node)
    followObject(object) {
        this.followed = object;
        this.lastTrailCameraPosition.copy(object.position);
    }

    // Call each frame with deltaSeconds
    update(dt) {
        if (!this._shader) return;
        this._shader.uniforms.u_time.value += dt;

        if (this._didReset) {
            this.lastTrailCameraPosition.copy(this.followed.position);
            this._didReset = false;
            return;
        }

        const distSq = this.lastTrailCameraPosition.distanceToSquared(this.followed.position);
        if (distSq > this.collisionDistance * this.collisionDistance) {
            const distance = Math.sqrt(distSq);
            const steps    = Math.max(1, Math.ceil(0.9 * distance / this.collisionDistance));

            for (let i = 0; i < steps; i++) {
                const t      = (i + 1) / steps;
                const lerpPos = this.tmpVector.lerpVectors(
                    this.lastTrailCameraPosition,
                    this.followed.position,
                    t
                );

                // Spawn slightly behind & around the player's path
                const jitter  = this.collisionDistance * 0.35;
                const particlePosition = this.tmpVector2.set(
                    (Math.random() - 0.5) * jitter * 2,
                    (Math.random() - 0.5) * jitter * 2,
                    -maze.minorWidth * 0.4
                );
                particlePosition.applyQuaternion(this.followed.quaternion);
                particlePosition.add(lerpPos);

                this._spawnParticle(particlePosition);
            }

            // Batch GPU upload once per frame for all newly spawned particles
            this._geometry.attributes.position.needsUpdate  = true;
            this._geometry.attributes.spawnTime.needsUpdate = true;
            this._geometry.attributes.lifeTime.needsUpdate  = true;
            this._geometry.attributes.direction.needsUpdate = true;
            this._geometry.attributes.color.needsUpdate     = true;
            this._geometry.attributes.a_size.needsUpdate    = true;

            this.lastTrailCameraPosition.copy(this.followed.position);
        }
    }

    _spawnParticle(position) {
        const idx = this._nextSpawnIndex;

        this._positions[idx*3+0] = position.x;
        this._positions[idx*3+1] = position.y;
        this._positions[idx*3+2] = position.z;

        this._spawnTime[idx] = this._shader.uniforms.u_time.value;

        // Lifetime: 2.0 – 4.0 s, fading gracefully behind the player
        this._lifeTime[idx] = 2.0 + Math.random() * 2.0;

        // Gentle drift — mostly upward + slight sideways float
        const motion = sampleUniformSphere(_scratchTrailMotion);
        const driftScale = 0.012;
        this._direction[idx*3+0] = motion[0] * driftScale;
        this._direction[idx*3+1] = motion[1] * driftScale * 0.6 + 0.006; // subtle float
        this._direction[idx*3+2] = motion[2] * driftScale * 0.3;

        // World-space orb size: 0.08 to 0.16 units
        this._sizes[idx] = 0.08 + Math.random() * 0.08;

        // Sci-fi palette — cycle through hue buckets with slight jitter
        this._paletteIdx = (this._paletteIdx + 1) % PALETTE_HUES.length;
        const hue = PALETTE_HUES[this._paletteIdx] + (Math.random() - 0.5) * 0.03;
        const sat = 0.90 + Math.random() * 0.10;
        const lig = 0.55 + Math.random() * 0.20;
        this._tmpColor.setHSL(hue, sat, lig);
        this._colors[idx*3+0] = this._tmpColor.r;
        this._colors[idx*3+1] = this._tmpColor.g;
        this._colors[idx*3+2] = this._tmpColor.b;

        this._nextSpawnIndex = (idx + 1) % this.count;
    }

    reset() {
        this._nextSpawnIndex = 0;
        this._didReset       = true;
        this._paletteIdx     = 0;
        for (let i = 0; i < this.count; i++) {
            this._spawnTime[i] = -999;
        }
        this._geometry.attributes.spawnTime.needsUpdate = true;
    }

    dispose() {
        if (this._geometry) { this._geometry.dispose(); this._geometry = null; }
        if (this._material) { this._material.dispose(); this._material = null; }
        if (this.object && this.object.parent) this.object.parent.remove(this.object);
        this.object = null;
    }
}

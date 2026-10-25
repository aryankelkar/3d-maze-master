import * as THREE from 'three';

/**
 * Quantum Warp Gateway & Hyper-Portal
 * Replaces legacy pastel dot particles with a high-tech sci-fi extraction gateway:
 * - Concentric counter-rotating gyro energy rings
 * - Shimmering procedural vortex event horizon
 * - Volumetric exit beacon light beam projecting into space
 * - Orbiting quantum resonator crystals
 * - Micro-ember energy intake vortex
 * - Dynamic dynamic point light illuminating maze corridor walls
 * - Hyperdrive victory supernova & expanding shockwave ring on maze completion
 */
export default class GoalDotEffect {
    constructor(opts = {}) {
        this.opts = Object.assign({
            map: null,
            count: 32,
            sizes: [0.85, 0.45],
            sizesVR: [1.0, 0.55],
        }, opts);

        this._isVR = false;
        this._finished = false;
        this._time = 0;
        this._spinSpeed = 1.0;
        this._targetSpinSpeed = 1.0;
        this._victoryPulse = 0.0;
        this._shockwaveTimer = 0.0;
        this._shockwaveActive = false;

        this.object = new THREE.Group();
        this.object.name = 'QuantumWarpGateway';

        this._disposables = [];

        this._initGateway();
    }

    _track(resource) {
        if (resource) this._disposables.push(resource);
        return resource;
    }

    _initGateway() {
        // 1. Dynamic Portal Point Light (illuminates corridor walls with glowing neon cyan)
        this._portalLight = new THREE.PointLight(0x00f0ff, 3.2, 5.5, 1.2);
        this.object.add(this._portalLight);

        // 2. Outer Resonator Gyro-Ring
        const outerGeom = this._track(new THREE.TorusGeometry(0.85, 0.032, 16, 64));
        const outerMat = this._track(new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x0284c7,
            emissiveIntensity: 0.95,
            metalness: 0.85,
            roughness: 0.2,
        }));
        this._outerRing = new THREE.Mesh(outerGeom, outerMat);
        this.object.add(this._outerRing);

        // 3. Middle Counter-Rotating Gyro-Ring (Tilted on 30-deg axis)
        const midGeom = this._track(new THREE.TorusGeometry(0.66, 0.024, 14, 48));
        const midMat = this._track(new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x00f0ff,
            emissiveIntensity: 1.2,
            metalness: 0.9,
            roughness: 0.15,
        }));
        this._midRing = new THREE.Mesh(midGeom, midMat);
        this._midRing.rotation.x = Math.PI / 6;
        this.object.add(this._midRing);

        // 4. Inner Acceleration Core Ring
        const innerGeom = this._track(new THREE.TorusGeometry(0.48, 0.018, 12, 36));
        const innerMat = this._track(new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: false,
        }));
        this._innerRing = new THREE.Mesh(innerGeom, innerMat);
        this.object.add(this._innerRing);

        // 5. Procedural Event Horizon (Swirling Vortex Disc)
        const vortexGeom = this._track(new THREE.CircleGeometry(0.56, 48));
        this._vortexMat = this._track(new THREE.ShaderMaterial({
            uniforms: {
                u_time:   { value: 0.0 },
                u_active: { value: 0.0 },
            },
            vertexShader: `
                #include <common>
                #include <logdepthbuf_pars_vertex>
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    #include <logdepthbuf_vertex>
                }
            `,
            fragmentShader: `
                #include <common>
                #include <logdepthbuf_pars_fragment>
                uniform float u_time;
                uniform float u_active;
                varying vec2 vUv;

                void main() {
                    vec2 centered = vUv - 0.5;
                    float dist = length(centered) * 2.0;
                    if (dist > 1.0) discard;

                    float angle = atan(centered.y, centered.x);

                    // Spiral energy vortex arms
                    float speed = 2.4 + u_active * 4.5;
                    float spiral1 = sin(angle * 4.0 - u_time * speed + dist * 9.0);
                    float spiral2 = cos(angle * 6.0 + u_time * (speed * 0.75) - dist * 13.0);
                    float spiral = (spiral1 + spiral2) * 0.5;

                    // Outward propagating ripple rings
                    float ripple = sin(dist * 26.0 - u_time * (speed * 1.4)) * 0.5 + 0.5;

                    // Glowing singularity core
                    float core = exp(-dist * 4.2);

                    // Soft edge falloff
                    float edgeAlpha = smoothstep(1.0, 0.72, dist);

                    // Cyber palette: White -> Cyan -> Electric Azure -> Deep Indigo
                    vec3 cCore   = vec3(1.0, 1.0, 1.0);
                    vec3 cCyan   = vec3(0.0, 0.94, 1.0);
                    vec3 cAzure  = vec3(0.22, 0.74, 0.97);
                    vec3 cIndigo = vec3(0.45, 0.35, 0.95);

                    vec3 col = mix(cCore, cCyan, smoothstep(0.0, 0.32, dist));
                    col = mix(col, cAzure, smoothstep(0.32, 0.75, dist));
                    col = mix(col, cIndigo, smoothstep(0.75, 1.0, dist));

                    // Add spiral & ripple energy
                    col += cCyan * (spiral * 0.35 + ripple * 0.22);
                    col += cCore * core * 1.35;

                    if (u_active > 0.0) {
                        col += vec3(0.35, 0.75, 1.0) * u_active * 0.7;
                    }

                    float alpha = (core * 0.95 + (0.58 + spiral * 0.25) * (1.0 - dist * 0.5)) * edgeAlpha;
                    alpha = clamp(alpha, 0.0, 0.96);

                    gl_FragColor = vec4(col, alpha);
                    #include <logdepthbuf_fragment>
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        }));
        this._vortexMesh = new THREE.Mesh(vortexGeom, this._vortexMat);
        this.object.add(this._vortexMesh);

        // 6. Volumetric Exit Beacon Beam (points along +Z into outer space)
        const beamGeom = this._track(new THREE.CylinderGeometry(0.52, 0.88, 3.2, 32, 1, true));
        // Rotate so cylinder points along +Z
        beamGeom.rotateX(Math.PI / 2);
        beamGeom.translate(0, 0, 1.6);

        this._beamMat = this._track(new THREE.ShaderMaterial({
            uniforms: {
                u_time:   { value: 0.0 },
                u_active: { value: 0.0 },
            },
            vertexShader: `
                #include <common>
                #include <logdepthbuf_pars_vertex>
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    #include <logdepthbuf_vertex>
                }
            `,
            fragmentShader: `
                #include <common>
                #include <logdepthbuf_pars_fragment>
                uniform float u_time;
                uniform float u_active;
                varying vec2 vUv;

                void main() {
                    float lengthFade = smoothstep(1.0, 0.05, vUv.y);
                    float baseFade   = smoothstep(0.0, 0.12, vUv.y);

                    float wave = sin(vUv.y * 16.0 - u_time * 5.0) * 0.5 + 0.5;
                    float edge = sin(vUv.x * 3.14159265);

                    vec3 beamColor = mix(vec3(0.0, 0.94, 1.0), vec3(0.22, 0.74, 0.97), vUv.y);
                    float alpha = lengthFade * baseFade * (0.24 + wave * 0.16 + u_active * 0.28) * pow(edge, 1.4);

                    gl_FragColor = vec4(beamColor, clamp(alpha, 0.0, 0.75));
                    #include <logdepthbuf_fragment>
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this._beamMesh = new THREE.Mesh(beamGeom, this._beamMat);
        this.object.add(this._beamMesh);

        // 7. Orbiting Quantum Focus Crystals
        this._crystals = [];
        const crystalGeom = this._track(new THREE.OctahedronGeometry(0.065, 0));
        const crystalMat = this._track(new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x38bdf8,
            emissiveIntensity: 1.5,
            metalness: 0.9,
            roughness: 0.1,
        }));

        for (let i = 0; i < 4; i++) {
            const mesh = new THREE.Mesh(crystalGeom, crystalMat);
            this.object.add(mesh);
            this._crystals.push({
                mesh,
                baseAngle: (i * Math.PI) / 2,
                orbitRadius: 0.92,
                orbitSpeed: 0.8 + i * 0.15,
                bobFreq: 2.2 + i * 0.4,
            });
        }

        // 8. Micro-Ember Energy Particles (intake vortex stream)
        const emberCount = 36;
        this._emberCount = emberCount;
        const emberPositions = new Float32Array(emberCount * 3);
        const emberColors = new Float32Array(emberCount * 3);
        this._emberData = [];

        const colorPalette = [
            new THREE.Color(0x00f0ff),
            new THREE.Color(0x38bdf8),
            new THREE.Color(0xffffff),
            new THREE.Color(0x818cf8),
        ];

        for (let i = 0; i < emberCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 0.35 + Math.random() * 0.55;
            const z = (Math.random() - 0.5) * 0.6;
            emberPositions[i * 3 + 0] = Math.cos(angle) * r;
            emberPositions[i * 3 + 1] = Math.sin(angle) * r;
            emberPositions[i * 3 + 2] = z;

            const c = colorPalette[i % colorPalette.length];
            emberColors[i * 3 + 0] = c.r;
            emberColors[i * 3 + 1] = c.g;
            emberColors[i * 3 + 2] = c.b;

            this._emberData.push({
                angle,
                radius: r,
                z,
                speed: 1.2 + Math.random() * 1.5,
                spiralRate: 0.15 + Math.random() * 0.2,
            });
        }

        const emberGeom = this._track(new THREE.BufferGeometry());
        emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
        emberGeom.setAttribute('color', new THREE.BufferAttribute(emberColors, 3));

        const emberMat = this._track(new THREE.PointsMaterial({
            size: 0.08,
            map: this.opts.map || null,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true,
            opacity: 0.85,
        }));

        this._emberPoints = new THREE.Points(emberGeom, emberMat);
        this.object.add(this._emberPoints);

        // 9. Victory Quantum Shockwave Ring (erupts on maze completion)
        const shockGeom = this._track(new THREE.RingGeometry(0.2, 0.32, 64));
        this._shockMat = this._track(new THREE.ShaderMaterial({
            uniforms: {
                u_opacity: { value: 0.0 },
            },
            vertexShader: `
                #include <common>
                #include <logdepthbuf_pars_vertex>
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    #include <logdepthbuf_vertex>
                }
            `,
            fragmentShader: `
                #include <common>
                #include <logdepthbuf_pars_fragment>
                uniform float u_opacity;
                varying vec2 vUv;

                void main() {
                    float dist = length(vUv - 0.5) * 2.0;
                    float ring = smoothstep(0.55, 0.78, dist) * smoothstep(1.0, 0.82, dist);
                    vec3 col = mix(vec3(0.0, 0.94, 1.0), vec3(1.0, 1.0, 1.0), ring);
                    gl_FragColor = vec4(col, ring * u_opacity);
                    #include <logdepthbuf_fragment>
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this._shockMesh = new THREE.Mesh(shockGeom, this._shockMat);
        this._shockMesh.visible = false;
        this.object.add(this._shockMesh);
    }

    addTo(parent) {
        parent.add(this.object);
    }

    setPosition(pos) {
        this.object.position.copy(pos);
    }

    /**
     * Called when a new maze is created — resets the gateway to its ready state
     */
    randomize() {
        this._finished = false;
        this._time = 0;
        this._spinSpeed = 1.0;
        this._targetSpinSpeed = 1.0;
        this._victoryPulse = 0.0;
        this._shockwaveActive = false;
        this._shockwaveTimer = 0.0;

        if (this._shockMesh) {
            this._shockMesh.visible = false;
            this._shockMesh.scale.set(1, 1, 1);
        }
        if (this._vortexMat) {
            this._vortexMat.uniforms.u_active.value = 0.0;
        }
        if (this._beamMat) {
            this._beamMat.uniforms.u_active.value = 0.0;
        }
        if (this._portalLight) {
            this._portalLight.intensity = 3.2;
            this._portalLight.color.setHex(0x00f0ff);
        }
    }

    /**
     * Called upon reaching the maze exit — activates the hyperdrive quantum jump!
     */
    finish() {
        if (this._finished) return;
        this._finished = true;
        this._targetSpinSpeed = 3.6;
        this._shockwaveActive = true;
        this._shockwaveTimer = 0.0;
        this._victoryPulse = 1.0;

        if (this._shockMesh) {
            this._shockMesh.visible = true;
            this._shockMesh.scale.set(0.5, 0.5, 0.5);
        }
        if (this._portalLight) {
            this._portalLight.intensity = 7.5;
            this._portalLight.color.setHex(0x38bdf8);
        }
    }

    /**
     * Frame-by-frame animation update (60+ FPS, zero heap allocations)
     */
    update(dt) {
        const safeDt = Math.min(dt || 0.016, 0.1);
        this._time += safeDt;

        // Smooth spin acceleration interpolation
        this._spinSpeed += (this._targetSpinSpeed - this._spinSpeed) * Math.min(safeDt * 3.0, 1.0);

        // 1. Gyro-Rings rotations
        if (this._outerRing) {
            this._outerRing.rotation.z += safeDt * 0.9 * this._spinSpeed;
            this._outerRing.rotation.y = Math.sin(this._time * 0.7) * 0.18;
        }
        if (this._midRing) {
            this._midRing.rotation.z -= safeDt * 1.4 * this._spinSpeed;
            this._midRing.rotation.x = Math.PI / 6 + Math.cos(this._time * 0.9) * 0.22;
        }
        if (this._innerRing) {
            this._innerRing.rotation.z += safeDt * 2.8 * this._spinSpeed;
            this._innerRing.rotation.y = Math.sin(this._time * 1.8) * 0.28;
        }

        // 2. Event Horizon Shader
        if (this._vortexMat) {
            this._vortexMat.uniforms.u_time.value = this._time;
            if (this._finished) {
                this._vortexMat.uniforms.u_active.value = 1.0;
            }
        }

        // 3. Volumetric Exit Beacon Beam
        if (this._beamMat) {
            this._beamMat.uniforms.u_time.value = this._time;
            if (this._finished) {
                this._beamMat.uniforms.u_active.value = 1.0;
            }
        }

        // 4. Orbiting Quantum Crystals
        if (this._crystals && this._crystals.length > 0) {
            for (let i = 0; i < this._crystals.length; i++) {
                const c = this._crystals[i];
                const angle = c.baseAngle + this._time * c.orbitSpeed * (this._finished ? 2.2 : 1.0);
                const bob = Math.sin(this._time * c.bobFreq) * 0.12;

                c.mesh.position.set(
                    Math.cos(angle) * c.orbitRadius,
                    Math.sin(angle) * c.orbitRadius,
                    bob
                );
                c.mesh.rotation.x += safeDt * 2.5;
                c.mesh.rotation.y += safeDt * 3.2;
            }
        }

        // 5. Micro-Ember Particles Stream (swirling intake vortex)
        if (this._emberPoints) {
            const posAttr = this._emberPoints.geometry.attributes.position;
            const positions = posAttr.array;

            for (let i = 0; i < this._emberCount; i++) {
                const d = this._emberData[i];
                d.angle += safeDt * d.speed * (this._finished ? 2.5 : 1.0);
                d.radius -= safeDt * d.spiralRate;
                d.z += Math.sin(this._time * 2.0 + i) * 0.002;

                // Respawn at outer edge when sucked into the singularity
                if (d.radius < 0.12) {
                    d.radius = 0.85 + Math.random() * 0.15;
                    d.z = (Math.random() - 0.5) * 0.4;
                }

                positions[i * 3 + 0] = Math.cos(d.angle) * d.radius;
                positions[i * 3 + 1] = Math.sin(d.angle) * d.radius;
                positions[i * 3 + 2] = d.z;
            }
            posAttr.needsUpdate = true;
        }

        // 6. Dynamic Light Breathing Pulse
        if (this._portalLight) {
            if (!this._finished) {
                this._portalLight.intensity = 3.2 + Math.sin(this._time * 2.8) * 0.8;
            } else {
                // Post-victory pulsing extraction beacon
                this._portalLight.intensity = 5.5 + Math.sin(this._time * 4.5) * 1.8;
            }
        }

        // 7. Victory Quantum Shockwave Ring Animation
        if (this._shockwaveActive && this._shockMesh) {
            this._shockwaveTimer += safeDt;
            const progress = this._shockwaveTimer / 1.8; // 1.8s shockwave expansion

            if (progress < 1.0) {
                // Ease-out exponential expansion
                const scale = 0.5 + Math.pow(progress, 0.45) * 7.5;
                this._shockMesh.scale.set(scale, scale, scale);
                const opacity = (1.0 - progress) * 0.9;
                this._shockMat.uniforms.u_opacity.value = opacity;
            } else {
                // Seamlessly trigger repeating subtle harmonic pulses in victory state
                this._shockwaveTimer = 0.0;
            }
        }
    }

    setVR(isVR) {
        this._isVR = isVR;
        const scale = isVR ? 1.15 : 1.0;
        this.object.scale.set(scale, scale, scale);
    }

    dispose() {
        if (this._disposables && this._disposables.length > 0) {
            for (let i = 0; i < this._disposables.length; i++) {
                const item = this._disposables[i];
                if (item && item.dispose) {
                    try { item.dispose(); } catch (_) {}
                }
            }
            this._disposables = [];
        }
        if (this.object && this.object.parent) {
            this.object.parent.remove(this.object);
        }
        this.object = null;
    }
}

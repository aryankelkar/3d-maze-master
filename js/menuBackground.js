import * as THREE from 'three';

/**
 * MenuBackground - AAA Sci-Fi Quantum Sector Labyrinth Start Menu Environment
 * 
 * Living 3D cubic maze environment in the background of the start menu:
 * - Positioned in the camera's natural forward field-of-view (-Z direction)
 * - Concentrated on the center-right and far-right to frame the left menu card
 * - Receding 3D maze corridor with illuminated floor runners and rectangular wall panels
 * - Glowing quantum gateway with cyan perimeter illumination and atmospheric blue aura
 * - Suspended floating cubic fragments and platforms with independent gentle bobbing
 * - Illuminated navigation path lines with traveling energy pulses
 * - Deep-space atmospheric lighting and floating quantum particles
 * - High performance: instanced rendering, shared geometries/materials, delta-time animation
 */
export default class MenuBackground {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'MenuBackgroundGroup';

        // Accessibility preference
        this.reducedMotion = false;
        try {
            if (typeof window !== 'undefined' && window.matchMedia) {
                this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            }
        } catch (_) {}

        this.elapsedTime = 0;
        this.floatingFragments = [];
        this.rotatingStructures = [];

        this.geometries = [];
        this.materials = [];

        this.initMaterials();
        this.setupLighting();
        this.buildCorridor();
        this.buildGateway();
        this.buildFloatingStructures();
        this.buildFloatingFragments();
        this.buildNavigationPaths();
        this.buildAtmosphericParticles();
    }

    trackGeo(geo) {
        this.geometries.push(geo);
        return geo;
    }

    trackMat(mat) {
        this.materials.push(mat);
        return mat;
    }

    initMaterials() {
        // Sophisticated Sci-Fi Materials: Obsidian, Brushed Titanium, Champagne Gold & Ice Teal
        // Metal Hull: Deep graphite with brushed titanium reflection
        this.metalHullMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0x111A25,
            roughness: 0.38,
            metalness: 0.55,
            flatShading: false
        }));

        // Frame structure: Titanium alloy
        this.frameMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0x263342,
            roughness: 0.32,
            metalness: 0.65
        }));

        // Surface plates: Elevated graphite surface
        this.plateMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0x17212D,
            roughness: 0.42,
            metalness: 0.45
        }));

        // Restrained Ice Teal Emissive
        this.cyanEmissiveMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0x79C9D4,
            emissive: 0x54B9C6,
            emissiveIntensity: 1.8,
            roughness: 0.25,
            metalness: 0.15
        }));

        this.iceBlueEmissiveMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0x79C9D4,
            emissive: 0x79C9D4,
            emissiveIntensity: 1.4,
            roughness: 0.25,
            metalness: 0.15
        }));

        // Champagne Gold Emissive for Gateway Arch & Accents
        this.violetEmissiveMat = this.trackMat(new THREE.MeshStandardMaterial({
            color: 0xD6B875,
            emissive: 0xD6B875,
            emissiveIntensity: 1.5,
            roughness: 0.3,
            metalness: 0.4
        }));

        // Line materials for LineSegments (LineBasicMaterial)
        this.cyanLineMat = this.trackMat(new THREE.LineBasicMaterial({
            color: 0x79C9D4,
            transparent: true,
            opacity: 0.88
        }));

        this.iceLineMat = this.trackMat(new THREE.LineBasicMaterial({
            color: 0x54B9C6,
            transparent: true,
            opacity: 0.82
        }));

        this.violetLineMat = this.trackMat(new THREE.LineBasicMaterial({
            color: 0xD6B875,
            transparent: true,
            opacity: 0.75
        }));

        // Portal interior void & aura
        this.portalVoidMat = this.trackMat(new THREE.MeshBasicMaterial({
            color: 0x05070B
        }));

        this.portalAuraMat = this.trackMat(new THREE.MeshBasicMaterial({
            color: 0x79C9D4,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide
        }));
    }

    setupLighting() {
        const lightsGroup = new THREE.Group();
        lightsGroup.name = 'BackgroundLights';

        // Deep graphite ambient fill
        const ambLight = new THREE.AmbientLight(0x111A25, 1.6);
        lightsGroup.add(ambLight);

        // Warm platinum directional key light
        const keyLight = new THREE.DirectionalLight(0xF1F0EA, 2.2);
        keyLight.position.set(4, 8, 2);
        lightsGroup.add(keyLight);

        // Subtle champagne gold rim light for cinematic depth
        const rimLight = new THREE.DirectionalLight(0xD6B875, 1.2);
        rimLight.position.set(12, 6, -18);
        lightsGroup.add(rimLight);

        // Point light at the gateway: Restrained ice teal illumination
        this.gatewayLight = new THREE.PointLight(0x79C9D4, 4.5, 18, 1.2);
        this.gatewayLight.position.set(3.2, 1.2, -6.0);
        lightsGroup.add(this.gatewayLight);

        // Point light down the corridor (ice-teal illumination to highlight corridor frames and metallic panels)
        const corridorLight = new THREE.PointLight(0x54B9C6, 3.2, 22, 1.2);
        corridorLight.position.set(4.5, 1.6, -10.0);
        lightsGroup.add(corridorLight);

        this.group.add(lightsGroup);
    }

    /**
     * Receding 3D Maze Corridor (Recedes towards -Z)
     */
    buildCorridor() {
        const corridorGroup = new THREE.Group();
        corridorGroup.name = 'RecedingCorridor';

        const numSegments = 10;
        const segmentSpacing = 2.4;
        const corridorWidth = 2.4;
        const corridorHeight = 2.4;
        const beamThickness = 0.12;

        const ribGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));
        const floorPanelGeo = this.trackGeo(new THREE.BoxGeometry(corridorWidth * 0.44, 0.06, segmentSpacing * 0.85));
        const wallPanelGeo = this.trackGeo(new THREE.BoxGeometry(0.06, corridorHeight * 0.45, segmentSpacing * 0.75));
        const markerGeo = this.trackGeo(new THREE.BoxGeometry(0.12, 0.05, 0.3));

        const corridorNodes = [];
        for (let i = 0; i < numSegments; i++) {
            const t = i / (numSegments - 1);
            const z = -5.0 - i * segmentSpacing; // Recedes towards -Z in front of camera
            const x = 3.2 + Math.sin(t * 1.5) * 1.2 + t * 2.0;
            const y = 0.2 + Math.cos(t * 1.2) * 0.4 - t * 0.3;
            corridorNodes.push(new THREE.Vector3(x, y, z));
        }

        const ribInstances = [];
        const floorInstances = [];
        const wallInstances = [];
        const markerInstances = [];

        const dummy = new THREE.Object3D();

        for (let i = 0; i < numSegments; i++) {
            const pos = corridorNodes[i];

            // 1. Rib frame (columns and cross-beams)
            // Left column
            dummy.position.set(pos.x - corridorWidth / 2, pos.y + corridorHeight / 2, pos.z);
            dummy.scale.set(beamThickness, corridorHeight, beamThickness);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            ribInstances.push(dummy.matrix.clone());

            // Right column
            dummy.position.set(pos.x + corridorWidth / 2, pos.y + corridorHeight / 2, pos.z);
            dummy.scale.set(beamThickness, corridorHeight, beamThickness);
            dummy.updateMatrix();
            ribInstances.push(dummy.matrix.clone());

            // Bottom beam
            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.scale.set(corridorWidth, beamThickness, beamThickness);
            dummy.updateMatrix();
            ribInstances.push(dummy.matrix.clone());

            // Top beam
            dummy.position.set(pos.x, pos.y + corridorHeight, pos.z);
            dummy.scale.set(corridorWidth, beamThickness, beamThickness);
            dummy.updateMatrix();
            ribInstances.push(dummy.matrix.clone());

            // 2. Floor panels
            dummy.position.set(pos.x - corridorWidth * 0.22, pos.y + 0.03, pos.z - segmentSpacing * 0.4);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            floorInstances.push(dummy.matrix.clone());

            dummy.position.set(pos.x + corridorWidth * 0.22, pos.y + 0.03, pos.z - segmentSpacing * 0.4);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            floorInstances.push(dummy.matrix.clone());

            // 3. Wall panels with doorway openings
            if (i % 2 === 0) {
                dummy.position.set(pos.x + corridorWidth / 2, pos.y + corridorHeight * 0.72, pos.z - segmentSpacing * 0.45);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                wallInstances.push(dummy.matrix.clone());
            } else {
                dummy.position.set(pos.x - corridorWidth / 2, pos.y + corridorHeight * 0.5, pos.z - segmentSpacing * 0.45);
                dummy.scale.set(1, 1.8, 1);
                dummy.updateMatrix();
                wallInstances.push(dummy.matrix.clone());
            }

            // 4. Cyan floor markers
            dummy.position.set(pos.x - corridorWidth * 0.42, pos.y + 0.05, pos.z);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            markerInstances.push(dummy.matrix.clone());

            dummy.position.set(pos.x + corridorWidth * 0.42, pos.y + 0.05, pos.z);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            markerInstances.push(dummy.matrix.clone());
        }

        // Instanced meshes with instanceMatrix.needsUpdate = true
        const ribMesh = new THREE.InstancedMesh(ribGeo, this.frameMat, ribInstances.length);
        ribInstances.forEach((mat, idx) => ribMesh.setMatrixAt(idx, mat));
        ribMesh.instanceMatrix.needsUpdate = true;
        corridorGroup.add(ribMesh);

        const floorMesh = new THREE.InstancedMesh(floorPanelGeo, this.plateMat, floorInstances.length);
        floorInstances.forEach((mat, idx) => floorMesh.setMatrixAt(idx, mat));
        floorMesh.instanceMatrix.needsUpdate = true;
        corridorGroup.add(floorMesh);

        const wallMesh = new THREE.InstancedMesh(wallPanelGeo, this.metalHullMat, wallInstances.length);
        wallInstances.forEach((mat, idx) => wallMesh.setMatrixAt(idx, mat));
        wallMesh.instanceMatrix.needsUpdate = true;
        corridorGroup.add(wallMesh);

        const markerMesh = new THREE.InstancedMesh(markerGeo, this.cyanEmissiveMat, markerInstances.length);
        markerInstances.forEach((mat, idx) => markerMesh.setMatrixAt(idx, mat));
        markerMesh.instanceMatrix.needsUpdate = true;
        corridorGroup.add(markerMesh);

        // Corridor edge accent line stringers
        const edgePositions = [];
        for (let i = 0; i < corridorNodes.length - 1; i++) {
            const p1 = corridorNodes[i];
            const p2 = corridorNodes[i + 1];
            edgePositions.push(p1.x - corridorWidth / 2, p1.y, p1.z, p2.x - corridorWidth / 2, p2.y, p2.z);
            edgePositions.push(p1.x + corridorWidth / 2, p1.y, p1.z, p2.x + corridorWidth / 2, p2.y, p2.z);
            edgePositions.push(p1.x + corridorWidth / 2, p1.y + corridorHeight, p1.z, p2.x + corridorWidth / 2, p2.y + corridorHeight, p2.z);
        }
        const edgeGeo = this.trackGeo(new THREE.BufferGeometry());
        edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
        const edgeLines = new THREE.LineSegments(edgeGeo, this.cyanLineMat);
        corridorGroup.add(edgeLines);

        this.corridorNodes = corridorNodes;
        this.group.add(corridorGroup);
    }

    /**
     * Glowing Quantum Gateway (Center-Right Focal Point at Z = -6.0)
     */
    buildGateway() {
        const gatewayGroup = new THREE.Group();
        gatewayGroup.name = 'QuantumGateway';
        gatewayGroup.position.set(3.2, 0.2, -6.0);

        const portalWidth = 2.6;
        const portalHeight = 2.6;
        const frameDepth = 0.5;
        const frameBevel = 0.18;

        const pillarGeo = this.trackGeo(new THREE.BoxGeometry(frameBevel, portalHeight + frameBevel, frameDepth));
        const headerGeo = this.trackGeo(new THREE.BoxGeometry(portalWidth + frameBevel * 2, frameBevel, frameDepth));

        // Pillars
        const leftPillar = new THREE.Mesh(pillarGeo, this.frameMat);
        leftPillar.position.set(-portalWidth / 2 - frameBevel / 2, (portalHeight + frameBevel) / 2, 0);
        gatewayGroup.add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeo, this.frameMat);
        rightPillar.position.set(portalWidth / 2 + frameBevel / 2, (portalHeight + frameBevel) / 2, 0);
        gatewayGroup.add(rightPillar);

        // Header & base
        const headerBeam = new THREE.Mesh(headerGeo, this.frameMat);
        headerBeam.position.set(0, portalHeight + frameBevel / 2, 0);
        gatewayGroup.add(headerBeam);

        const baseBeam = new THREE.Mesh(headerGeo, this.plateMat);
        baseBeam.position.set(0, frameBevel / 2, 0);
        gatewayGroup.add(baseBeam);

        // Edge highlights on gateway pillars
        const pillarEdgesGeo = this.trackGeo(new THREE.EdgesGeometry(pillarGeo));
        const headerEdgesGeo = this.trackGeo(new THREE.EdgesGeometry(headerGeo));

        const lpEdge = new THREE.LineSegments(pillarEdgesGeo, this.cyanLineMat);
        leftPillar.add(lpEdge);
        const rpEdge = new THREE.LineSegments(pillarEdgesGeo, this.cyanLineMat);
        rightPillar.add(rpEdge);
        const hbEdge = new THREE.LineSegments(headerEdgesGeo, this.cyanLineMat);
        headerBeam.add(hbEdge);

        // Glowing cyan aperture loop
        const glowPoints = [
            -portalWidth / 2, frameBevel, frameDepth / 2 + 0.02,
            portalWidth / 2, frameBevel, frameDepth / 2 + 0.02,
            portalWidth / 2, frameBevel, frameDepth / 2 + 0.02,
            portalWidth / 2, portalHeight, frameDepth / 2 + 0.02,
            portalWidth / 2, portalHeight, frameDepth / 2 + 0.02,
            -portalWidth / 2, portalHeight, frameDepth / 2 + 0.02,
            -portalWidth / 2, portalHeight, frameDepth / 2 + 0.02,
            -portalWidth / 2, frameBevel, frameDepth / 2 + 0.02
        ];
        const loopGeo = this.trackGeo(new THREE.BufferGeometry());
        loopGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPoints, 3));
        const loopLine = new THREE.LineSegments(loopGeo, this.cyanLineMat);
        gatewayGroup.add(loopLine);

        // Dark portal interior plane
        const portalVoidGeo = this.trackGeo(new THREE.PlaneGeometry(portalWidth - 0.06, portalHeight - frameBevel));
        const portalVoidMesh = new THREE.Mesh(portalVoidGeo, this.portalVoidMat);
        portalVoidMesh.position.set(0, portalHeight / 2 + frameBevel / 2, -frameDepth * 0.3);
        gatewayGroup.add(portalVoidMesh);

        // Translucent energetic aura
        const auraGeo = this.trackGeo(new THREE.PlaneGeometry(portalWidth * 0.94, portalHeight * 0.88));
        const auraMesh = new THREE.Mesh(auraGeo, this.portalAuraMat);
        auraMesh.position.set(0, portalHeight / 2 + frameBevel / 2, -frameDepth * 0.15);
        gatewayGroup.add(auraMesh);

        this.gatewayGroup = gatewayGroup;
        this.group.add(gatewayGroup);
    }

    /**
     * Floating Cubic Maze Structures (Placed in -Z)
     */
    buildFloatingStructures() {
        const structuresGroup = new THREE.Group();
        structuresGroup.name = 'FloatingStructures';

        const platformGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));
        const platformEdges = this.trackGeo(new THREE.EdgesGeometry(platformGeo));

        // Cluster Alpha: Midground Far-Right Sector Hub
        const clusterA = new THREE.Group();
        clusterA.position.set(6.8, 1.8, -12.0);

        const deckA = new THREE.Mesh(platformGeo, this.metalHullMat);
        deckA.scale.set(4.5, 0.25, 4.5);
        clusterA.add(deckA);
        const deckAEdges = new THREE.LineSegments(platformEdges, this.cyanLineMat);
        deckA.add(deckAEdges);

        const corridorA1 = new THREE.Mesh(platformGeo, this.frameMat);
        corridorA1.scale.set(1.4, 2.2, 4.2);
        corridorA1.position.set(-1.2, 1.1, 0);
        clusterA.add(corridorA1);
        const c1Edges = new THREE.LineSegments(platformEdges, this.iceLineMat);
        corridorA1.add(c1Edges);

        const corridorA2 = new THREE.Mesh(platformGeo, this.plateMat);
        corridorA2.scale.set(4.2, 2.2, 1.4);
        corridorA2.position.set(0, 1.1, 1.2);
        clusterA.add(corridorA2);
        const c2Edges = new THREE.LineSegments(platformEdges, this.cyanLineMat);
        corridorA2.add(c2Edges);

        // Upper platform
        const upperDeck = new THREE.Mesh(platformGeo, this.metalHullMat);
        upperDeck.scale.set(2.8, 0.2, 2.8);
        upperDeck.position.set(0.4, 2.5, -0.4);
        clusterA.add(upperDeck);
        const udEdges = new THREE.LineSegments(platformEdges, this.cyanLineMat);
        upperDeck.add(udEdges);

        structuresGroup.add(clusterA);
        this.rotatingStructures.push({
            group: clusterA,
            rotSpeedY: 0.015,
            initialRotY: 0.35
        });

        // Cluster Beta: Distant Superstructure
        const clusterB = new THREE.Group();
        clusterB.position.set(6.0, 4.5, -28.0);

        const megaDeck = new THREE.Mesh(platformGeo, this.metalHullMat);
        megaDeck.scale.set(8.5, 0.6, 8.5);
        clusterB.add(megaDeck);
        const mdEdges = new THREE.LineSegments(platformEdges, this.violetLineMat);
        megaDeck.add(mdEdges);

        for (let i = -1; i <= 1; i++) {
            const tower = new THREE.Mesh(platformGeo, this.plateMat);
            tower.scale.set(1.8, 5.5, 1.8);
            tower.position.set(i * 2.8, 2.8, 0);
            clusterB.add(tower);
            const tEdges = new THREE.LineSegments(platformEdges, this.iceLineMat);
            tower.add(tEdges);
        }

        structuresGroup.add(clusterB);
        this.rotatingStructures.push({
            group: clusterB,
            rotSpeedY: 0.008,
            initialRotY: -0.3
        });

        // Foreground Far-Right Framing Column
        const fgColumn = new THREE.Mesh(platformGeo, this.frameMat);
        fgColumn.scale.set(0.4, 3.8, 0.4);
        fgColumn.position.set(4.2, 0.8, -2.5);
        fgColumn.rotation.y = -0.3;
        const fgEdges = new THREE.LineSegments(platformEdges, this.cyanLineMat);
        fgColumn.add(fgEdges);
        structuresGroup.add(fgColumn);

        this.group.add(structuresGroup);
    }

    /**
     * Floating Maze Fragments (Placed in -Z)
     */
    buildFloatingFragments() {
        const fragmentsGroup = new THREE.Group();
        fragmentsGroup.name = 'FloatingFragments';

        const fragmentData = [
            { pos: [2.2, 2.2, -6.5], scale: [0.9, 0.12, 0.9], rot: [0.1, 0.2, -0.05], bobSpeed: 1.1, bobAmp: 0.08 },
            { pos: [4.8, 2.8, -8.5], scale: [1.3, 0.15, 1.3], rot: [-0.15, 0.4, 0.1], bobSpeed: 0.85, bobAmp: 0.11 },
            { pos: [3.6, -0.8, -7.0], scale: [1.2, 0.18, 1.6], rot: [0.05, -0.3, 0.08], bobSpeed: 1.3, bobAmp: 0.09 },
            { pos: [5.6, -0.4, -11.5], scale: [0.8, 1.5, 0.14], rot: [0.2, 0.5, 0.0], bobSpeed: 0.95, bobAmp: 0.10 },
            { pos: [2.4, -0.7, -4.5], scale: [0.65, 0.08, 0.65], rot: [-0.1, 0.15, 0.12], bobSpeed: 1.4, bobAmp: 0.07 },
            { pos: [6.2, 1.2, -18.0], scale: [2.0, 0.22, 2.0], rot: [0.05, -0.2, 0.0], bobSpeed: 0.7, bobAmp: 0.13 }
        ];

        const boxGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));
        const edgesGeo = this.trackGeo(new THREE.EdgesGeometry(boxGeo));

        fragmentData.forEach((data, index) => {
            const fragMesh = new THREE.Mesh(boxGeo, this.metalHullMat);
            fragMesh.scale.set(...data.scale);
            fragMesh.position.set(...data.pos);
            fragMesh.rotation.set(...data.rot);

            const edgeLine = new THREE.LineSegments(
                edgesGeo,
                index % 2 === 0 ? this.cyanLineMat : this.iceLineMat
            );
            fragMesh.add(edgeLine);

            fragmentsGroup.add(fragMesh);

            this.floatingFragments.push({
                mesh: fragMesh,
                baseY: data.pos[1],
                bobSpeed: data.bobSpeed,
                bobAmp: data.bobAmp,
                rotYBase: data.rot[1],
                rotYRate: (index % 2 === 0 ? 1 : -1) * 0.08,
                phase: index * 1.3
            });
        });

        this.group.add(fragmentsGroup);
    }

    /**
     * Navigation Paths (Traced in -Z)
     */
    buildNavigationPaths() {
        const pathsGroup = new THREE.Group();
        pathsGroup.name = 'NavigationPaths';

        const pathPoints1 = [
            new THREE.Vector3(3.2, 0.25, -6.0),
            new THREE.Vector3(3.2, 2.75, -6.0),
            new THREE.Vector3(3.8, 2.75, -8.0),
            new THREE.Vector3(4.2, 1.4, -10.5),
            new THREE.Vector3(5.2, 1.4, -13.0),
            new THREE.Vector3(6.8, 1.8, -13.0)
        ];

        const lineGeo1 = this.trackGeo(new THREE.BufferGeometry().setFromPoints(pathPoints1));
        const pathLine1 = new THREE.Line(lineGeo1, this.cyanLineMat);
        pathsGroup.add(pathLine1);

        // Traveling energy pulse beacon
        const pulseGeo = this.trackGeo(new THREE.SphereGeometry(0.08, 8, 8));
        this.pulseBeacon1 = new THREE.Mesh(pulseGeo, this.cyanEmissiveMat);
        pathsGroup.add(this.pulseBeacon1);

        this.pathCurve1 = new THREE.CatmullRomCurve3(pathPoints1);

        this.group.add(pathsGroup);
    }

    /**
     * Atmospheric Quantum Dust Particles (Drifting in -Z)
     */
    buildAtmosphericParticles() {
        const particleCount = 120;
        const pGeo = this.trackGeo(new THREE.BufferGeometry());
        const positions = new Float32Array(particleCount * 3);
        const pColors = new Float32Array(particleCount * 3);

        const tealColor = new THREE.Color(0x79C9D4);
        const goldColor = new THREE.Color(0xD6B875);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 0] = 1.8 + Math.random() * 6.5;
            positions[i * 3 + 1] = -1.2 + Math.random() * 4.5;
            positions[i * 3 + 2] = -3.0 - Math.random() * 18.0; // In front of camera in -Z

            const col = i % 4 === 0 ? goldColor : tealColor;
            pColors[i * 3 + 0] = col.r;
            pColors[i * 3 + 1] = col.g;
            pColors[i * 3 + 2] = col.b;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

        this.particleMat = this.trackMat(new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));

        this.particleSystem = new THREE.Points(pGeo, this.particleMat);
        this.group.add(this.particleSystem);
    }

    /**
     * Frame Animation Update
     */
    update(delta, timeSec) {
        if (!this.group.visible) return;

        this.elapsedTime += delta;
        const t = this.elapsedTime;
        const motionMult = this.reducedMotion ? 0.2 : 1.0;

        // Rotate structures
        this.rotatingStructures.forEach(item => {
            if (item.rotSpeedY) {
                item.group.rotation.y = item.initialRotY + t * item.rotSpeedY * motionMult;
            }
        });

        // Floating fragment bobbing
        this.floatingFragments.forEach(frag => {
            const bob = Math.sin(t * frag.bobSpeed * motionMult + frag.phase) * frag.bobAmp;
            frag.mesh.position.y = frag.baseY + bob;
            frag.mesh.rotation.y = frag.rotYBase + t * frag.rotYRate * motionMult;
        });

        // Gateway illumination pulse
        if (this.gatewayLight) {
            this.gatewayLight.intensity = 3.5 + Math.sin(t * 2.0) * 0.9;
            if (this.portalAuraMat) {
                this.portalAuraMat.opacity = 0.28 + Math.sin(t * 2.0) * 0.12;
            }
        }

        // Navigation beacon pulse
        if (this.pathCurve1 && this.pulseBeacon1) {
            const u = (t * 0.15) % 1.0;
            this.pathCurve1.getPointAt(u, this.pulseBeacon1.position);
        }

        // Particle drift
        if (this.particleSystem && !this.reducedMotion) {
            const posAttr = this.particleSystem.geometry.attributes.position;
            const arr = posAttr.array;
            const count = arr.length / 3;
            for (let i = 0; i < count; i++) {
                arr[i * 3 + 1] += delta * 0.05;
                if (arr[i * 3 + 1] > 3.8) {
                    arr[i * 3 + 1] = -1.2;
                }
            }
            posAttr.needsUpdate = true;
        }
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose() {
        this.geometries.forEach(geo => geo.dispose());
        this.materials.forEach(mat => mat.dispose());
        this.geometries = [];
        this.materials = [];
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }
}

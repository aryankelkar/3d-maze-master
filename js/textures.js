import * as THREE from 'three';

/**
 * Procedural texture generator for 3D Maze Sci-Fi / Cyberpunk theme.
 * Generates seamless high-resolution diffuse and bump maps for walls and frame pillars.
 */

function generateWallUVs(geometry) {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        let nx = 0, ny = 1, nz = 0;
        if (norm) {
            nx = Math.abs(norm.getX(i));
            ny = Math.abs(norm.getY(i));
            nz = Math.abs(norm.getZ(i));
        }

        if (ny >= 0.5) {
            // Main broad face (X-Z plane)
            uvs[i * 2 + 0] = x + 0.5;
            uvs[i * 2 + 1] = z + 0.5;
        } else if (nx > nz) {
            // Cutout rim / side edge along X
            uvs[i * 2 + 0] = z + 0.5;
            uvs[i * 2 + 1] = (y + 0.5) * 4;
        } else {
            // Cutout rim / side edge along Z
            uvs[i * 2 + 0] = x + 0.5;
            uvs[i * 2 + 1] = (y + 0.5) * 4;
        }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function drawHexBolt(ctx, x, y, radius, isBump = false) {
    ctx.save();
    // Recessed dark socket
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = isBump ? '#202020' : '#181a20';
    ctx.fill();

    // Hex head
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 * Math.PI) / 180;
        const hx = x + Math.cos(angle) * radius;
        const hy = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = isBump ? '#f0f0f0' : '#d4d4d8';
    ctx.fill();

    // Highlight glint
    if (!isBump) {
        ctx.beginPath();
        ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fill();
    }
    ctx.restore();
}

function createSciFiWallDiffuseTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 1. Base metallic gradient plate
    const baseGrad = ctx.createLinearGradient(0, 0, size, size);
    baseGrad.addColorStop(0, '#c7cbd2');
    baseGrad.addColorStop(0.5, '#e2e5eb');
    baseGrad.addColorStop(1, '#b4b9c3');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Micro brushed-metal noise streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 800; i++) {
        const y = Math.random() * size;
        const h = 1 + Math.random() * 2;
        ctx.fillRect(0, y, size, h);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
    for (let i = 0; i < 600; i++) {
        const y = Math.random() * size;
        const h = 1 + Math.random() * 2;
        ctx.fillRect(0, y, size, h);
    }

    // 3. 3x3 Sub-panels with chamfered bevels
    const third = size / 3;
    const margin = 14;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const px = c * third + margin;
            const py = r * third + margin;
            const pw = third - margin * 2;
            const ph = third - margin * 2;
            const chamfer = 16;

            // Plate shadow
            ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
            ctx.beginPath();
            ctx.moveTo(px + chamfer, py);
            ctx.lineTo(px + pw - chamfer, py);
            ctx.lineTo(px + pw, py + chamfer);
            ctx.lineTo(px + pw, py + ph - chamfer);
            ctx.lineTo(px + pw - chamfer, py + ph);
            ctx.lineTo(px + chamfer, py + ph);
            ctx.lineTo(px, py + ph - chamfer);
            ctx.lineTo(px, py + chamfer);
            ctx.closePath();
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#1e293b';
            ctx.stroke();

            // Plate surface gradient
            const pGrad = ctx.createRadialGradient(px + pw / 2, py + ph / 2, 20, px + pw / 2, py + ph / 2, pw);
            pGrad.addColorStop(0, '#f1f5f9');
            pGrad.addColorStop(0.7, '#cbd5e1');
            pGrad.addColorStop(1, '#94a3b8');
            ctx.fillStyle = pGrad;
            ctx.fill();

            // Plate inner bevel highlight (top-left)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(px + chamfer + 2, py + 3);
            ctx.lineTo(px + pw - chamfer - 2, py + 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px + 3, py + chamfer + 2);
            ctx.lineTo(px + 3, py + ph - chamfer - 2);
            ctx.stroke();

            // Plate inner bevel shadow (bottom-right)
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
            ctx.beginPath();
            ctx.moveTo(px + chamfer, py + ph - 3);
            ctx.lineTo(px + pw - chamfer, py + ph - 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px + pw - 3, py + chamfer);
            ctx.lineTo(px + pw - 3, py + ph - chamfer);
            ctx.stroke();

            // Corner rivets in each sub-panel
            const boltOffset = 24;
            drawHexBolt(ctx, px + boltOffset, py + boltOffset, 4.5);
            drawHexBolt(ctx, px + pw - boltOffset, py + boltOffset, 4.5);
            drawHexBolt(ctx, px + boltOffset, py + ph - boltOffset, 4.5);
            drawHexBolt(ctx, px + pw - boltOffset, py + ph - boltOffset, 4.5);

            // Tech corner brackets / notches
            ctx.fillStyle = '#475569';
            const bLen = 14;
            ctx.fillRect(px + chamfer, py + 4, bLen, 3);
            ctx.fillRect(px + 4, py + chamfer, 3, bLen);
            ctx.fillRect(px + pw - chamfer - bLen, py + 4, bLen, 3);
            ctx.fillRect(px + pw - 7, py + chamfer, 3, bLen);
        }
    }

    // 4. Main grid seam channels
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(third, 0); ctx.lineTo(third, size);
    ctx.moveTo(third * 2, 0); ctx.lineTo(third * 2, size);
    ctx.moveTo(0, third); ctx.lineTo(size, third);
    ctx.moveTo(0, third * 2); ctx.lineTo(size, third * 2);
    ctx.stroke();

    // 5. High-tech glowing conduits & circuit traces
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    // Center cross circuit lines
    const mid = size / 2;
    ctx.beginPath();
    ctx.moveTo(mid - 120, mid);
    ctx.lineTo(mid - 40, mid);
    ctx.lineTo(mid - 20, mid - 20);
    ctx.lineTo(mid + 20, mid - 20);
    ctx.lineTo(mid + 40, mid);
    ctx.lineTo(mid + 120, mid);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mid, mid - 120);
    ctx.lineTo(mid, mid - 40);
    ctx.lineTo(mid + 20, mid - 20);
    ctx.lineTo(mid + 20, mid + 20);
    ctx.lineTo(mid, mid + 40);
    ctx.lineTo(mid, mid + 120);
    ctx.stroke();

    // Circuit glowing nodes
    ctx.fillStyle = '#38bdf8';
    [
        [mid - 120, mid], [mid + 120, mid],
        [mid, mid - 120], [mid, mid + 120],
        [mid - 20, mid - 20], [mid + 20, mid - 20]
    ].forEach(([nx, ny]) => {
        ctx.beginPath();
        ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0; // reset shadow

    // 6. Technical stencils and decal markings
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('SECTOR-3D // AIRLOCK', 36, third - 22);
    ctx.fillText('MODULAR-PANEL-MK4', third + 36, third - 22);
    ctx.fillText('SYS-NAV // GRID-XYZ', third * 2 + 36, third - 22);

    // Hazard warning stripes in corner tabs
    const hazardWidth = 50;
    const hazardHeight = 12;
    const drawHazard = (hx, hy) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(hx, hy, hazardWidth, hazardHeight);
        ctx.clip();
        ctx.fillStyle = '#eab308';
        ctx.fillRect(hx, hy, hazardWidth, hazardHeight);
        ctx.fillStyle = '#1e293b';
        for (let s = -hazardHeight; s < hazardWidth + hazardHeight; s += 10) {
            ctx.beginPath();
            ctx.moveTo(hx + s, hy);
            ctx.lineTo(hx + s + 6, hy);
            ctx.lineTo(hx + s - 2, hy + hazardHeight);
            ctx.lineTo(hx + s - 8, hy + hazardHeight);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    };
    drawHazard(third - 70, third * 2 + 18);
    drawHazard(third * 2 + 20, third + 18);

    // 7. Outer perimeter reinforcement border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
}

function createSciFiWallBumpTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Neutral height base
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    const third = size / 3;
    const margin = 14;

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const px = c * third + margin;
            const py = r * third + margin;
            const pw = third - margin * 2;
            const ph = third - margin * 2;
            const chamfer = 16;

            // Recessed gap
            ctx.fillStyle = '#202020';
            ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);

            // Raised plate surface
            ctx.fillStyle = '#b0b0b0';
            ctx.beginPath();
            ctx.moveTo(px + chamfer, py);
            ctx.lineTo(px + pw - chamfer, py);
            ctx.lineTo(px + pw, py + chamfer);
            ctx.lineTo(px + pw, py + ph - chamfer);
            ctx.lineTo(px + pw - chamfer, py + ph);
            ctx.lineTo(px + chamfer, py + ph);
            ctx.lineTo(px, py + ph - chamfer);
            ctx.lineTo(px, py + chamfer);
            ctx.closePath();
            ctx.fill();

            // Plate bevel highlights (bright) and shadows (dark)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(px + chamfer, py + 2);
            ctx.lineTo(px + pw - chamfer, py + 2);
            ctx.moveTo(px + 2, py + chamfer);
            ctx.lineTo(px + 2, py + ph - chamfer);
            ctx.stroke();

            ctx.strokeStyle = '#303030';
            ctx.beginPath();
            ctx.moveTo(px + chamfer, py + ph - 2);
            ctx.lineTo(px + pw - chamfer, py + ph - 2);
            ctx.moveTo(px + pw - 2, py + chamfer);
            ctx.lineTo(px + pw - 2, py + ph - chamfer);
            ctx.stroke();

            // Rivet bumps
            const boltOffset = 24;
            drawHexBolt(ctx, px + boltOffset, py + boltOffset, 4.5, true);
            drawHexBolt(ctx, px + pw - boltOffset, py + boltOffset, 4.5, true);
            drawHexBolt(ctx, px + boltOffset, py + ph - boltOffset, 4.5, true);
            drawHexBolt(ctx, px + pw - boltOffset, py + ph - boltOffset, 4.5, true);
        }
    }

    // Seams (deep valleys)
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#101010';
    ctx.beginPath();
    ctx.moveTo(third, 0); ctx.lineTo(third, size);
    ctx.moveTo(third * 2, 0); ctx.lineTo(third * 2, size);
    ctx.moveTo(0, third); ctx.lineTo(size, third);
    ctx.moveTo(0, third * 2); ctx.lineTo(size, third * 2);
    ctx.stroke();

    // Outer border ridge
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#202020';
    ctx.strokeRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
}

function createSciFiPillarDiffuseTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Dark gunmetal base
    ctx.fillStyle = '#181b22';
    ctx.fillRect(0, 0, size, size);

    // High-tech carbon micro-weave pattern
    const cellSize = 16;
    for (let y = 0; y < size; y += cellSize) {
        for (let x = 0; x < size; x += cellSize) {
            const isAlt = ((x / cellSize) + (y / cellSize)) % 2 === 0;
            ctx.fillStyle = isAlt ? '#222733' : '#14171d';
            ctx.fillRect(x, y, cellSize, cellSize);

            // Subtle carbon fiber weave threads
            ctx.fillStyle = isAlt ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(x + 1, y + 1, cellSize - 2, 2);
            ctx.fillRect(x + 1, y + cellSize / 2, cellSize - 2, 2);
        }
    }

    // Heavy reinforced frame bevels along borders
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#0f1117';
    ctx.strokeRect(0, 0, size, size);

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(18, 18, size - 36, size - 36);

    // Industrial corner hex fasteners
    drawHexBolt(ctx, 36, 36, 7);
    drawHexBolt(ctx, size - 36, 36, 7);
    drawHexBolt(ctx, 36, size - 36, 7);
    drawHexBolt(ctx, size - 36, size - 36, 7);

    // Subtle neon cyan conduit line in center
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size / 2, 40);
    ctx.lineTo(size / 2, size - 40);
    ctx.stroke();

    ctx.shadowBlur = 0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
}

function createSciFiPillarBumpTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Neutral base
    ctx.fillStyle = '#606060';
    ctx.fillRect(0, 0, size, size);

    // Weave height differences
    const cellSize = 16;
    for (let y = 0; y < size; y += cellSize) {
        for (let x = 0; x < size; x += cellSize) {
            const isAlt = ((x / cellSize) + (y / cellSize)) % 2 === 0;
            ctx.fillStyle = isAlt ? '#727272' : '#525252';
            ctx.fillRect(x, y, cellSize, cellSize);
        }
    }

    // Outer frame ridge
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#303030';
    ctx.strokeRect(0, 0, size, size);

    // Chamfer highlights
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#b0b0b0';
    ctx.strokeRect(18, 18, size - 36, size - 36);

    // Fastener bumps
    drawHexBolt(ctx, 36, 36, 7, true);
    drawHexBolt(ctx, size - 36, 36, 7, true);
    drawHexBolt(ctx, 36, size - 36, 7, true);
    drawHexBolt(ctx, size - 36, size - 36, 7, true);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
}

export {
    generateWallUVs,
    createSciFiWallDiffuseTexture,
    createSciFiWallBumpTexture,
    createSciFiPillarDiffuseTexture,
    createSciFiPillarBumpTexture
};

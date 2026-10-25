import { storageGetItem, storageSetItem } from './storage.js';

/**
 * Celebration module for 3D Maze victory effects
 * Provides sci-fi audio fanfare with mute support, controlled particle confetti,
 * and performance rating calculation.
 */

class CelebrationManager {
    constructor() {
        this.audioCtx = null;
        this.activeAudioNodes = [];
        this.confettiCanvas = null;
        this.confettiCtx = null;
        this.poolSize = 65;
        this.particles = [];
        this.animFrameId = null;
        this.isRunning = false;
        this.isMuted = storageGetItem('maze_sound_muted', 'false') === 'true';
        this.resizeHandler = this.onResize.bind(this);
        this.cachedWidth = 0;
        this.cachedHeight = 0;
        this.initPool();
    }

    initPool() {
        this.particles = [];
        for (let i = 0; i < this.poolSize; i++) {
            this.particles.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                size: 6,
                color: '#D6B875',
                shape: 'rect',
                rotation: 0,
                rotationSpeed: 0,
                wobble: 0,
                wobbleSpeed: 0.05,
                life: 0,
                decay: 0.005,
                active: false
            });
        }
    }

    initCanvas(canvas) {
        this.confettiCanvas = canvas;
        if (canvas) {
            this.confettiCtx = canvas.getContext('2d');
            this.onResize();
        }
    }

    onResize() {
        if (!this.confettiCanvas) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this.cachedWidth !== w || this.cachedHeight !== h) {
            this.cachedWidth = w;
            this.cachedHeight = h;
            this.confettiCanvas.width = w;
            this.confettiCanvas.height = h;
        }
    }

    /**
     * Audio Mute Management
     */
    getMuted() {
        return this.isMuted;
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
        storageSetItem('maze_sound_muted', this.isMuted ? 'true' : 'false');
        if (this.isMuted) {
            this.stopActiveAudio();
        }
        return this.isMuted;
    }

    toggleMute() {
        return this.setMuted(!this.isMuted);
    }

    stopActiveAudio() {
        if (this.activeAudioNodes && this.activeAudioNodes.length > 0) {
            this.activeAudioNodes.forEach(node => {
                try {
                    if (node.stop) node.stop();
                    if (node.disconnect) node.disconnect();
                } catch (_) {}
            });
            this.activeAudioNodes = [];
        }
    }

    /**
     * Play uplifting victory fanfare using Web Audio API (reusable context, non-blocking)
     */
    playVictorySound() {
        if (this.isMuted) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            if (!this.audioCtx) {
                this.audioCtx = new AudioContextClass();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }

            this.stopActiveAudio();

            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            const masterGain = ctx.createGain();
            const vol = typeof this.volume === 'number' ? this.volume : 1.0;
            masterGain.gain.setValueAtTime(0.26 * vol, now);
            masterGain.connect(ctx.destination);
            this.activeAudioNodes.push(masterGain);

            // Sci-Fi celebratory melodic sequence:
            // C5 -> E5 -> G5 -> C6 with resonant harmonic tail
            const notes = [
                { freq: 523.25, time: 0.00, dur: 0.16 }, // C5
                { freq: 659.25, time: 0.11, dur: 0.16 }, // E5
                { freq: 783.99, time: 0.22, dur: 0.20 }, // G5
                { freq: 1046.50, time: 0.35, dur: 0.80 }, // C6
                { freq: 523.25, time: 0.35, dur: 0.80 },  // C5 chord
                { freq: 659.25, time: 0.35, dur: 0.80 },  // E5 chord
                { freq: 1318.51, time: 0.40, dur: 0.65 }  // E6 high shimmer
            ];

            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.freq, now + note.time);

                gain.gain.setValueAtTime(0.0001, now + note.time);
                gain.gain.linearRampToValueAtTime(0.20, now + note.time + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.dur);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(now + note.time);
                osc.stop(now + note.time + note.dur + 0.05);

                this.activeAudioNodes.push(osc, gain);
            });
        } catch (err) {
            console.warn('Audio playback error (celebration):', err);
        }
    }

    /**
     * Start celebration confetti burst using pre-allocated particle pool
     */
    startConfetti() {
        if (!this.confettiCanvas) return;

        // Respect prefers-reduced-motion
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        this.stopConfetti();

        window.removeEventListener('resize', this.resizeHandler);
        window.addEventListener('resize', this.resizeHandler);
        this.onResize();

        this.isRunning = true;

        // Premium sci-fi celebration palette:
        // Champagne gold, gold highlight, warm platinum, restrained ice teal, refined emerald, titanium
        const colors = [
            '#D6B875', '#F0D9A0', // Champagne gold & highlight
            '#F1F0EA', '#B0BAC7', // Warm platinum & titanium
            '#79C9D4', '#54B9C6', // Ice teal & interactive teal
            '#56C8A0'             // Refined emerald
        ];

        // Device-capability adaptive count
        const isMobileDevice = /Mobi|Android|iPhone/i.test(navigator.userAgent);
        const spawnCount = isMobileDevice ? 36 : Math.min(this.poolSize, 56);

        const width = this.confettiCanvas.width || window.innerWidth;
        const height = this.confettiCanvas.height || window.innerHeight;

        // Initialize active particles from pre-allocated pool (no new object allocations)
        for (let i = 0; i < spawnCount && i < this.particles.length; i++) {
            const p = this.particles[i];
            const fromLeft = i % 2 === 0;
            p.x = fromLeft ? width * 0.22 : width * 0.78;
            p.y = height * 0.88;

            const angle = fromLeft
                ? (-Math.PI / 2) + (Math.random() * 0.65 - 0.12)
                : (-Math.PI / 2) - (Math.random() * 0.65 - 0.12);
            const speed = 9 + Math.random() * 12;

            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.size = 5 + Math.random() * 5;
            p.color = colors[i % colors.length];

            const randShape = Math.random();
            p.shape = randShape < 0.65 ? 'rect' : (randShape < 0.85 ? 'circle' : 'star');

            p.rotation = Math.random() * 360;
            p.rotationSpeed = (Math.random() - 0.5) * 8;
            p.wobble = Math.random() * 10;
            p.wobbleSpeed = 0.04 + Math.random() * 0.05;
            p.life = 1.0;
            // Finite lifetime: ~3.5 to 4.5 seconds burst, then automatically ends
            p.decay = 0.0035 + Math.random() * 0.0035;
            p.active = true;
        }

        this.renderConfetti();
    }

    renderConfetti() {
        if (!this.isRunning || !this.confettiCtx) return;

        const ctx = this.confettiCtx;
        const width = this.confettiCanvas.width;
        const height = this.confettiCanvas.height;

        ctx.clearRect(0, 0, width, height);

        let activeCount = 0;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.22; // gravity
            p.vx *= 0.985; // drag
            p.vy *= 0.985;
            p.rotation += p.rotationSpeed;
            p.wobble += p.wobbleSpeed;
            p.life -= p.decay;

            if (p.life <= 0 || p.y > height + 30) {
                p.active = false;
                continue;
            }

            activeCount++;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
            ctx.fillStyle = p.color;

            const scaleX = Math.cos(p.wobble);

            if (p.shape === 'rect') {
                ctx.scale(scaleX, 1);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            } else if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // 4-point tech star
                ctx.beginPath();
                const r = p.size;
                const rInner = p.size * 0.35;
                for (let s = 0; s < 4; s++) {
                    const a = (s * 90 * Math.PI) / 180;
                    const aMid = a + (45 * Math.PI) / 180;
                    if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    ctx.lineTo(Math.cos(aMid) * rInner, Math.sin(aMid) * rInner);
                }
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        // When all particles in the burst expire, cleanly STOP animation loop
        if (activeCount === 0) {
            this.stopConfetti();
            return;
        }

        this.animFrameId = requestAnimationFrame(() => this.renderConfetti());
    }

    /**
     * Stop and clear confetti, freeing all animation frames and listeners
     */
    stopConfetti() {
        this.isRunning = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.confettiCtx && this.confettiCanvas) {
            this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
        }
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].active = false;
        }
        window.removeEventListener('resize', this.resizeHandler);
    }

    /**
     * Calculate score and rating
     */
    getRating(totalSeconds, mazeSize) {
        const size = parseInt(mazeSize) || 3;
        const baseTarget = size * 12; // e.g. size 3 -> 36s
        let stars = 3;
        let rank = 'MASTER NAVIGATOR';
        let badge = '🏆';

        if (totalSeconds <= baseTarget) {
            stars = 3;
            rank = 'MASTER NAVIGATOR';
            badge = '🏆';
        } else if (totalSeconds <= baseTarget * 1.75) {
            stars = 2;
            rank = 'SWIFT PATHFINDER';
            badge = '⭐';
        } else {
            stars = 1;
            rank = 'SECTOR CONQUEROR';
            badge = '🎖️';
        }

        return {
            stars,
            starsString: '★'.repeat(stars) + '☆'.repeat(3 - stars),
            rank,
            badge
        };
    }
}

const celebration = new CelebrationManager();
export default celebration;

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const _scratchEndRelative = new THREE.Vector3();
const _scratchInvQuat = new THREE.Quaternion();

export default class CompassManager {
    constructor(opts = {}) {
        const o = Object.assign({
            count: 800,
            color: new THREE.Color(0.4, 0.4, 0.4),
            spawnRadius: 20,
            map: null,
            size: 0.1
        }, opts);

        this.arrowMesh = null;
        this.visible = false;

        this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, powerPreference: "high-performance" } );
        this.renderer.setPixelRatio( Math.min(window.devicePixelRatio || 1, 1.5) );
        
        let compassWindowSize = Math.floor( Math.min(window.innerWidth, window.innerHeight)/6 );
        this.renderer.setSize( compassWindowSize, compassWindowSize );
        this.renderer.setClearColor( 0x000000, 0 );
        this.renderer.domElement.id = "compass";
        document.querySelector('#compass-container').appendChild( this.renderer.domElement );

        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera( 75, 1/1, 0.1, 1000 );
        this.camera.position.z = 2;

        let compassPoint = new THREE.PointLight( 0xffffff, 5, 0, 1 );
        compassPoint.position.set( -1, -2, 1 );

        let compassSecondaryDirectional = new THREE.DirectionalLight( 0xffffff, 1.5 );
        compassSecondaryDirectional.position.set( 1, 2, 2);
        compassSecondaryDirectional.target.position.set(0,0,0);

        this.scene.add( compassSecondaryDirectional );
        this.scene.add( compassPoint );
        this.scene.add( new THREE.AmbientLight( 0xffffff, 1.0 ) );

        // load the model
        const arrowGeometry = new THREE.BufferGeometry();
        const loader = new GLTFLoader();
        loader.load( 'models/arrow.glb', ( gltf ) => {
            const modelArrow = gltf.scene.getObjectByName('arrow');
            THREE.BufferGeometry.prototype.copy.call(arrowGeometry, modelArrow.geometry);
            this.arrowMesh = new THREE.Mesh( arrowGeometry, new THREE.MeshStandardMaterial( {
                color: 0xe63946,
                emissive: 0x800f1a,
                emissiveIntensity: 0.35,
                roughness: 0.3,
                metalness: 0.2
            } ) );
            this.scene.add( this.arrowMesh );
        }, undefined, ( error ) => {

            console.error( error );

        } );
    }

    setVisible(visible) {
        this.visible = !!visible;
    }

    followObject(object) {
        this.followedObject = object;
    }

    setEndPos(position) {
        this.endPos = position;
    }

    onWindowResize() {
        let compassWindowSize = Math.floor( Math.min(window.innerWidth, window.innerHeight)/6 );
        this.renderer.setSize( compassWindowSize, compassWindowSize );
        this.renderer.setPixelRatio( Math.min(window.devicePixelRatio || 1, 1.5) );
    }

    update() {
        if (!this.visible) return;
        if (this.arrowMesh != null && this.followedObject != null && this.endPos != null ) {
            _scratchEndRelative.subVectors( this.endPos, this.followedObject.position );
            this.arrowMesh.lookAt( _scratchEndRelative );
            _scratchInvQuat.copy( this.followedObject.quaternion ).invert();
            this.arrowMesh.applyQuaternion( _scratchInvQuat );
        }
    }

    render() {
        if (!this.visible) return;
        this.renderer.render( this.scene, this.camera );
    }
}
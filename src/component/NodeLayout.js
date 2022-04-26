import React, {useMemo, useRef, useState, useEffect, useCallback} from "react";
import {useFrame} from "@react-three/fiber";
import {Html} from "@react-three/drei";
import * as THREE from "three";
import makeStyles from "@mui/styles/makeStyles";

const tempVec = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

// function THREE.MathUtils.lerp(v0, v1, t) {
//     return v0 * (1 - t) + v1 * t;
// }

const useStyles = makeStyles({
    tooltip: {
        background: 'rgba(0,0,0,0.66)',
        fontSize:'70%',
        border: 0,
        borderRadius: 3,
        boxShadow: '0 3px 5px 2px rgba(255, 255, 255, .3)',
        color: 'white',
        padding: 5,
        width: '300px'
    },
});
export default function NodeLayout({data=[],selectService=0,size=[0.4, 0.1, 0.01],timeGap=0,adjustscale=(d)=>d,getKey=((d,i)=>i),stackOption=false,onUserhighlight,onReleaseUserhighlight,...others}) {
    const classes = useStyles();
    const [hovered, set] = useState();
    const [freeze, setfreeze] = useState(false);
    const prevData= usePrevious(data);
    const meshRef = useRef();
    const colorArray = useMemo(() => {
        setfreeze(false);
        set(undefined);
        return Float32Array.from(new Array(data.length).fill().flatMap((_, i) => [...tempColor.set(data[i].color??'red').toArray(),1]))}, [data,selectService]);
    const trackerData = useMemo(()=>{
        const tracker={}
        if (prevData){
            prevData.forEach((d,i)=>{
                meshRef.current.getMatrixAt(i,tempMatrix);
                tracker[getKey(d,i)] =  tempMatrix.clone();
            });
            // data.forEach((d,i)=>{
            //     meshRef.current.setMatrixAt(i,tracker[getKey(d,i)]);
            // });
        }
        return {first:true,tracker};
    },[data,getKey])

    // useEffect(()=>{
    //     if (globeEl.current) {
    //         if (currentSequnce < MAP_CENTERs.length) {
    //             const interval = setTimeout(() => {
    //                 globeEl.current.pointOfView(MAP_CENTERs[currentSequnce], 4000)
    //                 setCurrentSequnce(currentSequnce + 1);
    //             }, 4000);
    //             return () => {
    //                 clearInterval(interval);
    //             };
    //         }
    //     }
    // },[currentSequnce]);

    useFrame((state) => {
        const hoverEmpty = hovered===undefined;
        const notMetric = typeof selectService === 'string';
        if (trackerData.first){
            data.forEach((d,i)=>{
                const newd = trackerData.tracker[getKey(d,i)];
                if (newd)
                    meshRef.current.setMatrixAt(i,newd);
                else{
                    tempObject.position.set( d[0],d[1],d[2]);
                    tempObject.scale.set(0,0,0);
                    tempObject.updateMatrix();
                    meshRef.current.setMatrixAt(i,tempObject.matrix);
                }

            });
            meshRef.current.instanceMatrix.needsUpdate = true;
            trackerData.first = false;
        }else {
            data.forEach((d, i) => {
                meshRef.current.getMatrixAt(i, tempMatrix);
                tempVec.setFromMatrixPosition(tempMatrix);

                const scalesize = [1, 1, 1];
                if (d.size) {
                    scalesize[0] = d.size[0] / size[0];
                    scalesize[1] = d.size[1] / size[1];
                    scalesize[2] = (notMetric ? 0.5 : adjustscale(d.data.values[selectService] ?? 0)) * timeGap / size[2];
                }
                tempObject.position.x = THREE.MathUtils.lerp(tempVec.x, d[0], 0.1);
                tempObject.position.y = THREE.MathUtils.lerp(tempVec.y, d[1], 0.1);
                tempObject.position.z = THREE.MathUtils.lerp(tempVec.z, d[2] + scalesize[2] * size[2] / 2, 0.1);
                // tempObject.position.set(Math.random(),Math.random(),0)

                tempVec.setFromMatrixScale(tempMatrix)
                tempObject.scale.x = THREE.MathUtils.lerp(tempVec.x, scalesize[0], 0.1);
                tempObject.scale.y = THREE.MathUtils.lerp(tempVec.y, scalesize[1], 0.1);
                tempObject.scale.z = THREE.MathUtils.lerp(tempVec.z, scalesize[2], 0.1);
                // tempObject.scale.set(1,1,100)

                colorArray[i * 4 + 3] = (hoverEmpty || (i === hovered)) ? 1 : 0.01;
                meshRef.current.geometry.attributes.color.needsUpdate = true;
                tempObject.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObject.matrix);
            });
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });
    const getDataPos = useCallback((d)=>{
        return [d[0], d[1], d[2]*timeGap]
    },[timeGap])
    return <><instancedMesh ref={meshRef} args={[null, null, data.length]}
                            onClick={(e)=>{setfreeze(!freeze); if(freeze) set(undefined)}}
                            onPointerMove={(e) => {e.stopPropagation(); if(!freeze){ set(e.instanceId);
                            const h = {};
                            h[data[e.instanceId].data.user]=true;
                                onUserhighlight(h)
                            }}}
                            onPointerOut={(e) => {e.stopPropagation(); if(!freeze) {set(undefined); onReleaseUserhighlight()}}}>
        <boxGeometry args={size}>
            <instancedBufferAttribute attachObject={['attributes', 'color']} args={[colorArray, 4]} />
        </boxGeometry>
        <meshStandardMaterial vertexColors toneMapped={false} transparent={true} alphaTest={0} />
    </instancedMesh>
    <Html scaleFactor={1}
          position={((hovered!==undefined)&&data[hovered])?getDataPos(data[hovered]):undefined}
          className={classes.tooltip} style={{ pointerEvents: "none", display: (hovered!==undefined) ? "block" : "none" }}>
        <div>
            {data[hovered]&&data[hovered].data.toolTip}
        </div>
    </Html>
    </>
}

function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

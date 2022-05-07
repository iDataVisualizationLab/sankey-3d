import React, {useImperativeHandle, useRef, useState, useEffect, useCallback} from "react";
import * as d3 from 'd3'
import {PCA} from './PCA'
import Lasso from "./Lasso";

const xscale = d3.scaleLinear();
const yscale = d3.scaleLinear();
export const PCAchart = React.forwardRef(({DIM=2,setSelectedComputeMap,...props},ref)=> {
    const canvasRef = useRef();
    const width=500;
    const height=500;
    const r = 2;
    const [data,setData] = useState([]);
    useEffect(()=>{
        console.log(data)
        d3.select(canvasRef.current).call(d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", ({transform}) => zoomed(transform,data)));
        zoomed(d3.zoomIdentity,data);

    },[data]);
    const handleLassoEnd = useCallback((lassoPolygon)=> {
        debugger
        if (lassoPolygon) {
            const comps = {};
            data.forEach((d) => {
                const [x, y] = d;
                if (!d3.polygonContains(lassoPolygon, [xscale(x), yscale(y)])) {
                    d._color = 'black'
                } else {
                    delete d._color;
                    console.log(d.data);
                    if(!comps[d.data.key])
                        comps[d.data.key] = [];
                    comps[d.data.key].push(d.data.timestep)
                }
            });
            setSelectedComputeMap(comps)
        }else{
            data.forEach((d) => {
                delete d._color;
            });
            setSelectedComputeMap(undefined)
        }
        zoomed(d3.zoomIdentity,data);
        setData(data);
    },[data]);
    const handleLassoStart = useCallback((lassoPolygon)=> {
        data.forEach((d) => {
            delete d._color;
        });
        zoomed(d3.zoomIdentity,data);
        setData(data);
    },[data]);
    useImperativeHandle(ref, () => ({
        calculatePCA: function calculatePCA(data){

            const dataIn = [];
            data.forEach(d=>{
                if ( d.data.values.find(e=>e===null) === undefined) {
                    d.data.values.color = d.color
                    dataIn.push(d.data.values)
                }
            });
            let pca = new PCA();
            // console.log(brand_names);
            // let matrix = pca.scale(dataIn, true, true);
            let matrix = pca.scale(dataIn, false, false);

            let pc = pca.pca(matrix,DIM);

            let A = pc[0];  // this is the U matrix from SVD
            // let B = pc[1];  // this is the dV matrix from SVD
            let chosenPC = pc[2];   // this is the most value of PCA
            let solution = dataIn.map((d,i)=>{
                const dd = d3.range(0,DIM).map(dim=>A[i][chosenPC[dim]]);
                dd.data = d;
                return dd
            });

            let xrange = d3.extent(solution, d => d[0]);
            let yrange = d3.extent(solution, d => d[1]);
            xscale.range([0, width]);
            yscale.range([0, height]);
            const ratio = height / width;
            if ((yrange[1] - yrange[0]) / (xrange[1] - xrange[0]) > height / width) {
                yscale.domain(yrange);
                let delta = ((yrange[1] - yrange[0]) / ratio - (xrange[1] - xrange[0])) / 2;
                xscale.domain([xrange[0] - delta, xrange[1] + delta])
            } else {
                xscale.domain(xrange);
                let delta = ((xrange[1] - xrange[0]) * ratio - (yrange[1] - yrange[0])) / 2;
                yscale.domain([yrange[0] - delta, yrange[1] + delta])
            }
            console.log('I set new solution')
            setData(solution);
        }
    }),[]);
    // useEffect(()=>{
    //     zoomed(d3.zoomIdentity);
    // },[data])

    function zoomed(transform,data) {
        const context = canvasRef.current.getContext('2d')
        context.save();
        context.clearRect(0, 0, width, height);
        context.translate(transform.x, transform.y);
        context.scale(transform.k, transform.k);
        for (const d of data) {
            const [x, y] = d;
            context.fillStyle = d._color??d.data.color;
            context.beginPath();
            context.moveTo(xscale(x) + r, yscale(y));
            context.arc(xscale(x), yscale(y), r, 0, 2 * Math.PI);
            context.fill();
        }
        context.restore();
    }


    return <div style={{position: 'relative',width:'100%'}}>
        <canvas ref={canvasRef} width={width} height={height} style={{width:'100%'}}/>
        <Lasso start={(d)=>handleLassoStart(d)} width={width} height={height} end={d=>handleLassoEnd(d)}/>
    </div>
})
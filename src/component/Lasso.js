import React, {useImperativeHandle, useRef,useState, useEffect} from "react";
import * as d3 from 'd3'
let closeDistance = 75;


const Lasso = React.forwardRef(({start,end,width,height,...props},ref)=> {
    const [lassoPolygon,setlassoPolygon] = useState({value:undefined})

    // distance last point has to be to first point before it auto closes when mouse is released
    useEffect(()=>{
        const area = d3.select(svgRef.current).select('rect.area')
        const drag = d3
            .drag()
            .on('start', handleDragStart)
            .on('drag', handleDrag)
            .on('end', handleDragEnd);

        area.call(drag);
    },[start,end]);
    const handleDragStart = (event) => {
        lassoPolygon.value = [d3.pointer(event,svgRef.current)];
        lassoPolygon.condition = false;
        lassoPolygon.end = false;
        setlassoPolygon({...lassoPolygon})
        if(start)
            start(lassoPolygon.value);
    }

    const handleDrag = (event) => {
        const point = d3.pointer(event,svgRef.current);
        lassoPolygon.value.push(point);

        // indicate if we are within closing distance
        if (
            distance(lassoPolygon.value[0], lassoPolygon.value[lassoPolygon.value.length - 1]) <
            closeDistance
        ) {
            lassoPolygon.condition = point;
        } else {
            lassoPolygon.condition = false;
        }

        setlassoPolygon({...lassoPolygon})
    }

    const handleDragEnd = () => {
        // remove the close path
        lassoPolygon.end = true;

        // succesfully closed

        if ((distance(lassoPolygon.value[0], lassoPolygon.value[lassoPolygon.value.length - 1]) < closeDistance)&&(lassoPolygon.value.length>2)) {
            lassoPolygon.condition = true;
            // otherwise cancel
        } else {
            lassoPolygon.value = undefined;
        }
        if(end)
            end(lassoPolygon.value);
        setlassoPolygon({...lassoPolygon})
    }
    useImperativeHandle(ref, () => {

        return ({
            reset: ()=>{
                lassoPolygon.value = undefined;
                setlassoPolygon(lassoPolygon)
            }
        })
    });

    const svgRef = useRef();
    return <svg ref={svgRef} width={width} height={height} viewBox={[0,0,width,height]} style={{position:'absolute',top:0,left:0, width:'100%', height:'100%'}}>
        <g className="lasso-group">
            <rect className={'area'} width={'100%'} height={'100%'} opacity={0}/>
            {lassoPolygon.value&&<>
                <path fill={'#0bb'} fillOpacity={0.1} stroke={'#0bb'} strokeDasharray={'3 3'} d={polygonToPath(lassoPolygon.value)+((lassoPolygon.condition&&lassoPolygon.end)?'Z':'')}/>
                {(!lassoPolygon.end)&&<line
                    x1={lassoPolygon.condition[0]}
                    y1={lassoPolygon.condition[1]}
                    x2={lassoPolygon.value[0][0]}
                    y2={lassoPolygon.value[0][1]}
                    stroke={'#0bb'} strokeDasharray={'3 3'} opacity={lassoPolygon.condition?1:0}/>}
            </>}
        </g>
    </svg>
});
export default Lasso;

function polygonToPath(polygon) {
    return ("M" + (polygon.map(function (d) { return d.join(','); }).join('L')));
}

function distance(pt1, pt2) {
    return Math.sqrt(Math.pow( (pt2[0] - pt1[0]), 2 ) + Math.pow( (pt2[1] - pt1[1]), 2 ));
}
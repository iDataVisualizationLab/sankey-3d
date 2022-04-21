import React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import {css} from "@emotion/css";
import {bumpX} from "./Bump"
import {sankey} from "d3-sankey";
import {d3adaptor} from "webcola"
import NodeElement from "./NodeElement";


const area = d3.area().defined(d => !!d).curve(bumpX).x(d => d[0])
export default class Sankey extends React.Component {
    svgRef = React.createRef();

    widthView() {
        return this.props.width * (this.state.scalezoom ?? 1)
    }

    heightView() {
        return this.props.height * (this.state.scalezoom ?? 1)
    }

    widthG() {
        return this.widthView() - (this.state.margin ?? {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        }).left - (this.state.margin ?? {top: 0, bottom: 0, left: 0, right: 0}).right
    }

    heightG() {
        return this.heightView() - (this.state.margin ?? {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        }).top - (this.state.margin ?? {top: 0, bottom: 0, left: 0, right: 0}).bottom
    }

    nodeSort = ((a, b) => 0)
    padding = 0;
    isAnimate = false;
    sankey = sankey()
        .nodeWidth(0.1)
        // .nodeAlign(sankeyLeft)
        .nodeAlign((node) => {
            return node.layer;
        })
        .nodePadding(5)
    y = d3.scalePoint()
    x = d3.scaleTime()
    svg = d3.select(null)
    g = d3.select(null)
    color = d3.scaleOrdinal(d3.schemeCategory10)
    _color = d3.scaleOrdinal(d3.schemeCategory10)
    force = d3adaptor(d3)

    constructor(props) {
        super(props);
        this.state = {
            freezing: false,
            margin: {top: 20, right: 20, bottom: 30, left: 100},
            data: [],
            times: [],
            nodes: [],
            links: [],
            linksBySource: [],
            graph: {},
            isForceDone: false
        }
    }

    zoomFunc = d3.zoom().on("zoom", (event) => {
        this.svg.select('g.content').attr("transform", event.transform);
    });

    componentDidMount() {
        const {margin} = this.state;
        this.svg = d3.select(this.svgRef.current);
        this.g = this.svg.select('g.content');

        // this.svg.select<SVGRectElement>('rect.pantarget').call(this.zoomFunc.bind(this)).call(this.zoomFunc.transform, d3.zoomIdentity.translate(margin.left, margin.top));
        // @ts-ignore
        // this.svg.call(this.zoomFunc.bind(this)).call(this.zoomFunc.transform, d3.zoomIdentity.translate(margin.left, margin.top));
        const data = this.props.data;

        this.y.domain(data.map((d) => d.key));
        data.forEach((d, i) => {
            d.order = i;
        });
        this.draw({data});
        this.setState({data})
    }

    componentDidUpdate(prevProps, prevState) {
        if ((this.props.data !== prevProps.data)|| (this.props.timespan !== prevProps.timespan)) {
            const data = this.props.data;
            this.y.domain(data.map((d) => d.key));
            data.forEach((d, i) => {
                d.order = i;
            });
            this.draw({data});
            this.setState({data})
        } else if ((this.props.width !== prevProps.width) || (this.props.height !== prevProps.height)) {
            console.log('I am here???')
            const graph = this.state.graph;
            const {nodes, links, linksBySource} = this.renderSankey({graph}, 0);
            this.setState({nodes, links, linksBySource, graph});
            if (this.props.sankeyResult)
                this.props.sankeyResult(linksBySource,this.getColorScale.bind(this));
        } else if ((this.state.isForceDone !== prevState.isForceDone) && this.state.isForceDone && !this.svg.empty()) {
            const {margin} = this.state;
            // @ts-ignore
            this.svg.call(this.zoomFunc.transform, d3.zoomIdentity.translate(margin.left, margin.top));
            // this.svg.select<SVGRectElement>('rect.pantarget').call(this.zoomFunc.transform, d3.zoomIdentity.translate(margin.left, margin.top));
        }
    }

    freezeHandle() {
        const {freezing} = this.state;
        if (freezing) {
            // freezing();
            this.setState({freezing: false});
        }
    }

    draw(opts = {}) {
        let {freezing} = this.state;
        const {timespan} = this.props;
        const {x} = this;
        const self = this;
        const data = opts.data ?? this.state.data;
        if (freezing)
            this.freezeHandle();
        let keys = timespan;
        const times = keys;
        let nodes = [];
        x.domain([keys[0], _.last(keys)]);

        let graph = (() => {
            let index = -1;
            let nodes = [];
            const nodeByKey = new Map;
            const indexByKey = new Map;
            const nodeLabel = new Map;
            let links = [];
            const nodeList = {};
            console.time('create nodes');
            keys.forEach((_k, ki) => {
                const k = '' + _k;
                for (const d of data) {
                    if (d[k]) {
                        const item = d[k];
                        const text = getUserName(item);
                        const key = JSON.stringify([k, text]);
                        if ((this.props.showShareUser && (!(item && item.length > 1))) || nodeByKey.has(key))
                            continue; // return

                        const node = {
                            name: text,
                            time: _k,
                            layer: ki,
                            _key: key,
                            relatedLinks: [],
                            element: item,
                            id: ++index
                        };
                        if (!nodeLabel.has(text)) {
                            node.first = true;
                            node.childNodes = [];
                            nodeLabel.set(text, node);
                            nodeList[text] = [];
                            node.isShareUser = !!(item && (item.length > 1));
                            node.maxIndex = ki;
                            node.maxval = 0;
                            node.drawData = [];
                            node.comp = {}
                            node.comp[d.key] = true;


                            nodes.push(node);
                            nodeByKey.set(key, node);
                            indexByKey.set(key, index);
                            nodeList[text].push(node);
                        } else {
                            node.isShareUser = !!(item && item.length > 1);
                            node.parentNode = nodeLabel.get(text).id;
                            node.comp = {}
                            node.comp[d.key] = true;
                            nodes.push(node);
                            // if (nodeByKey.has(key)) continue;
                            nodeByKey.set(key, node);
                            indexByKey.set(key, index);
                            nodeList[text].push(node);
                        }
                    }
                }
            });
            console.timeEnd('create nodes');
            console.time('create links');
            const maxLimit = this.props.maxPerUnit;
            const mapOfSankey = {};
            // nodes = _.shuffle(nodes)
            for (let i = 1; i < keys.length; ++i) {
                const a = '' + keys[i - 1];
                const b = '' + keys[i];
                const linkByKey = new Map();
                for (const d of data) {
                    const d_a = d[a];
                    const d_b = d[b];
                    const sourceName = JSON.stringify([a, getUserName(d_a)]);
                    const targetName = JSON.stringify([b, getUserName(d_b)]);
                    if (d[a] && d[b] && nodeByKey.has(sourceName) && nodeByKey.has(targetName)) {
                        const names = [sourceName, targetName];
                        const key = JSON.stringify(names);
                        // const value = (d.value??d_a.total) || 1;
                        // const value = Math.min(d_a.total,maxLimit);
                        const value = Math.min(d_a.total, maxLimit);
                        const arr = [d.key];//just ad for testing
                        let link = linkByKey.get(key);
                        const byComp = {};
                        const byComp_t = {};
                        byComp[d.key] = value;
                        byComp_t[d.key] = Math.min(d_b.total, maxLimit);
                        // _byComp_t[d.key] = d_b.total;

                        if (link) {
                            let new_val = Math.min((link.byComp[d.key] ?? 0) + value, maxLimit);
                            let delta = new_val - (link.byComp[d.key] ?? 0);
                            link.byComp[d.key] = new_val;

                            let new_val_t = Math.min((link.byComp_t[d.key] ?? 0) + byComp_t[d.key], maxLimit);
                            link.byComp_t[d.key] = new_val_t;
                            // link._byComp_t[d.key] = (link._byComp_t[d.key]??0)+_byComp_t[d.key];

                            nodeByKey.get(sourceName).comp[d.key] = true;
                            nodeByKey.get(targetName).comp[d.key] = true;
                            d_a.jobs[0].forEach((d, i) => link.sources[d] = {display: {}, data: d_a.jobs[1][i]});
                            d_b.jobs[0].forEach((d, i) => link.targets[d] = {display: {}, data: d_b.jobs[1][i]});
                            // if a compute over the limit
                            link.value += delta;
                            d_b.forEach((n, i) => {
                                link._target[i].value += n.value;
                                link._target.total = (link._target.total ?? 0) + n.value;
                            });
                            link.arr.push(arr[0]);
                            // TIME ARC
                            // if (nodes[link.source].maxval<link.value) {
                            //     nodes[link.source].maxval = link.value;
                            //     nodes[link.source].maxIndex = i - 1;
                            // }
                            // if (nodes[link.target].maxval<link.value) {
                            //     nodes[link.target].maxval = link.value;
                            //     nodes[link.target].maxIndex = i;
                            // }
                            continue;
                        }
                        const source = JSON.stringify([a, getUserName(d_a)]);
                        nodeByKey.get(source).comp[d.key] = true;
                        const target = JSON.stringify([b, getUserName(d_b)]);
                        nodeByKey.get(target).comp[d.key] = true;
                        if (!mapOfSankey[sourceName])
                            mapOfSankey[sourceName] = JSON.parse(JSON.stringify(d[a]));
                        mapOfSankey[targetName] = JSON.parse(JSON.stringify(d[b]));
                        const _source = mapOfSankey[sourceName];
                        // _source.total=d[a].total;
                        const _target = mapOfSankey[targetName];
                        // _target.total=d[b].total;
                        // const _source = JSON.parse(JSON.stringify(d[a]));
                        // _source.total=Math.min(d_a.total,maxLimit);
                        // const _target = JSON.parse(JSON.stringify(d[b]));
                        // _target.total=Math.min(d_a.total,maxLimit);
                        const sources = {};
                        const targets = {};
                        d_a.jobs[0].forEach((d, i) => sources[d] = {display: {}, data: d_a.jobs[1][i]});
                        d_b.jobs[0].forEach((d, i) => targets[d] = {display: {}, data: d_b.jobs[1][i]});
                        link = {
                            byComp,
                            byComp_t,
                            // _byComp_t,
                            source: indexByKey.get(source),
                            sources,
                            targets,
                            _source,
                            target: indexByKey.get(target),
                            _target,
                            names,
                            arr,
                            value,
                            _id: 'link_' + key.replace(/\.|\[|\]| |"|\\|:|-|,/g, '')
                        };
                        if (getUserName(d_a) !== getUserName(d_b)) {
                            if (this.props.hideStable) {
                                nodeByKey.get(JSON.stringify([a, getUserName(d_a)])).relatedLinks.push(link);
                                nodeByKey.get(JSON.stringify([b, getUserName(d_b)])).relatedLinks.push(link);
                            }
                            nodeByKey.get(JSON.stringify([a, getUserName(d_a)])).shared = true;
                            nodeByKey.get(JSON.stringify([b, getUserName(d_b)])).shared = true;
                        } else {
                            link.isSameNode = true;
                        }
                        links.push(link);
                        linkByKey.set(key, link);
                    }
                }
            }

            if (this.props.showOverLimitUser) {
                let keepNodes = {};
                let nodeObj = {};
                nodes.forEach(d => {
                    nodeObj[d.id] = d;
                });
                links = links.filter(l => {
                    if (((l._source.total > l.arr.length * 36) || (l._target.total > l.arr.length * 36))) {
                        keepNodes[nodeObj[l.source].name] = true;
                        keepNodes[nodeObj[l.target].name] = true;
                        return true;
                    }
                    l.hide = true;
                    return false;
                });
                nodes = nodes.filter((n, index) => {
                    if (keepNodes[n.name])
                        return true;
                    else {
                        delete nodeObj[n.id];
                        // listUser[n.name] = n;
                        return false;
                    }
                });
                links = links.filter(l => nodeObj[l.source] && nodeObj[l.target] && nodeObj[nodeObj[l.source].parentNode] && nodeObj[nodeObj[l.target].parentNode])
            }
            if (this.props.hideStable) {
                let removeNodes = {};
                Object.entries(nodeList).forEach(n => {
                    let removeList = {};
                    if (!n.value.find(e => {
                        if (!e.relatedLinks.length) removeList[e.id] = true;
                        return e.relatedLinks.length
                    }))
                        Object.keys(removeList).forEach(k => removeNodes[k] = true);
                })

                nodes = nodes.filter((n, index) => {
                    if (!removeNodes[n.id])
                        return true;
                    else {
                        // listUser[n.name] = n;
                        return false;
                    }
                });
                // console.log(listUser)
                links = links.filter(l => !(removeNodes[l.source] || removeNodes[l.target]))
            }
            console.timeEnd('create links');
            return {nodes, links};
        })();
        // TIME ARC
        const nodeObj = {};
        const nodesObj = {};
        nodes = graph.nodes.filter(d => {
            nodeObj[d.id] = d;
            if (d.first) {
                nodesObj[d.id] = true;
                return true;
            }
            return false;
        });
        nodes.forEach(d => d.color = this.getColorScale(d))
        const _links = graph.links.filter(l => !l.isSameNode && nodeObj[l.source] && nodeObj[l.target]).map(d => {
            if (nodeObj[d.source].parentNode !== undefined && (!nodesObj[d.source])) {
                nodeObj[nodeObj[d.source].parentNode].childNodes.push(d.source);
                nodes.push(nodeObj[d.source]);
                nodesObj[d.source] = true;
            }
            if (nodeObj[d.target].parentNode !== undefined && (!nodesObj[d.target])) {
                nodeObj[nodeObj[d.target].parentNode].childNodes.push(d.target);
                nodes.push(nodeObj[d.target]);
                nodesObj[d.target] = true;
            }
            let item = Object.assign({}, d);
            item.source = nodeObj[d.source];
            item.target = nodeObj[d.target];
            return item;
        });

        this.setState({isForceDone: false});
        // const forceNode = nodes.filter(d=>d.shared);
        debugger
        console.time('Force time');

        // let iterations=0;
//         this.force = d3.forceSimulation<Node>()
//             .force("charge", d3.forceManyBody().strength(-50))
//             .force('x', d3.forceX(this.widthG() / 2).strength(0.015))
//             .force('y',  d3.forceY(this.heightG() / 2).strength(0.015))
//             .nodes( forceNode)
//             .force('link',d3.forceLink<Node,SimulationLinkDatum<Node>>(_links).id(d=>''+d.id).distance(0))
//             .alpha(1)
//             .on('tick', () => {
//                 // iterations++;
//                 forceNode.forEach( (d,i) =>{
//                     if(d.x!==undefined && d.y!==undefined) {
//                         // d.x += ((self.widthG() / 2) - d.x) * 0.05;
//                         if (d.parentNode !== undefined) {
//                             if ((nodeObj[d.parentNode]!== undefined) && (nodeObj[d.parentNode].y !== undefined))
//                                 d.y += ((nodeObj[d.parentNode].y??0) - d.y) * 0.5;
//
//                             if (nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
//                                 nodeObj[d.parentNode].y = d3.mean(nodeObj[d.parentNode].childNodes,e=>nodeObj[e].y);
//                             }
//                         } else if (d.childNodes && d.childNodes.length) {
//                             var yy = d3.mean(d.childNodes, e => nodeObj[e].y);
//                             if (yy !== undefined)
//                                 d.y += (yy - d.y) * 0.2;
//                         }
//                     }
//                 });
//                 // console.log(iterations)
//                 // console.timeLog('Force time');
//                 // console.log(forceNode.slice().sort((a,b)=>a.y-b.y).map(d=>d.name))
// //                 console.log(d3.select<SVGSVGElement, any>('#timarc'))
// //                 console.log(d3.select<SVGSVGElement, any>('#timarc')
// //                         .selectAll<SVGTextElement, unknown>('text.l')
// //                         .data(forceNode)
// //                         .join('text')
// //                         .attr('fill', 'white')
// //                         .attr('class', 'l').text(d => d.name ?? '').attr('x', d => d.x ?? 0).attr('y', d => d.y ?? 0));
// //                 console.log(_links)
// //                 console.log(forceNode.slice().sort((a,b)=>a.y-b.y).map(d=>d.name).join(' > '))
//
//             })
//             .on("end",  () => {
//                 console.time('forceEnd')
//                 let left = 1;
//                 const nodep: Record<string, number|undefined> = {};
//                 forceNode.forEach(d=>{
//                     if ((d.parentNode !==undefined) && nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
//                         nodep[d.name] = d3.mean(nodeObj[d.parentNode].childNodes,e=>nodeObj[e].y);
//                     }else if(d.y){
//                         nodep[d.name] = d.y;
//                     }
//                 });
//                 Object.keys(nodep).sort((a,b)=>(nodep[a] as number)- (nodep[b] as number))
//                     .forEach((k,ki)=>nodep[k]= ki*10);
//                 // console.log(forceNode.slice().sort((a,b)=>a.y-b.y).map(d=>d.name))
//                 const miny =0;
//                     graph.nodes.forEach(d=>{
//                     d._forcey =  nodep[d.name];
//                     if((d._forcey === undefined) || _.isNaN(d._forcey) ) {
//                         if (nodep[d.name] === undefined) {
//                             nodep[d.name] = miny - 10 * (left);
//                             d._forcey = nodep[d.name];
//                             left++;
//                         } else {
//                             d._forcey = nodep[d.name];
//                         }
//                     }
//                     d.y = d._forcey;
//                 });
//                 // graph.nodes.forEach(d=>d._forcey = d.y??nodeObj[d.parentNode].y);
//                 self.nodeSort = function(a,b){ return (a._forcey-b._forcey)};
//                 const {nodes,links,linksBySource} = this.renderSankey({graph},0);
//                 // const {nodes,links} = this.renderSankey({graph},1);
//                 console.timeEnd('forceEnd')
//                 console.timeEnd('Force time')
//                 this.setState({nodes,links,linksBySource,graph,isForceDone:true});
//             })

        const mapIndex = {};
        let countmap = 0;
        const forceNode = nodes.filter(d => {
            if (d.shared) {
                mapIndex[d.id] = countmap;
                countmap++;
                return true;
            }
            return false;
        });
        console.log('forceNode length: ', forceNode.length, ' , link length: ', _links.length);
        if (forceNode.length)
        this.force
            .size([this.widthG(), this.heightG()])
            .nodes(forceNode)
            .links(_links)
            .constraints([{axis: "x", offsets: forceNode.map((d, i) => ({node: i, offset: 0})), type: "alignment"}])
            .jaccardLinkLengths(40, 0.7)
            // .avoidOverlaps(true)
            .start(20, 0, 10)
            .on('tick', () => {
                // iterations++;
                forceNode.forEach((d, i) => {
                    if (d.x !== undefined && d.y !== undefined) {
                        // d.x += ((self.widthG() / 2) - d.x) * 0.05;
                        if (d.parentNode !== undefined) {
                            if ((nodeObj[d.parentNode] !== undefined) && (nodeObj[d.parentNode].y !== undefined))
                                d.y += ((nodeObj[d.parentNode].y ?? 0) - d.y) * 0.5;

                            if (nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
                                nodeObj[d.parentNode].y = d3.mean(nodeObj[d.parentNode].childNodes, e => nodeObj[e].y);
                            }
                        } else if (d.childNodes && d.childNodes.length) {
                            var yy = d3.mean(d.childNodes, e => nodeObj[e].y);
                            if (yy !== undefined)
                                d.y += (yy - d.y) * 0.2;
                        }
                    }
                });

                // console.log(d3.select<SVGSVGElement, any>('#timarc')
                //         .selectAll<SVGTextElement, unknown>('text.l')
                //         .data(forceNode)
                //         .join(  'text')
                //         .attr('fill', 'white')
                //         .attr('class', 'l').text(d => d.name ?? '').attr('x', d => d.x ?? 0).attr('y', d => d.y ?? 0));
                d3.select('#timarc')
                    .selectAll('path.l')
                    .data(_links)
                    .join('path')
                    .attr('class', 'l').attr('d', linkArc).attr('stroke', 'white').attr('fill', 'none');

                function linkArc(d) {
                    var dx = d.target.x - d.source.x,
                        dy = d.target.y - d.source.y,
                        dr = Math.sqrt(dx * dx + dy * dy) / 2;
                    if (d.source.y < d.target.y)
                        return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
                    else
                        return "M" + d.target.x + "," + d.target.y + "A" + dr + "," + dr + " 0 0,1 " + d.source.x + "," + d.source.y;
                }
            })
            .on('end', () => {
                console.time('forceEnd')
                let left = 1;
                const nodep = {};
                forceNode.forEach(d => {
                    if ((d.parentNode !== undefined) && nodeObj[d.parentNode].childNodes && nodeObj[d.parentNode].childNodes.length) {
                        nodep[d.name] = d3.mean(nodeObj[d.parentNode].childNodes, e => nodeObj[e].y);
                    } else if (d.y) {
                        nodep[d.name] = d.y;
                    }
                });
                Object.keys(nodep).sort((a, b) => (nodep[a]) - (nodep[b]))
                    .forEach((k, ki) => nodep[k] = ki * 10);
                // console.log(forceNode.slice().sort((a,b)=>a.y-b.y).map(d=>d.name))
                const miny = 0;
                graph.nodes.forEach(d => {
                    d._forcey = nodep[d.name];
                    if ((d._forcey === undefined) || _.isNaN(d._forcey)) {
                        if (nodep[d.name] === undefined) {
                            nodep[d.name] = miny - 10 * (left);
                            d._forcey = nodep[d.name];
                            left++;
                        } else {
                            d._forcey = nodep[d.name];
                        }
                    }
                    d.y = d._forcey;
                });
                // graph.nodes.forEach(d=>d._forcey = d.y??nodeObj[d.parentNode].y);
                self.nodeSort = function (a, b) {
                    return (a._forcey - b._forcey)
                };
                const {nodes, links, linksBySource} = this.renderSankey({graph}, 0);
                // const {nodes,links} = this.renderSankey({graph},1);
                console.timeEnd('forceEnd')
                console.timeEnd('Force time')
                this.setState({nodes, links, linksBySource, graph, isForceDone: true});
                if (this.props.sankeyResult)
                    this.props.sankeyResult(linksBySource,this.getColorScale.bind(this));
            });
        // this.force.stop();
        // this.force.alpha(1).restart();
        this.setState({times, graph})
    }

// order () {
//     let orderedArray = [];
//     let nextIndex = 0;
//
//     for (var i = 0; i < updated_data.length; i++) {
//         dfs(updated_data[i], orderedArray);
//     }
//
//     // DFS
//     function dfs(o, array) {
//         if (o.isDone == undefined) {
//             array.push(o);
//             o.isDone = true;
//             if (o.children != undefined) {
//                 for (var i = 0; i < o.children.length; i++) {
//                     dfs(o.children[i], array);
//                 }
//             }
//         }
//     }
//
//     // DFS
//     function getSuccessors(o, array) {
//         if (o.children != undefined) {
//             for (var i = 0; i < o.children.length; i++) {
//                 array.push(o.children[i]);
//             }
//             for (var i = 0; i < o.children.length; i++) {
//                 getSuccessors(o.children[i], array)
//             }
//         }
//         return array;
//     }
// }
    renderSankey(opts = {}, linearScale = 0) {
        const {x, sankey} = this;
        const nodeSort = this.nodeSort.bind(this);
        const graph = opts.graph ?? this.state.graph;
        let nodeObj = {};
        graph.nodes.forEach((d) => {
            nodeObj[d.id] = d;
        });
        console.time('Sankey cal')
        sankey.nodeId(function (d) {
            return d.id
        })
            .nodeSort(nodeSort)
            // .linkSort(function(a,b){return ((a.source._forcey+a.target._forcey)-(b.source._forcey+b.target._forcey))})
            .extent([[x.range()[0], 10], [x.range()[1], this.heightG() - 10]]);

        const __nodes = graph.nodes.map((d) => Object.assign({}, d))
        const __links = graph.links.map((d) => {
            const link = Object.assign({}, d);
            link._value = link.value;
            link.value = d.value + linearScale;
            return link;
        })
        const {nodes, links} = sankey({
            nodes: __nodes,
            links: __links
        });
        console.timeEnd('Sankey cal')
        const linksBySource = d3.groups(links,(d) => d.source.name).map(d=>({key:d[0],values:d[1]}));
        linksBySource.forEach((l) => {
            let pre = l.values[0].source;
            let preL = l.values[0];
            l.drawP = [horizontalSource3(preL)];
            l.draw = [pre];
            l.values.forEach((d) => {
                if (pre !== d.source) {
                    l.draw.push(pre, d.source);
                    l.drawP.push(horizontalTarget3(preL), undefined, horizontalSource3(d));
                } else {
                    l.draw.push(d.source);
                    l.drawP.push(horizontalTarget3(preL), horizontalSource3(d));
                }
                pre = d.target;
                preL = d;
            });
            l.draw.push(pre);
            l.drawP.push(horizontalTarget3(preL));
            l._class = str2class(l.key);
        });
        this.isAnimate = true;
        if (links.length > 400)
            this.isAnimate = false;
        links.forEach(l => {
            if (l.isSameNode) {
                let parentNode = l.source;
                if (l.source.parentNode !== undefined) {
                    parentNode = nodeObj[l.source.parentNode];
                }
                if (parentNode.drawData.length === 0 || parentNode.drawData[parentNode.drawData.length - 1][0] !== l.source.time)
                    parentNode.drawData.push([l.source.time, l.value]);
                parentNode.drawData.push([l.target.time, l.value]);
            }


            l._class = str2class(l.source.name)
        });
        return {nodes, links, linksBySource: linksBySource, graph}
    }

// onMouseOver(d:Link,event:MouseEvent){
//     const list:Record<string, boolean> = {};
//     const highlight = { list, el:d, event };
//     if( d.source.element.length >1){
//         highlight.list[d.source.name] = true;
//         d.source.element.forEach((e:any)=>highlight.list[e.key] = true);
//     }else
//         highlight.list[d.source.name] = true;
//     this.setState({highlight})
//     this.props.mouseOver(d);
// }
    onMouseOver(target, event) {
        // @ts-ignore
        const [x, y] = d3.pointer(event.target, event);
        const d = target.values[d3.bisect(target.values.map(e => e.source.time), this.x.invert(x))];
        const list = {};
        if (d && (!this.state.highlight || (this.state.highlight && (d !== this.state.highlight.el)))) {
            debugger
            const highlight = {list, el: d, event};
            if (d.source.element.length > 1) {
                highlight.list[d.source.name] = true;
                d.source.element.forEach((e) => highlight.list[e.key] = true);
            } else
                highlight.list[d.source.name] = true;
            this.setState({highlight})
            this.props.mouseOver(d);
        }
    }

    onRelease() {
        this.setState({highlight: undefined, highlightJob: undefined});
        this.props.mouseLeave();
    }

    onMouseOverJob(d) {
        const highlightJob = {el: d};
        this.setState({highlightJob});
        this.props.mouseOver(this.state.highlight?.el, d);
    }

    onReleaseJob() {
        this.setState({highlightJob: undefined});
        this.props.mouseOver(this.state.highlight?.el);
    }

    _getColorScale_byName(d) {
        if (d.isShareUser)
            return this.props.theme.isDark ? '#696969' : 'white';
        else
            return (this._color)(d.name ?? '')
    }

    getCluster(d) {
        const index = d.layer;
        let groups = {};
        Object.keys(d.comp).forEach(k => {
            if (this.props.metrics) {
                const com = this.props.metrics[k];
                if (com && com[index]) {
                    const _val = com[index].cluster;
                    if (_val !== undefined) {
                        if (!groups[_val])
                            groups[_val] = 0;
                        groups[_val]++;
                    }
                }
            }
        });
        const val = Object.keys(groups).length;
        return val > 1 ? undefined : (val === 1 ? Object.keys(groups)[0] : 'outlier');
    }

    getValue(d) {
        const index = d.layer;
        const _key = +(this.props.colorBy ?? '0');
        // const val = d3.mean(Object.keys(d.comp),k=>{
        //     if(this.props.metrics) {
        //         const com = this.props.metrics[k];
        //         if (com && com[index])
        //             return com[index][_key];
        //     }
        //     return undefined
        // });
        // return val;
        let sum = 0;
        let total = 0;
        Object.keys(d.comp).forEach(k => {
            if (this.props.metrics) {
                const com = this.props.metrics[k];
                if (com && com[index]) {
                    const _val = com[index][_key];
                    if (_val !== undefined) {
                        sum += _val * d.comp[k];
                        total += d.comp[k]
                    }
                }
            }
        });
        const val = sum / total;
        return (total) ? val : undefined;
    }

    _getColorScale_byCluster(d) {
        const val = this.getCluster(d);
        return val ? (this.props.colorCluster)(val) : 'white'
    }

    _getColorScale_byValue(d) {
        const val = this.getValue(d);
        return '' + (this.color)(val)
    }

    getColorScale = this._getColorScale_byName;

    renderLink(d) {
        const {sankeyComputeSelected} = this.props
        const start = d.draw[0].x1;
        const endT = _.last(d.draw);
        const end = (endT?.x0) ?? 0;
        const scale = d3.scaleLinear().range([0, 100]).domain([start, end]);
        const fill = (this.props.colorBy !== 'name') ? `url(#${d.values[0]._id})` : this.getColorScale(d.draw[0] ?? {})//this.getColorScale(endT??{});
        const dot = [];
        if (sankeyComputeSelected && sankeyComputeSelected.nodes[d.key]) {
            d.values.forEach(l => {
                if (sankeyComputeSelected.nodes[d.key][l.target.layer]) {
                    sankeyComputeSelected.nodes[d.key][l.target.layer].x = l.target.x0;
                    sankeyComputeSelected.nodes[d.key][l.target.layer].y = l.y1;
                    dot.push(sankeyComputeSelected.nodes[d.key][l.target.layer])
                }
            })
        }
        const color = this.props.colorCluster ? this.props.colorCluster('outlier') : 'gray';
        return <>
            {(this.props.colorBy !== 'name') ?
                <linearGradient id={d.values[0]._id} gradientUnits={'userSpaceOnUse'} x1={start} x2={end}>
                    {d.draw.map(e => <stop key={e.index} offset={`${scale(e.x0)}%`}
                                           stopColor={this.getColorScale(e)}/>)}
                </linearGradient> : ''}
            <path className={'main'} fill={fill} stroke={fill}
                  strokeWidth={0.1} d={linkPath(d.drawP) ?? ''}/>
            {sankeyComputeSelected ? dot.map(d => <circle fill={color} key={d.timestep} r={Math.sqrt(d.value) + 2}
                                                          cx={d.x} cy={d.y} stroke={"white"}/>) : ''}
        </>
    }

    render() {
        const {width, height, theme, timespan, lineaScale,userHighlight} = this.props;
        const {margin, nodes, linksBySource, isForceDone, highlight, highlightJob} = this.state;
        const {x, y} = this;
        const styles = getStyles;
        y.range([0, this.heightG()]).padding(this.padding);
        x.range([0, this.widthG()]);

        let scale = d3.scaleTime().range(x.range()).domain([timespan[0], timespan[timespan.length - 1]]);
        this._color = this.props.colorByName ?? d3.scaleOrdinal(["#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"]);
        this.color = this.props.color ?? this._color;
        if (this.props.color) {
            switch (this.props.colorBy) {
                case 'name':
                    this.getColorScale = this._getColorScale_byName;
                    break;
                case 'cluster':
                    this.getColorScale = this._getColorScale_byCluster;
                    break;
                default:
                    this.getColorScale = this._getColorScale_byValue;
            }
        }
        const time = highlightJob?.el.time ?? highlight?.el.source.time;
        area.y0((d) => d[1] + (d[2] + lineaScale)).y1((d) => d[1] - (d[2] + lineaScale));
        return <div style={{width: width + ' px', height: height + ' px', position: 'relative',pointerEvents:'none'}}>
            <svg width={width}
                 height={height}
                 viewBox={`0 0 ${width} ${height}`}
                 ref={this.svgRef}
                // style={{backgroundColor:'white'}}
                 style={{overflow:'visible'}}
                 className={styles.svg}>

                <defs>
                    <clipPath id={'timeClip'}>
                        <rect x={-margin.left} width={margin.left} height={this.heightG()}/>
                    </clipPath>
                </defs>
                {/*<rect className={"pantarget"} width={width} height={height} onClick={() => this.freezeHandle()}*/}
                      {/*opacity="0"/>*/}
                {this.state.freezing && <text fill={this.props.theme.isDark ? 'white' : 'black'}
                                              transform={`translate(${this.widthG() / 2},20)`}>Click anywhere to
                    release</text>}
                {isForceDone ? <g className={'content' + ((highlight||userHighlight) ? ' onhighlight' : '')}>
                        <g className={'background'} opacity={0.2}></g>
                        <g className={'drawArea'}>
                            <g className={'nodes'}>
                                {nodes.filter(d => d.first).map(d => <g key={d.name}
                                                                        className={'outer_node element' + (((highlight && highlight.list[d.name])||(userHighlight && userHighlight[d.name])) ? ' highlight' : '')}
                                                                        transform={`translate(${d.x0},${d.y0})`}>
                                    {/*<title></title>*/}
                                    <text x={-6} y={(d.y1 + d.y0) / 2 - d.y0} dy={"0.35em"} textAnchor={'end'}
                                          paintOrder={'stroke'}
                                          stroke={'black'} strokeWidth={1}
                                          fill={d.first ? this._getColorScale_byName(d) : 'white'}
                                          fontWeight={d.isShareUser ? undefined : 'bold'}>{d.first ? d.name : ''}</text>
                                </g>)}
                            </g>
                            <g className={'links'}>
                                {/*{links.map(d=><NodeElement className={'outer_node element '+d._class+(d.hide?' hide':'')+((highlight&&(highlight.list[d.source.name]||highlight.list[d.target.name]))?' highlight':'')} key={d._id}*/}
                                {/*                 opacity={0.7}  transform={'scale(1,1)'}*/}
                                {/*                           //style={{mixBlendMode:'multiply'}}*/}
                                {/*                           freezing={this.state.freezing} setfreezing={(freezing)=>{this.setState({freezing}); if(!freezing){this.onRelease()}}}*/}
                                {/*                           mouseOver={(e:MouseEvent)=>this.onMouseOver(d,e)} mouseLeave={()=>this.onRelease()}>*/}
                                {/*    {this.getColorScale===this._getColorScale_byName?<linearGradient id={d._id} gradientUnits={'userSpaceOnUse'} x1={d.source.x1} x2={d.target.x0}>*/}
                                {/*        <stop offset={'0%'} stopColor={this.getColorScale(d.source)}/>*/}
                                {/*        <stop offset={'100%'} stopColor={this.getColorScale(d.target)}/>*/}
                                {/*    </linearGradient>:''}*/}
                                {/*    <path className={'main'+(d.arr===undefined?' hide':'')} fill={this.getColorScale===this._getColorScale_byName?`url(#${d._id})`:this.getColorScale(d.target)} stroke={`url(#${d._id})`}*/}
                                {/*        strokeWidth={0.1} d={linkPath(d,this.props.lineaScale)}/>*/}
                                {/*    {highlight&&(highlight.list[d.source.name]||highlight.list[d.target.name])?<g stroke={this.props.theme.isDark?'black':'white'} style={{pointerEvents:this.state.freezing?'all':'none'}}>{renderjob(d,this.props.lineaScale,this.props.maxPerUnit,this.getColorScale.bind(this), this.onMouseOverJob.bind(this), this.onReleaseJob.bind(this),this.getValue.bind(this),highlightJob)}</g>:''}*/}
                                {/*</NodeElement>)}*/}
                                {
                                    linksBySource.map(d => <NodeElement
                                        className={'outer_node element ' + d.values[0]._class + (d.hide ? ' hide' : '') + (((highlight && highlight.list[d.key])||(userHighlight && userHighlight[d.key])) ? ' highlight' : '')}
                                        key={d.key}
                                        opacity={0.7} transform={'scale(1,1)'}
                                        //style={{mixBlendMode:'multiply'}}
                                        freezing={this.state.freezing} setfreezing={(freezing) => {
                                        this.setState({freezing});
                                        if (!freezing) {
                                            this.onRelease()
                                        }
                                    }}
                                        mouseMove={(e) => this.onMouseOver(d, e)}
                                        mouseLeave={() => this.onRelease()}>
                                        {this.renderLink(d)}
                                        {highlight && (highlight.list[d.key]) ? d.values.map(j => <g key={j._id}
                                                                                                     stroke={this.props.theme.isDark ? 'black' : 'white'}
                                                                                                     style={{pointerEvents: this.state.freezing ? 'all' : 'none'}}>{renderjob(j, this.props.lineaScale, this.props.maxPerUnit, this.getColorScale.bind(this), this.onMouseOverJob.bind(this), this.onReleaseJob.bind(this), this.getValue.bind(this), highlightJob)}</g>) : ''}
                                    </NodeElement>)
                                }
                            </g>
                            {/*{highlight?<g transform={`translate(${highlight.event.nativeEvent.offsetX+5},${highlight.event.nativeEvent.offsetY+5})`} style={{pointerEvents:'none'}}>*/}
                            {(highlight && (!highlightJob)) ?
                                <g transform={`translate(${highlight.el.target.x0 + 5},${highlight.el.y1 + 5})`}
                                   stroke={'black'}
                                   fill={'white'}
                                   style={{pointerEvents: 'none'}}>
                                    <text
                                        strokeWidth={1}
                                        paintOrder={'stroke'}>{highlight.el.source.name}</text>
                                    {/*<text*/}
                                    {/*      strokeWidth={1}*/}
                                    {/*      y={14}*/}
                                    {/*      paintOrder={'stroke'}>Time: {new Date(highlight.el.source.time).toLocaleString()}</text>*/}
                                    {/*<text*/}
                                    {/*    strokeWidth={1}*/}
                                    {/*    y={28}*/}
                                    {/*    paintOrder={'stroke'}>#{this.props.mode==='core'?'Cores':'Nodes'}={+d3.format('.2f')(highlight.el.value)}</text>*/}
                                    <text
                                        strokeWidth={0.5}
                                        y={14}
                                        paintOrder={'stroke'}>#{this.props.mode === 'core' ? 'Cores' : 'Nodes'}={+d3.format('.2f')(highlight.el.source.value)}</text>
                                    <text
                                        strokeWidth={0.5}
                                        y={28}
                                        // paintOrder={'stroke'}>{this.props.getMetric((this.props.colorBy==='cluster')?this.getCluster(highlight.el.target):highlight.el.value)}</text>
                                        paintOrder={'stroke'}>{this.props.getMetric(highlight.el.value)}</text>
                                </g> : ''}
                            {highlightJob ? <g transform={`translate(${highlightJob.el.x + 5},${highlightJob.el.y + 5})`}
                                               stroke={'black'}
                                               fill={'white'}
                                               style={{pointerEvents: 'none'}}>
                                <text
                                    strokeWidth={1}
                                    y={-14}
                                    paintOrder={'stroke'}>User: {highlightJob.el.user_name}</text>
                                <text
                                    strokeWidth={1}
                                    paintOrder={'stroke'}>JobId: {highlightJob.el.name}</text>
                                <text
                                    strokeWidth={1}
                                    y={14}
                                    paintOrder={'stroke'}>Compute: {(highlightJob.el.data.node_list.length > 5) ? (highlightJob.el.data.node_list.slice(0, 5).join(', ') + ` + ${highlightJob.el.data.node_list.length - 5}`) : highlightJob.el.data.node_list.join(', ')}</text>
                                <text
                                    strokeWidth={1}
                                    y={28}
                                    paintOrder={'stroke'}>Start: {new Date(highlightJob.el.data.start_time).toLocaleString()}</text>
                                <text
                                    strokeWidth={1}
                                    y={42}
                                    paintOrder={'stroke'}>End {highlightJob.el.data.finish_time ? new Date(highlightJob.el.data.finish_time).toLocaleString() : '-'}</text>
                                <text
                                    strokeWidth={1}
                                    y={56}
                                    paintOrder={'stroke'}>{this.props.getMetric(highlightJob.el.value)}</text>
                            </g> : ''}
                        </g>
                        <g className={'axis'}>
                            <g className={'axisx'} transform={`translate(0,${this.heightG()})`}>
                                {scale.ticks(10).map(d => <g className={'ticks'}
                                                             transform={`translate(${scale(d)},${0})`}>
                                    <text dy='1.5rem' textAnchor={'middle'}
                                          fill={'white'}>{multiFormat(d)}</text>
                                    <line y2={5} vectorEffect="non-scaling-stroke"
                                          style={{stroke: this.props.theme.isDark ? 'white' : 'black', strokeWidth: 0.2}}/>
                                </g>)}
                                <line x2={scale.range()[1]} vectorEffect="non-scaling-stroke"
                                      style={{stroke: this.props.theme.isDark ? 'white' : 'black', strokeWidth: 0.5}}/>
                            </g>
                        </g>
                        <g className={'timeHandleHolder' + highlight ? '' : ' hide'}
                           transform={`translate(${scale(time)},0)`}>
                            <line className={'timeStick'} y2={this.heightG()} stroke={'white'}
                                  strokeDasharray={'2 1'}/>
                            <text y={this.heightG()} dy='2.5rem'
                                  fill={this.props.theme.isDark ? 'white' : 'black'}>{time ? new Date(+time).toLocaleString() : ''}</text>
                        </g>
                    </g>
                    : <svg width={width}
                           height={height}
                           viewBox={`0 0 ${width} ${height}`}
                           id={'timarc'}
                           style={{backgroundColor: 'white'}}
                    />}
                {/*:<text transform={`translate(${[width/2,height/2]})`} fill={this.props.theme.isDark?'white':'black'}>Calculating position...</text>}*/}
            </svg>
        </div>;
    }
}

export function getUserName(arr) {
    if (arr && arr.length) {
        return arr.map(d => d.key).join(',');
    } else
        return 'No user';
}

export function getUserName2(arr) {
    if (arr && arr.length) {
        return arr.join(',');
    } else
        return 'No user';
}

export function horizontalSource3(d) {
    return [d.source.x1, d.y0, d.width / 2];
}

export function horizontalTarget3(d) {
    return [d.target.x0, d.y1, d.width / 2];
}

export function horizontalSource(d) {
    return [d.source.x1, d.y0];
}

export function horizontalTarget(d) {
    return [d.target.x0, d.y1];
}

// function linkPath(d:any,lineaScale=0) {
//     const source = horizontalSource(d);
//     const target = horizontalTarget(d);
//     const width = (target[0]-source[0])/2;
//     const thick = d.width/2;
//
//     return renderFargment(source,target,width,thick,lineaScale);
// }

function linkPath(d) {
    return area(d);
}

function renderFargment(source, target, width, thick, lineaScale = 0) {
    thick = thick + lineaScale;
    return `M ${source[0]} ${source[1] - thick} C ${source[0] + width} ${source[1] - thick}, ${target[0] - width} ${target[1] - thick}, ${target[0]} ${target[1] - thick}
            L ${target[0]} ${target[1] + thick} C ${target[0] - width} ${target[1] + thick}, ${source[0] + width} ${source[1] + thick}, ${source[0]} ${source[1] + thick} Z`;
}

function renderjob(d, lineaScale = 0, max, getColorScale, onMouseOverJob, onReleaseJob, getValue, highlightJob) {
    const source = horizontalSource(d);
    const target = horizontalTarget(d);
    const thick = d.width;
    // const deltaThick = thick/n;
    // const width = (target[0]-source[0]);
    const width = (target[0] - source[0]) / 2;
    // return <>{d3.range(0,n-1).map((e,ei)=><line x2={width} transform={`translate(${[source[0],source[1]-thick/2+deltaThick*(e+1)]})`}/>)}</>
    const v = d3.sum(Object.values(d.byComp_t));
    const scale = d3.scaleLinear().domain([0, v]).range([0, thick + lineaScale]);
    let offest = -thick / 2;
    const _byComp_s = {};
    const _compS = {};
    Object.keys(d.sources).forEach(e => {
        _compS[e] = {};
        d.sources[e].data.node_list.forEach((comp) => {
            if (d.source.comp[comp]) {
                _compS[e][comp] = Math.min(max, d.sources[e].data.node_list_obj[comp])
                _byComp_s[comp] = (_byComp_s[comp] ?? 0) + _compS[e][comp];
            }
        });
    });
    Object.keys(d.sources).forEach(e => {
        const compT = {};
        const compS = _compS[e];
        let oldpos = Infinity;
        // oldpos = d.sources[e].data.start_Index;
        // let _past = undefined;
        // d.source.relatedLinks.f
        if (d.sources[e].data[d.source.layer - 1]) {
            // d.sources[e].data.node_list.forEach((comp:string)=>{if(d.source.comp[comp]) compS[comp] = Math.min(max,d.sources[e].data.node_list_obj[comp])});
            oldpos = d3.mean(d.sources[e].data[d.source.layer - 1], (d) => d.y) ?? Infinity;
        }
        const isEnd = d.source.layer === d.sources[e].data.finish_Index;
        const value = d3.sum(Object.keys(compS), k => (compS[k] / _byComp_s[k]) * d.byComp[k]);
        const _thick = scale(value) ?? 0;
        d.sources[e].display = {compS, compT, isEnd, _thick, oldpos, data: d.sources[e].data}
        if (!d.sources[e].data[d.source.layer])
            d.sources[e].data[d.source.layer] = [d.sources[e].display]
    });

    return <>{Object.keys(d.sources).sort((a, b) => d.sources[a].display.oldpos - d.sources[b].display.oldpos).map((e, ei) => {
        const {compS, isEnd, _thick, data} = d.sources[e].display;
        offest += _thick;
        d.sources[e].display.y = target[1] + offest - _thick / 2;
        const comp = {};
        Object.keys(compS).forEach(c => comp[c] = d.sources[e].data.node_list_obj[c]);
        const _Data = {...d.source, comp};
        const colorS = getColorScale(_Data);
        const thick = _thick / 2;

        return <g key={d._id + '__' + e} onMouseOver={() => onMouseOverJob({
            name: e,
            user_name: d.source.name,
            x: source[0],
            y: d.sources[e].display.y,
            time: d.source.time,
            layer: d.source.layer,
            value: getValue(_Data),
            data
        })} onMouseLeave={() => onReleaseJob()}
                  className={highlightJob ? ((highlightJob.el.name !== e) ? 'fade' : '') : ''}>
            {isEnd ? <linearGradient id={d._id + '__' + e} gradientUnits={'userSpaceOnUse'} x1={d.source.x1}
                                     x2={d.target.x0}>
                <stop offset={'0%'} stopColor={colorS}/>
                <stop offset={'100%'} stopColor={'black'}/>
            </linearGradient> : ''}
            <path fill={isEnd ? `url(#${d._id + '__' + e})` : colorS}
                  strokeWidth={0.1}
                  d={renderFargment([source[0], source[1] + offest - thick], [target[0], d.sources[e].display.y], width, thick)}/>
        </g>
    })}</>
}

function str2class(str) {
    return 'l' + str.replace(/ |,/g, '_');
}

const formatMillisecond = d3.timeFormat(".%L"),
    formatSecond = d3.timeFormat(":%S"),
    formatMinute = d3.timeFormat("%I:%M"),
    formatHour = d3.timeFormat("%I %p"),
    formatDay = d3.timeFormat("%a %d"),
    formatWeek = d3.timeFormat("%b %d"),
    formatMonth = d3.timeFormat("%B"),
    formatYear = d3.timeFormat("%Y");

function multiFormat(date) {
    return (d3.timeSecond(date) < date ? formatMillisecond
        : d3.timeMinute(date) < date ? formatSecond
            : d3.timeHour(date) < date ? formatMinute
                : d3.timeDay(date) < date ? formatHour
                    : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
                        : d3.timeYear(date) < date ? formatMonth
                            : formatYear)(date);
}

const getStyles = {
    svg: css`
            & .fade 
            {opacity: 0.2;}
             & .onhighlight .outer_node:not(.highlight) 
                  {opacity: 0.1;}
              & .onhighlight .outer_node.highlight 
                  {
                  
                  }
            `
}

import {LineGraph} from "./linegraph";
import * as neurons from "./neuron_models";
import {State, UIBuilder, UIBuilders, GraphParams} from "./state";
import {MultiPoint, Point} from "./utilities";

let neuronModels: {[key: string]: neurons.BiologicalNeuron} = {
  "Izhikevich": new neurons.Izhikevich(0.1, 0.25, -65, 8),
  "FitzHugh-Nagumo": new neurons.FitzHugh_Nagumo(0.08, 0.7, 0.8)
};

let uis: {[key: string]: UIBuilder} = {
  "Izhikevich": UIBuilders.IzhikevichUI,
  "FitzHugh-Nagumo": UIBuilders.FitzHugh_NagumoUI
}

let graphRanges: {[key: string]: GraphParams} = {
  "Izhikevich": {
    time: 1000,
    spikeXRange: [0, 1000],
    spikeYRange: [-85, 30],
    phaseXRange: [-80, -30],
    phaseYRange: [-30, 5],
    inputRange: [-10, 20],
    IF_XRange: [0, 50],
    IF_YRange: [0,100]
  },
  "FitzHugh-Nagumo":{
    time: 1000,
    spikeXRange: [0, 1000],
    spikeYRange: [-2, 2],
    phaseXRange: [-2, 2],
    phaseYRange: [-2, 2],
    inputRange: [-1, 1],
    IF_XRange: [0, -1],
    IF_YRange: [0,100]
  }
}

let state = new State();

function redraw(state: State): void {
  //update the linegraphs
  let inputs: number[] = [];
  let inputdata: MultiPoint[] = [];
  for (let i = 0, t = 0; t < state.graphParams.time; i++, t += state.dt) {
    let input = state.inputFunction(t, state.input);
    inputs.push(input);
    inputdata.push({x: t, y: [input]});
  }
  let spikedata = state.neuron.solve(inputs, state.dt); 
  state.spikeTrain.update(spikedata);
  state.inputGraph.update(inputdata);

  //phase graph
  let graphTransplant = state.phaseGraph.transplant();
  graphTransplant.svg.selectAll("circle").remove();
  graphTransplant.svg.selectAll(".vector").remove();
  let fixedPoints = state.neuron.fixedPoints(state.input);
  let criticalLines = state.neuron.nullcline(state.input);
  let phasedata = [];
  //Draw nullcline
  let phaseXRange = state.graphParams.phaseXRange;
  let phaseYRange = state.graphParams.phaseYRange;
  for (let v = phaseXRange[0]; v < phaseXRange[1]; v += 0.1) {
    phasedata.push({x: v, y: [criticalLines[0](v), criticalLines[1](v)]});
  }

  for (let v = phaseXRange[0]; v < phaseXRange[1]; v += (phaseXRange[1] - phaseXRange[0])/6) {
    for (let u = phaseYRange[0]; u < phaseYRange[1]; u += (phaseYRange[1] - phaseYRange[0])/10) {
      let points: {x: number, y: number}[] = [];
      let tmpState = [v, u];
      for (let t = 0; t < 300; t++) {
        if (tmpState[0] < phaseXRange[0] || tmpState[0] > phaseXRange[1] || tmpState[1] < phaseYRange[0] || tmpState[1] > phaseYRange[1]) {
          break;
        }
        points.push({x: tmpState[0], y: tmpState[1]});
        tmpState = state.neuron.solve([state.input], state.dt, tmpState)[0].y;
      }
      drawVector(graphTransplant.svg, points, graphTransplant.xscale, graphTransplant.yscale);
    }
  }
  state.phaseGraph.update(phasedata);
   //Draw fixed Points
  for (let i = 0; i < fixedPoints.length; i++) {
    let pnt = fixedPoints[i].point;
    if (pnt.x >= phaseXRange[0] && pnt.x <= phaseXRange[1]) {
      drawfixedPoint(graphTransplant.svg, pnt, fixedPoints[i].type, graphTransplant.xscale, graphTransplant.yscale);
    }
  } 
  //DRAW IF CURVE
  let is: number[] = [];
  let ts: number[] = [];
  for (let i = state.graphParams.IF_XRange[0]; Math.abs(i) < Math.abs(state.graphParams.IF_XRange[1]); i += (state.graphParams.IF_XRange[1] - state.graphParams.IF_XRange[0])/50) {
    is.push(i);
  }
  state.ifCurve.update(state.neuron.IFCurve(is, state.dt, 100/state.dt));
}

function drawfixedPoint(svg: d3.Selection<any, any, any, any>, point: {x: number, y: number}, type: string, xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>) {
  let color: string = "black";
  if (type == "asymptotic sink") {
    color = "purple";
  } else if (type == "asymptotic source") {
    color = "pink";
  } else if (type == "sink") {
    color = "blue";
  } else if (type == "source") {
    color = "red";
  }

  svg.select(".extra")
     .datum(point)
     .append("circle")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", (d) => 2)
      .attr("fill", color)
      .attr("class", type);
}

function drawVector(svg: d3.Selection<any, any, any, any>, points: {x: number, y: number}[], xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>) {

  let getLine = d3.line<{x: number, y: number}>()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y));
  
  svg.select(".extra")
     .datum(points)
     .append("path")
     .attr("stroke-width", "0.1")
     .attr("alpha", "3")
     .attr("stroke", "steelblue")
     .attr("stroke-opacity", "0.3")
     .attr("class", "vector line")
      .attr("d", getLine)
      .attr("marker-start","url(#arrow)")
      .attr("marker-end","url(#arrow)")
} 

function UI() {
  function reset(): void {
    state.ui.demolish(d3.select("body"));
    state.ui.build(d3.select("body"), state, redraw);
  } 

  let neuronDropDown = d3.select("#neuron").on("change", function() {
    state.neuron = neuronModels[this.value];
    state.ui = uis[this.value];
    state.graphParams = graphRanges[this.value];
    reset();
    state.phaseGraph.updateScales(state.graphParams.phaseXRange, state.graphParams.phaseYRange);
    state.inputGraph.updateScales(state.graphParams.spikeXRange, state.graphParams.inputRange);
    state.spikeTrain.updateScales(state.graphParams.spikeXRange, state.graphParams.spikeYRange);
    state.ifCurve.updateScales(state.graphParams.IF_XRange, state.graphParams.IF_YRange);
    redraw(state);
  });
}

function init() {
  let neuron = "Izhikevich";
  state.neuron = neuronModels[neuron];
  state.input = 10;
  state.inputFunction = (time: number, input: number) => input;
  state.dt = 0.05;
  state.graphParams = graphRanges["Izhikevich"];
  state.ui = uis["Izhikevich"];
  state.ui.demolish(d3.selectAll("body"));
  state.ui.build(d3.selectAll("body"), state, redraw);
  let spiketrainSvg = d3.select("#spiketrain")
                        .append("svg")
                          .attr("width", 800)
                          .attr("height", 230);
  let inputgraphSvg = d3.select("#inputgraph")
                        .append("svg")
                          .attr("width", 800)
                          .attr("height", 80); 
  let phasegraphSvg = d3.select("#phasegraph")
                        .append("svg")
                          .attr("width", 300)
                          .attr("height", 300);
  phasegraphSvg.append("svg:defs")
            .append("svg:marker")
            .attr("id", "arrow")	
            .attr("refX", 0)
            .attr("refY", 2)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("svg:path")
            .attr("d", "M0,0 L0,4 L3,2 L0,0")
            .attr("fill", "steelblue")
            .attr("fill-opacity", "0.5");
 let ifcurvegraphSvg = d3.select("#ifcurvegraph")
                        .append("svg")
                          .attr("width", 300)
                          .attr("height", 300);

let phaseLegend = d3.select("#fixedPointLegend")
                    .append("svg")
                      .attr("width", 300)
                      .attr("height", 200);

let stabilityPoints = [{color: "purple", type: "asymptotic sink"},{type: "asymptotic source", color: "pink"},{color: "blue", type: "sink"}, {color: "red", type: "source"}, {color: "black", type: "saddle"}];
let xpos = 30,
    ypos = 10,
    size = 5;
phaseLegend.selectAll("circle")
          .data(stabilityPoints)
          .enter()
          .append("circle")
          .attr("r", (d, i) => size)
          .attr("cx", (d, i) => xpos)
          .attr("cy", (d, i) => ypos + 20*i)
          .attr("fill", (d, i) => d.color);


phaseLegend.selectAll("text")
          .data(stabilityPoints)
          .enter()
          .append("text")
          .attr("dx", (d, i) => xpos + 10)
          .attr("dy", (d, i) => ypos + i*20 + 5)
          .text((d) => d.type);

  state.spikeTrain = new LineGraph(spiketrainSvg, 1, ["steelblue"], [state.graphParams.spikeXRange, state.graphParams.spikeYRange]);
  state.inputGraph = new LineGraph(inputgraphSvg, 1, ["orange"], [state.graphParams.spikeXRange, state.graphParams.inputRange]);
  state.phaseGraph = new LineGraph(phasegraphSvg, 2, ["black", "black"], [state.graphParams.phaseXRange, state.graphParams.phaseYRange]);
  state.ifCurve = new LineGraph(ifcurvegraphSvg, 1, ["steelblue"], [state.graphParams.IF_XRange, state.graphParams.IF_YRange]);
  redraw(state);
}

init();
UI();
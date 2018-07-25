import * as n from "./neuron";
import { LineGraph } from './linegraph';
import { MultiLineGraph } from './multilinegraph';
import { FieldGraph } from './fieldgraph';
import { Histogram } from './histogram';
import * as d3 from 'd3';
import {scaleElement} from './utils';
import { makeSelect,
         makeSlider,
         UIHandler, 
         PersistentSodiumUI,
         IzhikevichUI,
         IntegrateAndFireUI, 
         FitzHughNagumoUI, 
         HodgekinHuxleyUI, 
         PoissonUI, 
         RateModelUI, 
         PersistentSodiumPlusPotassiumUI } from "./state";

// Main graphs
const figure: HTMLElement = document.getElementById("neuron-playground");
let opts = ["simple model", "persistent Na + K", "persistent Na", "fitzhugh-nagumo", "hodgekin-huxley", "integrate and fire", "poisson", "rate model"];
let uiHandler = new IzhikevichUI();
let fn = function (kind: string, key: any, value: any): void {
    uiHandler.destroy();
    switch (value) {
        case "persistent Na + K": {
            uiHandler = new PersistentSodiumPlusPotassiumUI();
            uiHandler.build();
            break;
        }
        case "persistent Na": {
            uiHandler = new PersistentSodiumUI();
            uiHandler.build();
            break;
        }
        case "simple model": {
            uiHandler = new IzhikevichUI();
            uiHandler.build();
            break;
        }
        case "fitzhugh-nagumo": {
            uiHandler = new FitzHughNagumoUI();
            uiHandler.build();
            break;
        }
        case "hodgekin-huxley": {
            uiHandler = new HodgekinHuxleyUI();
            uiHandler.build();
            break;
        }
        case "integrate and fire": {
            uiHandler = new IntegrateAndFireUI();
            uiHandler.build();
            break;
        }
        case "poisson": {
            uiHandler = new PoissonUI();
            uiHandler.build();
            break;
        }
        case "rate model": {
            uiHandler = new RateModelUI();
            uiHandler.build();
            break;
        }
    }
}

makeSelect(figure, "neuron_selector", "biological-neuron-selector", opts, fn);
let equations = document.createElement("div");
equations.setAttribute("id", "equations");
figure.appendChild(equations);
uiHandler.build();

//scaleElement(figure, window.innerWidth);
////////////////////////////////////////////////////////////////////////////////
// splash graph
////////////////////////////////////////////////////////////////////////////////

const fig = document.getElementById("splash");
const spike = document.createElement("div");
spike.style.setProperty("grid-row", "2");
spike.style.setProperty("grid-column", "3 / span 2");
fig.appendChild(spike);
const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
spikeGraphSvg.setAttribute("width", "800");
spikeGraphSvg.setAttribute("height", "300");
spikeGraphSvg.setAttribute("class", "playground-plot");
spikeGraphSvg.setAttribute("id", "spikeGraph");
spike.appendChild(spikeGraphSvg);
const spikeGraphD3 = d3.select(spikeGraphSvg);
const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                            [0, 500],
                                            [-85, 40],
                                            'time (msec)',
                                            'membrane potential (mV)',
                                            'Membrane Potential',
                                            "black");

const iput = document.createElement("div");
iput.style.setProperty("grid-row", "3");
iput.style.setProperty("grid-column", "3 / span 2");
fig.appendChild(iput);
const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
inputGraphSvg.setAttribute("width", "800");
inputGraphSvg.setAttribute("height", "160");
inputGraphSvg.setAttribute("class", "playground-plot");
inputGraphSvg.setAttribute("id", "inputGraph");
const inputGraphD3 = d3.select(inputGraphSvg);
const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                            [0, 500],
                                            [-5, 20],
                                            'time (msec)',
                                            'input (nA)',
                                            'Input Current',
                                            'black');
iput.appendChild(inputGraphSvg);

////scaleElement(fig, window.innerWidth);

let data = [];
let inputs = []
let spikeLine = spikeGraph.path.datum(data);
let inputLine = inputGraph.path.datum(inputs);
let params = [0.02, 0.25, -65, 8];
let neuronState = [params[2], params[1]*params[2]];
let state = {
    neuron: "izhikevich",
    params: params,
    state: neuronState,
    input: 6,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let update = function (kind: string, key: any, value: any) {
    if (kind == "neuronKindSelector") {
        switch (value) {
            case "Regular Spiking": {
                state.params = [0.02, 0.2, -65, 8];
                break;
            }
            case "Fast Spiking": {
                state.params = [0.1, 0.2, -65, 2];
                break;
            }
            case "Resonator": {
                state.params = [0.1, 0.26, -60, 2];
                state.input = 0.1;
                break;
            }
            case "Chattering": {
                state.params = [0.02, 0.2, -50, 2];
                break;
            }
        }
        if (key == "") {
            state.params[0] = +value;
        } else if (key == "b") {
            state.params[1] = +value;
        } else if (key == "c") {
            state.params[2] = +value;
        } else if (key == "d") {
            state.params[3] = +value;

        }
    } else if (kind == 'inputParam') {
        if (key == "input") {
            state.input = +value;
        }
    }    
}

const controlPanel: HTMLElement = document.getElementById("control-panel2");

let neuronKinds = ["Regular Spiking",
                   "Fast Spiking",
                   "Resonator",
                   "Chattering"]
makeSelect(controlPanel, "neuronKindSelector", "neuronKindSelector", neuronKinds, update);

makeSlider(controlPanel, "inputParam", "input", -5, 20, 0.1, state.input, "input current (nA)", update);

let I = 0;
for (state.t=1; state.t < 500; state.t+=state.dt) {
    data.push({x: state.t, y: state.state[0]});
    inputs.push({x: state.t, y: I});
    I = state.input;
    state.state = n.Neurons.IzhikevichNeuron.solve(state.state, state.params, I, state.dt);
}

let getLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => spikeGraph.xScale(d.x))
            .y(d => spikeGraph.yScale(Math.min(30, d.y)))
};

let getLine2 = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => inputGraph.xScale(d.x))
            .y(d => inputGraph.yScale(d.y))
};

let splashStep = function() {
    let f = (Math.random() < state.range) ? 1 : 0;
    I = state.input;
    for (let i = 0; i < state.N; i++) {
        state.state = n.Neurons.IzhikevichNeuron.solve(state.state, state.params, I, state.dt);
        state.t += state.dt; 
        data.push({x: state.t, y: state.state[0]});
        inputs.push({x: state.t, y: I});
    }

    // update domain
    spikeGraph.xScale.domain([state.t - 500, state.t]);
    inputGraph.xScale.domain([state.t - 500, state.t]);
    // update data
    spikeLine
        .attr("d", getLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + spikeGraph.xScale(-state.dt*state.N) + ")");


    spikeGraph.bottomAxis.call(d3.axisBottom(spikeGraph.xScale));

    inputLine
        .attr("d", getLine2())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + spikeGraph.xScale(-state.dt*state.N) + ")");

    inputGraph.bottomAxis.call(d3.axisBottom(inputGraph.xScale));

    // pop the old data point off the front
    for (let i = 0; i < state.N; i++) {
        data.shift();
        inputs.shift();
    }
}

////////////////////////////////////////////////////////////////////////////////
// Persistent Sodium Plus Potassium
////////////////////////////////////////////////////////////////////////////////
const psppFig = document.getElementById("pspp");
const psppSpike = document.createElement("div");
psppSpike.style.setProperty("grid-row", "2");
psppSpike.style.setProperty("grid-column", "3 / span 2");
psppFig.appendChild(psppSpike);
const psppSpikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
psppSpikeGraphSvg.setAttribute("width", "800");
psppSpikeGraphSvg.setAttribute("height", "300");
psppSpikeGraphSvg.setAttribute("class", "playground-plot");
psppSpikeGraphSvg.setAttribute("id", "spikeGraph");
psppSpike.appendChild(psppSpikeGraphSvg);
const psppSpikeGraphD3 = d3.select(psppSpikeGraphSvg);
const psppSpikeGraph: LineGraph = new LineGraph(psppSpikeGraphD3,
                                            [0, 500],
                                            [-85, 40],
                                            'time (msec)',
                                            'membrane potential (mV)',
                                            'Membrane Potential',
                                            "black");

const psppInput = document.createElement("div");
psppInput.style.setProperty("grid-row", "3");
psppInput.style.setProperty("grid-column", "3 / span 2");
psppFig.appendChild(psppInput);
const psppInputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
psppInputGraphSvg.setAttribute("width", "800");
psppInputGraphSvg.setAttribute("height", "160");
psppInputGraphSvg.setAttribute("class", "playground-plot");
psppInputGraphSvg.setAttribute("id", "inputGraph");
const psppInputGraphD3 = d3.select(psppInputGraphSvg);
const psppInputGraph: LineGraph = new LineGraph(psppInputGraphD3,
                                            [0, 1000],
                                            [-5, 35],
                                            'time (msec)',
                                            'input (nA)',
                                            'Input Current',
                                            'black');
psppInput.appendChild(psppInputGraphSvg);

//scaleElement(psppFig, window.innerWidth);

let psppData = [];
let psppInputs = [];
let psppSpikeLine = psppSpikeGraph.path.datum(psppData);
let psppInputLine = psppInputGraph.path.datum(psppInputs);
let psppParams = [1, -20, 15, -25, 5, 1, -80, 60,-90, 8, 20, 10];

let psppNeuronState = [-65, 0.2];
let psppState = {
    neuron: "pspp",
    params: psppParams,
    state: psppNeuronState,
    input: 8,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let psppUpdate = function (kind: string, key: any, value: any) {
    if (kind == 'inputParam') {
        if (key == "input") {
            psppState.input = +value;
        }
    } 
}

const psppControlPanel: HTMLElement = document.getElementById("pspp-control-panel");

makeSlider(psppControlPanel, "inputParam", "input", -5, 35, 0.1, psppState.input, "input current (nA)", psppUpdate);

let psppGetLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => psppSpikeGraph.xScale(d.x))
            .y(d => psppSpikeGraph.yScale( Math.min(30, d.y)))
};

let psppGetLine2 = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => psppSpikeGraph.xScale(d.x))
            .y(d => psppSpikeGraph.yScale(d.y))
};

let psppI = 0;
for (psppState.t=1; psppState.t < 500; psppState.t+=psppState.dt) {
    psppData.push({x: psppState.t, y: psppState.state[0]});
    psppInputs.push({x: psppState.t, y: psppI});
    psppI = psppState.input;
    psppState.state = n.Neurons.PersistentSodiumPlusPotassium.solve(psppState.state, psppState.params, psppI, psppState.dt);
}

let psppStep = function() {
    psppI = psppState.input;
    for (let i = 0; i < psppState.N; i++) {
        psppState.state = n.Neurons.PersistentSodiumPlusPotassium.solve(psppState.state, psppState.params, psppI, psppState.dt);
        psppState.t += psppState.dt; 
        psppData.push({x: psppState.t, y: psppState.state[0]});
        psppInputs.push({x: psppState.t, y: psppI});
    }

    // update domain
    psppSpikeGraph.xScale.domain([psppState.t - 500, psppState.t]);
    psppInputGraph.xScale.domain([psppState.t - 500, psppState.t]);
    // update data
    psppSpikeLine
        .attr("d", psppGetLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + psppSpikeGraph.xScale(-psppState.dt*psppState.N) + ")");

    psppSpikeGraph.bottomAxis.call(d3.axisBottom(psppSpikeGraph.xScale));

    psppInputLine
        .attr("d", psppGetLine2())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + psppInputGraph.xScale(-psppState.dt*psppState.N) + ")");

    psppInputGraph.bottomAxis.call(d3.axisBottom(psppInputGraph.xScale))

    // pop the old data point off the front
    for (let i = 0; i < psppState.N; i++) {
        psppData.shift();
        psppInputs.shift();
    }
}


////////////////////////////////////////////////////////////////////////////////
// Integrate & Fire
////////////////////////////////////////////////////////////////////////////////
const iafFig = document.getElementById("iaf");
const iafSpike = document.createElement("div");
iafSpike.style.setProperty("grid-row", "2");
iafSpike.style.setProperty("grid-column", "3 / span 2");
iafFig.appendChild(iafSpike);
const iafSpikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
iafSpikeGraphSvg.setAttribute("width", "800");
iafSpikeGraphSvg.setAttribute("height", "300");
iafSpikeGraphSvg.setAttribute("class", "playground-plot");
iafSpikeGraphSvg.setAttribute("id", "spikeGraph");
iafSpike.appendChild(iafSpikeGraphSvg);
const iafSpikeGraphD3 = d3.select(iafSpikeGraphSvg);
const iafSpikeGraph: LineGraph = new LineGraph(iafSpikeGraphD3,
                                            [0, 500],
                                            [-85, 40],
                                            'time (msec)',
                                            'membrane potential (mV)',
                                            'Membrane Potential',
                                            "black");

const iafInput = document.createElement("div");
iafInput.style.setProperty("grid-row", "3");
iafInput.style.setProperty("grid-column", "3 / span 2");
iafFig.appendChild(iafInput);
const iafInputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
iafInputGraphSvg.setAttribute("width", "800");
iafInputGraphSvg.setAttribute("height", "160");
iafInputGraphSvg.setAttribute("class", "playground-plot");
iafInputGraphSvg.setAttribute("id", "inputGraph");
const iafInputGraphD3 = d3.select(iafInputGraphSvg);
const iafInputGraph: LineGraph = new LineGraph(iafInputGraphD3,
                                            [0, 500],
                                            [-5, 20],
                                            'time (msec)',
                                            'input (nA)',
                                            'Input nA',
                                            'black');
iafInput.appendChild(iafInputGraphSvg);

//scaleElement(iafFig, window.innerWidth);

let iafData = [];
let iafInputs = [];
let iafSpikeLine = iafSpikeGraph.path.datum(iafData);
let iafInputLine = iafInputGraph.path.datum(iafInputs);
let iafParams = [-50, 2.6, 10, 2.7, -70];
let iafNeuronState = [iafParams[4], 0];
let iafState = {
    neuron: "integrate and fire",
    params: iafParams,
    state: iafNeuronState,
    input: 8,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let iafUpdate = function (kind: string, key: any, value: any) {
    if (kind == "neuronParam") {
        if (key == "threshold") {
            iafState.params[0] = +value;
        } else if (key == "resistance") {
            iafState.params[1] = +value;
        } else if (key == "time_constant") {
            iafState.params[2] = +value;
        } else if (key == "refractory") {
            iafState.params[3] = +value;
        } else if (key == "resting") {
            iafState.params[4] = +value;
        }
    } else if (kind == 'inputParam') {
        if (key == "input") {
            iafState.input = +value;
        }
    } 
}

const iafControlPanel: HTMLElement = document.getElementById("iaf-control-panel");

makeSlider(iafControlPanel, "inputParam", "input", -5, 20, 0.1, iafState.input, "input current (nA)", iafUpdate);

let iafGetLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => iafSpikeGraph.xScale(d.x))
            .y(d => iafSpikeGraph.yScale(Math.min(30, d.y)))
};

let iafGetLine2 = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => iafInputGraph.xScale(d.x))
            .y(d => iafInputGraph.yScale(d.y))
};

let iafI = 0;
for (iafState.t=1; iafState.t < 500; iafState.t+=iafState.dt) {
    iafData.push({x: iafState.t, y: (n.Neurons.IntegrateAndFire.spike(iafState.state, iafState.params)) ? 30 : iafState.state[0]});
    iafInputs.push({x: iafState.t, y: iafI});
    iafI = iafState.input;
    iafState.state = n.Neurons.IntegrateAndFire.solve(iafState.state, iafState.params, iafI, iafState.dt);
}

let iafStep = function() {
    iafI = iafState.input;
    for (let i = 0; i < iafState.N; i++) {
        iafState.state = n.Neurons.IntegrateAndFire.solve(iafState.state, iafState.params, iafI, iafState.dt);
        iafState.t += iafState.dt; 
        iafData.push({x: iafState.t, y: (n.Neurons.IntegrateAndFire.spike(iafState.state, iafState.params)) ? 30 : iafState.state[0]});
        iafInputs.push({x: iafState.t, y: iafI});
    }

    // update domain
    iafSpikeGraph.xScale.domain([iafState.t - 500, iafState.t]);
    iafInputGraph.xScale.domain([iafState.t - 500, iafState.t]);
    // update data
    iafSpikeLine
        .attr("d", iafGetLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + iafSpikeGraph.xScale(-iafState.dt*iafState.N) + ")");


    iafSpikeGraph.bottomAxis.call(d3.axisBottom(iafSpikeGraph.xScale));

    iafInputLine
        .attr("d", iafGetLine2())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + iafInputGraph.xScale(-iafState.dt*iafState.N) + ")");

    iafInputGraph.bottomAxis.call(d3.axisBottom(iafInputGraph.xScale))

    // pop the old data point off the front
    for (let i = 0; i < iafState.N; i++) {
        iafData.shift();
        iafInputs.shift();
    }
}


////////////////////////////////////////////////////////////////////////////////
// Poisson
////////////////////////////////////////////////////////////////////////////////
const poissonFig = document.getElementById("poisson");
const poissonSpike = document.createElement("div");
poissonSpike.style.setProperty("grid-row", "2");
poissonSpike.style.setProperty("grid-column", "3 / span 2");
poissonFig.appendChild(poissonSpike);
const poissonSpikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
poissonSpikeGraphSvg.setAttribute("width", "800");
poissonSpikeGraphSvg.setAttribute("height", "300");
poissonSpikeGraphSvg.setAttribute("class", "playground-plot");
poissonSpikeGraphSvg.setAttribute("id", "spikeGraph");
poissonSpike.appendChild(poissonSpikeGraphSvg);
const poissonSpikeGraphD3 = d3.select(poissonSpikeGraphSvg);
const poissonSpikeGraph: LineGraph = new LineGraph(poissonSpikeGraphD3,
                                            [0, 500],
                                            [0, 1],
                                            'time (msec)',
                                            'spike indicator',
                                            'Membrane Potential',
                                            "black");


//scaleElement(poissonFig, window.innerWidth);

let poissonData = [];
let poissonInputs = [];
let poissonSpikeLine = poissonSpikeGraph.path.datum(poissonData);
let poissonParams = [100];
let poissonNeuronState = [poissonParams[4], 0];
let poissonState = {
    neuron: "poisson",
    params: poissonParams,
    state: poissonNeuronState,
    input: 0.1,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let poissonUpdate = function (kind: string, key: any, value: any) {
    if (kind == "neuronParam") {
        if (key == "instantaneous firing rate") {
            poissonState.params[0] = +value;
        }
    }
}

const poissonControlPanel: HTMLElement = document.getElementById("poisson-control-panel");
makeSlider(poissonControlPanel, "neuronParam", "instantaneous firing rate", 1, 200, 1, poissonState.params[0], 'firing rate', poissonUpdate);

let poissonGetLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => poissonSpikeGraph.xScale(d.x))
            .y(d => poissonSpikeGraph.yScale(Math.min(30, d.y)))
};

let poissonI = 0;
for (poissonState.t=1; poissonState.t < 500; poissonState.t+=poissonState.dt) {
    poissonData.push({x: poissonState.t, y: poissonState.state[0]});
    poissonInputs.push({x: poissonState.t, y: poissonI});
    poissonI = poissonState.input;
    poissonState.state = n.Neurons.PoissonNeuron.solve(poissonState.state, poissonState.params, poissonI, poissonState.dt);
}

let poissonStep = function() {
    poissonI = poissonState.input;
    for (let i = 0; i < poissonState.N; i++) {
        poissonState.state = n.Neurons.PoissonNeuron.solve(poissonState.state, poissonState.params, poissonI, poissonState.dt);
        poissonState.t += poissonState.dt; 
        poissonData.push({x: poissonState.t, y: poissonState.state[0]});
        poissonInputs.push({x: poissonState.t, y: poissonI});
    }

    // update domain
    poissonSpikeGraph.xScale.domain([poissonState.t - 500, poissonState.t]);
    // update data
    poissonSpikeLine
        .attr("d", poissonGetLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + poissonSpikeGraph.xScale(-poissonState.dt*poissonState.N) + ")");


    poissonSpikeGraph.bottomAxis.call(d3.axisBottom(poissonSpikeGraph.xScale));

    // pop the old data point off the front
    for (let i = 0; i < poissonState.N; i++) {
        poissonData.shift();
        poissonInputs.shift();
    }
}


////////////////////////////////////////////////////////////////////////////////
// Hodgekin Huxley
////////////////////////////////////////////////////////////////////////////////
const hhFig = document.getElementById("hodgkinhuxley");
const hhSpike = document.createElement("div");
hhSpike.style.setProperty("grid-row", "2");
hhSpike.style.setProperty("grid-column", "3 / span 2");
hhFig.appendChild(hhSpike);
const hhSpikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
hhSpikeGraphSvg.setAttribute("width", "800");
hhSpikeGraphSvg.setAttribute("height", "300");
hhSpikeGraphSvg.setAttribute("class", "playground-plot");
hhSpikeGraphSvg.setAttribute("id", "spikeGraph");
hhSpike.appendChild(hhSpikeGraphSvg);
const hhSpikeGraphD3 = d3.select(hhSpikeGraphSvg);
const hhSpikeGraph: LineGraph = new LineGraph(hhSpikeGraphD3,
                                            [0, 500],
                                            [-85, 40],
                                            'time (msec)',
                                            'membrane potential (mV)',
                                            'Membrane Potential',
                                            "black");

const hhInput = document.createElement("div");
hhInput.style.setProperty("grid-row", "3");
hhInput.style.setProperty("grid-column", "3 / span 2");
hhFig.appendChild(hhInput);
const hhInputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
hhInputGraphSvg.setAttribute("width", "800");
hhInputGraphSvg.setAttribute("height", "160");
hhInputGraphSvg.setAttribute("class", "playground-plot");
hhInputGraphSvg.setAttribute("id", "inputGraph");
const hhInputGraphD3 = d3.select(hhInputGraphSvg);
const hhInputGraph: LineGraph = new LineGraph(hhInputGraphD3,
                                            [0, 500],
                                            [-5, 25],
                                            'time (msec)',
                                            'input (nA)',
                                            'Input Current',
                                            'black');
hhInput.appendChild(hhInputGraphSvg);

//scaleElement(hhFig, window.innerWidth);

let hhData = [];
let hhInputs = [];
let hhSpikeLine = hhSpikeGraph.path.datum(hhData);
let hhInputLine = hhInputGraph.path.datum(hhInputs);
let hhParams = [1, 120, 120, 36, -12, 0.3, 10.6];
let hhNeuronState = [0, 0.05, 0.6, 0.32];
let hhState = {
    neuron: "hh",
    params: hhParams,
    state: hhNeuronState,
    input: 8,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let hhUpdate = function (kind: string, key: any, value: any) {
    if (kind == 'inputParam') {
        if (key == "input") {
            hhState.input = +value;
        }
    } 
}

const hhControlPanel: HTMLElement = document.getElementById("hh-control-panel");

makeSlider(hhControlPanel, "inputParam", "input", -5, 25, 0.1, hhState.input, "input current (nA)", hhUpdate);

let hhGetLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => hhSpikeGraph.xScale(d.x))
            .y(d => hhSpikeGraph.yScale(d.y - 70))
};

let hhGetLine2 = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => hhInputGraph.xScale(d.x))
            .y(d => hhInputGraph.yScale(d.y))
};

let hhI = 0;
for (hhState.t=1; hhState.t < 500; hhState.t+=hhState.dt) {
    hhData.push({x: hhState.t, y: hhState.state[0]});
    hhInputs.push({x: hhState.t, y: hhState.input});
    hhI = hhState.input;
    let tmpState = hhState.state;
    for (let i = 0; i < 10; i++) {
        tmpState = n.Neurons.HodgekinHuxleyNeuron.solve(tmpState, hhState.params, hhI, hhState.dt/10);
    }
    hhState.state = tmpState; 
}

let hhStep = function() {
    hhI = hhState.input;
    for (let i = 0; i < hhState.N; i++) {
        let tmpState = hhState.state;
        for (let i = 0; i < 10; i++) {
            tmpState = n.Neurons.HodgekinHuxleyNeuron.solve(tmpState, hhState.params, hhI, hhState.dt/10);
        }
        hhState.state = tmpState;
        hhState.t += hhState.dt; 
        hhData.push({x: hhState.t, y: hhState.state[0]});
        hhInputs.push({x: hhState.t, y: hhState.input});
    }

    // update domain
    hhSpikeGraph.xScale.domain([hhState.t - 500, hhState.t]);
    hhInputGraph.xScale.domain([hhState.t - 500, hhState.t]);
    // update data
    hhSpikeLine
        .attr("d", hhGetLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + hhSpikeGraph.xScale(-hhState.dt*hhState.N) + ")");

    hhSpikeGraph.bottomAxis.call(d3.axisBottom(hhSpikeGraph.xScale));

    hhInputLine
        .attr("d", hhGetLine2())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + hhInputGraph.xScale(-hhState.dt*hhState.N) + ")");

    hhInputGraph.bottomAxis.call(d3.axisBottom(hhInputGraph.xScale))

    // pop the old data point off the front
    for (let i = 0; i < hhState.N; i++) {
        hhData.shift();
        hhInputs.shift();
    }
}


////////////////////////////////////////////////////////////////////////////////
// Izhikevich Model
////////////////////////////////////////////////////////////////////////////////
const izFig = document.getElementById("izhikevich");
const izSpike = document.createElement("div");
izSpike.style.setProperty("grid-row", "2");
izSpike.style.setProperty("grid-column", "3 / span 2");
izFig.appendChild(izSpike);
const izSpikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
izSpikeGraphSvg.setAttribute("width", "800");
izSpikeGraphSvg.setAttribute("height", "300");
izSpikeGraphSvg.setAttribute("class", "playground-plot");
izSpikeGraphSvg.setAttribute("id", "spikeGraph");
izSpike.appendChild(izSpikeGraphSvg);
const izSpikeGraphD3 = d3.select(izSpikeGraphSvg);
const izSpikeGraph: LineGraph = new LineGraph(izSpikeGraphD3,
                                            [0, 500],
                                            [-85, 40],
                                            'time (msec)',
                                            'membrane potential (mV)',
                                            'Membrane Potential',
                                            "black");

const izInput = document.createElement("div");
izInput.style.setProperty("grid-row", "3");
izInput.style.setProperty("grid-column", "3 / span 2");
izFig.appendChild(izInput);
const izInputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
izInputGraphSvg.setAttribute("width", "800");
izInputGraphSvg.setAttribute("height", "160");
izInputGraphSvg.setAttribute("class", "playground-plot");
izInputGraphSvg.setAttribute("id", "inputGraph");
const izInputGraphD3 = d3.select(izInputGraphSvg);
const izInputGraph: LineGraph = new LineGraph(izInputGraphD3,
                                            [0, 500],
                                            [-5, 20],
                                            'time (msec)',
                                            'input (nA)',
                                            'Input Current',
                                            'black');
izInput.appendChild(izInputGraphSvg);

//scaleElement(izFig, window.innerWidth);

let izData = [];
let izInputs = [];
let izSpikeLine = izSpikeGraph.path.datum(izData);
let izInputLine = izInputGraph.path.datum(izInputs);
let izParams = [0.02, 0.25, -65, 8];
let izNeuronState = [izParams[2], izParams[1]*izParams[2]];
let izState = {
    neuron: "izhikevich",
    params: izParams,
    state: izNeuronState,
    input: 6,
    dt: 0.1,
    t: 0,
    N: 5,
    range: 0.01
}

let izUpdate = function (kind: string, key: any, value: any) {
    if (kind == "neuronKindSelector") {
        switch (value) {
            case "Regular Spiking": {
                izState.params = [0.02, 0.2, -65, 8];
                break;
            }
            case "Fast Spiking": {
                izState.params = [0.1, 0.2, -65, 2];
                break;
            }
            case "Resonator": {
                izState.params = [0.1, 0.26, -60, 2];
                izState.input = 0.1;
                break;
            }
            case "Chattering": {
                izState.params = [0.02, 0.2, -50, 2];
                break;
            }
        }
        if (key == "") {
            izState.params[0] = +value;
        } else if (key == "b") {
            izState.params[1] = +value;
        } else if (key == "c") {
            izState.params[2] = +value;
        } else if (key == "d") {
            izState.params[3] = +value;

        }
    } else if (kind == 'inputParam') {
        if (key == "input") {
            izState.input = +value;
        }
    }    
}

const izControlPanel: HTMLElement = document.getElementById("i-control-panel");

let izNeuronKinds = ["Regular Spiking",
                   "Fast Spiking",
                   "Resonator",
                   "Chattering"]
makeSelect(izControlPanel, "neuronKindSelector", "neuronKindSelector", neuronKinds, izUpdate);

makeSlider(izControlPanel, "inputParam", "input", -5, 20, 0.1, izState.input, "input current (nA)", izUpdate);

let izGetLine = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => izSpikeGraph.xScale(d.x))
            .y(d => izSpikeGraph.yScale(Math.min(30, d.y)))
};
let izGetLine2 = () => {
    return d3.line<{x: number, y: number}>()
            .x(d => izInputGraph.xScale(d.x))
            .y(d => izInputGraph.yScale( d.y))
};

let izI = 0;
for (izState.t=1; izState.t < 500; izState.t+=izState.dt) {
    izData.push({x: izState.t, y: izState.state[0]});
    izInputs.push({x: izState.t, y: izI});
    izI = izState.input;
    izState.state = n.Neurons.IzhikevichNeuron.solve(izState.state, izState.params, izI, izState.dt);
}

let izStep = function() {
    izI = izState.input;
    for (let i = 0; i < izState.N; i++) {
        izState.state = n.Neurons.IzhikevichNeuron.solve(izState.state, izState.params, izI, izState.dt);
        izState.t += izState.dt; 
        izData.push({x: izState.t, y: izState.state[0]});
        izInputs.push({x: izState.t, y: izI});
    }

    // update domain
    izSpikeGraph.xScale.domain([izState.t - 500, izState.t]);
    izInputGraph.xScale.domain([izState.t - 500, izState.t]);
    // update data
    izSpikeLine
        .attr("d", izGetLine())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + izSpikeGraph.xScale(-izState.dt*izState.N) + ")");


    izSpikeGraph.bottomAxis.call(d3.axisBottom(izSpikeGraph.xScale));

    izInputLine
        .attr("d", izGetLine2())
        .attr("transform", null)
        .attr("stoke-width", "2")
        .attr("stroke", "black")
        .attr("fill", "none")
        .attr("class", "line regular-line")
      .transition()
        .attr("transform", "translate(" + izSpikeGraph.xScale(-izState.dt*izState.N) + ")");

    izInputGraph.bottomAxis.call(d3.axisBottom(izInputGraph.xScale))

    // pop the old data point off the front
    for (let i = 0; i < izState.N; i++) {
        izData.shift();
        izInputs.shift();
    }
}


////////////////////////////////////////////////////////////////////////////////
// step
////////////////////////////////////////////////////////////////////////////////

function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    // DOMRect { x: 8, y: 8, width: 100, height: 100, top: 8, right: 108, bottom: 108, left: 8 }
    const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
    const windowWidth = (window.innerWidth || document.documentElement.clientWidth);

    // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

    return (vertInView && horInView);
}


const forwardStep = function() {
    //
    if (isInViewport(fig)) {
        splashStep();
    }
    //
    if (isInViewport(iafFig)) {
        iafStep();
    }
    //
    if (isInViewport(psppFig)) {
        psppStep();
    }
    //
    if (isInViewport(hhFig)) {
        hhStep();
    }
    //
    if (isInViewport(poissonFig)) {
        poissonStep();
    }
    //
    if (isInViewport(izFig)) {
        izStep();
    }

    window.requestAnimationFrame(forwardStep);
}

window.requestAnimationFrame(forwardStep);
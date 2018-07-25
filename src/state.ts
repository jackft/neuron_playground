import * as n from './neuron';
import { LineGraph } from './linegraph';
import { MultiLineGraph } from './multilinegraph';
import { FieldGraph } from './fieldgraph';
import { Histogram } from './histogram';
import * as d3 from 'd3';
import * as utils from './utils';

export interface State {
    neuron: string;
    params: number[];
    state: number[];
    input: number;
    dt: number;
}


export abstract class UIHandler {
    public abstract build(neuron: n.Neuron, state: State): void;
    public abstract destroy(): void;
}

let inputColor = 'black';
let spikeColor = '#F44336';
let ifColor = 'black';
let fieldColor = spikeColor;

let TIME = 1000;
let INPUTS = Array(50).fill(1).map((_, i) => i*25/50);

export function makeSlider(elt: HTMLElement,
                    cssClassName: string, 
                    id: string,
                    min: number,
                    max: number,
                    step: number,
                    value: number,
                    text: string,
                    fn: (kind: string, key: any, value: any)=>void) {
    let div: HTMLDivElement = document.createElement("div");
    div.setAttribute("id", id);
    let label: HTMLLabelElement = document.createElement("label");
    label.setAttribute("for", "id");
    label.innerHTML = text + ": ";
    let span: HTMLSpanElement = document.createElement("span");
    let slider: HTMLInputElement = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("class", cssClassName);
    slider.setAttribute("id", id);
    slider.setAttribute("min", min.toString());
    slider.setAttribute("max", max.toString());
    slider.setAttribute("step", step.toString());
    slider.setAttribute("value", value.toString());
    slider.addEventListener("input", (event: Event) => {
        fn(slider.getAttribute("class"), slider.getAttribute("id"), slider.value);
        span.innerHTML = slider.value;
    });
    span.innerHTML = slider.value;
    label.appendChild(span);
    div.appendChild(label)
    div.appendChild(slider);
    elt.appendChild(div);
    div.setAttribute("class", "slider");
    return slider;
}

export function makeSelect(elt: HTMLElement,
                    cssClassName: string,
                    id: string,
                    opts: string[],
                    fn: (kind: string, key: any, value: any)=>void) {
    let selection: HTMLSelectElement = document.createElement("select");
    selection.setAttribute("class", cssClassName);
    selection.setAttribute("id", id);
    elt.appendChild(selection);
    for (let i=0; i < opts.length; i++) {
        let option = document.createElement("option");
        option.innerHTML = opts[i];
        option.setAttribute("value", opts[i]);
        selection.appendChild(option);
    }
    selection.addEventListener("input", (event: Event) => {
        fn(selection.getAttribute("class"), selection.getAttribute("id"), selection.value);
    });
    return selection;
}


let constantInputF = function (timeOn: number, timeOff: number) {
    return  (input: number) => (
                (t: number) => (timeOn <= t && t < timeOff) ? input : 0
            );
}
            
let pulseInputF = function (timeOn: number, timeOff: number, gap: number, duration: number) {
    return  (input: number) => (
                (t: number) =>  {
                    if (timeOn <= t && t < timeOff) {
                        let relative_t = (t - timeOn) % 300;
                        if (0 <= relative_t % 300 && relative_t <= gap*2 + duration) {
                            return (0 <= relative_t % gap && relative_t % gap < duration) ? input : 0;
                        }
                    }
                    return 0;
                }
            )
}


let inputBuilder = function (controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update) {
    if (kind == "inputParam") {
        if (key == "input") {
            state.input = +value;
        } else if (key == "inputGap") {
            state.inputGap = +value;
            inputF = pulseInputF(100, 900, state.inputGap, state.inputDuration);
        } else if (key == "inputDuration") {
            state.inputDuration = +value;
            inputF = pulseInputF(100, 900, state.inputGap, state.inputDuration);
        } else if (key == "inputDurationConst") {
            state.inputDuration = +value;
            inputF = constantInputF(100, 100 + (+value));
        }
    } else if (kind == "inputType") {
        switch (value) {
            case 'constant': {
                if (document.getElementById("inputGap") !== null) {
                    document.getElementById("inputGap").remove();
                }
                if (document.getElementById("inputDuration") !== null) {
                    document.getElementById("inputDuration").remove();
                }
                if (document.getElementById("inputDurationConst") !== null) {
                    document.getElementById("inputDurationConst").remove();
                }
                inputF = constantInputF(100, 900);
                break;
            }
            case 'pulses': {
                if (document.getElementById("inputDurationConst") !== null) {
                    document.getElementById("inputDurationConst").remove();
                }
                if (document.getElementById("inputGap") == null) {
                    makeSlider(controlPanel, "inputParam", "inputGap", 0.5, 100, 0.1, inputGap, "pulse gap (msec)", update);
                }
                if (document.getElementById("inputDuration") == null) {
                    makeSlider(controlPanel, "inputParam", "inputDuration", 0.5, 50, 0.1, inputDuration, "pulse duration (msec)", update);
                }
                inputF = pulseInputF(100, 900, inputGap, inputDuration);
                break;
            }
            case 'impulse': {
                if (document.getElementById("inputGap") !== null) {
                    document.getElementById("inputGap").remove();
                } 
                if (document.getElementById("inputDuration") !== null) {
                    document.getElementById("inputDuration").remove();
                }
                if (document.getElementById("inputDurationConst") == null) {
                    makeSlider(controlPanel, "inputParam", "inputDurationConst", 0.5, 50, 0.1, inputDuration, "pulse duration (msec)", update);
                }
                inputF = constantInputF(100, 100 + inputDuration);
                break;
            }
        }
    }
    return inputF;
}

export class HodgekinHuxleyUI extends UIHandler {

    public build() {
        let dt = 0.05;
        let params = [1, 120, 120, 36, -12, 0.3, 10.6];

        let [c_m, g_na, e_na, g_k, e_k, g_l, e_l] = params;

        let neuronState = [0, 0.05, 0.6, 0.32];
        let inputVoltage = 8;
        let inputGap = 5;
        let inputDuration = 2;
        let uiHandler = new HodgekinHuxleyUI();

        let state = {
            neuron: "hodgekin-huxley",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        for (let eq of n.Neurons.HodgekinHuxleyNeuron.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }

        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3 / span 2");
        bottomleft.style.setProperty("grid-column", "3");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const channelGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        channelGraphSvg.setAttribute("width", "800");
        channelGraphSvg.setAttribute("height", "220");
        channelGraphSvg.setAttribute("class", "playground-plot");
        channelGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(channelGraphSvg);

        const legend = document.createElement("div");
        const l1 = document.createElement("div");
        const l1text = document.createElement("p");
        const l2 = document.createElement("div");
        const l2text = document.createElement("p");
        const l3 = document.createElement("div");
        const l3text = document.createElement("p");
        const sodiumAct = document.createElement("div");
        const sodiumIn = document.createElement("div");
        const potassium = document.createElement("div");
        legend.setAttribute("id", "legend");
        legend.style.setProperty("grid-row", "3");
        legend.style.setProperty("grid-column", "5");
        legend.style.setProperty("margin-top", "30px");
        sodiumAct.style.setProperty("border-radius", "50%");
        sodiumAct.style.setProperty("background", "orange");
        sodiumAct.style.setProperty("width", "10px");
        sodiumAct.style.setProperty("height", "10px");
        sodiumAct.style.setProperty("float", "left");
        sodiumAct.style.setProperty("margin-right", "10px");
        l1text.innerText = "sodium activation gate $m$";
        l1.appendChild(sodiumAct);
        l1.appendChild(l1text);
        try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, l1text]);
            }
        catch (e) {}
        sodiumIn.style.setProperty("border-radius", "50%");
        sodiumIn.style.setProperty("background", "blue");
        sodiumIn.style.setProperty("width", "10px");
        sodiumIn.style.setProperty("height", "10px");
        sodiumIn.style.setProperty("float", "left");
        sodiumIn.style.setProperty("margin-right", "10px");
        l2text.innerText = "sodium inactivation gate $h$";
        l2.appendChild(sodiumIn);
        l2.appendChild(l2text);
        try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, l2text]);
            }
        catch (e) {}
        potassium.style.setProperty("height", "10px");
        potassium.style.setProperty("border-radius", "50%");
        potassium.style.setProperty("background", "green");
        potassium.style.setProperty("width", "10px");
        potassium.style.setProperty("height", "10px");
        potassium.style.setProperty("float", "left");
        potassium.style.setProperty("margin-right", "10px");
        l3text.innerText = "potassium activation gate $n$";
        try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, l3text]);
            }
        catch (e) {}
        l3.appendChild(potassium);
        l3.appendChild(l3text);
        legend.appendChild(l1);
        legend.appendChild(l2);
        legend.appendChild(l3);
        figure.appendChild(legend);

        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-20, 120],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 
        const channelGraphD3 = d3.select(channelGraphSvg);
        const channelGraph: MultiLineGraph = new MultiLineGraph(channelGraphD3,
                                                 3,
                                                 [0, 1000],
                                                 [0, 2],
                                                 'time (msec)',
                                                 'sodium activation',
                                                 'Channel Activations',
                                                 ['orange','blue', 'green']);

        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                 [0, 1000],
                                                 [0, 20],
                                                 'time (msec)',
                                                 'input',
                                                 'input',
                                                 inputColor);

        let updateSpikeGraph = function (inputFunction) {
            let spikes: {x: number, y: number}[] = new Array(TIME);
            let channels: {x: number, ys: number[]}[] = new Array(TIME);
            let inputs: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                let input = inputFunction(state.input)(t);
                spikes[i] = {x: t, y:newState[0]};
                channels[i] = {x: t, ys: [newState[1], newState[2], newState[3]]};
                inputs[i] = {x: t, y: input};
                newState = n.Neurons.HodgekinHuxleyNeuron.solve(newState, state.params, input, 0.025);
                t += dt;
            }
            spikeGraph.update(spikes);
            channelGraph.update(channels);
            inputGraph.update(inputs);
        }

        let vs = [-20, 120];
        let hs = [0, 1];

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");

        let paramNames: string[] = ["C_m", "g_na", "e_na", "g_k", "e_k", "g_l", "e_l"];
        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (paramNames.indexOf(key) != -1) {
                    state.params[paramNames.indexOf(key)] = +value;
                }
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            }
            updateSpikeGraph(inputF);
        }

        makeSlider(controlPanel, "neuronParam", "C_m", 0, 2, 0.1, state.params[0], "C_m", update);
        makeSlider(controlPanel, "neuronParam", "g_na", 100, 140, 1, state.params[1], "g_na", update);
        makeSlider(controlPanel, "neuronParam", "e_na", 100, 130, 1, state.params[2], "e_na", update);
        makeSlider(controlPanel, "neuronParam", "g_k", 30, 40, 1, state.params[3], "g_k", update);
        makeSlider(controlPanel, "neuronParam", "e_k", -15, -5, 1, state.params[4], "e_k", update);
        makeSlider(controlPanel, "neuronParam", "g_l", 0, 8, 0.1, state.params[5], "g_l", update);
        makeSlider(controlPanel, "neuronParam", "e_l", -20, 20, 0.01, state.params[6], "e_l", update);

        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", -5, 20, 0.1, state.input, "input current (nA)", update);
        update("", "", "");
    }

    public destroy() {
        // destroy legend
        document.getElementById("legend").remove();
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class PersistentSodiumPlusPotassiumUI extends UIHandler {

    public build() {

        let dt = 0.05;
        let params = [1, -20, 15, -25, 5, 1, -80, 60,-90, 8, 20, 10];
        let neuronState = [-65, 0.2];
        let inputVoltage = 6;
        let uiHandler = new PersistentSodiumPlusPotassiumUI();

        let inputGap = 5;
        let inputDuration = 2;

        let state = {
            neuron: "pspp",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        let eqs = n.Neurons.PersistentSodiumPlusPotassium.equation();
        for (let eq of n.Neurons.PersistentSodiumPlusPotassium.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }
       
        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "400");
        fiGraphSvg.setAttribute("height", "300");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(fiGraphSvg);
        const fieldGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fieldGraphSvg.setAttribute("width", "400");
        fieldGraphSvg.setAttribute("height", "300");
        fieldGraphSvg.setAttribute("class", "playground-plot");
        fieldGraphSvg.setAttribute("id", "fieldCurveGraph");
        bottomright.appendChild(fieldGraphSvg);

        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                    [0, 1000],
                                                    [-5, 20],
                                                    'time (msec)',
                                                    'input (nA)',
                                                    'Input Current',
                                                    inputColor)
 
        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-85, 40],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 

        let inputs: number[] = Array(100).fill(1).map((x, i) => 25*i/100);
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                 [inputs[0], inputs[inputs.length - 1]],
                                                 [0, 200],
                                                 'input (nA)',
                                                 'firing rate (hz)',
                                                 'F-I Curve',
                                                 ifColor);
        
        const fieldGraphD3 = d3.select(fieldGraphSvg);
        const fieldGraph: FieldGraph = new FieldGraph(fieldGraphD3,
                                                      [-80, 20],
                                                      [-0.1, 0.6],
                                                      [0, 25],
                                                      'membrane potential (mV)',
                                                      'recovery variable',
                                                      'Neuron Dynamics',
                                                      fieldColor);

        //update functions
        let updateFIGraph = function () {
            let result = new Array(inputs.length);
            let firingRates = undefined;
            let bifurcations = n.Neurons.PersistentSodiumPlusPotassium.bifurcations(state.state, state.params, state.input);
            let is = inputs.concat(bifurcations)
                           .filter((x) => x >= 0)
                           .sort((a,b)=> a -b);
            firingRates = n.Neurons.PersistentSodiumPlusPotassium.fiCurve(state.state, state.params, is, dt, 100);
            for (let i=0; i<is.length; i++) {
                result[i] = {x: is[i], y:firingRates[i]};
            }
            fiGraph.update(result);
        };

        let updateSpikeGraph = function (inputFunction) {
            let result: {x: number, y: number}[] = new Array(TIME);
            let inputs: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                let input = inputFunction(state.input)(t);
                result[i] = {x: t, y:newState[0]};
                inputs[i] = {x: t, y: input};
                newState = n.Neurons.PersistentSodiumPlusPotassium.solve(newState, state.params, input, state.dt);
                t += dt;
            }
            spikeGraph.update(result);
            inputGraph.update(inputs);
        }

        let vs = [-80, 20];

        let updateFieldGraph = function() {
            // null cline
            let nullClines = n.Neurons.PersistentSodiumPlusPotassium.nullCline(state.params, state.input);
            let nullClineResults: {x: number, y: number}[][] = [];
            for (let i=0; i<nullClines.length; i++) {
                let f: (v: number) => number = nullClines[i];
                nullClineResults.push([]);
                for (let v=vs[0]; v<=vs[1]; v+=1) {
                    nullClineResults[i].push({x: v, y: f(v)});
                }
            }
            fieldGraph.updateNullCline(nullClineResults);
            // vector field
            let vectors: {x:number, y:number}[][] = [];
            for (let v=-80; v<=20; v+=100/30) {
                for (let u=0.0; u<=0.6; u+=0.6/30) {
                    let [v_new, u_new] = n.Neurons.PersistentSodiumPlusPotassium.derivative([v, u], state.params, state.input)
                    let magnitude = Math.sqrt((Math.pow(v_new/(100/30), 2) + Math.pow(u_new/(0.6/30), 2)));
                    if (magnitude > 1.5) {
                        v_new = v_new/magnitude;
                        u_new = u_new/magnitude;
                    }
                    vectors.push([{x:v,y:u},{x:v+v_new,y:u+u_new}])
                }
            }
            fieldGraph.updateVectorField(vectors);

            let states: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                states[i] = {x: newState[0], y:newState[1]};
                newState = n.Neurons.PersistentSodiumPlusPotassium.solve(newState, state.params, state.input, state.dt);
                t += dt;
            }
            fieldGraph.updateLine(states);

            //fixed points
            let fixedPoints = n.Neurons.PersistentSodiumPlusPotassium.fixedPoints(state.state, state.params, state.input);
            let pnts = [];
            let types = [];
            let separatrix = [];
            for (let i = 0; i < fixedPoints.length; i++) {
                let pnt = fixedPoints[i];
                let stability = utils.stability(
                    n.Neurons
                     .PersistentSodiumPlusPotassium
                     .jaccobian(fixedPoints[i], state.params, state.input)
                );
                pnts.push({x: pnt[0], y: pnt[1]})
                types.push(stability);

                // separatrix / basin of attraction
                //if (stability == 'saddle') {
                //    let eigenVector = utils
                //            .eigen(n.Neurons
                //                    .PersistentSodiumPlusPotassium
                //                    .jaccobian(fixedPoints[0], state.params, state.input)
                //            ).E.x[0];
                //    let newState = [fixedPoints[i][0] + state.dt*eigenVector[0]/10,
                //                    fixedPoints[i][1] + state.dt*eigenVector[1]/10];
                //    let j = 0;
                //    while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                //        separatrix.push({x: newState[0], y: newState[1]});
                //        let gradient = n.Neurons
                //                        .PersistentSodiumPlusPotassium
                //                        .derivative(newState, state.params, state.input);

                //        newState = [newState[0] - state.dt*gradient[0],
                //                    newState[1] - state.dt*gradient[1]];
                //        j++;
                //    }
                //    separatrix = separatrix.reverse();
                //    newState = [fixedPoints[i][0] - state.dt*eigenVector[0]/10,
                //                fixedPoints[i][1] - state.dt*eigenVector[1]/10];
                //    j = 0;
                //    while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                //        separatrix.push({x: newState[0], y: newState[1]});
                //        let gradient = n.Neurons
                //                        .PersistentSodiumPlusPotassium
                //                        .derivative(newState, state.params, state.input);

                //        newState = [newState[0] - state.dt*gradient[0],
                //                    newState[1] - state.dt*gradient[1]];
                //        j++;
                //    }
                //}

            }
            let [minX, maxX] = fieldGraph.xScale.domain();
            let [minY, maxY] = fieldGraph.yScale.domain();
            fieldGraph.updateSeparatrix(separatrix);
            separatrix.push({x: minX,y: maxY});
            fieldGraph.updateSeparatrixArea(separatrix);
            fieldGraph.updateFixedPoints(pnts, types);
        }


        let paramNames: string[] = ["C_m",
                                    "m_half",
                                    "m_k",
                                    "n_half",
                                    "n_k",
                                     "tau",
                                     "e_leak",
                                     "e_sodium",
                                     "e_potassium",
                                     "g_leak",
                                     "g_sodium",
                                     "g_potassium"];
        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (paramNames.indexOf(key) != -1) {
                    state.params[paramNames.indexOf(key)] = +value;
                }
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            }
   
            updateFieldGraph();
            updateSpikeGraph(inputF);
            if (kind != "inputParam") {
                updateFIGraph();
            }
    }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "C_m", 0, 2, 0.1, state.params[0], "C_m", update);
        makeSlider(controlPanel, "neuronParam", "m_half", -10, -30, 1, state.params[1], "m_half", update);
        makeSlider(controlPanel, "neuronParam", "m_k", 5, 30, 1, state.params[2], "m_k", update);
        makeSlider(controlPanel, "neuronParam", "n_half", -10, -35, 1, state.params[3], "n_half", update);
        makeSlider(controlPanel, "neuronParam", "n_k", 0, 20, 0.1, state.params[4], "n_k", update);
        makeSlider(controlPanel, "neuronParam", "tau", 0.1, 10, 0.1, state.params[5], "tau", update);
       // makeSlider(controlPanel, "neuronParam", "e_leak", -90, -70, 1, state.params[6], "e_leak", update);
       // makeSlider(controlPanel, "neuronParam", "e_sodium", 50, 70, 1, state.params[7], "e_sodium", update);
       // makeSlider(controlPanel, "neuronParam", "e_potassium", -100, -80, 1, state.params[8], "e_potassium", update);
        makeSlider(controlPanel, "neuronParam", "g_leak", 5, 10, 0.1, state.params[9], "g_leak", update);
        makeSlider(controlPanel, "neuronParam", "g_sodium", 15, 25, 0.1, state.params[10], "g_sodium", update);
        makeSlider(controlPanel, "neuronParam", "g_potassium", 5, 20, 0.1, state.params[11], "g_potassium", update);

        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", -5, 20, 0.1, state.input, "input current (mV)", update);
 

        fieldGraph.svg.on("click", function(d, i) {
            let [x, y] = d3.mouse(this);
            x = x - fieldGraph.margin.left;
            y = y - fieldGraph.margin.top;
            let v = fieldGraph.xScale.invert(x);
            let u = fieldGraph.yScale.invert(y);
            state.state = [v, u];
            update("", "", "");
        });
        
        update("", "", "");
    }


    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}


export class FitzHughNagumoUI extends UIHandler {

    public build() {

        let dt = 0.05;
        let params = [0.1, 0.01, 0.02];
        let neuronState = [0.1, 0];
        let inputVoltage = 0.03;
        let uiHandler = new FitzHughNagumoUI();
        
        let inputGap = 5;
        let inputDuration = 2;

        let state = {
            neuron: "fitzhugh-nagumo",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        for (let eq of n.Neurons.FitzHughNagumo.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }

        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "400");
        fiGraphSvg.setAttribute("height", "300");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(fiGraphSvg);
        const fieldGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fieldGraphSvg.setAttribute("width", "400");
        fieldGraphSvg.setAttribute("height", "300");
        fieldGraphSvg.setAttribute("class", "playground-plot");
        fieldGraphSvg.setAttribute("id", "fieldCurveGraph");
        bottomright.appendChild(fieldGraphSvg);

        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                    [0, 1000],
                                                    [-0.1, 1],
                                                    'time (msec)',
                                                    'input (nA)',
                                                    'Input Current',
                                                    inputColor)
 
        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-0.5, 1.2],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);

        // returns an input Range
        let fitzHughInputF = function(params) {
            let [,a, b] = params;
            let min = 0;
            let max = 0.3;
            return Array(100).fill(1).map((x, i) => min + (max-min)*i/100);
        }

        let fitzhughInput = fitzHughInputF(state.params);
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                 [fitzhughInput[0], fitzhughInput[fitzhughInput.length - 1]],
                                                 [0, 50],
                                                 'input (nA)',
                                                 'firing rate (hz)',
                                                 'F-I Curve',
                                                 ifColor);
        
        const fieldGraphD3 = d3.select(fieldGraphSvg);
        const fieldGraph: FieldGraph = new FieldGraph(fieldGraphD3,
                                                      [-0.4, 1.2],
                                                      [-0.1, 0.3],
                                                      [0, 25],
                                                      'membrane potential (mV)',
                                                      'recovery variable',
                                                      'Neuron Dynamics',
                                                      fieldColor);

        //update functions
        let updateFIGraph = function () {
            fitzhughInput = fitzHughInputF(state.params);
            let result = new Array(fitzhughInput.length);
            let firingRates = undefined;
            firingRates = n.Neurons.FitzHughNagumo.fiCurve(state.state, state.params, fitzhughInput, 0.05, 300);
            for (let i=0; i<fitzhughInput.length; i++) {
                result[i] = {x: fitzhughInput[i], y:firingRates[i]};
            }
            let [,a, b] = params;
            let min = (-1 + a + (2/3)*b)*b;
            let max = (1 + a - (2/3)*b)/b;
            result.push({x: min, y: undefined});
            result.push({x: max, y: undefined});
            fiGraph.update(result);
        };

        let updateSpikeGraph = function (inputFunction) {
            let result: {x: number, y: number}[] = new Array(1000);
            let inputs: {x: number, y: number}[] = new Array(1000);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<1000; i++) {
                let input = inputFunction(state.input)(t);
                inputs[i] = {x: t, y: input};
                result[i] = {x: t, y:Math.min(newState[0], 40)};
                newState = n.Neurons.FitzHughNagumo.solve(newState, state.params, input, state.dt);
                t += dt;
            }

            spikeGraph.update(result);
            inputGraph.update(inputs);
        }

        let vs = [-0.4, 1.2];

        let updateFieldGraph = function() {
            // null cline
            let nullClines = n.Neurons.FitzHughNagumo.nullCline(state.params, state.input);
            let nullClineResults: {x: number, y: number}[][] = [];
            for (let i=0; i<nullClines.length; i++) {
                let f: (v: number) => number = nullClines[i];
                nullClineResults.push([]);
                for (let v=vs[0]; v<=vs[1]; v+=(vs[1] - vs[0])/100) {
                    nullClineResults[i].push({x: v, y: f(v)});
                }
            }
            fieldGraph.updateNullCline(nullClineResults);

            let states: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                states[i] = {x: newState[0], y:newState[1]};
                newState = n.Neurons.FitzHughNagumo.solve(newState, state.params, state.input, state.dt);
                t += dt;
            }
            fieldGraph.updateLine(states);

            // vector field
            let vectors: {x: number, y: number}[][] = [];
            let mag = 1.5/30;
            for (let v=-0.4; v<=1.2; v+=1.6/30) {
                for (let u=-0.1; u<=0.3; u+=0.4/30) {
                    let [v_new, u_new] = n.Neurons.FitzHughNagumo.derivative([v, u], state.params, state.input)
                    let magnitude = Math.sqrt((Math.pow(v_new, 2) + Math.pow(u_new, 2)));
                    if (magnitude > mag) {
                        v_new = mag*v_new/magnitude;
                        u_new = mag*u_new/magnitude;
                    }
                    vectors.push([{x:v,y:u},{x:v+v_new,y:u+u_new}])
                }
            }
            fieldGraph.updateVectorField(vectors, 1.5/30);


            let fixedPoints = n.Neurons.FitzHughNagumo.fixedPoints(state.state, state.params, state.input);
            let pnts = [];
            let types = [];
            let separatrix = [];
            let plotBasin = true;
            for (let i = 0; i < fixedPoints.length; i++) {
                let pnt = fixedPoints[i];
                let stability = utils.stability(
                    n.Neurons
                     .FitzHughNagumo
                     .jaccobian(fixedPoints[i], state.params, state.input)
                );
                pnts.push({x: pnt[0], y: pnt[1]})
                types.push(stability);
                if (stability.includes("sink")) {
                    plotBasin = true;
                }
            }
            if (plotBasin){
                for (let i = 0; i < fixedPoints.length; i++) {
                    // separatrix / basin of attraction
                    let stability = types[i];
                    if (stability == 'saddle') {
                        let eigenVector = utils
                                .eigen(n.Neurons
                                        .FitzHughNagumo
                                        .jaccobian(fixedPoints[0], state.params, state.input)
                                ).E.x[0];
                        let newState = [fixedPoints[i][0] + state.dt*eigenVector[0]/10,
                                        fixedPoints[i][1] + state.dt*eigenVector[1]/10];
                        let j = 0;
                        while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                            separatrix.push({x: newState[0], y: newState[1]});
                            let gradient = n.Neurons
                                            .FitzHughNagumo
                                            .derivative(newState, state.params, state.input);

                            newState = [newState[0] - state.dt*gradient[0],
                                        newState[1] - state.dt*gradient[1]];
                            j++;
                        }
                        separatrix = separatrix.reverse();
                        newState = [fixedPoints[i][0] - state.dt*eigenVector[0]/10,
                                    fixedPoints[i][1] - state.dt*eigenVector[1]/10];
                        j = 0;
                        while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                            separatrix.push({x: newState[0], y: newState[1]});
                            let gradient = n.Neurons
                                            .FitzHughNagumo
                                            .derivative(newState, state.params, state.input);

                            newState = [newState[0] - state.dt*gradient[0],
                                        newState[1] - state.dt*gradient[1]];
                            j++;
                        }
                    }

                }
            }
            
            let [minX, maxX] = fieldGraph.xScale.domain();
            let [minY, maxY] = fieldGraph.yScale.domain();
            fieldGraph.updateSeparatrix(separatrix);
            fieldGraph.updateFixedPoints(pnts, types);

        }

        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (key == "a") {
                    state.params[0] = +value;
                } else if (key == "b") {
                    state.params[1] = +value;
                } else if (key == "c") {
                    state.params[2] = +value;
                }
                let fitzhughInput = fitzHughInputF(state.params);
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            }

            fitzhughInput = fitzHughInputF(state.params);
            let ys = fiGraph.yScale.domain();
            fiGraph.updateScales([{x: fitzhughInput[0], y: ys[0]},
                                  {x: fitzhughInput[fitzhughInput.length - 1], y: ys[1]}]);
            updateSpikeGraph(inputF);
            if (kind != "inputParam") {
                updateFIGraph();
            }
            updateFieldGraph();
        }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "a", 0, 1, 0.001, state.params[0], "a", update);
        makeSlider(controlPanel, "neuronParam", "b", 0, 2, 0.001, state.params[1], "b", update);
        makeSlider(controlPanel, "neuronParam", "c", 0, 2, 0.001, state.params[2], "c", update);

        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", 0, 1, 0.005, state.input, "input current (nA)", update);
        
        fieldGraph.svg.on("click", function(d, i) {
            let [x, y] = d3.mouse(this);
            x = x - fieldGraph.margin.left;
            y = y - fieldGraph.margin.top;
            let u = fieldGraph.xScale.invert(x);
            let w = fieldGraph.yScale.invert(y);
            state.state = [u, w];
            update("", "", "");
        });

        update("", "", "");
    }


    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class IzhikevichUI extends UIHandler {

    public build() {

        let dt = 0.05;
        let params = [0.02, 0.25, -65, 2];
        let neuronState = [params[2], params[1]*params[2]];
        let inputVoltage = 2;
        let uiHandler = new IzhikevichUI();

        let inputGap = 5;
        let inputDuration = 2;

        let state = {
            neuron: "izhikevich",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        let eqs = n.Neurons.IzhikevichNeuron.equation();
        for (let eq of n.Neurons.IzhikevichNeuron.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }
       
        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "400");
        fiGraphSvg.setAttribute("height", "300");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(fiGraphSvg);
        const fieldGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fieldGraphSvg.setAttribute("width", "400");
        fieldGraphSvg.setAttribute("height", "300");
        fieldGraphSvg.setAttribute("class", "playground-plot");
        fieldGraphSvg.setAttribute("id", "fieldCurveGraph");
        bottomright.appendChild(fieldGraphSvg);

        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                    [0, 1000],
                                                    [-5, 20],
                                                    'time (msec)',
                                                    'input (nA)',
                                                    'Input Current',
                                                    inputColor);
 
        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-85, 40],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                 [INPUTS[0], INPUTS[INPUTS.length - 1]],
                                                 [0, 200],
                                                 'input (nA)',
                                                 'firing rate (hz)',
                                                 'F-I Curve',
                                                 ifColor);
        
        const fieldGraphD3 = d3.select(fieldGraphSvg);
        const fieldGraph: FieldGraph = new FieldGraph(fieldGraphD3,
                                                      [-80, -30],
                                                      [-30, 5],
                                                      [0, 25],
                                                      'membrane potential (mV)',
                                                      'recovery variable',
                                                      'Neuron Dynamics',
                                                      fieldColor);

        //update functions
        let inputs: number[] = INPUTS;
        let updateFIGraph = function () {
            let result = new Array(inputs.length);
            let firingRates = undefined;
            let bifurcations = n.Neurons.IzhikevichNeuron.bifurcations(state.state, state.params, state.input);
            let is = inputs.concat(bifurcations)
                           .filter((x) => x >= 0)
                           .sort((a,b)=> a -b);
            firingRates = n.Neurons.IzhikevichNeuron.fiCurve(state.state, state.params, is, 0.1, 250);
            for (let i=0; i<is.length; i++) {
                result[i] = {x: is[i], y:firingRates[i]};
            }
            fiGraph.update(result);
        };

        let updateSpikeGraph = function (inputFunction) {
            let result: {x: number, y: number}[] = new Array(TIME);
            let inputs: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                let input = inputFunction(state.input)(t);
                result[i] = {x: t, y:Math.min(newState[0], 30)};
                inputs[i] = {x: t, y: input};
                newState = n.Neurons.IzhikevichNeuron.solve(newState, state.params, input, state.dt);
                t += dt;
            }
            spikeGraph.update(result);
            inputGraph.update(inputs);
        }

        let vs = [-80, -30];

        let updateFieldGraph = function() {
            // null cline
            let nullClines = n.Neurons.IzhikevichNeuron.nullCline(state.params, state.input);
            let nullClineResults: {x: number, y: number}[][] = [];
            for (let i=0; i<nullClines.length; i++) {
                let f: (v: number) => number = nullClines[i];
                nullClineResults.push([]);
                for (let v=vs[0]; v<=vs[1]; v+=1) {
                    nullClineResults[i].push({x: v, y: f(v)});
                }
            }
            fieldGraph.updateNullCline(nullClineResults);
            // vector field
            let vectors: {x:number, y:number}[][] = [];
            for (let v=-80; v<=-30; v+=50/30) {
                for (let u=-30; u<=5; u+=35/30) {
                    let [v_new, u_new] = n.Neurons.IzhikevichNeuron.derivative([v, u], state.params, state.input)
                    let magnitude = Math.sqrt((Math.pow(v_new, 2) + Math.pow(u_new, 2)));
                    if (magnitude > 1.5) {
                        v_new = 1.5*v_new/magnitude;
                        u_new = 1.5*u_new/magnitude;
                    }
                    vectors.push([{x:v,y:u},{x:v+v_new,y:u+u_new}])
                }
            }
            fieldGraph.updateVectorField(vectors);

            let states: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                states[i] = {x: newState[0], y:newState[1]};
                newState = n.Neurons.IzhikevichNeuron.solve(newState, state.params, state.input, state.dt);
                t += dt;
            }
            fieldGraph.updateLine(states);

            //fixed points
            let fixedPoints = n.Neurons.IzhikevichNeuron.fixedPoints(state.state, state.params, state.input);

            let pnts = [];
            let types = [];
            let separatrix = [];
            let plotBasin = false;
            for (let i = 0; i < fixedPoints.length; i++) {
                let pnt = fixedPoints[i];
                let stability = utils.stability(
                    n.Neurons
                     .IzhikevichNeuron
                     .jaccobian(fixedPoints[i], state.params, state.input)
                );
                pnts.push({x: pnt[0], y: pnt[1]})
                types.push(stability);
                if (stability.includes("sink")) {
                    plotBasin = true;
                }
            }
            if (plotBasin) {
                for (let i = 0; i < fixedPoints.length; i++) {
                    // separatrix / basin of attraction
                    let stability = types[i];
                    if (stability == 'saddle') {
                        let eigenVector = utils
                                .eigen(n.Neurons
                                        .IzhikevichNeuron
                                        .jaccobian(fixedPoints[i], state.params, state.input)
                                ).E.x[0];
                        let newState = [fixedPoints[i][0] + state.dt*eigenVector[0]/10,
                                        fixedPoints[i][1] + state.dt*eigenVector[1]/10];
                        let j = 0;
                        while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                            separatrix.push({x: newState[0], y: newState[1]});
                            let gradient = n.Neurons
                                            .IzhikevichNeuron
                                            .derivative(newState, state.params, state.input);

                            newState = [newState[0] - state.dt*gradient[0],
                                        newState[1] - state.dt*gradient[1]];
                            j++;
                        }
                        separatrix = separatrix.reverse();
                        newState = [fixedPoints[i][0] - state.dt*eigenVector[0]/10,
                                    fixedPoints[i][1] - state.dt*eigenVector[1]/10];
                        j = 0;
                        while (fieldGraph.contains({x: newState[0], y: newState[1]}) && j < TIME / state.dt) {
                            separatrix.push({x: newState[0], y: newState[1]});
                            let gradient = n.Neurons
                                            .IzhikevichNeuron
                                            .derivative(newState, state.params, state.input);

                            newState = [newState[0] - state.dt*gradient[0],
                                        newState[1] - state.dt*gradient[1]];
                            j++;
                        }
                    }
                }
            }
            
            let [minX, maxX] = fieldGraph.xScale.domain();
            let [minY, maxY] = fieldGraph.yScale.domain();
            fieldGraph.updateSeparatrix(separatrix);
            separatrix.push({x: minX,y: maxY});
            fieldGraph.updateSeparatrixArea(separatrix);
            fieldGraph.updateFixedPoints(pnts, types);
        }



        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (key == "a") {
                    state.params[0] = +value;
                } else if (key == "b") {
                    state.params[1] = +value;
                } else if (key == "c") {
                    state.params[2] = +value;
                } else if (key == "d") {
                    state.params[3] = +value;

                }
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            }
   
            updateFieldGraph();
            updateSpikeGraph(inputF);
            if (kind != "inputParam") {
                updateFIGraph();
            }
    }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "a", 0, 0.1, 0.001, state.params[0], "a", update);
        makeSlider(controlPanel, "neuronParam", "b", -0.1, 0.3, 0.01, state.params[1], "b", update);
        makeSlider(controlPanel, "neuronParam", "c", -70, -50, 1, state.params[2], "c (mV)", update);
        makeSlider(controlPanel, "neuronParam", "d", 0, 8, 0.1, state.params[3], "d", update);

        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", -5, 20, 0.1, state.input, "input current (nA)", update);
 

        fieldGraph.svg.on("click", function(d, i) {
            let [x, y] = d3.mouse(this);
            x = x - fieldGraph.margin.left;
            y = y - fieldGraph.margin.top;
            let v = fieldGraph.xScale.invert(x);
            let u = fieldGraph.yScale.invert(y);
            state.state = [v, u];
            update("", "", "");
        });
        
        update("", "", "");
    }


    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class PersistentSodiumUI extends UIHandler {

    public build() {
        let dt = 0.05;
        let params = [10, -67, 19, 60, 74, 1.5, 16, -65];

        let neuronState = [-65, 0];
        let inputVoltage = 8;
        let uiHandler = new PersistentSodiumUI();
        let inputGap = 5;
        let inputDuration = 2;

        let state = {
            neuron: "persistent sodium",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        for (let eq of n.Neurons.PersistentSodium.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }

        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.setAttribute("class", "graph");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "400");
        fiGraphSvg.setAttribute("height", "300");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(fiGraphSvg);
        const fieldGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fieldGraphSvg.setAttribute("width", "400");
        fieldGraphSvg.setAttribute("height", "300");
        fieldGraphSvg.setAttribute("class", "playground-plot");
        fieldGraphSvg.setAttribute("id", "fieldCurveGraph");
        bottomright.appendChild(fieldGraphSvg);

        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                    [0, 1000],
                                                    [-30, 30],
                                                    'time (msec)',
                                                    'input (nA)',
                                                    'Input Current',
                                                    inputColor);
 
        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-85, 40],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 
        let inputs: number[] = Array(100).fill(1).map((x, i) => 25*i/100);
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                 [inputs[0], inputs[inputs.length - 1]],
                                                 [0, 200],
                                                 'input (nA)',
                                                 'firing rate (hz)',
                                                 'F-I Curve',
                                                 ifColor);

        const fieldGraphD3 = d3.select(fieldGraphSvg);
        const fieldGraph: MultiLineGraph = new MultiLineGraph(fieldGraphD3,
                                                 20,
                                                 [0, 30],
                                                 [-80, 40],
                                                 'time (msec)',
                                                 'membrane potential (mV)',
                                                 'Neuron Dynamics',
                                                 (new Array(50)).fill("black"));

        //update functions
        let updateFIGraph = function () {
            let result = new Array(inputs.length);
            let firingRates = undefined;
            firingRates = n.Neurons.PersistentSodium.fiCurve(state.state, state.params, inputs, 0.1, 200);
            for (let i=0; i<inputs.length; i++) {
                result[i] = {x: inputs[i], y:firingRates[i]};
            }
            fiGraph.update(result);
        };


        let updateSpikeGraph = function (inputFunction) {
            let result: {x: number, y: number}[] = new Array(TIME);
            let inputs: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                let input = inputFunction(state.input)(t);
                result[i] = {x: t, y:newState[0]};
                inputs[i] = {x: t, y: input};
                newState = n.Neurons.PersistentSodium.solve(newState, state.params, input, state.dt);
                if (n.Neurons.PersistentSodium.spike(newState, state.params)) {
                    newState[0] = 30;
                }
                t += dt;
            }
            spikeGraph.update(result);
            inputGraph.update(inputs);
        }

        let updateFieldGraph = function () {
            let vectors: {x:number, ys:number[]}[] = new Array(30/state.dt);
            let i = 0;
            for (let v=-80; v<=40; v+=120/20) {
                let newState = [v];
                let j = 0;
                for (let t=0; t<=30; t+=state.dt) {
                    if (vectors[j] === undefined) {
                        vectors[j] = {x:t,ys:new Array(20)};
                    }
                    vectors[j].ys[i] = newState[0];
                    newState = n.Neurons.PersistentSodium.derivative(newState, state.params, state.input).map((x) => x*state.dt + newState[0]);
                    j++;
                }
                i++;
            }
            fieldGraph.update(vectors);

            let fixedPoints = n.Neurons.PersistentSodium.fixedPoints(state.state, state.params, state.input);
            let pnts = [];
            let types = [];
            let separatrix = [];
            for (let i = 0; i < fixedPoints.length; i++) {
                let pnt = fixedPoints[i];
                let dv = n.Neurons
                          .PersistentSodium
                          .jaccobian(fixedPoints[i], state.params, state.input)
                let stability = dv[0][0] < 0 ? 'sink' : 'source';
                pnts.push({x: 0, y: pnt[0]})
                types.push(stability);
                console.log(pnt + " " + dv + " " + stability)
            }
            let circle = fieldGraph.extra.selectAll("circle")
                      .data(pnts);
            
            circle
                .attr("cx", d => fieldGraph.xScale(d.x))
                .attr("cy", d => fieldGraph.yScale(d.y))
                .attr("r", 4)
                .style("fill", (d, i) => types[i].includes('sink')   ? "black" : 
                                        (types[i].includes('source') ? "white" : 
                                                                        "grey"));

            circle.exit().remove();
            circle.enter()
                .append("circle")
                .attr("cx", d => fieldGraph.xScale(d.x))
                .attr("cy", d => fieldGraph.yScale(d.y))
                .attr("r", 4)
                .style("fill", (d, i) => types[i].includes('sink')   ? "black" : 
                                        (types[i].includes('source') ? "white" : 
                                                                        "grey"))
                .style("stroke", "black")
                .style("stroke-width", 0.5);

        }

        let paramNames: string[] = ["C_m",
                                    "e_leak",
                                    "g_leak",
                                    "e_sodium",
                                    "g_sodium",
                                    "m_sodium",
                                    "k_sodium",
                                    "reset"];
        
        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (paramNames.indexOf(key) != -1) {
                    state.params[paramNames.indexOf(key)] = +value;
                }
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            }
   
            updateFieldGraph();
            updateSpikeGraph(inputF);
            if (kind != "inputParam") {
                updateFIGraph();
            }
        }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "C_m", 0, 20, 1, state.params[0], "C_m", update);
        makeSlider(controlPanel, "neuronParam", "e_leak", -80, -50, 1, state.params[1], "e_leak", update);
        makeSlider(controlPanel, "neuronParam", "g_leak", 10, 30, 1, state.params[2], "g_leak", update);
        makeSlider(controlPanel, "neuronParam", "e_sodium", 50, 70, 1, state.params[3], "e_sodium", update);
        makeSlider(controlPanel, "neuronParam", "g_sodium", 50, 80, 1, state.params[4], "g_sodium", update);
        makeSlider(controlPanel, "neuronParam", "m_sodium", 0, 1, 0.1, state.params[5], "m_sodium", update);
        makeSlider(controlPanel, "neuronParam", "k_sodium", 5, 30, 1, state.params[6], "k_sodium", update);
        makeSlider(controlPanel, "neuronParam", "reset", -80, -50, 1, state.params[7], "g_sodium", update);

        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", -30, 30, 0.1, state.input, "input current (nA)", update);

        update("", "", "");
    }

    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class IntegrateAndFireUI extends UIHandler {

    public build() {
        let dt = 0.05;
        let params = [-50, 2.6, 10, 2.7, -70];
        let neuronState = [-65, 0];
        let inputVoltage = 8;
        let uiHandler = new IntegrateAndFireUI();
        let inputGap = 5;
        let inputDuration = 2;

        let state = {
            neuron: "integrate and fire",
            params: params,
            state: neuronState,
            input: inputVoltage,
            inputGap: inputGap,
            inputDuration: inputDuration,
            dt: dt
        }

        let inputF = constantInputF(100, 900);

        // build equation
        let equations = document.getElementById("equations");
        for (let eq of n.Neurons.IntegrateAndFire.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }

        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.setAttribute("class", "graph");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const inputGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        inputGraphSvg.setAttribute("width", "800");
        inputGraphSvg.setAttribute("height", "120");
        inputGraphSvg.setAttribute("class", "playground-plot");
        inputGraphSvg.setAttribute("id", "inputGraph");
        top.appendChild(inputGraphSvg);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "400");
        fiGraphSvg.setAttribute("height", "300");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(fiGraphSvg);
        const fieldGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fieldGraphSvg.setAttribute("width", "400");
        fieldGraphSvg.setAttribute("height", "300");
        fieldGraphSvg.setAttribute("class", "playground-plot");
        fieldGraphSvg.setAttribute("id", "fieldCurveGraph");
        bottomright.appendChild(fieldGraphSvg);




        const inputGraphD3 = d3.select(inputGraphSvg);
        const inputGraph: LineGraph = new LineGraph(inputGraphD3,
                                                    [0, 1000],
                                                    [-5, 20],
                                                    'time (msec)',
                                                    'input (nA)',
                                                    'Input Current',
                                                    inputColor);
 
        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [-85, 40],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 
        let inputs: number[] = Array(100).fill(1).map((x, i) => 25*i/100);
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                 [inputs[0], inputs[inputs.length - 1]],
                                                 [0, 200],
                                                 'input (nA)',
                                                 'firing rate (hz)',
                                                 'F-I Curve',
                                                 ifColor);

        const fieldGraphD3 = d3.select(fieldGraphSvg);
        const fieldGraph: MultiLineGraph = new MultiLineGraph(fieldGraphD3,
                                                 20,
                                                 [0, 50],
                                                 [-80, -30],
                                                 'time (msec)',
                                                 'membrane potential (mV)',
                                                 'Neuron Dynamics',
                                                 (new Array(20)).fill(fieldColor));

        //update functions
        let time_last = performance.now();
        let updateFIGraph = function () {
            let result = new Array(inputs.length);
            let firingRates = undefined;
            firingRates = n.Neurons.IntegrateAndFire.fiCurve(state.state, state.params, inputs, 0.1, 200);
            for (let i=0; i<inputs.length; i++) {
                result[i] = {x: inputs[i], y:firingRates[i]};
            }
            fiGraph.update(result);
        };


        let updateSpikeGraph = function (inputFunction) {
            let result: {x: number, y: number}[] = new Array(TIME);
            let inputs: {x: number, y: number}[] = new Array(TIME);
            let t = 0;
            let newState = state.state;
            for (let i=0; t<TIME; i++) {
                let input = inputFunction(state.input)(t);
                result[i] = {x: t, y:newState[0]};
                inputs[i] = {x: t, y: input};
                newState = n.Neurons.IntegrateAndFire.solve(newState, state.params, input, state.dt);
                if (n.Neurons.IntegrateAndFire.spike(newState, state.params)) {
                    newState[0] = 30;
                }
                t += dt;
            }
            spikeGraph.update(result);
            inputGraph.update(inputs);
        }

        let updateFieldGraph = function () {
            let vectors: {x:number, ys:number[]}[] = new Array(50/state.dt);
            let i = 0;
            for (let v=-80; v<=-30; v+=50/20) {
                let newState = [v];
                let j = 0;
                for (let t=0; t<=50; t+=state.dt) {
                    if (vectors[j] === undefined) {
                        vectors[j] = {x:t,ys:new Array(20)};
                    }
                    vectors[j].ys[i] = newState[0];
                    newState = n.Neurons.IntegrateAndFire.derivative(newState, state.params, state.input).map((x) => x*state.dt + newState[0]);
                    j++;
                }
                i++;
            }
            fieldGraph.update(vectors);
        }

        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (key == "threshold") {
                    state.params[0] = +value;
                } else if (key == "resistance") {
                    state.params[1] = +value;
                } else if (key == "time_constant") {
                    state.params[2] = +value;
                } else if (key == "refractory") {
                    state.params[3] = +value;
                } else if (key == "resting") {
                    state.params[4] = +value;
                }
            } else {
                inputF = inputBuilder(controlPanel, state, inputF, kind, key, value, inputDuration, inputGap, update);
            } 

            updateSpikeGraph(inputF);
            updateFIGraph();
            updateFieldGraph();
        }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "threshold", -60, -40, 1, state.params[0], 'threshold (mV)', update);
        makeSlider(controlPanel, "neuronParam", "resistance", 0.1, 5, 0.1, state.params[1], 'resistance (Ohm)', update);
        makeSlider(controlPanel, "neuronParam", "time_constant", 5, 25, 1, state.params[2], 'time constant (ms)', update);
        makeSlider(controlPanel, "neuronParam", "refractory", 0, 8, 0.1, state.params[3], 'refractory time (ms)', update);
        makeSlider(controlPanel, "neuronParam", "resting", -80, -60, 1, state.params[4], 'resting voltage (mV)', update);


        var opts = ["constant", "pulses", "impulse"];
        makeSelect(controlPanel, "inputType", "inputType", opts, update);
        makeSlider(controlPanel, "inputParam", "input", -5, 20, 0.1, state.input, "input current (nA)", update);
       
        update("", "", "");
    }

    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class PoissonUI extends UIHandler {

    public build() {
        let dt = 0.05
        let params = [100];
        let neuronState = [0];
        let inputVoltage = 0;
        let uiHandler = new PoissonUI();

        let state = {
            neuron: "integrate and fire",
            params: params,
            state: neuronState,
            input: inputVoltage,
            dt: dt
        }

        // build equation
        let equations = document.getElementById("equations");
        for (let eq of n.Neurons.PoissonNeuron.equation()){
            let equation = document.createElement("div");
            equation.setAttribute("class", "equation");
            equation.innerHTML = eq;
            equations.appendChild(equation);
            try {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, equation]);
            }
            catch (e) {}
        }


        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        const bottomleft = document.createElement("div");
        bottomleft.setAttribute("class", "graph");
        bottomleft.style.setProperty("grid-row", "3");
        bottomleft.style.setProperty("grid-column", "3");
        const bottomright = document.createElement("div");
        bottomright.setAttribute("class", "graph");
        bottomright.style.setProperty("grid-row", "3");
        bottomright.style.setProperty("grid-column", "4");
        figure.appendChild(top);
        figure.appendChild(bottomleft);
        figure.appendChild(bottomright);
        const spikeGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        spikeGraphSvg.setAttribute("width", "800");
        spikeGraphSvg.setAttribute("height", "220");
        spikeGraphSvg.setAttribute("class", "playground-plot");
        spikeGraphSvg.setAttribute("id", "spikeGraph");
        top.appendChild(spikeGraphSvg);
        const hzGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        hzGraphSvg.setAttribute("width", "400");
        hzGraphSvg.setAttribute("height", "300");
        hzGraphSvg.setAttribute("class", "playground-plot");
        hzGraphSvg.setAttribute("id", "fiCurveGraph");
        bottomleft.appendChild(hzGraphSvg);
        const stateGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        stateGraphSvg.setAttribute("width", "400");
        stateGraphSvg.setAttribute("height", "300");
        stateGraphSvg.setAttribute("class", "playground-plot");
        stateGraphSvg.setAttribute("id", "stateCurveGraph");
        bottomright.appendChild(stateGraphSvg);

        const spikeGraphD3 = d3.select(spikeGraphSvg);
        const spikeGraph: LineGraph = new LineGraph(spikeGraphD3,
                                                    [0, 1000],
                                                    [0, 1],
                                                    'time (msec)',
                                                    'membrane potential (mV)',
                                                    'Membrane Potential',
                                                    spikeColor);
 
        const hzGraphD3 = d3.select(hzGraphSvg);
        const hzGraph: Histogram = new Histogram(hzGraphD3,
                                                 [0,200],
                                                 [0, 1],
                                                 'Firing Rate (Hz)',
                                                 'Probability',
                                                 'Hz Distribution',
                                                 inputColor);

        const stateGraphD3 = d3.select(stateGraphSvg);
        const stateGraph: Histogram = new Histogram(stateGraphD3,
                                                    [0, 100],
                                                    [0, 1],
                                                    'inter-spike interval (ms)',
                                                    'Probability',
                                                    'Inter-spike Interval Distribution)',
                                                    inputColor);
 
        
        //update functions
        let inputs = new Array(500).fill(0).map((_, i) => i);
        let updateDistributionGraphs = function () {

            let spikeCounts: number[] = [];
            let interSpikeIntervals: number[] = [];
            var t = 0;
            var last_spike = -1;
            for (let input of inputs) {
                let spikeCount: number = 0;
                let newState = state.state;
                for (let t=0; t<TIME; t+=dt) {
                    newState = n.Neurons.PoissonNeuron.solve(newState, params, input, dt);
                    var isspike = n.Neurons.PoissonNeuron.spike(newState, params) ? 1 : 0;
                    if (isspike == 1) {
                        spikeCount += 1;
                        let interval = last_spike == -1 ? t : t - last_spike;
                        interSpikeIntervals.push(interval);
                        last_spike = t;
                    }
                    t += state.dt;
                }
                spikeCounts.push(spikeCount);
            }
            hzGraph.update(spikeCounts);
            stateGraph.update(interSpikeIntervals);
        };


        let updateSpikeGraph = function () {
            let result: {x: number, y: number}[] = [];
            let t = 0;
            let newState = state.state;
            for (let i=0; t<1000; i++) {
                result.push({x: t, y:newState[0]});
                newState = n.Neurons.PoissonNeuron.solve(newState, state.params, state.input, state.dt);
                t += dt;
            }
            spikeGraph.update(result);
        }

        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (key == "instantaneous firing rate") {
                    state.params[0] = +value;
                }
            }
            updateSpikeGraph();
            updateDistributionGraphs();
        }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        makeSlider(controlPanel, "neuronParam", "instantaneous firing rate", 1, 200, 1, state.params[0], 'firing rate', update);

        update("", "", "");
    }

    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}

export class RateModelUI extends UIHandler {

    public build() {
        let dt = 0.05
        let params = [0, 1, 0];
        let neuronState = [0];
        let inputVoltage = 0;
        let uiHandler = new RateModelUI();

        let state = {
            neuron: "rate model",
            params: params,
            state: neuronState,
            input: inputVoltage,
            dt: dt
        }

        // build equation

        // build graphs
        const figure = document.getElementById("neuron-playground");
        const top = document.createElement("div");
        top.style.setProperty("grid-row", "2");
        top.style.setProperty("grid-column", "3 / span 2");
        top.setAttribute("class", "graph");
        figure.appendChild(top);
        const fiGraphSvg: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        fiGraphSvg.setAttribute("width", "800");
        fiGraphSvg.setAttribute("height", "220");
        fiGraphSvg.setAttribute("class", "playground-plot");
        fiGraphSvg.setAttribute("id", "fiGraph");
        top.appendChild(fiGraphSvg);
        const fiGraphD3 = d3.select(fiGraphSvg);
        const fiGraph: LineGraph = new LineGraph(fiGraphD3,
                                                    [0, 20],
                                                    [0, 1],
                                                    'Input Units',
                                                    'Output Units',
                                                    'Rate Model',
                                                    spikeColor);
        
        let inputs = Array(101).fill(1).map((_, i) => (i/100)*20);
        let updateFIGraph = function () {
            let result = new Array(inputs.length);
            let firingRates = undefined;
            firingRates = n.Neurons.RateModelNeuron.fiCurve(state.state, state.params, inputs, 0.1, TIME);
            for (let i=0; i<inputs.length; i++) {
                result[i] = {x: inputs[i], y:firingRates[i]};
            }
            fiGraph.update(result);
        }

        let update = function (kind: string, key: any, value: any) {
            if (kind == "neuronParam") {
                if (key == "shape") {
                    state.params[1] = +value;
                } else if (key == "bias") {
                    state.params[2] = +value;
                } else if (key == "activationFunction") {
                    switch (value) {
                        case 'ReLU': {
                            state.params[0] = 0;
                            break;
                        }
                        case 'sigmoid': {
                            state.params[0] = 1;
                            break;
                        }
                    }
                }
            }
            updateFIGraph();
        }

        // build control panel
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        let opts = ['ReLU', 'sigmoid'];
        makeSelect(controlPanel, "neuronParam", "activationFunction", opts, update);
        makeSlider(controlPanel, "neuronParam", "shape", 0, 2, 0.01, state.params[1], 'shape', update);
        makeSlider(controlPanel, "neuronParam", "bias", 0, 20, 1, state.params[2], 'bias', update);

        update("", "", "");
    }

    public destroy() {
        // destroy all graphs
        let graphs = document.getElementsByClassName("graph");
        for (let i = graphs.length - 1; i >= 0; i--) {
            graphs[i].remove();
        }
        // destroy all inputs
        const controlPanel: HTMLElement = document.getElementById("control-panel");
        controlPanel.innerHTML="";
        // destroy equation
        const equations: HTMLElement = document.getElementById("equations");
        equations.innerHTML="";
    }
}
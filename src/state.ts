import * as neuron from "./neuron_models";
import {LineGraph} from "./linegraph";

export class State {
    public neuron: neuron.BiologicalNeuron;
    public dt: number;
    public input: number;
    public inputFunction: (time: number, input: number) => number;
    public ui: UIBuilder;
    public graphParams: GraphParams;
    public spikeTrain: LineGraph;
    public inputGraph: LineGraph;
    public phaseGraph: LineGraph;
    public ifCurve: LineGraph;
}

export interface GraphParams {
    time: number,
    spikeXRange: [number, number],
    spikeYRange: [number, number],
    phaseXRange: [number, number],
    phaseYRange: [number, number],
    inputRange: [number, number],
    IF_XRange: [number, number],
    IF_YRange: [number, number]
}

export interface UIBuilder {
    demolish: (controlPanel: d3.Selection<any, any, any, any>) => void;
    build: (controlPanel: d3.Selection<any, any, any, any>, state: State, redraw: (state: State) => void) => void;
}

function slider(controlPanel: d3.Selection<any, any, any, any>,
                range: [number, number, number],
                value: number,
                classes: string,
                id: string,
                name: string) : d3.Selection<any, any, any, any> {
    let uiDiv = controlPanel.append("div")
                            .attr("class", classes);

    uiDiv.append("label")
        .attr("for", id)
        .text(name)
        .append("span")
        .text(value);

    uiDiv.append("input")
                .attr("type", "range")
                .attr("min", range[0])
                .attr("max", range[1])
                .attr("step", range[2])
                .attr("id", id)
                .property("value", value);
    return uiDiv;
}

function options(controlPanel: d3.Selection<any, any, any, any>,
                 opts: string[],
                 classes: string,
                 id: string,
                 name: string) : d3.Selection<any, any, any, any> {
 
    let uiDiv = controlPanel.append("div")
                            .attr("class", classes);
    uiDiv.append("label")
         .attr("for", id)
         .text(name);

    let selection = uiDiv.append("select");

    for (let i=0; i < opts.length; i++) {
        selection.append("option")
                    .attr("value", opts[i])
                    .text(opts[i]);
    }
    selection.attr("id", id);
    return uiDiv;
}

export class UIBuilders {

    public static IzhikevichUI: UIBuilder = {
        
        demolish: (body: d3.Selection<any, any, any, any>) => {
            body.select("#controlPanel").html("");
            body.select("#equations").html("");
        }
        ,
        build: (body: d3.Selection<any, any, any, any>, state: State, redraw: (state: State) => void) => {
          //add neuron equation
          let equations = body.select("#equations");
          for (let eq of state.neuron.equation) {
            equations.append("div")
                        .attr("class", "equation")
                        .text(eq);
          }
          try {
              MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
          }
          catch(e) {}
          let controlPanel = body.select("#controlPanel");
          //neuron states
          let selectStates = {
            "regular spiking":  {neuronParameters: [0.02, 0.2, -65, 8], neuronState: [-65, 0.2*-65], input: 10},
            "intrisically bursting": {neuronParameters: [0.02, 0.2, -55, 4], neuronState: [-65, 0.2*-65], input: 10},
            "chattering":       {neuronParameters: [0.02, 0.2, -50, 2], neuronState: [-65, 0.2*-65], input: 10},
            "fast spiking":     {neuronParameters: [0.1, 0.2, -65, 2], neuronState: [-65, 0.2*-65], input: 10},
            "thalamo-cortical": {neuronParameters: [0.02, 0.25, -65, 0.05], neuronState: [-65, 0.2*-65], input: 10},
            "resonator":        {neuronParameters: [0.1, 0.26, -65, 8], neuronState: [-65, 0.2*-65], input: 10}
           };

           let selectInputs = {
               "constant": (time: number, input: number) => {
                   if (time > 100 && time < 900) {
                       return input;
                   } else {
                       return 0;
                   }
               },
               "various frequencies": (time: number, input: number) => {
                    if (time > 100 && time < 130 && time % 10 < 1) {
                        return input;
                    } else if (time > 200 && time < 260 && time % 20 < 1) {
                        return input;
                    } else if (time > 300 && time < 390 && time % 30 < 1) {
                        return input;
                    } else {
                        return 0;
                    }
               }
           };

           //build sliders and selectors
           let classes = "neuronInput";
           let itype = options(controlPanel, Object.keys(selectInputs),
                         classes + " selector", "inputtype", "input kind:    ");

           let i = slider(controlPanel, [-10,20,0.1], 10, classes + " slider",  "inputCurrent",
                          "injected current (mV):   ");

           let t = options(controlPanel, Object.keys(selectStates),
                           classes + " selector", "neurontype", "neuron type");

           let a = slider(controlPanel, [0,0.1, 0.001], 0.02, classes + " slider", "aRecovDecay",
                          "recovery decay:  ");

           let b = slider(controlPanel, [-0.1,0.3, 0.01], 0.25, classes + " slider", "bRecovSensitivity",
                          "recovery sensitivity:    ");
 
           let c = slider(controlPanel, [-70,-50, 1], -65,  classes + " slider", "cMembraneReset",
                          "membrane reset:  ");
          
           let d = slider(controlPanel, [0,8, 0.1], 2,  classes + " slider", "dRecoveryReset",
                          "recovery reset:  ");

            //listeners to change neuron state
            i.select("input").on("input", function () {
                state.input = +this.value;
                i.select("span").text(this.value);
                redraw(state);
            });
            a.select("input").on("input", function () {
                state.neuron.setParameter('a', +this.value);
                a.select("span").text(this.value);
                redraw(state);
            });
            b.select("input").on("input", function () {
                state.neuron.setParameter('b', +this.value);
                b.select("span").text(this.value);
                redraw(state);
            });
            c.select("input").on("input", function () {
                state.neuron.setParameter('c', +this.value);
                c.select("span").text(this.value);
                redraw(state);
            });
            d.select("input").on("input", function () {
                state.neuron.setParameter('d', +this.value);
                d.select("span").text(this.value);
                redraw(state);
            });
            t.select("select").on("input", function () {
                let newstate = selectStates[this.value];
                state.neuron.setParameter('a', newstate.neuronParameters[0])
                state.neuron.setParameter('b', newstate.neuronParameters[1])
                state.neuron.setParameter('c', newstate.neuronParameters[2])
                state.neuron.setParameter('d', newstate.neuronParameters[3])
                state.input = newstate.input;
                a.select("input").property("value", +newstate.neuronParameters[0]);
                a.select("span").text(newstate.neuronParameters[0]);
                b.select("input").property("value", +newstate.neuronParameters[1]);
                b.select("span").text(newstate.neuronParameters[1]);
                c.select("input").property("value", +newstate.neuronParameters[2]);
                c.select("span").text(newstate.neuronParameters[2]);
                d.select("input").property("value", +newstate.neuronParameters[3]);
                d.select("span").text(newstate.neuronParameters[3]);
                redraw(state);
            });
    
            itype.select("select").on("input", function () {
                state.inputFunction = selectInputs[this.value];
                redraw(state);
            });
        }
    };

    public static FitzHugh_NagumoUI: UIBuilder = {
        
        demolish: (body: d3.Selection<any, any, any, any>) => {
            body.select("#controlPanel").html("");
            body.select("#equations").html("");
        },
        build: (body: d3.Selection<any, any, any, any>, state: State, redraw: (state: State) => void) => {
          //add neuron equation
          let equations = body.select("#equations");
          for (let eq of state.neuron.equation) {
            equations.append("div")
                        .attr("class", "equation")
                        .text(eq);
          }
          try {
              MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
          }
          catch(e) {}
          let controlPanel = body.select("#controlPanel");
          //neuron states
          let selectStates = {
            "regular spiking":  {neuronParameters: [0.7, 0.8, 0.08], neuronState: [-65, 0.2*-65], input: 10}
           };

           let selectInputs = {
               "constant": (time: number, input: number) => {
                   if (time > 100 && time < 900) {
                       return input;
                   } else {
                       return 0;
                   }
               },
               "various frequencies": (time: number, input: number) => {
                    if (time > 100 && time < 130 && time % 10 < 1) {
                        return input;
                    } else if (time > 200 && time < 260 && time % 20 < 1) {
                        return input;
                    } else if (time > 300 && time < 390 && time % 30 < 1) {
                        return input;
                    } else {
                        return 0;
                    }
               }
           };

           //build sliders and selectors
           let classes = "neuronInput";
           let itype = options(controlPanel, Object.keys(selectInputs),
                         classes + " selector", "inputtype", "input kind:    ");

           let i = slider(controlPanel, [-2,1,0.05], 0.5, classes + " slider",  "inputCurrent",
                          "injected current (mV):   ");

           let t = options(controlPanel, Object.keys(selectStates),
                           classes + " selector", "neurontype", "neuron type");

           let a = slider(controlPanel, [0,1, 0.01], 0.8, classes + " slider", "aRecovDecay",
                          "A:  ");

           let b = slider(controlPanel, [0,1, 0.01], 0.7, classes + " slider", "bRecovSensitivity",
                          "B:    ");
 
           let phi = slider(controlPanel, [0, 1, 0.01], 0.08,  classes + " slider", "cMembraneReset",
                          "phi (recovery rate):  ");
            
            //listeners to change neuron state
            i.select("input").on("input", function () {
                state.input = +this.value;
                i.select("span").text(this.value);
                redraw(state);
            });
            a.select("input").on("input", function () {
                state.neuron.setParameter('a', +this.value);
                a.select("span").text(this.value);
                redraw(state);
            });
            b.select("input").on("input", function () {
                state.neuron.setParameter('b', +this.value);
                b.select("span").text(this.value);
                redraw(state);
            });
            phi.select("input").on("input", function () {
                state.neuron.setParameter('phi', +this.value);
                phi.select("span").text(this.value);
                redraw(state);
            });
            t.select("select").on("input", function () {
                let newstate = selectStates[this.value];
                state.neuron.setParameter('a', newstate.neuronParameters[0])
                state.neuron.setParameter('b', newstate.neuronParameters[1])
                state.neuron.setParameter('phi', newstate.neuronParameters[2])
                state.input = newstate.input;
                a.select("input").property("value", +newstate.neuronParameters[0]);
                a.select("span").text(newstate.neuronParameters[0]);
                b.select("input").property("value", +newstate.neuronParameters[1]);
                b.select("span").text(newstate.neuronParameters[1]);
                phi.select("input").property("value", +newstate.neuronParameters[2]);
                phi.select("span").text(newstate.neuronParameters[2]);
                redraw(state);
            });
    
            itype.select("select").on("input", function () {
                state.inputFunction = selectInputs[this.value];
                redraw(state);
            });
        }
    };

}
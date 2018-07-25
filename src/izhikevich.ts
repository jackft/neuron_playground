import {BiologicalNeuron} from './neuron';
import {FixedPoint, solveQuadratic, stability} from './utils';

const membraneEq = "$\\frac{dv}{dt} = 0.04v^2 + 5v + 140 - u + I$";
const recoveryEq = "$\\frac{du}{dt} = a(bv - u)$";
const resetEq = "$if\\ v > 30mV\\ then \\begin{cases} v = c \\\\ u = u + d\\end{cases}$";
export const equations = [membraneEq, recoveryEq, resetEq];

export class IzhikevichNeuron extends BiologicalNeuron {
    public time: number = 10;
    public inputRange: number[] = (new Array(20)).map((x, i) => i);
    public a: number;
    public b: number;
    public c: number;
    public d: number;
    public dt: number;

    constructor(a: number, b: number, c: number, d: number, dt: number) {
        super();
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.state = {'v': c,
                      'u': c*b};
    }

    public solve = (input: number): [number, number] => {
        let v_0 = this.state['v'];
        let u_0 = this.state['u'];
        let v_1: number,
            u_1: number;
        if (this.state['v'] < 30) {
            v_1 = v_0 + this.dt*(0.04*v_0**2 + 5*v_0 + 140 - u_0 + input);
            u_1 = u_0 + this.dt*this.a*(this.b*v_0 - u_0);
        }
        else {
            v_1 = this.c;
            u_1 = u_0 + this.d;
        }
        this.state['v'] = v_1;
        this.state['u'] = u_1;
        return [v_1, u_1];
    }

    public derivative(input: number): [number, number] {
        let v = this.state['v'];
        let u = this.state['u'];
        return [
            0.04*v**2 + 5*v + 140 - u + input,
            this.a*(this.b*v - u)
        ];
    }

    public ifCurve = (): number[] => {
        let spikeCounts: number[] = Array(this.inputRange.length);
        for (let i=0; i < spikeCounts.length; i++) {
            let input = this.inputRange[i];
            let nSpikes = 0;
            for (let t=0; t < this.time; t + this.dt) {
                this.solve(input);
                if (this.state['v'] >= 30) {
                    nSpikes += 1;
                }
            }
            spikeCounts[i] = nSpikes;
        }
        return spikeCounts;
    }

    /*
     * Find a function which defines all the points on which part of the 
     * Derivative is 0. This is an important part of a dynamical equation,
     * beause the system will qualitatively change.
     */
    public nullCline(input: number): ((v: number) => number)[] {
        return [
            (v: number) => 0.04*v**2 + 5*v + 140 + input,
            (v: number) => this.b*v
        ];
    }

    /*  
     * Jaccobian of the derivative of the system.
     * Basically this is a linearization of the dynamical system.
     */
    public jaccobian(v: number, u: number): number[][] {
        return [
            [0.08*v + 5, -1],
            [this.a*this.b, -this.a]
        ]
    }

    /*
     * The fixed points of the system, i.e. where the system doesn't change,
     * or orbits.
     */
    public fixedPoints(input: number): FixedPoint[] {
        let aSquare = 0.04,
            bLinear = 5 - this.b,
            cOffset = 140 + input;
        let vs = solveQuadratic(aSquare, bLinear, cOffset);
        let results: FixedPoint[] = Array(vs.length);
        for (let i=0; i < vs.length; i++) {
            let v = vs[i],
                u = this.b*v;
            results[i] = {pnt: [v, u], 
                          type: stability(this.jaccobian(v, u))};
        }
        return results;
    }

}
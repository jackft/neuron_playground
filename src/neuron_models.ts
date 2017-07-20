import {MultiPoint, Point, stability, solveCubic, solveQuadratic} from './utilities';

export abstract class BiologicalNeuron {
    public equation: string[];
    public abstract solve(input: number[], dt: number, state?: number[]): MultiPoint[];
    public abstract IFCurve(input: number[], dt: number, time: number, state?: number[]): MultiPoint[];
    public abstract setParameter(param: string, value: number): void;
    public abstract nullcline(input: number): ((v: number) => number)[];
    public abstract fixedPoints(input: number): {point: Point, type: string}[];
    public abstract derivative(input: number, state?: number[]): number[];
}


export class Izhikevich extends BiologicalNeuron {
    private membraneEq = "$\\frac{dv}{dt} = 0.04v^2 + 5v + 140 - u + I$";
    private recoveryEq = "$\\frac{du}{dt} = a(bv - u)$";
    private resetEq = "$if\\ v > 30mV\\ then \\begin{cases} v = c \\\\ u = u + d\\end{cases}$";
    public equation = [this.membraneEq, this.recoveryEq, this.resetEq];

    private a: number;
    private b: number;
    private c: number;
    private d: number;
    private v: number;
    private u: number;

    constructor(a: number, b: number, c: number, d: number) {
        super();

        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;

        this.v = c;
        this.u = c*b;
    }

    public setParameter(param: string, value: number): void {
        if (param == 'a') {
            this.a = value;
        } else if (param == 'b') {
            this.b = value;
        } else if (param == 'c') {
            this.c = value;
        } else if (param == 'd') {
            this.d = value;
        }
    }

    public solve(input: number[], dt: number, state?: number[]): MultiPoint[] {
        let output: MultiPoint[] = Array(input.length);
        let v: number,
            u: number;
        let t = 0;
        if (state) {
            v = state[0];
            u = state[1];
        } else {
            v = this.v;
            u = this.u;
        }
        for (let i=0; i < input.length; i++) {
            if (v >= 30) {
                v = this.c;
                u = u + this.d;
            } else {
                let tmpV = v + dt*(0.04*v**2 + 5*v + 140 - u + input[i]);
                u = u + dt*this.a*(this.b*v - u);
                v = Math.min(30, tmpV);
            }
            t += dt;
            output[i] = {x: t, y: [v, u]};
        }
        return output;
    }

    public IFCurve(input: number[], dt: number, time: number, state?: number[]): MultiPoint[] {
        let output: MultiPoint[] = Array(input.length);

        let initV: number,
            initU: number,
            v: number,
            u: number;
        if (state) {
            initV = state[0];
            initU = state[1];
        } else {
            initV = this.v;
            initU = this.u;
        }

        for (let i=0; i < input.length; i++) {
            let count = 0,
                I = input[i];
            v = initV;
            u = initU;
            for (let t=0; t < time; t += dt) {
                if (v >= 30) {
                    v = this.c;
                    u = this.d + u;
                    count++;
                } else {
                    let tmpV = v + dt*(0.04*v**2 + 5*v + 140 - u + I);
                    u = u + dt*this.a*(this.b*v - u);
                    v = tmpV;
                }
            }
            output[i] = {x: I, y: [count/1000/dt]}
        }
        return output;
    }

    public nullcline(input: number): ((v: number) => number)[] {
        return [
            (v: number) => 0.04*v**2 + 5*v + 140 + input,
            (v: number) => this.b*v
        ];
    }

    public fixedPoints(input: number): {point: Point, type: string}[] {
        let aSquare = 0.04,
            bLinear = 5 - this.b,
            cOffset = 140 + input;
        let vs = solveQuadratic(aSquare, bLinear, cOffset);
        let results = Array(vs.length);
        for (let i=0; i < vs.length; i++) {
            let v = vs[i],
                u = this.b*v;
            results[i] = {point: {x: v, y: u},
                          type: stability(this.jaccobian(v, u))};
        }
        return results;
    }

    private jaccobian(v: number, u: number): number[][] {
        return [
            [0.08*v + 5, -1],
            [this.a*this.b, -this.a]
        ]
    }

    public derivative(input: number, state?: number[]): number[] {
        let v: number,
            u: number;
        if (state) {
            v = state[0];
            u = state[1];
        } else {
            v = this.v;
            u = this.u;
        }

        return [
            0.04*v**2 + 5*v + 140 - u + input,
            this.a*(this.b*v - u)
        ];
    }

}

export class FitzHugh_Nagumo extends BiologicalNeuron{
    private membraneEq = "$ \\frac{dv}{dt} = v - \\frac{v^3}{3} - w + I $";
    private recoveryEq = "$ \\frac{du}{dt} = \\phi(a - v - bw) $";
    public equation = [this.membraneEq, this.recoveryEq];

    public phi: number;
    public a: number;
    public b: number;
    public v: number;
    public w: number;

    constructor(phi: number, a: number, b: number) {
        super();
        this.phi = phi;
        this.a = a;
        this.b = b;
        this.v = -1;
        this.w = -1;
    }

    public setParameter(param: string, value: number): void {
        if (param == 'a') {
            this.a = value;
        } else if (param == 'b') {
            this.b = value;
        } else if (param == 'phi') {
            this.phi = value;
        }
    }

    public solve(input: number[], dt: number, state?: number[]): MultiPoint[] {
        let output: MultiPoint[] = Array(input.length);
        let v: number,
            w: number;
        let t = 0;
        if (state) {
            v = state[0];
            w = state[1];
        } else {
            v = this.v;
            w = this.w;
        }
        for (let i=0; i < input.length; i++) {
            let tmpV = v + dt*(v - (v**3)/3 - w + input[i]);
            w = w + dt*(this.phi*(v - this.a - this.b*w));
            v = tmpV;
            t += dt;
            output[i] = {x: t, y: [v, w]};
        }
        return output;
    }

    public IFCurve(input: number[], dt: number, time: number, state?: number[]): MultiPoint[] {
        let output: MultiPoint[] = Array(input.length);

        let initV: number,
            initW: number,
            v: number,
            w: number;
        if (state) {
            initV = state[0];
            initW = state[1];
        } else {
            initV = this.v;
            initW = this.w;
        }

        for (let i=0; i < input.length; i++) {
            let count = 0,
                I = input[i];
            v = initV;
            w = initW;
            let oldDV = -1;
            for (let t=0; t < time; t += dt) {
                let dv = dt*(v - v**3/3 - w + I);
                v += dv;
                w += dt*(this.phi*(v - this.a - this.b*w));
                if (v >= 1.5 && oldDV > 0 && dv <= 0) {
                    count++;
                }
                oldDV = dv;
            }
            output[i] = {x: I, y: [count]}
        }
        return output;
    }

    public nullcline(input: number): ((v: number) => number)[] {
        return [
            (v: number) => v - v**3/3 + input,
            (v: number) => (v - this.a)/this.b
        ];
    }

    public fixedPoints(input: number): {point: Point, type: string}[] {
        let aCube = -1/3, //this.b/3,
            bSquare = 0,
            cLinear = 1 - (1/this.b),
            dOffset = input + (this.a/this.b)//this.b*input - this.a;
        let vs = solveCubic(aCube, bSquare, cLinear, dOffset);
        let results = Array(vs.length);
        for (let i=0; i < vs.length; i++) {
            let v = vs[i],
                w = (v - this.a)/this.b;
            results[i] = {point:{x: v, y: w},
                          type: stability(this.jaccobian(v, w))};
        }
        return results;
    }

    private jaccobian(v: number, u: number): number[][] {
        return [
            [1 - v**2, -1],
            [this.phi, -this.b*this.phi]
        ]
    }



    public derivative(input: number, state?: number[]): number[] {
        let v: number,
            w: number;
        if (state) {
            v = state[0];
            w = state[1];
        } else {
            v = this.v;
            w = this.w;
        }

        return [
            v - v**3/3 - w + input,
            this.phi*(v - this.a - this.b*w)
        ];
    }

}
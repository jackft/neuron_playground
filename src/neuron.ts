import * as utils from './utils';

export interface Neuron {
    equation: () => string[];
    spike: (state: number[], params?: number[], input?: number, dt?: number) => boolean;
    solve: (state: number[], params: number[], input: number, dt: number) => number[];
    derivative: (state: number[], params: number[], input: number) => number[];
    fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => number[];
}

export interface DynamicalNeuron extends Neuron {
    nullCline: (params: number[], input: number) => ((v: number) => number)[];
    jaccobian: (state: number[], params: number[], input: number) => number[][];
    fixedPoints: (state: number[], params: number[], input: number) => number[][];
    bifurcations: (state: number[], params: number[], input: number) => number[];
}

export class Neurons {
    private static HodgekinHuxleyHelper = {
        alphaN: (v) => (v == 10) ? Neurons.HodgekinHuxleyHelper.alphaN(v + 0.001)  : (10-v) / (100*(Math.exp((10-v)/10)-1)),
        betaN: (v) =>  0.125 * Math.exp(-v/80),
        alphaM: (v) => (v == 25) ? Neurons.HodgekinHuxleyHelper.alphaM(v + 0.001) : (25-v) / (10 * (Math.exp((25-v)/10)-1)),
        betaM: (v) => 4 * Math.exp(-v/18),
        alphaH: (v) =>  0.07*Math.exp(-v/20),
        betaH: (v) => 1 / (Math.exp((30-v)/10)+1)
    }
    public static HodgekinHuxleyNeuron: DynamicalNeuron = {
        equation: () => [],
        bifurcations: (state: number[], params: number[], input: number) => [],
        spike: (state: number[], params: number[], input: number, dt: number) => {
            // slightly tricky. We register a spike if it crosses the nullcline
            // in a region of the state space.
            let [v, m, h, n] = state;
            let [dv, _1, _2 , _3] = Neurons.HodgekinHuxleyNeuron.derivative(state, params, input);
            return v < 80 && dv*dt + v > 80;
        },
        derivative: (state: number[], params: number[], input: number) => {
            let [v, m, h, n] = state;
            let [c_m, g_na, e_na, g_k, e_k, g_l, e_l] = params;

            var alphaN = Neurons.HodgekinHuxleyHelper.alphaN(v);
            var betaN = Neurons.HodgekinHuxleyHelper.betaN(v);
            var alphaM = Neurons.HodgekinHuxleyHelper.alphaM(v);
            var betaM = Neurons.HodgekinHuxleyHelper.betaM(v);
            var alphaH = Neurons.HodgekinHuxleyHelper.alphaH(v);
            var betaH = Neurons.HodgekinHuxleyHelper.betaH(v);
            
            var tauN = 1 / (alphaN + betaN);
            var tauM = 1 / (alphaM + betaM);
            var tauH = 1 / (alphaH + betaH);
            var nInf = alphaN * tauN;
            var mInf = alphaM * tauM;
            var hInf = alphaH * tauH;
            
            let dndt = 1 / tauN * (nInf - n);
            let dmdt = 1 / tauM * (mInf - m);
            let dhdt = 1 / tauH * (hInf - h);
            
            let INa = g_na* (m **3)*h*(e_na - v);
            let IK = g_k*(n**4)*(e_k - v);
            let Im = g_l * (e_l - v);
            let dvdt = 1 / c_m * (INa + IK + Im + input);
            return [dvdt, dmdt, dhdt, dndt];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let [v_old, m_old, h_old, n_old] = state;
            let [d_v, d_m, d_h, d_n] = Neurons.HodgekinHuxleyNeuron.derivative(state, params, input);
            return [v_old + dt*d_v, m_old + dt*d_m, h_old + dt*d_h, n_old + dt*d_n];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let spikeCounts: number[] = [];
            for (let input of inputs) {
                let spikeCount: number = 0;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.HodgekinHuxleyNeuron.solve(newState, params, input, dt);
                    spikeCount += Neurons.HodgekinHuxleyNeuron.spike(newState, params, input, dt) ? 1 : 0;
                }
                spikeCounts.push(spikeCount);
            }
            return spikeCounts;
        },
        nullCline: (params: number[], input: number) => {
            let [ , b, , ] = params;
            return [
            ];
        },
        jaccobian: (state: number[], params: number[], input: number) => {
            return [[]];
        },
        fixedPoints: (state: number[], params: number[], input: number) => {
            return [[]];
        }
    }
    public static PersistentSodiumPlusPotassium: DynamicalNeuron = {
        equation: () => ["$ \\frac{dv}{dt} = I - g_L(V - E_L) - g_{Na}m_\\infty(V)(V-E_{Na}) - g_Kn(V-E_K)$",
                         "$\\frac{dn}{dt} = (n_\\infty(V) - n)/\\tau(V)$"],
        bifurcations: (state: number[], params: number[], input: number) => {
            let [e_leak, e_sodium, e_potassium] = params;
            return [0, 0];
        },
        spike: (state: number[], params?: number[], input?: number, dt?: number) => {
            // slightly tricky. We register a spike if it crosses the nullcline
            // in a region of the state space.
            let [fu, fw] = Neurons.PersistentSodiumPlusPotassium.nullCline(params, input);
            let [u, w] = state;
            if (u > 5 && w < fw(u)) {
                let [du, dw] = Neurons.PersistentSodiumPlusPotassium.derivative(state, params, input);
                if (w < fu(u) && w + dt*dw > fu(dt*du + u) ) {
                    return true;
                }
            }
            return false;
        },
        derivative: (state: number[], params: number[], input: number) => {
            let [c, m, mk, n, nk, tau, e_leak, e_sodium, e_potassium, g_leak, g_sodium, g_potassium] = params;
            let [v_old, n_old] = state;

            let n_inf = 1/(1 + Math.exp((n - v_old)/nk));
            let m_inf = 1/(1 + Math.exp((m - v_old)/mk));

            let dv = input - g_leak*(v_old - e_leak) 
                           - g_sodium*m_inf*(v_old-e_sodium)
                           - g_potassium*n_old*(v_old-e_potassium);
            let dn = (n_inf - n_old)/tau;
            return [dv, dn];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let [v_old, n_old] = state;
            let [d_v, d_n] = Neurons.PersistentSodiumPlusPotassium
                                    .derivative(state, params, input);
            return [v_old + dt*d_v, n_old + dt*d_n];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let frequencies: number[] = [];
            for (let input of inputs) {
                let lastLastSpike = undefined;
                let lastSpike = undefined;
                let intervals: number[] = [];
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.PersistentSodiumPlusPotassium.solve(newState, params, input, dt);
                    if (Neurons.PersistentSodiumPlusPotassium.spike(newState, params, input, dt)) {
                        lastLastSpike = lastSpike;
                        lastSpike = t;
                    }
                    if (lastLastSpike !== undefined) {
                        intervals.push(lastSpike - lastLastSpike);
                    }
                }
                if (lastLastSpike === undefined || lastSpike === undefined) {
                    frequencies.push(0);
                } else {
                    const frequency = 1 / (intervals.reduce((prev, curr)=>prev + curr)/intervals.length);
                    frequencies.push(frequency*1000);
                }
            }
            return frequencies;
        },
        nullCline: (params: number[], input: number) => {
            let [c, m, mk, n, nk, tau, e_leak, e_sodium, e_potassium, g_leak, g_sodium, g_potassium] = params;
            return [
                (v: number) => {
                    let m_inf = 1/(1 + Math.exp((m - v)/mk));
                    return (input - g_leak*(v - e_leak) - g_sodium*m_inf*(v - e_sodium) )
                          /(g_potassium*(v - e_potassium));
                },
                (v: number) => {
                    let n_inf = 1/(1 + Math.exp((n - v)/nk));
                    return n_inf;
                }
            ];
        },
        jaccobian: (state: number[], params: number[], input: number) => {
            let [v, n] = state;
            let [c, m_sodium, k_sodium, n_potassium, k_potassium, tau, e_leak, e_sodium, e_potassium, g_leak, g_sodium, g_potassium] = params;

            let m_infty = utils.boltzman((m_sodium - v)/k_sodium);
            let m_infty_dv =Math.exp((m_sodium - v)/k_sodium) / (k_sodium * (Math.exp((m_sodium - v)/k_sodium) + 1)**2);

            let n_infy = utils.boltzman((n - v)/n_potassium);
            let n_infy_dv = Math.exp((n_potassium - v)/k_potassium) / (k_potassium * (Math.exp((n_potassium - v)/k_potassium) + 1)**2);

            let dvdv = (- g_leak 
                        - g_sodium*(  m_infty 
                                    + (v - e_sodium)
                                      * m_infty_dv
                                   )
                        - g_potassium*n
                      )/c;

            let dvdn = -g_potassium*v;
            let dndv = n_infy_dv/tau;
            let dndn = -1/tau;

            return [[dvdv, dvdn],
                    [dndv, dndn]];
        },
        fixedPoints: (state: number[], params: number[], input: number) => {
            let [c, m, mk, n, nk, tau, e_leak, e_sodium, e_potassium, g_leak, g_sodium, g_potassium] = params;

            let xs = (new Array(20000)).fill(0)
                                       .map((_, i) => 100*(i/20000) - 80);
            let f = function (v: number) {
                let m_inf = 1/(1 + Math.exp((m - v)/mk));
                let n_inf = 1/(1 + Math.exp((n - v)/nk));
                return (input - g_leak*(v - e_leak) - g_sodium*m_inf*(v - e_sodium))
                      /(g_potassium*(v - e_potassium))
                      -n_inf;
            };
            return utils.bisection(xs, f)
                        .map((v: number) => [v, 1/(1 + Math.exp((n - v)/nk))]); 
        }
    }
    public static FitzHughNagumo: DynamicalNeuron = {
        equation: () => ["$ \\frac{dv}{dt} = v(a - v)(v - 1) - w + I $",
                         "$\\frac{du}{dt} = \\frac{b}{c}v$"],
        bifurcations: (state: number[], params: number[], input: number) => {
            let [,a, b] = params;
            let min = (-1 + a + (2/3)*b)*b;
            let max = (1 + a - (2/3)*b)/b;
            return [min, max];
        },
        spike: (state: number[], params?: number[], input?: number, dt?: number) => {
            // slightly tricky. We register a spike if it crosses the nullcline
            // in a region of the state space.
            let [fu, fw] = Neurons.FitzHughNagumo.nullCline(params, input);
            let [u, w] = state;
            if (u > 0.8 && w < fw(u)) {
                let [du, dw] = Neurons.FitzHughNagumo.derivative(state, params, input);
                if (w < fu(u) && w + dt*dw > fu(dt*du + u) ) {
                    return true;
                }
            }
            return false;
        },
        derivative: (state: number[], params: number[], input: number) => {
            let [a, b, c] = params;
            let [u_old, w_old] = state;
            let du = u_old*(a - u_old)*(u_old - 1) - w_old + input;
            let dw = b*u_old - c*w_old;
            return [du, dw];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let [u_old, w_old] = state;
            let [d_u, d_w] = Neurons.FitzHughNagumo.derivative(state, params, input);
            return [u_old + dt*d_u, w_old + dt*d_w];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let frequencies: number[] = [];
            for (let input of inputs) {
                let lastLastSpike = undefined;
                let lastSpike = undefined;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.FitzHughNagumo.solve(newState, params, input, dt);
                    if (Neurons.FitzHughNagumo.spike(newState, params, input, dt)) {
                        lastLastSpike = lastSpike;
                        lastSpike = t;
                    }
                    if (lastLastSpike !== undefined && lastSpike - lastLastSpike < 1) {
                        break;
                    }
                }
                if (lastLastSpike === undefined || lastSpike === undefined) {
                    frequencies.push(0);
                } else {
                    const frequency = 1 / (lastSpike - lastLastSpike);
                    frequencies.push(frequency*1000);
                }
            }
            return frequencies;
        },
        nullCline: (params: number[], input: number) => {
            let [a, b, c] = params;
            return [
                (u: number) => u*(a - u)*(u - 1) + input,
                (u: number) => b/c*u
            ];
        },
        jaccobian: (state: number[], params: number[], input: number) => {
            let [u, w] = state;
            let [a, b, c] = params;
            return [[2*u*a - a - 3*u**2 +2*u, -1],
                    [b, -c]];
        },
        fixedPoints: (state: number[], params: number[], input: number) => {
            let [fu, ] = Neurons.FitzHughNagumo.nullCline(params, input);
            let [a, b, c] = params;
            let roots = utils.solveCubic(-1, 1 + a, -a - (b/c), input);
            return roots.map((u, _) => [u, fu(u)]);
        }
    }
    public static IzhikevichNeuron: DynamicalNeuron = {
        equation: () => ["$\\frac{dv}{dt} = 0.04v^2 + 5v + 140 - u + I$",
                         "$\\frac{du}{dt} = a(bv - u)$",
                         "$if\\ v > 30mV\\ then \\begin{cases} v \\leftarrow c \\\\ u \\leftarrow u + d\\end{cases}$"
                        ],
                        
        bifurcations: (state: number[], params: number[], input: number) => {
            let [a, b, , ] = params;
            return [((-1*(5 - b)**2)/4*(0.04)) - 140, (((5 - b)**2)/4*(0.04)) - 140];
        },
        spike: (state: number[]) => state[0] >= 30,
        derivative: (state: number[], params: number[], input: number) => {
            let [a, b, , ] = params;
            let [v_old, u_old] = state;
            let v_new = 0.04*v_old**2 + 5*v_old + 140 - u_old + input;
            let u_new = a*(b*v_old - u_old);
            return [v_new, u_new];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let [v_old, u_old] = state;
            if (Neurons.IzhikevichNeuron.spike(state)) {
                let [, , c, d] = params;
                let v = c;
                let u = u_old + d;
                return [v, u];
            }
            let [d_v, d_u] = Neurons.IzhikevichNeuron.derivative(state, params, input);
            return [v_old + dt*d_v, u_old + dt*d_u];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let spikeCounts: number[] = [];
            for (let input of inputs) {
                let spikeCount: number = 0;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.IzhikevichNeuron.solve(newState, params, input, dt);
                    spikeCount += Neurons.IzhikevichNeuron.spike(newState) ? 1 : 0;
                }
                spikeCounts.push(spikeCount);
            }
            return spikeCounts;
        },
        nullCline: (params: number[], input: number) => {
            let [ , b, , ] = params;
            return [
                (v: number) => 0.04*v**2 + 5*v + 140 + input,
                (v: number) => b*v
            ];
        },
        jaccobian: (state: number[], params: number[], input: number) => {
            let [a, b, , ] = params;
            let [v, ] = state;
            return [[0.08*v + 5, -1],
                    [a*b       , -a]];
        },
        fixedPoints: (state: number[], params: number[], input: number) => {
            let [fv, ] = Neurons.IzhikevichNeuron.nullCline(params, input);
            let [a, b, , ] = params;
            let roots = utils.solveQuadratic(0.04, 5 - b, 140 + input);
            return roots.map((v, _) => [v, fv(v)]);
        }
    }
    public static PersistentSodium: DynamicalNeuron = {
        equation: () => ["$\\frac{dv}{dt}C=I - g_L(V-E_L)-g_{Na}m_{\\infty}(V)(V-E_{Na})$"],
        bifurcations: (state: number[], params: number[], input: number) => {
            let [a, b, , ] = params;
            return [((-1*(5 - b)**2)/4*(0.04)) - 140, (((5 - b)**2)/4*(0.04)) - 140];
        },
        spike: (state: number[], params: number[]) => state[0] >= 30 - 0.01,
        derivative: (state: number[], params: number[], input: number) => {
            let [c, e_leak, g_leak, e_sodium, g_sodium, m_sodium, k_sodium, reset] = params;
            let [v] = state;
            let m_infty = utils.boltzman((m_sodium - v)/k_sodium);
            let dv = (input - g_leak*(v - e_leak) - g_sodium*m_infty*(v - e_sodium))/c;
            return [dv];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let reset = params[params.length - 1];
            if (Neurons.PersistentSodium.spike(state, params)) {
                return [reset];
            } else {

            }
            let [dv] = Neurons.PersistentSodium.derivative(state, params, input);
            let [v_old] = state;
            return [v_old + dt*dv];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let frequencies: number[] = [];
            for (let input of inputs) {
                let lastLastSpike = undefined;
                let lastSpike = undefined;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.PersistentSodium.solve(newState, params, input, dt);
                    if (Neurons.PersistentSodium.spike(newState, params, input, dt)) {
                        lastLastSpike = lastSpike;
                        lastSpike = t;
                    }
                    if (lastLastSpike !== undefined && lastSpike - lastLastSpike < 1) {
                        break;
                    }
                }
                if (lastLastSpike === undefined || lastSpike === undefined) {
                    frequencies.push(0);
                } else {
                    const frequency = 1 / (lastSpike - lastLastSpike);
                    frequencies.push(frequency*1000);
                }
            }
            return frequencies;
        },
        nullCline: (params: number[], input: number) => {
            return [];
        },
        jaccobian: (state: number[], params: number[], input: number) => {
            let [c, e_leak, g_leak, e_sodium, g_sodium, m_sodium, k_sodium, reset] = params;
            let [v] = state;

            let m_infty = utils.boltzman((m_sodium - v)/k_sodium);
            let m_infty_dv =Math.exp((m_sodium - v)/k_sodium) / (k_sodium * (Math.exp((m_sodium - v)/k_sodium) + 1)**2);// m_infty*(1 - m_infty);
            return [[
                (-g_sodium*(m_infty + (v - e_sodium)*m_infty_dv) - g_leak)/c
            ]];
        },
        fixedPoints: (state: number[], params: number[], input: number) => {
            let xs = (new Array(20000)).fill(0)
                                       .map((_, i) => 150*(i/20000) - 80);
            let f = (x: number) => {
                return Neurons.PersistentSodium.derivative([x], params, input)[0];
            };
            return utils.bisection(xs, f).map((pnt) => [pnt]);
        }
    }
    public static IntegrateAndFire: Neuron = {
        equation: () => ["$\\frac{dv}{dt}\\tau_m=-v(t) + RI(t)$"],
        spike: (state: number[], params: number[]) => state[0] >= params[0],
        derivative: (state: number[], params: number[], input: number) => {
            let [threshold, resistance, time_constant, , resting] = params;
            let [v, ] = state;
            return [(-(v - resting) + input * resistance) / time_constant];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let [v_old, t_old] = state;
            let [threshold, resistance, time_constant, refractory, resting] = params;
            if (Neurons.IntegrateAndFire.spike(state, params)) {
                return [resting, refractory];
            } else if (t_old <= 0) {
                let [d_v] = Neurons.IntegrateAndFire.derivative(state, params, input);
                let v_new = v_old + dt* d_v;
                return [v_new, 0];
            } 
            return [v_old, t_old - dt];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let frequencies: number[] = [];
            for (let input of inputs) {
                let lastLastSpike = undefined;
                let lastSpike = undefined;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.IntegrateAndFire.solve(newState, params, input, dt);
                    if (Neurons.IntegrateAndFire.spike(newState, params, input, dt)) {
                        lastLastSpike = lastSpike;
                        lastSpike = t;
                    }
                    if (lastLastSpike !== undefined && lastSpike - lastLastSpike < 1) {
                        break;
                    }
                }
                if (lastLastSpike === undefined || lastSpike === undefined) {
                    frequencies.push(0);
                } else {
                    const frequency = 1 / (lastSpike - lastLastSpike);
                    frequencies.push(frequency*1000);
                }
            }
            return frequencies;           
        },
    }
    public static PoissonNeuron: Neuron = {
        equation: () => [
                         "$v = \\begin{cases} 1 \\text{ if } random() < r \\\\ 0 \\text{ otherwise } \\end{cases}$"],
        spike: (state: number[]) => (state[0] === 1),
        derivative: (state: number[], params: number[], input: number) => {
            return [];
        },
        solve: (state: number[], params: number[], input: number, dt: number) => {
            let rand = Math.random();
            let [r] = params;
            return [(rand <= r/1000*dt) ? 1 : 0];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let spikeCounts: number[] = [];
            for (let input of inputs) {
                let spikeCount: number = 0;
                let newState = state;
                for (let t=0; t<time; t+=dt) {
                    newState = Neurons.PoissonNeuron.solve(newState, params, input, dt);
                    spikeCount += Neurons.PoissonNeuron.spike(newState, params) ? 1 : 0;
                }
                spikeCounts.push(spikeCount);
            }
            return spikeCounts;
        },
    } 
    public static RateModelNeuron: Neuron = {
        equation: () => [""],
        spike: (state: number[]) => false,
        derivative: (state: number[], params: number[], input: number) => {
            let [_, a, b] = params;
            switch (params[0]) {
                case 0: {
                    return [Neurons.RateModels.reluDerivative(input, a, b)];
                }
                case 1: {
                    return [Neurons.RateModels.sigmoidDerivative(input, a, b)];
                }
            }
            return [0];
        },
        solve: (state: number[], params: number[], input: number) => {
            let [_, a, b] = params;
            switch (params[0]) {
                case 0: {
                    return [Neurons.RateModels.relu(input, a, b)];
                }
                case 1: {
                    return [Neurons.RateModels.sigmoid(input, a, b)];
                }
            }
            return [0];
        },
        fiCurve: (state: number[], params: number[], inputs: number[], dt: number, time: number) => {
            let [_, a, b] = params;
            switch (params[0]) {
                case 0: {
                    return inputs.map((I) => Neurons.RateModels.relu(I, a, b));
                }
                case 1: {
                    return inputs.map((I) => Neurons.RateModels.sigmoid(I, a, b));
                }
            }
            return [0];
        },           
    }
    public static RateModels = {
        relu: (x: number, a: number, b: number) => x > b ? a*(x - b) : 0,
        reluDerivative: (x: number, a: number, b: number) => x > -b ? a : 0,
        sigmoid: (x: number, a: number, b: number) => 1 / (1 + Math.exp(-a*(x - b))),
        sigmoidDerivative: (x: number, a: number, b: number) => {
            let tmpVal: number = Neurons.RateModels.sigmoid(x, a, b);
            return tmpVal * (1 - tmpVal);
        }
    }
}
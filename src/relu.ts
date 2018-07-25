import {ArtificialNeuron} from './neuron';

export class ReluNeuron extends ArtificialNeuron {

    constructor() {
        super();
    }

    solve(input: number): [number] {
        return [Math.max(0, input)];
    }

    derivative(input: number): [number] {
        return input > 0 ? [1] : [0];
    }
}
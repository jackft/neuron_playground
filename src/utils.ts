import * as numeric from 'numeric';

export type FixedPoint = {
    pnt: number[];
    type: string;
}

export type Margin = {
    left: number;
    right: number;
    top: number;
    bottom: number
}

export type MultiPoint = {
    x: number;
    y: number[];
};

export type Point = {
    x: number;
    y: number;
}

export function solveQuadratic(a: number, b: number, c: number): number[] {
    if (b**2 - 4*a*c < 0) {
        return [];
    }
    let sol1 = (-b + Math.sqrt(b**2 - 4*a*c))/(2*a);
    if (b == 0) {
        return [sol1];
    }
    let sol2 = (-b - Math.sqrt(b**2 - 4*a*c))/(2*a);
    return [sol1, sol2];
}

function cuberoot(x) {
    var y = Math.pow(Math.abs(x), 1/3);
    return x < 0 ? -y : y;
}

export function solveCubic(a, b, c, d) {
    if (Math.abs(a) < 1e-8) { // Quadratic case, ax^2+bx+c=0
        a = b; b = c; c = d;
        if (Math.abs(a) < 1e-8) { // Linear case, ax+b=0
            a = b; b = c;
            if (Math.abs(a) < 1e-8) // Degenerate case
                return [];
            return [-b/a];
        }

        var D = b*b - 4*a*c;
        if (Math.abs(D) < 1e-8)
            return [-b/(2*a)];
        else if (D > 0)
            return [(-b+Math.sqrt(D))/(2*a), (-b-Math.sqrt(D))/(2*a)];
        return [];
    }

    // Convert to depressed cubic t^3+pt+q = 0 (subst x = t - b/3a)
    var p = (3*a*c - b*b)/(3*a*a);
    var q = (2*b*b*b - 9*a*b*c + 27*a*a*d)/(27*a*a*a);
    var roots;

    if (Math.abs(p) < 1e-8) { // p = 0 -> t^3 = -q -> t = -q^1/3
        roots = [cuberoot(-q)];
    } else if (Math.abs(q) < 1e-8) { // q = 0 -> t^3 + pt = 0 -> t(t^2+p)=0
        roots = [0].concat(p < 0 ? [Math.sqrt(-p), -Math.sqrt(-p)] : []);
    } else {
        var D = q*q/4 + p*p*p/27;
        if (Math.abs(D) < 1e-8) {       // D = 0 -> two roots
            roots = [-1.5*q/p, 3*q/p];
        } else if (D > 0) {             // Only one real root
            var u = cuberoot(-q/2 - Math.sqrt(D));
            roots = [u - p/(3*u)];
        } else {                        // D < 0, three roots, but needs to use complex numbers/trigonometric solution
            var u = 2*Math.sqrt(-p/3);
            var t = Math.acos(3*q/p/u)/3;  // D < 0 implies p < 0 and acos argument in [-1..1]
            var k = 2*Math.PI/3;
            roots = [u*Math.cos(t), u*Math.cos(t-k), u*Math.cos(t-2*k)];
        }
    }

    // Convert back from depressed cubic
    for (var i = 0; i < roots.length; i++)
        roots[i] -= b/(3*a);

    return roots;
}

export function bisection(xs: number[], f: (x: number)=>number, n=1000, m=0.0001) {
    let roots = [];

    //get pairs of numbers
    let pairs = [];
    let prev = null;
    for(let i = 0; i<xs.length; i++) {
        let curr = xs[i];
        if (prev != null && Math.sign(f(prev)) != Math.sign(f(curr))) {
            pairs.push([prev, curr]);
        }
        prev = curr;
    }
    //approach root
    pairs.forEach(element => {
        let a: number,
            b: number;
        if (element[1] > element[0]) {
            a = element[0];
            b = element[1];
        } else {
            a = element[1];
            b = element[0];
        }
        for (let i = 0; i<n; i++) {
            let x = (b + a)/2;
            let y = f(x);
            if (y == 0 || (0 < y && y < m) || (m > y && y > 0)) {
                roots.push(x);
                break;
            }
            else if (y > 0) {
                b = x;
            } else {
                a = x;
            }
        }
        let x = (b + a)/2;
        let y = f(x);
        roots.push(x);
    });
    
    return roots;
}

export function boltzman(x) {
    return 1 / (1 + Math.exp(x));
}

export function eigen(jaccobian: number[][]) {
    return numeric.eig(jaccobian);
}

export function stability(matrix: number[][]): string {
    let result = Array<string>(matrix.length);
    let eigenValues: {x: number[], y: number[]} = numeric.eig(matrix).lambda;
    // check if all are real
    if (eigenValues.y === undefined || eigenValues.y.every((y) => y == 0)) {
        if (eigenValues.x.every((x) => x < 0)) {
            return "sink";
        } else if (eigenValues.x.every((x) => x > 0)) {
            return "source";
        } else {
            return "saddle";
        }
    } else {
        if (eigenValues.x.every((x) => x < 0)) {
            return "asymptotic sink";
        } else if (eigenValues.x.every((x) => x > 0)) {
            return "asymptotic source";
        }
    }
    return "?";
}

export function scaleElement(elem: HTMLElement, dWidth: number) {
    let sWidth = elem.scrollWidth;
    let scale = dWidth/sWidth;
    console.log(scale + " sWidth " + sWidth + " " + dWidth);
    if (scale < 1) {
        console.log(scale);
        elem.style.transform = `scale(${scale})`
        elem.style.transformOrigin = `0 0`;
    }
    //elem.style.webkitTransform = `scale${scale}`;
}
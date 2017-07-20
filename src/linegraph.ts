import {MultiPoint} from "./utilities";

type Margin = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

let defaultMargin: Margin = {left: 25, right: 5, top: 5, bottom: 25};

export class LineGraph {
    private svg: d3.Selection<any, any, any, any>;
    private width: number;
    private height: number;
    private margin: Margin;

    private paths: d3.Selection<any,any, any, any>[];
    private colors: string[];

    private leftAxis: any;
    private bottomAxis: any;

    private data: MultiPoint[];

    private xScale: d3.ScaleLinear<number, number>;
    private yScale: d3.ScaleLinear<number, number>;

    private fixedScale: boolean;

    constructor(svg: d3.Selection<any, any, any, any>, nLines: number, colors?: string[], scales?: number[][], margin?: Margin) {
        this.svg = svg;
                       
        if (colors) {
            this.colors = colors;
        }
        else {
            for (let i = 0; i < nLines; i++) {
                this.colors.push("steelblue");
            }
        }
        if (margin) {
            this.margin = margin;
        }
        else {
            this.margin = defaultMargin;
        }

        //set dimensions
        let totalWidth: number = +svg.attr("width");
        let totalHeight: number = +svg.attr("height");
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;

        let xDomain = [0, 0];
        let yDomain = [0, 0];
        if (scales) {
            this.fixedScale = true;
            xDomain = scales[0];
            yDomain = scales[1];
        }

        //add path
        this.paths = [];
        for (let i = 0; i < nLines; i++) {
            this.paths[i] = this.svg.append("g")
                                   .attr("width", this.width)
                                   .attr("height", this.height)
                                   .attr("transform",
                                         `translate(${this.margin.left}, ${this.margin.top})`)
                                   .append("path")
                                    .attr("stroke", this.colors[i])
                                    .attr("class", "line");
        }

        this.xScale = d3.scaleLinear()
                        .domain(xDomain)
                        .range([0, this.width]);
        this.yScale = d3.scaleLinear()
                        .domain(yDomain)
                        .range([this.height, 0]);
        
        let laxis = d3.axisLeft(this.yScale);
        let baxis = d3.axisBottom(this.xScale);
        this.leftAxis = this.svg.append("g")
                .attr("transform", 
                      `translate(${this.margin.left},${this.margin.top})`);
        this.leftAxis.call(laxis);
        this.bottomAxis = this.svg.append("g")
                .attr("transform", 
                      `translate(${this.margin.left},${this.height + this.margin.top})`);
        this.bottomAxis.call(baxis);

        this.svg.append("g")
                .attr("class", "extra")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                      `translate(${this.margin.left}, ${this.margin.top})`);
    }

    update(data: MultiPoint[]) {
        this.data = data;
        this.redraw();
    }


    private redraw() {
        if (!this.fixedScale){
            this.updateScales();
        }
        let getLine = (idx: number) => {
            return d3.line<MultiPoint>()
              .x(d => this.xScale(d.x))
              .y(d => this.yScale(d.y[idx]))
        };
        for (let i = 0; i < this.paths.length; i++) {
            this.paths[i]
                .datum(this.data)
                .attr("d", getLine(i))
                .attr("stoke-width", "2");
        }
    }

    public updateScales(xScale?: [number, number], yScale?: [number, number]) {
        let minX: number,
            maxX: number,
            minY: number,
            maxY: number;
        if (xScale && yScale) {
            minX = xScale[0];
            maxX = xScale[1];
            minY = yScale[0];
            maxY = yScale[1];
        } else {
            minX = this.data[0].x;
            maxX = this.data[0].x;
            minY = Math.min(...this.data[0].y);
            maxY = Math.max(...this.data[0].y);
            for (let i = 1; i < this.data.length; i ++) {
                let x = this.data[i].x,
                    y = this.data[i].y;
                if (minX > x) {
                    minX = x;
                }
                else if (maxX < x) {
                    maxX = x;
                }
                if (minY > Math.min(...y)) {
                    minY = Math.min(...y);
                }
                else if (maxY < Math.max(...y)) {
                    maxY = Math.max(...y);
                }
            }
        }

        this.xScale.domain([minX, maxX]);
        this.yScale.domain([minY, maxY]);

        let laxis = d3.axisLeft(this.yScale);
        let baxis = d3.axisBottom(this.xScale);
        this.leftAxis.call(laxis);
        this.bottomAxis.call(baxis);
    }

    reset() {
        this.data = [];
    }

    transplant() {
        return {svg: this.svg, xscale: this.xScale, yscale: this.yScale};
    }
}
import {Margin} from './utils';
import * as d3 from 'd3';

/*
 * This graph plots a simple line graph
 */
export class FieldGraph {

    public svg: d3.Selection<any, any, any, any>;
    public width: number;
    public height: number;
    public margin: Margin = {left: 45, right: 25, top: 20, bottom: 35};

    public color: string;

    public path: d3.Selection<any,any, any, any>;

    public separatrix: d3.Selection<any,any, any, any>;

    public nullClines: d3.Selection<any,any, any, any>;

    public vectorField: d3.Selection<any, any, any, any>;
    
    public fixedPoints: d3.Selection<any, any, any, any>;

    public leftAxis: any;
    public bottomAxis: any;

    public xScale: d3.ScaleLinear<number, number>;
    public yScale: d3.ScaleLinear<number, number>;

    public colorScale: d3.ScaleSequential<string>;

    constructor(svg: d3.Selection<any, any, any, any>,
                xDomain: [number, number],
                yDomain: [number, number],
                colorDomain: [number, number],
                xLabel: string,
                yLabel: string,
                title: string,
                color: string) {

        this.svg = svg;

        this.color = color;
                       
        //set dimensions
        let totalWidth: number = +svg.attr("width");
        let totalHeight: number = +svg.attr("height");
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;



        // groups
        // separatrix, i.e. the path along the basin(s) of attraction
        this.separatrix = this.svg.append("g")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                        `translate(${this.margin.left}, ${this.margin.top})`);


        // null clines
        this.nullClines = this.svg.append("g")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                        `translate(${this.margin.left}, ${this.margin.top})`);

        //add path
        this.path = this.svg.append("g")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                        `translate(${this.margin.left}, ${this.margin.top})`);

        // vector field
        this.vectorField = this.svg.append("g")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                        `translate(${this.margin.left}, ${this.margin.top})`);

        this.vectorField
            .append("svg:defs").append("svg:marker")
            .attr("id", `triangle_arrow`)
            .attr("refX", 2.0)
            .attr("refY", 2.0)
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("orient", "auto")
            .append("path")
            .attr("class", "vector")
            .attr("d", "M 0 0 4 2 0 4 1 2")
            .style("fill", "#666");

        // fixed point
        this.fixedPoints = this.svg.append("g")
                .attr("class", "fixedPoint")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                        `translate(${this.margin.left}, ${this.margin.top})`);
        
        // extra
        this.svg.append("g")
                .attr("class", "extra")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                      `translate(${this.margin.left}, ${this.margin.top})`);

        //scales
        this.xScale = d3.scaleLinear()
                        .domain(xDomain)
                        .range([0, this.width]);
        this.yScale = d3.scaleLinear()
                        .domain(yDomain)
                        .range([this.height, 0]);
        
        this.colorScale = d3.scaleSequential(d3.interpolateViridis)
                            .domain(colorDomain);
        //axes        
        let laxis = d3.axisLeft(this.yScale);
        this.leftAxis = this.svg.append("g")
                .attr("transform", 
                      `translate(${this.margin.left},${this.margin.top})`);
        this.leftAxis.call(laxis);

        let baxis = d3.axisBottom(this.xScale);
        this.bottomAxis = this.svg.append("g")
                .attr("transform", 
                      `translate(${this.margin.left},${this.height + this.margin.top})`);
        this.bottomAxis.call(baxis);
        //labels
        this.svg.append("text")
                .attr("transform", "rotate(90)")
                .style("text-anchor", "middle")
                .text("")

        this.svg.append("text")
                .attr("transform", "rotate(90)")
                .style("text-anchor", "middle")
                .text("")

        this.svg.append("text")
            .attr("x", (this.width / 2))             
            .attr("y", 0 - (this.margin.top / 2))
            .attr("text-anchor", "middle")  
            .style("font-size", "16px") 
            .text(title);


        this.svg.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
            .attr("transform", `translate(${this.margin.left/3}, ${this.height/2})rotate(-90)`)  // text is drawn off the screen top left, move down and out and rotate
            .attr("class", "axislabel")
            .attr("font-family", "Helvetica")
            .text(yLabel);

        this.svg.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
            .attr("transform", `translate(${(this.width + this.margin.left + this.margin.right)/2}, ${this.height + this.margin.bottom/2 + this.margin.top + 10})`) // centre below axis
            .attr("class", "axislabel")
            .attr("font-family", "Helvetica")
            .text(xLabel); 

    this.svg.append("text")
        .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
        .attr("transform", `translate(${(this.width + this.margin.left + this.margin.right)/2}, ${this.margin.top - 5})`) // centre below axis
        .attr("class", "axistitle")
        .attr("font-family", "Helvetica")
        .style("font-size", "16px")
        .text(title);

    }

    public updateFixedPoints(data: {x: number, y: number}[], types?: string[]) {
        let circle = this.fixedPoints
            .selectAll("circle")
            .data(data);
        circle
            .attr("cx", d => this.xScale(d.x))
            .attr("cy", d => this.yScale(d.y))
            .attr("r", 4)
            .style("fill", (d, i) => types[i].includes('sink')   ? "black" : "white");

        circle.exit().remove();
        circle.enter()
            .append("circle")
            .attr("cx", d => this.xScale(d.x))
            .attr("cy", d => this.yScale(d.y))
            .attr("r", 4)
            .style("fill", (d, i) => types[i].includes('sink')   ? "black" : "white")
            .style("stroke", "black")
            .style("stroke-width", 0.5);
    }

    public updateLine(data: {x: number, y: number}[]) {
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        let getLine = () => {
            return d3.line<{x: number, y: number}>()
                    //.defined(d => d.x <= maxX && d.x >= minX &&
                    //         d.y <= maxY && d.y >= minY)
                     .x(d => this.xScale(d.x))
                     .y(d => this.yScale(d.y))
        };
        this.path.selectAll("*").remove();
        this.path
                .append("path")
                .attr("class", "line")
                .datum(data)
                .attr("d", getLine())
                .attr("stoke-width", "0.5")
                .attr("stroke", this.color)
                .attr("fill", "none")
                .attr("class", "line")
                .attr("stroke-opacity", 0.7);
    }

    public updateSeparatrixArea(data: {x: number, y: number}[]) {
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        let getLine = () => {
            return d3.line<{x: number, y: number}>()
                    .defined(d => d.x <= maxX && d.x >= minX &&
                             d.y <= maxY && d.y >= minY)
                     .x(d => this.xScale(d.x))
                     .y(d => this.yScale(d.y))
        };
        this.separatrix
                .append("path")
                .attr("class", "line")
                .datum(data)
                .attr("d", getLine())
                .attr("stoke-width", "0.5")
                .attr("stroke-opacity", "0")
                .attr("fill", "#7777cc")
                .attr("fill-opacity", "0.5")
                .attr("class", "separatrix-area");
    }

    public updateSeparatrix(data: {x: number, y: number}[]) {
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        let getLine = () => {
            return d3.line<{x: number, y: number}>()
                    .defined(d => d.x <= maxX && d.x >= minX &&
                             d.y <= maxY && d.y >= minY)
                     .x(d => this.xScale(d.x))
                     .y(d => this.yScale(d.y))
        };
        this.separatrix.selectAll("*").remove();
        this.separatrix
                .append("path")
                .attr("class", "line")
                .datum(data)
                .attr("d", getLine())
                .attr("stoke-width", "0.5")
                .attr("stroke", '#6666bb')
                .attr("fill-opacity", "0")
                .attr("class", "line separatrix-line");
    }

    public updateVectorField(vectors: {x: number, y: number}[][], max?: number, color?: string) {

        //coordinates are x, y
        //vectors are radians, magnitude
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        max = typeof(max) === 'undefined' ? 2 : max;
        let getLine = () => {
            return d3.line<{x: number, y: number}>()
                    .x(d => this.xScale(d.x))
                    .y(d => this.yScale(d.y))
        };

        let vecs = this.vectorField.selectAll(".vector").data(vectors);

        vecs.attr("d", (data: {x: number, y: number}[],
                                idx: number) => getLine()(data));

        vecs.enter()
            .append("svg:defs").append("svg:marker")
            .attr("id", `triangle_arrow1`)
            .attr("refX", 2.0)
            .attr("refY", 2.0)
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("orient", "auto")
            .append("path")
            .attr("class", "vector-arrow")
            .attr("d", "M 0 0 4 2 0 4 1 2")
            .style("fill", "#666");
        vecs.enter()
            .append("path")
            .attr("class", "vector")
            .attr("d", (data: {x: number, y: number}[],
                        idx: number) => getLine()(data))
            .attr("stroke-width", "1px")
            .attr("fill", "none")
            .attr("stroke", "#666")
            .attr("marker-end", `url(#triangle_arrow1)`)
            .attr("markerUnits", "1");

        vecs.exit().remove();
    }

    public updateNullCline(nullClines: {x: number, y: number}[][]) {
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        let getLine = () => {
            return d3.line<{x: number, y: number}>()
                    .defined(d => d.x <= maxX && d.x >= minX &&
                             d.y <= maxY && d.y >= minY)
                    .x(d => this.xScale(d.x))
                    .y(d => this.yScale(Math.min(d.y, maxY)))
        };
        this.nullClines.selectAll("*").remove();
        for (let i=0; i < nullClines.length; i++) {
            this.nullClines
                .append("path")
                .attr("class", "line null-cline")
                .datum(nullClines[i])
                .attr("d", getLine())
                .attr("stoke-width", "2")
                .attr("stroke", "black")
                .attr("fill", "none")
                .attr("class", "line");
        }
    }

    public updateScales(data: {x: number, y: number}[]) {
        let minX: number,
            maxX: number,
            minY: number,
            maxY: number;
        minX = data[0].x;
        maxX = data[data.length-1].x;
        let ys = data.map((x) => x.y);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
        this.xScale.domain([minX, maxX]);
        this.yScale.domain([minY, maxY]);

        let laxis = d3.axisLeft(this.yScale);
        let baxis = d3.axisBottom(this.xScale);
        this.leftAxis.call(laxis);
        this.bottomAxis.call(baxis);
    }

    public contains(point: {x: number, y: number}) {
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        return minX <= point.x && point.x <= maxX &&
               minY <= point.y && point.y <= maxY;
    }

}
import {Margin} from './utils';
import * as d3 from 'd3';

/*
 * This graph plots a simple line graph
 */
export class MultiLineGraph {

    public svg: d3.Selection<any, any, any, any>;
    public width: number;
    public height: number;
    public margin: Margin = {left: 45, right: 25, top: 20, bottom: 35};

    public colors: string[];

    public paths: d3.Selection<any,any, any, any>[];
    public extra: d3.Selection<any,any, any, any>;
    
    public leftAxis: any;
    public bottomAxis: any;

    public xScale: d3.ScaleLinear<number, number>;
    public yScale: d3.ScaleLinear<number, number>;

    constructor(svg: d3.Selection<any, any, any, any>,
                numLines: number,
                xDomain: [number, number],
                yDomain: [number, number],
                xLabel: string,
                yLabel: string,
                title: string,
                colors: string[]) {

        this.svg = svg;

        this.colors = colors;
                       
        //set dimensions
        let totalWidth: number = +svg.attr("width");
        let totalHeight: number = +svg.attr("height");
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;

        //add path
        this.paths = [];
        for (let i = 0; i < numLines; i++) {
            this.paths.push(this.svg.append("g")
                            .attr("width", this.width)
                            .attr("height", this.height)
                            .attr("transform",
                                    `translate(${this.margin.left}, ${this.margin.top})`)
                            .append("path")
                            .attr("class", "line"));
        }


        //scales
        this.xScale = d3.scaleLinear()
                        .domain(xDomain)
                        .range([0, this.width]);
        this.yScale = d3.scaleLinear()
                        .domain(yDomain)
                        .range([this.height, 0]);
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

        // extra group for other uses
       
        this.extra = this.svg.append("g")
                .attr("class", "extra")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("transform",
                      `translate(${this.margin.left}, ${this.margin.top})`);


    this.svg.append("text")
        .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
        .attr("transform", `translate(${this.margin.left/3}, ${this.height - this.height/3})rotate(-90)`)  // text is drawn off the screen top left, move down and out and rotate
        .attr("font-family", "Helvetica")
        .attr("class", "axislabel")
        .text(yLabel);

    this.svg.append("text")
        .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
        .attr("transform", `translate(${(this.width + this.margin.left + this.margin.right)/2}, ${this.height + this.margin.bottom/2 + this.margin.top+10})`) // centre below axis
        .attr("font-family", "Helvetica")
        .attr("class", "axislabel")
        .text(xLabel); 

    this.svg.append("text")
        .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
        .attr("transform", `translate(${(this.width + this.margin.left + this.margin.right)/2}, ${this.margin.top - 5})`) // centre below axis
        .attr("font-family", "Helvetica")
        .style("font-size", "16px")
        .attr("class", "axistitle")
        .text(title); 
    }

    public update(data: {x: number, ys: number[]}[]) {
        //this.updateScales(data);
        let [minX, maxX] = this.xScale.domain();
        let [minY, maxY] = this.yScale.domain();
        let getLine = (i) => {
            return d3.line<{x: number, ys: number[]}>()
                    .defined(d => d.x <= maxX && d.x >= minX &&
                             d.ys[i] <= maxY && d.ys[i] >= minY)
                    .x(d => this.xScale(d.x))
                    .y(d => this.yScale(Math.min(d.ys[i], maxY)))
        };
        for (let i=0; i<this.paths.length; i++) {
            this.paths[i]
                .datum(data)
                .attr("d", getLine(i))
                .attr("stoke-width", "2")
                .attr("stroke", this.colors[i])
                .attr("fill", "none")
                .attr("class", "line multi-line")
                .attr("stroke-opacity", "0.5");
        }
        
    }

    public updateScales(data: {x: number, ys: number[]}[]) {
        let minX: number,
            maxX: number,
            minY: number,
            maxY: number;
        minX = data[0].x;
        maxX = data[data.length-1].x;
        let ys = [].concat.apply([], data.map((pnt) => pnt.ys));
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
        this.xScale.domain([minX, maxX]);
        this.yScale.domain([minY, maxY]);

        let laxis = d3.axisLeft(this.yScale);
        let baxis = d3.axisBottom(this.xScale);
        this.leftAxis.call(laxis);
        this.bottomAxis.call(baxis);
    }


}
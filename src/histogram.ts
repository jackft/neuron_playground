import {Margin} from './utils';
import * as d3 from 'd3';

/*
 * This graph plots a simple line graph
 */
export class Histogram {

    public svg: d3.Selection<any, any, any, any>;
    public width: number;
    public height: number;
    public margin: Margin = {left: 45, right: 25, top: 20, bottom: 35};

    public color: string;

    public hist: d3.Selection<any,any, any, any>;
    
    public leftAxis: any;
    public bottomAxis: any;

    public xScale: d3.ScaleLinear<number, number>;
    public yScale: d3.ScaleLinear<number, number>;

    constructor(svg: d3.Selection<any, any, any, any>,
                xDomain: [number, number],
                yDomain: [number, number],
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

        this.hist = this.svg.append("g")
                        .attr("width", this.width)
                        .attr("height", this.height)
                        .attr("transform",
                                `translate(${this.margin.left}, ${this.margin.top})`)

        //scales
        this.xScale = d3.scaleLinear()
                        .domain(xDomain)
                        .rangeRound([0, this.width]);
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
       
        this.svg.append("g")
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

    public update(data: number[]) {
        let N = data.length;
        let [minX, maxX] = this.xScale.domain();
        var bins = d3.histogram()
                     .domain([minX, maxX])
                     .thresholds(this.xScale.ticks(50))
                     (data);
        this.yScale = d3.scaleLinear()
                  .domain([0, d3.max(bins, function(d) { return d.length/N; })])
                  .range([this.height, 0]);
        let formatCount = d3.format(",.0f");
        this.hist.selectAll("*").remove();
        var bar = this.hist.selectAll(".bar")
          .data(bins)
          .enter().append("g")
            .attr("class", "bar")
            .attr("transform", d => "translate(" + this.xScale(d.x0) + "," + this.yScale(d.length/N) + ")");
        bar.append("rect")
            .attr("x", 1)
            .attr("width", this.xScale(bins[0].x1) - this.xScale(bins[0].x0) - 1)
            .attr("height", d => this.height - this.yScale(d.length/N))
            .attr("fill", this.color);
    }
}
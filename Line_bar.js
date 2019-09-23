'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function() {
    // Use the jQuery document ready signal to know when everything has been initialized
    $(document).ready(function() {
        // Tell Tableau we'd like to initialize our extension
        tableau.extensions.initializeAsync().then(function() {
            // Once the extension is initialized
            getContainerSize();
        });
    });

    var objHeight;
    var objWidth;

    function getContainerSize() {
        const dashboardName = tableau.extensions.dashboardContent.dashboard.name;

        console.log(tableau.extensions.dashboardContent.dashboard);

        let dashboard = tableau.extensions.dashboardContent.dashboard;
        let object = tableau.extensions.dashboardContent.dashboard;
            dashboard.objects.forEach(function (object) {
                // do something with the objects..
                //console.log("The object name is " + object.name)
                if (object.name == "LineBarTest") {
                    console.log("Width : " + object.size.width);
                    console.log("Height : " + object.size.height);

                    objWidth = object.size.width;
                    objHeight = object.size.height;
                }
            });

        // Get the worksheet
        const worksheetName = "SUCCESSFUL IMPRESSIONS";

        //Show the viz 
        //$('#choose_sheet_dialog').modal('toggle');
        loadSelectedMarks(worksheetName);
    }

    function loadSelectedMarks(worksheetName) {
        //Setup variables
        var viz, sheet, options;

        //Set the desired sheet to the selected sheet
        sheet = getSelectedSheet(worksheetName);

        //Set options for the getUnderlyingData call
        options = {
            maxRows: 0, // Max rows to return. Use 0 to return all rows
            ignoreAliases: false,
            ignoreSelection: true,
            includeAllColumns: false
        };

        //getUnderlyingData call
        sheet.getUnderlyingDataAsync(options).then(function(t){
           cleanData(t); //Call the cleanData function (maps and converts)
        });      
    }

    function cleanData(t) {

        //Set variables to pass to conversion function
        var data = t.data; //Data
        var dataCols = t.columns; //Column names
        
        var niceData = reduceToObjects(dataCols, data); //conversion call

        drawChart(niceData);
    }

    //convert to field:values convention
    function reduceToObjects(cols,data) {
        //Map column names from column data
        var fieldNameMap = $.map(cols, function(col) { return col.fieldName; });

        //Map the column names to the data
        var dataToReturn = $.map(data, function(d) {
            return d.reduce(function(memo, value, idx) {
            memo[fieldNameMap[idx]] = value.value; return memo;
            }, {});
        });

        return dataToReturn;
      
    }

    function getSelectedSheet(worksheetName) {
        // Go through all the worksheets in the dashboard and find the one we want
        return tableau.extensions.dashboardContent.dashboard.worksheets.find(function(sheet) {
            return sheet.name === worksheetName;
        });
    }

    function drawChart(data) {

        var margin = { left:40, right:5, top:20, bottom:30 };

        var width = (objWidth - margin.left - margin.right)*0.95,
            height = (objHeight - margin.top - margin.bottom)*0.93;

        var g = d3.select("#data_table_wrapper")
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                //.attr("style", "outline: thin solid red;")   //Outline
            .append("g")
                .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

            const tParser = d3.timeParse("%Y-%m-%d")

            console.log(data);

            // Clean data
            data.forEach(function(d) {
                d.Successful = +d.Successful; //Convert to number
                d.MonthDate = tParser(d.Month) //Convert to date object
            });

            var successPercByMonth = d3.nest()
                .key(function(d) { return d.Month; })
                .rollup(function(f){
                    return {
                        successRate: (d3.sum(f, function(g) {return g.Successful; }) / d3.sum(f, function(g) { return g.Attempted; }) * 100)
                    }
                })
                .entries(data);

            var successfulByMonth = d3.nest()
                .key(function(d) { return d.Month; })
                .rollup(function(f) {
                    return { 
                        totalSuccessful: d3.sum(f, function(g) { return g.Successful; }), 
                    }
                })
                .entries(data);

            successfulByMonth.sort(function(a,b){
                // Turn your strings into dates, and then subtract them
                // to get a value that is either negative, positive, or zero.
                return new Date(a.key) - new Date(b.key);
            });

            successPercByMonth.sort(function(a,b){
                // Turn your strings into dates, and then subtract them
                // to get a value that is either negative, positive, or zero.
                return new Date(a.key) - new Date(b.key);
            });

            // Y Scale
            var y = d3.scaleLinear()
                .domain([d3.max(successfulByMonth, function(d) { return d.value.totalSuccessful }),0])
                .range([0, height]);


            // Y2 Scale
            var y2 = d3.scaleLinear()
                .domain([100 ,0])
                //.domain([d3.max(successPercByMonth, function(d) { return d.value.successRate }) + 1 ,0])
                .range([0, height]);

            console.log(d3.max(successPercByMonth, function(d) { return d.value.successRate }));

            // X Scale
            var x = d3.scaleBand()
                .domain(successfulByMonth.map(function(d){ return tParser(d.key) }))
                .range([0, width])
                .padding(0.25);

            // X Axis
            var xAxisCall = d3.axisBottom(x)
                .tickFormat(d3.timeFormat("%m-%d"));

            g.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height +")")
                .call(xAxisCall)
            .selectAll("text")
                .attr("y", "10")
                .attr("text-anchor", "middle");

            // Y Axis
            var yAxisCall = d3.axisLeft(y)
                .tickFormat(d3.format("$.2s"));

            g.append("g")
                .attr("class", "y axis")
                .call(yAxisCall);

            // Bars
            var rects = g.selectAll("rect")
                .data(successfulByMonth);
             
            rects.enter()
                .append("rect")
                    .attr("y", function(d){ return y(d.value.totalSuccessful); }) 
                    .attr("x", function(d){ return x(tParser(d.key)) })
                    .attr("width", x.bandwidth)
                    .attr("height", function(d){ return height - y(d.value.totalSuccessful); })
                    .attr("fill", "lightskyblue");

            var formattedLabelText = d3.format("$,.0f");
            var formattedLabelPerc = d3.format(".0%");

            g.selectAll(".text")          
                .data(successfulByMonth)
                .enter()
                    .append("text")
                    .attr("class","label")
                    .attr("y", function(d){ return y(d.value.totalSuccessful) - 5; })
                    .attr("x", function(d){ return x(tParser(d.key)) })
                    .attr("dx", "3.0em")
                    .text(function(d){ return formattedLabelText(d.value.totalSuccessful); });

            // Add the line
            g.append("path")
              .datum(successPercByMonth)
              .attr("fill", "none")
              .attr("stroke", "orange")
              .attr("stroke-width", 3)
              //.attr("")
              .attr("d", d3.line()
                .x(function(d) { return x(tParser(d.key)) + x.bandwidth() / 2; })
                .y(function(d) { return y2(d.value.successRate) })
                )

            g.selectAll("dot")
                .data(successPercByMonth)
                .enter().append("circle")
                    .attr("cx", function(d, i) { return x(tParser(d.key)) + x.bandwidth() / 2; })
                    .attr("cy", function(d) { return y2(d.value.successRate) })
                    .attr("fill", "orange")
                    .attr("r", 3.5);

            g.append("g").selectAll("text")
                .data(successPercByMonth)
                    .enter().append("text")
                        .attr("x", function(d, i) { return x(tParser(d.key)) + (x.bandwidth() / 2) - 10; })
                        .attr("y", function(d) { return y2(d.value.successRate) - 10; })
                        .attr("fill", "black")
                        .text(function(d) { return formattedLabelPerc(d.value.successRate / 100); });

    }       
})();
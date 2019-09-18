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
                if (object.name == "HorizBarTest") {
                    console.log("Width : " + object.size.width);
                    console.log("Height : " + object.size.height);

                    objWidth = object.size.width;
                    objHeight = object.size.height;
                }
            });

        // Get the worksheet
        const worksheetName = "REVENUE (2)";

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
        $('#no_data_message').css('display', 'none');

        var margin = { left:40, right:15, top:5, bottom:30 };

        var width = (objWidth - margin.left - margin.right)*0.95,
            height = (objHeight - margin.top - margin.bottom)*0.98;

        var g = d3.select("#data_table_wrapper")
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                //.attr("style", "outline: thin solid red;")   //Outline
            .append("g")
                .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
/*
        // X Label
        g.append("text")
            .attr("y", height + 50)
            .attr("x", width / 2)
            .attr("font-size", "20px")
            .attr("text-anchor", "middle")
            .text("Date");

        // Y Label
        g.append("text")
            .attr("y", -60)
            .attr("x", -(height / 2))
            .attr("font-size", "20px")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .text("Revenue");
*/
            const tParser = d3.timeParse("%Y-%m-%d")

            // Clean data
            data.forEach(function(d) {
                d.Revenue = +d.Revenue; //Convert to number
                d.MonthDate = tParser(d.Month) //Convert to date object
            });

            var revenueByMonth = d3.nest()
                .key(function(d) { return d.Month; })
                .rollup(function(f) {
                    return { 
                        totalRevenue: d3.sum(f, function(g) { return g.Revenue; }), 
                    }
                })
                .entries(data);

            revenueByMonth.sort(function(a,b){
                // Turn your strings into dates, and then subtract them
                // to get a value that is either negative, positive, or zero.
                return new Date(b.key) - new Date(a.key);
            });

            // X Scale
            var x = d3.scaleLinear()
                .domain([0, d3.max(revenueByMonth, function(d) { return d.value.totalRevenue })])
                .range([0, width]);

            // Y Scale
            var y = d3.scaleBand()
                .domain(revenueByMonth.map(function(d){ return tParser(d.key) }))
                .range([0, height])
                .padding(0.2);

            // X Axis
            var xAxisCall = d3.axisBottom(x)
                //.tickFormat(function(d){ return "$" + d; });
                .tickFormat(d3.format("$.2s"));

            g.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height +")")
                .call(xAxisCall)
            .selectAll("text")
                .attr("y", "10")
                //.attr("x", "-5")
                .attr("text-anchor", "middle");

            // Y Axis
            var yAxisCall = d3.axisLeft(y)
                .tickFormat(d3.timeFormat("%m-%d"))

            g.append("g")
                .attr("class", "y axis")
                .call(yAxisCall);

            // Bars
            var rects = g.selectAll("rect")
                .data(revenueByMonth)
                
            rects.enter()
                .append("rect")
                    .attr("x", 0) 
                    .attr("y", function(d){ return y(tParser(d.key)) })
                    .attr("height", y.bandwidth)
                    .attr("width", function(d){ return x(d.value.totalRevenue); })
                    .attr("fill", "purple");

            var formattedLabelText = d3.format("$.s");
            g.selectAll(".text")          
                .data(revenueByMonth)
                .enter()
                    .append("text")
                    .attr("class","label")
                    .attr("x", 5)
                    .attr("y", function(d){ return y(tParser(d.key)) })
                    .attr("dy", ".75em")
                    .text(function(d){ return formattedLabelText(d.value.totalRevenue); });
    }       
})();
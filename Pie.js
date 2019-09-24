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

    var viewBy;

    function getContainerSize() {
        const dashboardName = tableau.extensions.dashboardContent.dashboard.name;

        console.log(tableau.extensions.dashboardContent.dashboard);

        let dashboard = tableau.extensions.dashboardContent.dashboard;
        let object = tableau.extensions.dashboardContent.dashboard;
            dashboard.objects.forEach(function (object) {
                // do something with the objects..
                //console.log("The object name is " + object.name)
                if (object.name == "PieTest") {
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
        
        sheet.getParametersAsync().then (
            function(p) {
                console.log(p); // I do this just to confirm what comes back.
                // In this case, p is an array of Parameter objects
                for(var i=0;i<p.length;i++){
                    // You can find the methods for the Parameter object in the Reference Guide
                    var p_name = p[i].name;
                    var p_value = p[i].currentValue; // This is DataValue object
                    
                    console.log(p_value);

                    //var p_actual_value = p.currentValue.value;
                    //var p_formatted_value = p.currentValue.formattedValue;
                    //console.log('Parameter ' + p_name + ' has the value ' + p_formatted_value);
                }
            });

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

        var margin = { left:40, right:15, top:20, bottom:30 };

        var width = (objWidth - margin.left - margin.right)*0.95,
            height = (objHeight - margin.top - margin.bottom)*0.93;

        console.log(data);

        var g = d3.select("#data_table_wrapper")
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                //.attr("style", "outline: thin solid red;")   //Outline
            .append("g")
                .attr("transform", "translate(" + (width / 2 + margin.left) + ", " + (height / 2) + ")");

        
        // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
        var radius = Math.min(width, height) / 2 - margin.left

        var successfulByNetwork = d3.nest()
                .key(function(d) { return d.Network; })
                .rollup(function(f) {
                    return { 
                        totalSuccessful: d3.sum(f, function(g) { return g.Successful; }), 
                    }
                })
                .entries(data);

        var dataArray = [];
            for (var key in successfulByNetwork) {

                dataArray.push({
                    name: successfulByNetwork[key].key,
                    value: successfulByNetwork[key].value.totalSuccessful
              })
            };

        console.log(dataArray);
        
        var color = d3.scaleOrdinal()
            .domain(dataArray)
            .range(d3.schemeSet2);

        var radius = Math.min(width, height) / 2 - margin.left

        var arc = d3.arc()
            .outerRadius(radius)
            .innerRadius(0);

        var pie = d3.pie()
            .value(function(d) { return d.value; });

        var arcs = g.selectAll("g.slice")
            .data(pie(dataArray))
            .enter()
                .append("g")
                .attr("class", "slice");

        arcs.append("path")
            .attr("fill", function(d, i) { return color(i); } )
            .attr("d", arc);

        arcs.append("text")
                .attr("transform", function(d) {
                    d.innerRadius = 0;
                    d.outerRadius = radius;
                    return "translate(" + arc.centroid(d) + ")";
            })
            .attr("text-anchor", "middle")
            .text(function(d, i) { return dataArray[i].value; });

        }       
})();
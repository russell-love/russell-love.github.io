'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function() {
    // Use the jQuery document ready signal to know when everything has been initialized
    $(document).ready(function() {
        // Tell Tableau we'd like to initialize our extension
        tableau.extensions.initializeAsync().then(function() {

            tableau.extensions.dashboardContent.dashboard.getParametersAsync().then(function (parameters) {
                parameters.forEach(function (p) {
                    p.addEventListener(tableau.TableauEventType.ParameterChanged, onParameterChange);
                });
            });

            // To get filter info, first get the dashboard.
            const dashboard = tableau.extensions.dashboardContent.dashboard;

            // Then loop through each worksheet and get its filters, save promise for later.
            dashboard.worksheets.forEach(function (worksheet) {
                console.log(worksheet);

                worksheet.getFiltersAsync().then( function (f) {
                    console.log(f);
                    f.addEventListener(tableau.TableauEventType.FilterChanged, onFilterChange)
                });
            });

            getContainerSize();
        });

    });

    

    var objHeight;
    var objWidth;

    var viewBy;

    function onFilterChange(filterChangeEvent) {
        filterChangeEvent.getFilterAsync().then(function (fil) {
            console.log(fil);
        });
    }

    function onParameterChange(parameterChangeEvent) {
        $('#data_table_wrapper').empty();

        parameterChangeEvent.getParameterAsync().then(function (param) {
            var p_name = param.name;
            var p_value = param.currentValue;
            var p_actual_value = p_value.value;
            var p_formatted_value = p_value.formattedValue;
            
            console.log('Parameter ' + p_name + ' has the value ' + p_formatted_value);
            viewBy = p_actual_value;
        });

        getContainerSize();
    }

    function getContainerSize() {
        const dashboardName = tableau.extensions.dashboardContent.dashboard.name;

        let dashboard = tableau.extensions.dashboardContent.dashboard;
        let object = tableau.extensions.dashboardContent.dashboard;
            dashboard.objects.forEach(function (object) {
                // do something with the objects..
                if (object.name == "PieTest") {
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

        var margin = { left:40, right:15, top:20, bottom:30 };

        var width = (objWidth - margin.left - margin.right)*0.95,
            height = (objHeight - margin.top - margin.bottom)*0.93;

        var g = d3.select("#data_table_wrapper")
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                //.attr("style", "outline: thin solid red;")   //Outline
            .append("g")
                .attr("transform", "translate(" + (width / 2 + margin.left) + ", " + (height / 2) + ")");

        
        // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
        var radius = Math.min(width, height) / 2 - margin.left

        switch (viewBy) {
            case "Network":
                var successfulBy = d3.nest()
                .key(function(d) { return d.Network; })
                .rollup(function(f) {
                    return { 
                        totalSuccessful: d3.sum(f, function(g) { return g.Successful; }), 
                    }
                })
                .entries(data);
            break;
            case "Brand":
                var successfulBy = d3.nest()
                .key(function(d) { return d.Brand; })
                .rollup(function(f) {
                    return { 
                        totalSuccessful: d3.sum(f, function(g) { return g.Successful; }), 
                    }
                })
                .entries(data);
            break;
            default:
                // execute default code block
        }
        
        var dataArray = [];
            for (var key in successfulBy) {

                dataArray.push({
                    name: successfulBy[key].key,
                    value: successfulBy[key].value.totalSuccessful
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
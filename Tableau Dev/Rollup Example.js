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

            tableau.extensions.dashboardContent.dashboard.worksheets.forEach(function (worksheet) {
                console.log(worksheet);
                worksheet.getFiltersAsync();
                worksheet.addEventListener(tableau.TableauEventType.FilterChanged, onFilterChange);

            });

            getContainerSize();
        });

    });


    var objHeight;
    var objWidth;

    var viewBy;

    function onFilterChange(filterChangeEvent) {
        filterChangeEvent.getFilterAsync().then(function (fil) {
            $('#data_table_wrapper').empty();
            getContainerSize();
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
                if (object.name == "RollupTest") {
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
        console.log("Drawchart");

        console.log(data);

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

        var rollupData = d3.rollups(data, v => d3.sum(v, d => d["Successful"]), d => d.Network, d => d.Brand);


        var root = d3.hierarchy([null, rollupData], ([, value]) => value)
            .sum(([, value]) => value)
            .sort((a, b) => b.value - a.value)

        console.log(root);

        // Variables

        var radius = Math.min(width, height) / 2;

        // Define a function that returns the color
        // for a data point. The input parameter
        // should be a data point as defined/created
        // by the partition layout.
        var color = function(d) {

            // This function builds the total
            // color palette incrementally so
            // we don't have to iterate through
            // the entire data structure.

            // We're going to need a color scale.
            // Normally we'll distribute the colors
            // in the scale to child nodes.
            var colors;

            // The root node is special since
            // we have to seed it with our
            // desired palette.
            if (!d.parent) {
                colors = d3.scaleOrdinal(d3.schemeCategory10);

                // White for the root node itself
                d.color = "#fff";

            } else if (d.children) {
                colors = d3.scaleOrdinal(d3.schemeDark2);

            }

            if (d.children) {

                // Now distribute those colors to
                // the child nodes. We want to do
                // it in sorted order, so we'll
                // have to calculate that. Because
                // JavaScript sorts arrays in place,
                // we use a mapped version.
                d.children.map(function(child, i) {
                        return {value: child.value, idx: i};
                    }).forEach(function(child, i) {
                            d.children[child.idx].color = colors(i);
                });
            }
            
            return d.color;
        };

        var color2 = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 1))

        // Data strucure
        var partition = d3.partition()
            .size([2 * Math.PI, radius]);

        // Size arcs
        partition(root);
        var arc = d3.arc()
            .startAngle(function (d) { return d.x0 })
            .endAngle(function (d) { return d.x1 })
            .innerRadius(function (d) { return d.y0 })
            .outerRadius(function (d) { return d.y1 });

        // Put it all together
        g.selectAll('path')
            .data(root.descendants())
                .enter().append('path')
                    .attr("display", function (d) { return d.depth ? null : "none"; })
                    .attr("d", arc)
                    .style("stroke", '#fff')
                    //.style("fill", d => { return color2(d.data[0]); });
                    .style("fill", d => { while (d.depth > 1) d = d.parent; return color2(d.data[0]); });
                    //.style("fill", color2);

        g.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
            .enter().append("text")
                .attr("transform", function(d) {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (d.y0 + d.y1) / 2;
                    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
                })
                .attr("dy", "0.35em")
                .text(d => d.data[0]);
            }       
})();
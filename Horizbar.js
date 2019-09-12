'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function() {
    // Use the jQuery document ready signal to know when everything has been initialized
    $(document).ready(function() {
        // Tell Tableau we'd like to initialize our extension
        tableau.extensions.initializeAsync().then(function() {
            // Once the extension is initialized, ask the user to choose a sheet
            showChooseSheetDialog();

            initializeButtons();
        });
    });

    /**
     * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
     */
    function showChooseSheetDialog() {
        // Clear out the existing list of sheets
        $('#choose_sheet_buttons').empty();

        // Set the dashboard's name in the title
        const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
        $('#choose_sheet_title').text(dashboardName);

        // The first step in choosing a sheet will be asking Tableau what sheets are available
        const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

        // Next, we loop through all of these worksheets add add buttons for each one
        worksheets.forEach(function(worksheet) {
            // Declare our new button which contains the sheet name
            const button = createButton(worksheet.name);

            // Create an event handler for when this button is clicked
            button.click(function() {
                // Get the worksheet name which was selected
                const worksheetName = worksheet.name;

                // Close the dialog and show the data table for this worksheet
                $('#choose_sheet_dialog').modal('toggle');
                loadSelectedMarks(worksheetName);
            });

            // Add our button to the list of worksheets to choose from
            $('#choose_sheet_buttons').append(button);
        });

        // Show the dialog
        $('#choose_sheet_dialog').modal('toggle');
    }

    function createButton(buttonTitle) {
        const button =
            $(`<button type='button' class='btn btn-default btn-block'>
      ${buttonTitle}
    </button>`);

        return button;
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
    
    function initializeButtons() {
        $('#show_choose_sheet_button').click(showChooseSheetDialog);
    }

    function getSelectedSheet(worksheetName) {
        // Go through all the worksheets in the dashboard and find the one we want
        return tableau.extensions.dashboardContent.dashboard.worksheets.find(function(sheet) {
            return sheet.name === worksheetName;
        });
    }

    function drawChart(data) {
        $('#no_data_message').css('display', 'none');
        
        var margin = { left:80, right:20, top:50, bottom:100 };

        var width = 600 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        var g = d3.select("#data_table_wrapper")
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

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
                .range([height, 0]);


            // Y Scale
            var y = d3.scaleBand()
                .domain(revenueByMonth.map(function(d){ return d.key }))
                .range([0, width])
                .padding(0.2);

            // X Axis
            var xAxisCall = d3.axisBottom(x)
                .tickFormat(function(d){ return "$" + d; });
            g.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height +")")
                .call(xAxisCall)
            .selectAll("text")
                .attr("y", "10")
                .attr("x", "-5")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-40)");

            // Y Axis
            var yAxisCall = d3.axisLeft(y);
            g.append("g")
                .attr("class", "y axis")
                .call(yAxisCall);

            // Bars
            var rects = g.selectAll("rect")
                .data(revenueByMonth)
                
            rects.enter()
                .append("rect")
                    .attr("x", 0) 
                    //.attr("x", function(d){ return x(d.value.totalRevenue); }) 
                    .attr("y", function(d){ return y(d.key) })
                    .attr("height", y.bandwidth)
                    .attr("width", function(d){ return height - x(d.value.totalRevenue); })
                    .attr("fill", "grey");
/*
            // X Scale
            var x = d3.scaleBand()
                .domain(revenueByMonth.map(function(d){ return d.key }))
                .range([0, width])
                .padding(0.2);

            // Y Scale
            var y = d3.scaleLinear()
                .domain([0, d3.max(revenueByMonth, function(d) { return d.value.totalRevenue })])
                .range([height, 0]);

            // X Axis
            var xAxisCall = d3.axisBottom(x);
            g.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height +")")
                .call(xAxisCall)
            .selectAll("text")
                .attr("y", "10")
                .attr("x", "-5")
                .attr("text-anchor", "end")
                .attr("transform", "rotate(-40)");

            // Y Axis
            var yAxisCall = d3.axisLeft(y)
                .tickFormat(function(d){ return "$" + d; });
            g.append("g")
                .attr("class", "y axis")
                .call(yAxisCall);

            // Bars
            var rects = g.selectAll("rect")
                .data(revenueByMonth)
                
            rects.enter()
                .append("rect")
                    .attr("y", function(d){ return y(d.value.totalRevenue); }) 
                    .attr("x", function(d){ return x(d.key) })
                    .attr("height", function(d){ return height - y(d.value.totalRevenue); })
                    .attr("width", x.bandwidth)
                    .attr("fill", "grey");
    */
    }
})();
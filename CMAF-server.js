/*
//
//  Simple HTTP server to serve pre-generated CMAF chunks using HTTP/1.1 chunked transfer encoding.
//
*/

// Settings
var debug = true;
var info = true;
var chunkDuration = 500;

var fs = require('fs');

var serveFromMemory = true; // Set to False to serve data from disk, True to serve it from RAM [only m4s files (segments)]
var no_of_qualities = 5;
var no_of_segments = 181;

var segmentFiles = new Array(no_of_qualities);
for (var i = 0; i < segmentFiles.length; i++) {
  segmentFiles[i] = new Array(no_of_segments);
}
var chunkPositions = new Array(no_of_qualities);
for (var i = 0; i < chunkPositions.length; i++) {
  chunkPositions[i] = new Array(no_of_segments);
}

if(serveFromMemory) {

	//Check if chunk positions are cached already
	var precalculateChunkPositions=true;
	try {
		if (fs.existsSync("precalculatedChunkPositions.json")) {
			precalculateChunkPositions=false;
		}
	} catch(err) {
		console.error(err)
	}

	//Load all files from the disk into the memory
	for (var i = 0; i < segmentFiles.length; i++) {
		for (var j = 1; j < segmentFiles[i].length; j++) {

			var filename = "2000/segment_" + i + "-" + j + ".m4s";
			segmentFiles[i][j] = fs.readFileSync(filename);


			if(precalculateChunkPositions) {


			    var positions = [0, 0, 0, 0, 0, 0]
			    var currentPos = 0;
			    
			    var data = segmentFiles[i][j];
			    for (var k = 0; k < (data.length-5); k++) {
			        var val1 = String.fromCharCode(data[k]);
			        var val2 = String.fromCharCode(data[k+1]);
			        var val3 = String.fromCharCode(data[k+2]);
			        var val4 = String.fromCharCode(data[k+3]);
			        if (val1 + val2 + val3 + val4 == "moof") {
			        	positions[currentPos] = k;
			        	currentPos++;
			        }
			    }
				chunkPositions[i][j] = positions;

			}

		}
	}

	if(precalculateChunkPositions) {
		fs.writeFile("precalculatedChunkPositions.json", JSON.stringify(chunkPositions), function(err) {
		    if(err) {
		        return console.log(err);
		    }
		});
	} else {
		var contents = fs.readFileSync("precalculatedChunkPositions.json");
		chunkPositions = JSON.parse(contents);
	}

}

var currentSegment = 1;
var segmentDuration = 2; //in seconds (for calculating availability....)
var streamStartTime = 0; //timestamp of the when the stream becomes available

var streamStartTime = process.argv[2];
if(debug) console.log("streamStartTime: " + streamStartTime);

var mime_types = {
	mp4: "video/mp4",
	m4s: "video/iso.segment",
	mpd: "application/dash+xml",
};

var url_parser = require('url');
var http = require('http');

http.createServer(function (req, res) {
    //res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Transfer-Encoding', 'chunked');

	var useIndex = false;
	var notFound = false;
	var fStat;

	var parsed_url = url_parser.parse(req.url, true);
	var filename = parsed_url.pathname.slice(1);
	var time = res.startTime = getTime();

	if (filename === "") {
		filename = "./";
	}
	try {	
		fStat = fs.statSync(filename);
	} catch(e) {
		notFound = true;
	}
	if (notFound || !fStat.isFile()) {
		if (fStat && fStat.isDirectory()) {
			var fIndexStat;
			try {	
				fIndexStat = fs.statSync(filename+require('path').sep+'index.html');
			} catch (e) {
				notFound = true;
			}
			if (fIndexStat) {
				notFound = false;
				useIndex = true;
			}
		} 
		if (notFound) {
			res.statusCode = 404;
			res.end("GPAC DASH Server (404): The page you requested "+filename+" was not found");
			return;
		}
	}
    
    if(info) console.log("Request for file: '" + filename + "' at UTC " + time);

	var ext = parsed_url.pathname.slice(-3);

	if (ext === "mpd" || ext === "mp4" || ext === "m4s") {
		res.statusCode = 200;
		res.setHeader("Content-Type", mime_types[ext]);
		res.setHeader("Server-UTC", time);
		if (ext === "m4s") {

			//check if current time is higher than segAvailabilityTime + segDuration

			if(debug) console.log("Date.now()/1000: " + Date.now()/1000 + ", streamStartTime: " + streamStartTime);

			var currentTime = ((Date.now()/1000) - streamStartTime);
			var currentSegmentAvailabilityTime = (currentSegment * segmentDuration);

			if(debug) console.log("currentTime: " + currentTime + ", currentSegmentAvailabilityTime: " + currentSegmentAvailabilityTime);

			if( currentTime >= currentSegmentAvailabilityTime ) {

				// Current time is higher than segAvailabilityTime + segDuration, so the entire CMAF segment can be fetched

				sendFile(res, filename, currentSegment);

			} else {

				// Entire CMAF segment is not ready yet, only available chunks will be fetched
				// Within sendChunks need to add function to schedule chunks based on current time? (eg if 2 chunks are already available they can be fetched)

				sendChunks(res, filename, currentSegment, currentTime, currentSegmentAvailabilityTime);

			}

			currentSegment++; // Keep track of segment number

		} else {
			sendAnyFile(res, filename);
		}
	} else {
		if (useIndex) {
			sendAnyFile(res, filename+require('path').sep+'index.html');
		} else {		
			sendAnyFile(res, filename);
		}
	}


}).listen(process.env.VMC_APP_PORT || 8080, null);

/*
// Send the entire file at once.
*/
function sendAnyFile(res, filename) {
    
    var buffer = fs.readFileSync(filename);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
    if(info) console.log("File [" + filename + "] sent");
    
}

/*
// Send the entire file at once (segments only).
*/
function sendFile(res, filename, segmentNumber) {
    
	if(serveFromMemory) {

		// Extract quality index and segment number from the filename eg 2000/segment_0-1.m4s
		var qualityIndex = parseInt(filename.charAt(13), 10);
		console.log("qualityIndex: " + qualityIndex);

	    res.setHeader('Content-Length', segmentFiles[qualityIndex][segmentNumber].length);
	    res.end(segmentFiles[qualityIndex][segmentNumber]);
	    if(info) console.log("File [" + filename + "] sent");


	} else {

	    var buffer = fs.readFileSync(filename);
	    res.setHeader('Content-Length', buffer.length);
	    res.end(buffer);
	    if(info) console.log("File [" + filename + "] sent");
	    
    }
}

/*
// Send the file using chunk encoding. The file must be a valid CMAF segment.
// CMAF chunks are mapped onto HTTP chunks.
*/
function sendChunks(res, filename, segmentNumber, currentTime, currentSegmentAvailabilityTime) {
    
    
    //Parse the file to find moof boxes and their positions in the file
    var positions = [0, 0, 0, 0, 0, 0] //temp solution - a dynamic data structure is needed here
    var currentPos = 0;
    
    var data;
    if(serveFromMemory) {
    	var qualityIndex = parseInt(filename.charAt(13), 10);
    	data = segmentFiles[qualityIndex][segmentNumber];
    	positions = chunkPositions[qualityIndex][segmentNumber];
    } else {
    	data = fs.readFileSync(filename);
	    var i;
	    for (i = 0; i < (data.length-5); i++) {
	        var val1 = String.fromCharCode(data[i]);
	        var val2 = String.fromCharCode(data[i+1]);
	        var val3 = String.fromCharCode(data[i+2]);
	        var val4 = String.fromCharCode(data[i+3]);
	        if (val1 + val2 + val3 + val4 == "moof") {
	        	positions[currentPos] = i;
	        	currentPos++;
	            if(debug) console.log(val1 + val2 + val3 + val4);
	        }
	    }
    }
    var i;

    if(debug) {
	    for (i = 0; i < positions.length; i++) {
	    	console.log("Pos [" + i + "]: " + positions[i]);
	   	}
    }

   	//Schedule chunks to be sent using found moof boxes and their positions
   	var last = false;
   	for (i = 0; i < positions.length; i++) {

   		if(i > 0 && positions[i] == 0) break;

   		var delay = 0;
   		var chunkAvailabilityTime = (currentSegmentAvailabilityTime-segmentDuration)+((i+1)*(chunkDuration/1000));
   		if(currentTime >= chunkAvailabilityTime) {
   			delay = 0;
   		} else {
   			delay = (chunkAvailabilityTime-currentTime)*1000;
   		}
   		if(debug) console.log("chunkAvailabilityTime: " + chunkAvailabilityTime + ", delay: " + delay);

		var beginPosition = positions[i];
		if(i == 0) beginPosition = 0;
		var endPosition = positions[i+1];
		if(endPosition == 0) {
			endPosition = data.length;
			last = true;
		}
		if(debug) console.log("Chunk[" + i + "]: begins at " + beginPosition + ", and ends at " + endPosition)

	    setTimeout(function(chunkData, isLast){

	    	if(isLast) {
	    		if(info) console.log("Sending the last chunk.");
	   			res.end(chunkData);
	    	} else {
	    		if(info) console.log("Sending a chunk.");
	   			res.write(chunkData);
	   		}

	    }, delay, data.slice(beginPosition, endPosition), last);

	}
    
}

function getTime() {
	var d = new Date;
	var n = d.getTime();
	return n; 
}

  const fs = require('fs');
  const http = require('http');
  const AWS = require('aws-sdk');

  const logLevel = 4;
  const numSimutaneusURLs = 10;
  
//  var sqs = new AWS.SQS({region : 'us-east-1'});
//  var queueName = 'https://sqs.us-east-1.amazonaws.com/678987013791/iiif_image_broker';
//  const iiifEndpoint = "http://3.93.39.120:8182"

  const region = process.env.AWS_REGION;
  const sqs = new AWS.SQS({region : region});
  const queueName = process.env.QUEUE_NAME;
  const iiifEndpoint = process.env.IIIF_ENDPOINT;

  var getURLs = function(imageData) {
    if (logLevel > 2) console.log("\n **** URLs *****");

    //Id
    var id = imageData["@id"];
    if (logLevel > 2) console.log("@id: " + id);
    
    //Original Image
    var imageWidth = imageData.width;
    var imageHeight = imageData.height;
    if (logLevel > 2) console.log("Image size: " + imageWidth + " x " + imageHeight);
    
    //Tile Config
    let tileWidth = imageData.tiles[0].width;
    let tileHeight = imageData.tiles[0].height;
    var scaleFactors = imageData.tiles[0].scaleFactors;
    if (logLevel > 2) console.log("Tile size: " + tileWidth + " x " + tileHeight);
    
    //Sizes
    var sizes = imageData.sizes;
    var numOfSizes = sizes.length;
    if (logLevel > 2) console.log("Number of Sizes: "+ numOfSizes);
    if (logLevel > 2) console.log("Sizes: "+ JSON.stringify(sizes));    
    
    //Scale and Levels
    var maxScaleFactor = Math.max.apply(null, scaleFactors);
    var maxLevel = Math.round(Math.log(maxScaleFactor) * Math.LOG2E);
    if (logLevel > 2) console.log("maxScaleFactor: " + maxScaleFactor);
    if (logLevel > 2) console.log("maxLevel: " + maxLevel);

    var level, iiifSize, iiifRegion, iiifTileX, iiifTileY, iiifTileW, iiifTileH;
    var x=0;
    var y=0;
    var urls = [];

    for(var level=0; level <= maxLevel; level++) {
        var iiifSize = 0;
        var iiifRegion = 0;
        var iiifTileX = 0; 
        var iiifTileY = 0;
        var iiifTileW = 0;
        var iiifTileH = 0;

        if (logLevel > 3)console.log ("level: " + level)

        while(true) {
            while(true) {
                scale = Math.pow( 0.5, maxLevel - level );
                levelWidth = Math.ceil( imageWidth * scale );
                levelHeight = Math.ceil( imageHeight * scale );                
                if (logLevel > 3)console.log("    x: " + x + " - y: " + y + " scale: " + scale + " - levelWidth: " + levelWidth + " - levelHeight: " + levelHeight);  
                
                iiifTileSizeWidth = Math.ceil( tileWidth / scale );
                iiifTileSizeHeight = Math.ceil( tileHeight / scale );
                if (logLevel > 3)console.log ("    tileSizeWidth: " + iiifTileSizeWidth + " - tileSizeHeight: " + iiifTileSizeHeight );  
                if ( levelWidth < tileWidth && levelHeight < tileHeight ){
                    if (levelWidth  === imageWidth) {
                        iiifSize = "full";
                    } else {
                        iiifSize = levelWidth  + ","
                    }
                    iiifRegion = "full";
                } else {
                    iiifTileX = x * iiifTileSizeWidth;
                    iiifTileY = y * iiifTileSizeHeight;
                    iiifTileW = Math.min( iiifTileSizeWidth, imageWidth - iiifTileX );
                    iiifTileH = Math.min( iiifTileSizeHeight, imageHeight - iiifTileY );
                    if ( x === 0 && y === 0 && iiifTileW === imageWidth && iiifTileH === imageHeight ) {
                        iiifRegion = "full";
                    } else {
                        iiifRegion = [ iiifTileX, iiifTileY, iiifTileW, iiifTileH ].join( ',' );
                    }
                    iiifSizeW = Math.ceil( iiifTileW * scale );
                    iiifSizeH = Math.ceil( iiifTileH * scale );
                    if (iiifSizeW === imageWidth) {
                        iiifSize = "full";
                    } else {
                        iiifSize = iiifSizeW + ","
                    }   
                }
                
                console.log("    iiifSize: " + iiifSize + " - iiifRegion: " + iiifRegion);
                if ((x > 0 && iiifTileW <= 0) || iiifTileH <= 0) {
                    x=0;                    
                    if (logLevel > 3)console.log("break X");
                    break;
                }
                var url =  id + "/" + iiifRegion + "/" + iiifSize+ "/0/default.jpg";
                urls.push(url);
                if (logLevel > 2)console.log("    url: " + url);
                x++;
            }
            if (iiifTileH <= 0) {
                y=0;                    
                if (logLevel > 3)console.log("break Y");
                break;
            }
            y++;
        }    
    }
    
    return urls; 
}

var pushSQSMsg = function(message) {
    var msg = {}
    msg.urls = message;
    console.log('urls to be pushed: ' + JSON.stringify(msg));
    var params = {
      MessageBody: JSON.stringify(msg),
      QueueUrl: queueName
    };
    try {
        sqs.sendMessage(params).promise();
    } catch(err) {
        console.log(err);
    };
}

var sendProcessingMsgs = function(urls) {
    var msgUrl = [];
    for(var i=0; i<urls.length; i++) {
        msgUrl.push(urls[i]);
        if (((i+1) % numSimutaneusURLs) === 0) {
            pushSQSMsg(msgUrl,0);
            msgUrl = [];
        }
    }
    if (msgUrl.length > 0) {
        pushSQSMsg(msgUrl, 1);
    }
}

var processImageFromFile = function(imageName) {
    let rawdata = fs.readFileSync(imageName);
    let imageInfo = JSON.parse(rawdata);
    var urls = getURLs(imageInfo);
    if (logLevel > 2) console.log(JSON.stringify(urls));
}

var processImage = function(imageName) {
    const urlServer = iiifEndpoint + '/iiif/2/' + imageName +'/info.json';
    console.log("Retrieving info data from: " + urlServer);
    http.get(urlServer, (resp) => {
      let data = '';
    
      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });
    
      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        if (logLevel > 3) console.log(JSON.parse(data));
        var urls = getURLs(JSON.parse(data));
        if (logLevel > 2) console.log("*** URLs***");
        if (logLevel > 2) console.log(JSON.stringify(urls));
        sendProcessingMsgs(urls);
      });
    }).on("error", (err) => {
        console.log(err);
        context.done('error', "ERROR read info.json");  // ERROR with message
    });
}

  var context;
  exports.handler = function(event, cont) {
    context = cont;
    var imageName = event.Records[0].s3.object.key;
    console.log("imageName: " + imageName);
    processImage(imageName);

};


const http = require('http');
  
var callServer = function(url) {
    console.log("calling: " + url);
    http.get(url, (resp) => {

      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        console.log("receiving data ("+ url  + ")....");
      });
    
      // The whole response has been received. Print out the result.
      resp.on('end', () => {
          console.log("finished: " + url);
      });
    }).on("error", (err) => {
        console.log(err);
        context.done('error', "ERROR read accessing url: " + url);  // ERROR with message
    });
}

exports.handler = function(event, cont) {
    console.log(event);
    for (var i=0; i < event.Records.length; i++){
      var body = JSON.parse(event.Records[i].body);
      var urls = body.urls
      console.log(urls);
      urls.forEach(callServer);  
    } 
};
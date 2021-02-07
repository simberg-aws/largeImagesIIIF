# largeImagesIIIF

#Installing

Installing AWS CDK [tutorial](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html).

#Deployment

- Get the project from github
- Go to cdk directory
- Enter: *>cdk deploy*
- Save the **LargeImagesCdkStack.ELBURL** in the Output section, that is the URL to access your server

#Adding new images
- Go to S3 console (web)
- Find the bucket *largeimagescdkstack-imagesourcebucket<ID>*
- Upload the image
- The system will trigger a Lambda to create the tiles
- The new tiles will be saved inside of *largeimagescdkstack-imagecachebucket<ID>* bucket
- The tiles can take a few minutes to be processed, the system has a protection to not overload the production servers

#Visualizing the images
- Go to *clients* directory
- Edit the file *visualize_with_openseadragon.html"
-    *"<REPLACE_SERVER_IP:PORT>/iiif/2/<IMAGE_NAME>/info.json"*
-    Replace **<REPLACE_SERVER_IP:PORT>** with the **LargeImagesCdkStack.ELBURL** from the deployment fase
-    Replace **<IMAGE_NAME>** with the image name, including the extention
-    Example: *http://Large-MyFar-21312312321323.us-east-1.elb.amazonaws.com:8182/iiif/2/im1.tif/info.json*

#TODO List
- Add Cloudfront
- Review network
- Move to HTTPS and test with port 443







import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import { Aws, CfnOutput, Fn, StringConcat, Tag, Tags } from '@aws-cdk/core';
import { S3EventSource, SqsEventSource } from '@aws-cdk/aws-lambda-event-sources'

export class LargeImagesCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Config
    const NUM_AZS = 2;
    const NUM_OF_TASKS = 3;
    const CPU_UNITS_CONTAINER = 2048;
    const MEMORY_UNITS_CONTAINER = 4096;
    const IIIF_PORT = 8182;
    const LAMBDA_TIMEOUT = 90; //seconds
    const LAMBDA_PROCESSOR_CONCURRENT = 2; //Number of concurrent lamba processing images
    const SQS_EVENT_BATCH_SIZE = 5; //number max of messages rendenred by the LAMBDA_PROCESSOR via BATCH
    
    Tags.of(this).add("billing-group", "iiif");
    const stringConcat = new StringConcat;
    
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: NUM_AZS
    });


    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc
    });
 
    //IIIF User
    const iiifS3User = new iam.User( this, 'iiifUser', {
    });

    const accessKeyIiifUser = new iam.CfnAccessKey(this, 'iiifUserAccessKey', {
      userName: iiifS3User.userName
    });

    //Image Source Bucket
    const imageSourceBucket = new s3.Bucket(this, "imageSourceBucket", {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    imageSourceBucket.grantRead(iiifS3User);

    //Image Cache Bucket
    const imageCacheBucket = new s3.Bucket(this, "imageCacheBucket", {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    imageCacheBucket.grantReadWrite(iiifS3User);


    //ECS Service
    const ecsService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
      cluster: cluster,
      cpu: CPU_UNITS_CONTAINER,
      desiredCount: NUM_OF_TASKS,
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry("public.ecr.aws/f4r5b0m7/iiif-aws-solution-poc"), 
        containerPort:IIIF_PORT,
        environment: {
          S3SOURCE_ACCESS_KEY_ID: accessKeyIiifUser.ref,
          S3SOURCE_SECRET_KEY: accessKeyIiifUser.attrSecretAccessKey,
          S3SOURCE_ENDPOINT: stringConcat.join(stringConcat.join("https://s3.", this.region),".amazonaws.com"),
          S3SOURCE_BASICLOOKUPSTRATEGY_BUCKET_NAME: imageSourceBucket.bucketName,
          S3CACHE_ACCESS_KEY_ID: accessKeyIiifUser.ref,
          S3CACHE_SECRET_KEY: accessKeyIiifUser.attrSecretAccessKey,
          S3CACHE_ENDPOINT: stringConcat.join(stringConcat.join("https://s3.", this.region),".amazonaws.com"),
          S3CACHE_BUCKET_NAME: imageCacheBucket.bucketName
        }
      },
      memoryLimitMiB: MEMORY_UNITS_CONTAINER,
      publicLoadBalancer: true,
      listenerPort:IIIF_PORT
    })

    const iiifImgPreprocessQueue = new sqs.Queue(this, 'iiifImgPreprocessQueue', {
      visibilityTimeout: cdk.Duration.seconds(900)
    });

    // defines an AWS Lambda resource
    const iiifImgPreprocessLambda = new lambda.Function(this, 'iiifImgPreprocess', {
      runtime: lambda.Runtime.NODEJS_12_X,    
      code: lambda.Code.fromAsset('lambda/pre'),  // code loaded from "lambda" directory
      handler: 'iiifImgPreprocess.handler',
      timeout: cdk.Duration.seconds(LAMBDA_TIMEOUT),
      environment: {
        'QUEUE_NAME': iiifImgPreprocessQueue.queueUrl,
        'IIIF_ENDPOINT': "http://" + ecsService.loadBalancer.loadBalancerDnsName + ":" + IIIF_PORT
      }  
    });
    
    const iiifImgProcessLambda = new lambda.Function(this, 'iiifImgProcess', {
      runtime: lambda.Runtime.NODEJS_12_X,    
      code: lambda.Code.fromAsset('lambda/pos'),  // code loaded from "lambda" directory
      handler: 'iiifImgProcessor.handler',
      timeout: cdk.Duration.seconds(LAMBDA_TIMEOUT),
      reservedConcurrentExecutions: LAMBDA_PROCESSOR_CONCURRENT,
      environment: {
        'QUEUE_NAME': iiifImgPreprocessQueue.queueUrl,
        'IIIF_ENDPOINT': "http://" + ecsService.loadBalancer.loadBalancerDnsName + ":" + IIIF_PORT
      }  
    });

    iiifImgPreprocessLambda.addEventSource(new S3EventSource(imageSourceBucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
    }));
    iiifImgPreprocessQueue.grantSendMessages(iiifImgPreprocessLambda);
    iiifImgProcessLambda.addEventSource(new SqsEventSource(iiifImgPreprocessQueue, {
      batchSize: SQS_EVENT_BATCH_SIZE
    }));

    new CfnOutput(this, 'Region', { value: this.region});
    new CfnOutput(this, 'IIIF Username', { value: iiifS3User.userName});
    new CfnOutput(this, 'Image Source Bucket', { value: imageSourceBucket.bucketName});
    new CfnOutput(this, 'ELB URL', { value: stringConcat.join("http://" + ecsService.loadBalancer.loadBalancerDnsName, ":" + IIIF_PORT )});
  }
}


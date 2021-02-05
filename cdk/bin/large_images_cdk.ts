#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LargeImagesCdkStack } from '../lib/large_images_cdk-stack';

const app = new cdk.App();
new LargeImagesCdkStack(app, 'LargeImagesCdkStack');
